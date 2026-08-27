import path from 'node:path';
import { TEST_BASE_URL } from './constants';

// Single definition of the throwaway e2e database used by the Playwright
// suite. It is fully isolated from the real MySQL 'fortress' database and is
// deleted + rebuilt on every run (see tests/e2e/global.setup.ts) so all test
// data comes solely from tests/e2e/fixtures/test-data.yml.
export const playwrightDatabasePath = path.resolve(process.cwd(), 'database/playwright.sqlite');

export const laravelEnv: NodeJS.ProcessEnv = {
    ...process.env,
    APP_ENV: 'playwright',
    APP_URL: TEST_BASE_URL,
    DB_CONNECTION: 'sqlite',
    DB_DATABASE: playwrightDatabasePath,
    CACHE_STORE: 'file',
    SESSION_DRIVER: 'file',
    QUEUE_CONNECTION: 'sync',
    MAIL_MAILER: 'array',
    BROADCAST_CONNECTION: 'log',
};
