import path from 'node:path';
import { TEST_BASE_URL } from './constants';

export const laravelEnv: NodeJS.ProcessEnv = {
    ...process.env,
    APP_ENV: 'playwright',
    APP_URL: TEST_BASE_URL,
    DB_CONNECTION: 'sqlite',
    DB_DATABASE: path.resolve(process.cwd(), 'database/playwright.sqlite'),
    CACHE_STORE: 'file',
    SESSION_DRIVER: 'file',
    QUEUE_CONNECTION: 'sync',
    MAIL_MAILER: 'array',
    BROADCAST_CONNECTION: 'log',
};
