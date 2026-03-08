import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { laravelEnv } from './support/laravel-env';

function runArtisan(args: string[]) {
    execFileSync('php', ['artisan', ...args], {
        cwd: process.cwd(),
        env: laravelEnv,
        stdio: 'inherit',
    });
}

export default async function globalSetup() {
    const databasePath = path.resolve(process.cwd(), 'database/playwright.sqlite');

    if (!fs.existsSync(databasePath)) {
        fs.writeFileSync(databasePath, '');
    }

    runArtisan(['migrate:fresh', '--force']);
    runArtisan(['db:seed', '--class=Database\\Seeders\\BrowserAutomationSeeder', '--force']);
}
