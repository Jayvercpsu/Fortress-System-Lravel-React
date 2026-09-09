import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { laravelEnv, playwrightDatabasePath } from './support/laravel-env';
import { TEST_BASE_URL, VITE_URL } from './support/constants';

const snapshotPath = path.resolve(process.cwd(), 'database/playwright.snapshot.sqlite');
const snapshotHashPath = path.resolve(process.cwd(), 'database/.playwright-snapshot.hash');

function runArtisan(args: string[]) {
    execFileSync('php', ['artisan', ...args], {
        cwd: process.cwd(),
        env: laravelEnv,
        stdio: 'inherit',
    });
}

function hashFile(filePath: string, hash: crypto.Hash): void {
    hash.update(fs.readFileSync(filePath));
}

// Fail fast when the test servers Playwright just booted are unhealthy.
// A broken Vite transform (e.g. node_modules out of sync after a pull
// without `npm install`) or a broken app boot otherwise surfaces much
// later as mysterious per-test timeouts on elements that never render.
async function assertWebServersHealthy(): Promise<void> {
    const checks = [
        { name: 'Laravel test server', url: `${TEST_BASE_URL}/login` },
        { name: 'Vite dev server (app bundle)', url: `${VITE_URL}/resources/js/app.jsx` },
    ];
    for (const check of checks) {
        let status = 0;
        try {
            const response = await fetch(check.url, {
                redirect: 'manual',
                signal: AbortSignal.timeout(60000),
            });
            status = response.status;
            await response.arrayBuffer().catch(() => undefined);
        } catch (error) {
            throw new Error(
                `[global-setup] ${check.name} is not reachable at ${check.url}: ` +
                    `${error instanceof Error ? error.message : error}. ` +
                    `Kill stale dev servers and re-run.`
            );
        }
        if (status >= 500) {
            throw new Error(
                `[global-setup] ${check.name} errored (HTTP ${status}) at ${check.url}. ` +
                    `For the app bundle this usually means node_modules is out of sync — ` +
                    `run \`npm install\` and re-run.`
            );
        }
    }
}

function currentSchemaHash(): string {    const hash = crypto.createHash('sha256');
    const migrationsDir = path.resolve(process.cwd(), 'database/migrations');
    for (const file of fs.readdirSync(migrationsDir).sort()) {
        const full = path.join(migrationsDir, file);
        if (fs.statSync(full).isFile()) {
            hash.update(file);
            hashFile(full, hash);
        }
    }
    for (const fixture of ['tests/e2e/fixtures/test-data.yml', 'tests/e2e/fixtures/load-test-data.php']) {
        hashFile(path.resolve(process.cwd(), fixture), hash);
    }
    return hash.digest('hex');
}

export default async function globalSetup() {
    const databasePath = playwrightDatabasePath;

    // Fail fast when the test servers Playwright just booted are unhealthy.
    // A broken Vite transform (e.g. node_modules out of sync after a pull
    // without `npm install`) or a broken app boot otherwise surfaces much
    // later as mysterious per-test timeouts on elements that never render.
    await assertWebServersHealthy();

    // Fast path: when migrations and fixtures are unchanged since the last
    // run, restore the previously built database instead of migrating and
    // seeding from scratch. Restoring at the START of every run also means
    // a dirty database left by an interrupted run can never leak in.
    try {
        const wanted = currentSchemaHash();
        const stored = fs.existsSync(snapshotHashPath)
            ? fs.readFileSync(snapshotHashPath, 'utf8').trim()
            : '';
        if (wanted === stored && fs.existsSync(snapshotPath)) {
            for (const file of [
                databasePath,
                `${databasePath}-wal`,
                `${databasePath}-shm`,
                `${databasePath}-journal`,
            ]) {
                fs.rmSync(file, { force: true });
            }
            fs.copyFileSync(snapshotPath, databasePath);
            console.log('[global-setup] Restored playwright database from snapshot.');
            return;
        }
    } catch {
        // Any snapshot problem falls through to a full rebuild below.
    }

    // Start every run from a completely clean slate: the previous playwright
    // database (and any sqlite journal sidecar files) is removed so that ALL
    // test data comes solely from tests/e2e/fixtures/test-data.yml, rebuilt
    // through migrations + the YAML loader below.
    for (const file of [
        databasePath,
        `${databasePath}-wal`,
        `${databasePath}-shm`,
        `${databasePath}-journal`,
    ]) {
        fs.rmSync(file, { force: true });
    }

    // Create an empty sqlite file so the sqlite driver can connect, then let
    // migrations build the schema fresh.
    fs.writeFileSync(databasePath, '');

    // Run migrations only - test data comes from YAML fixtures
    // The YAML file at tests/e2e/fixtures/test-data.yml is the single source of truth
    runArtisan(['migrate:fresh', '--force']);

    // Seed the playwright database entirely from test-data.yml (no seeder class,
    // no migration changes). The loader is a plain PHP bootstrap that reads the
    // YAML fixture and inserts rows against the dedicated sqlite database.
    execFileSync('php', ['tests/e2e/fixtures/load-test-data.php'], {
        cwd: process.cwd(),
        env: laravelEnv,
        stdio: 'inherit',
    });

    // Snapshot the pristine database for the fast path on the next run.
    try {
        fs.copyFileSync(databasePath, snapshotPath);
        fs.writeFileSync(snapshotHashPath, currentSchemaHash());
        console.log('[global-setup] Saved playwright database snapshot.');
    } catch {
        // Snapshot failure is non-fatal; the next run simply rebuilds.
    }
}
