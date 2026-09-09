// Frees the Playwright e2e ports before a test run so orphaned servers
// left behind by aborted runs (Ctrl+C) can't squat them and cause
// mysterious hangs or "port already used" failures.
//
// Safety: only LISTENING sockets on exactly these e2e-dedicated ports are
// touched (TIME_WAIT and other ports are ignored). Exits non-zero when a
// port stays occupied, so the failure is loud instead of a hung suite.
import { execFileSync, execSync } from 'node:child_process';

const PORTS = [8010, 5180];

function listeningPids(port) {
    try {
        if (process.platform === 'win32') {
            const out = execSync(`netstat -ano | findstr :${port}`, {
                encoding: 'utf8',
                windowsHide: true,
            });
            const pids = new Set();
            for (const line of out.split('\n')) {
                const parts = line.trim().split(/\s+/);
                // TCP    127.0.0.1:8010    0.0.0.0:0    LISTENING    1234
                if (
                    parts.length >= 5 &&
                    parts[0] === 'TCP' &&
                    parts[3] === 'LISTENING' &&
                    parts[1].endsWith(`:${port}`)
                ) {
                    const pid = Number(parts[4]);
                    if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
                        pids.add(pid);
                    }
                }
            }
            return [...pids];
        }
        const out = execSync(`lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf8' });
        return out
            .split('\n')
            .map((entry) => Number(entry.trim()))
            .filter((pid) => Number.isFinite(pid) && pid > 0 && pid !== process.pid);
    } catch {
        return [];
    }
}

function killPid(pid) {
    if (process.platform === 'win32') {
        execFileSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' });
    } else {
        execFileSync('kill', ['-9', String(pid)]);
    }
}

function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

let failed = false;
for (const port of PORTS) {
    const occupants = listeningPids(port);
    if (occupants.length === 0) {
        console.log(`[free-e2e-ports] port ${port} is free.`);
        continue;
    }
    console.log(`[free-e2e-ports] port ${port} occupied by PID(s) ${occupants.join(', ')} — killing…`);
    for (const pid of occupants) {
        try {
            killPid(pid);
        } catch (error) {
            console.error(`[free-e2e-ports] could not kill PID ${pid}: ${error.message}`);
        }
    }
    let stillThere = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
        sleep(500);
        stillThere = listeningPids(port);
        if (stillThere.length === 0) break;
    }
    if (stillThere.length > 0) {
        console.error(
            `[free-e2e-ports] port ${port} is still occupied by PID(s) ${stillThere.join(', ')}. ` +
                `Kill them manually, then re-run.`
        );
        failed = true;
    } else {
        console.log(`[free-e2e-ports] port ${port} is free.`);
    }
}

process.exit(failed ? 1 : 0);
