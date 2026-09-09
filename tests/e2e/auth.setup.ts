import fs from 'node:fs';
import path from 'node:path';
import { test as setup } from '@playwright/test';
import { ACCOUNTS, AccountKey, RoleKey, TEST_BASE_URL } from './support/constants';
import { AUTH_STATE_DIR, authStatePath, loginAs } from './support/auth';

// Logs in once per role and persists the session cookies. Every spec's
// loginAs() call then restores cookies instead of driving the login form,
// which removes ~90 full UI logins from a suite run. co_foreman never logs
// in via loginAs (excluded from RoleKey), so it is skipped here; if a
// future test needs it, loginAs falls back to the UI login on its own.
const SETUP_ROLES = (Object.keys(ACCOUNTS) as AccountKey[]).filter(
    (role): role is RoleKey => role !== 'co_foreman'
);

const SNAPSHOT_HASH_PATH = path.resolve(process.cwd(), 'database/.playwright-snapshot.hash');
const AUTH_DB_HASH_PATH = path.join(AUTH_STATE_DIR, '.db-hash');

// Sessions are bound to user IDs, which are deterministic for a given
// schema + fixture set. When nothing changed since the sessions were
// saved, they are still valid and the logins are skipped entirely.
function sessionsAreFresh(): boolean {
    try {
        if (!SETUP_ROLES.every((role) => fs.existsSync(authStatePath(role)))) {
            return false;
        }
        if (!fs.existsSync(SNAPSHOT_HASH_PATH) || !fs.existsSync(AUTH_DB_HASH_PATH)) {
            return false;
        }
        const snapshotHash = fs.readFileSync(SNAPSHOT_HASH_PATH, 'utf8').trim();
        const authHash = fs.readFileSync(AUTH_DB_HASH_PATH, 'utf8').trim();
        return snapshotHash !== '' && snapshotHash === authHash;
    } catch {
        return false;
    }
}

setup('prepare auth sessions', async () => {
    if (sessionsAreFresh()) {
        console.log('[auth.setup] Reusing saved sessions.');
        return;
    }
    // Sessions reference user IDs in a database that global.setup just
    // rebuilt, so sessions saved by any previous run are dead. Wipe them
    // to force fresh UI logins below (loginAs fast-path only kicks in when
    // a state file already exists).
    fs.rmSync(AUTH_STATE_DIR, { recursive: true, force: true });
    fs.mkdirSync(AUTH_STATE_DIR, { recursive: true });
});

setup('authenticate roles', async ({ browser }) => {
    if (sessionsAreFresh()) {
        return;
    }
    // One context per role keeps the sessions independent; the logins run
    // concurrently and overlap browser work while the single-threaded PHP
    // test server serializes the backend requests on its own.
    await Promise.all(
        SETUP_ROLES.map(async (role) => {
            const context = await browser.newContext({ baseURL: TEST_BASE_URL });
            const page = await context.newPage();
            try {
                await loginAs(page, role);
                await context.storageState({ path: authStatePath(role) });
            } finally {
                await context.close();
            }
        })
    );
    try {
        const snapshotHash = fs.existsSync(SNAPSHOT_HASH_PATH)
            ? fs.readFileSync(SNAPSHOT_HASH_PATH, 'utf8').trim()
            : `run-${Date.now()}`;
        fs.writeFileSync(AUTH_DB_HASH_PATH, snapshotHash);
    } catch {
        // Hash bookkeeping is best-effort; a missing marker simply means
        // the next run logs in fresh again.
    }
});
