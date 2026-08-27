import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { laravelEnv, playwrightDatabasePath } from './support/laravel-env';

function runArtisan(args: string[]) {
    execFileSync('php', ['artisan', ...args], {
        cwd: process.cwd(),
        env: laravelEnv,
        stdio: 'inherit',
    });
}

export default async function globalSetup() {
    const databasePath = playwrightDatabasePath;

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
}
