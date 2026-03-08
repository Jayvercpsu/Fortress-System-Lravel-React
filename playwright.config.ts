import { defineConfig, devices } from '@playwright/test';
import { laravelEnv } from './tests/e2e/support/laravel-env';
import { TEST_BASE_URL, VITE_URL } from './tests/e2e/support/constants';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60_000,
    fullyParallel: false,
    workers: 1,
    globalSetup: './tests/e2e/global.setup.ts',
    retries: process.env.CI ? 2 : 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: TEST_BASE_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: [
        {
            command: 'php artisan serve --host 127.0.0.1 --port 8010',
            url: `${TEST_BASE_URL}/login`,
            env: laravelEnv,
            reuseExistingServer: false,
            timeout: 120_000,
        },
        {
            command: 'npm run dev -- --host 127.0.0.1 --port 5180',
            url: `${VITE_URL}/@vite/client`,
            env: laravelEnv,
            reuseExistingServer: false,
            timeout: 120_000,
        },
    ],
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],
});
