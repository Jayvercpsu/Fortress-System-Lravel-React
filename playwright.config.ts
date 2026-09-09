import { defineConfig, devices } from '@playwright/test';
import { laravelEnv } from './tests/e2e/support/laravel-env';
import { TEST_BASE_URL, VITE_URL } from './tests/e2e/support/constants';

export default defineConfig({
    testDir: './tests/e2e',
    // Generous ceiling for slower dev machines: individual waits are still
    // bounded (30s actions/navigation, 10s assertions), this only decides
    // how long a slow-but-working test may run before it is failed.
    timeout: 120_000,
    fullyParallel: false,
    workers: 1,
    globalSetup: './tests/e2e/global.setup.ts',
    retries: process.env.CI ? 2 : 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    expect: {
        timeout: 10_000,
    },
    use: {
        baseURL: TEST_BASE_URL,
        // Traces instrument every action, so they are only recorded where
        // they are likely to be opened: CI failures. Local failures keep
        // screenshots, which is enough to diagnose most breakage.
        trace: process.env.CI ? 'retain-on-failure' : 'off',
        screenshot: 'only-on-failure',
        video: 'off',
    },
    webServer: [
        {
            command: 'php artisan serve --host 127.0.0.1 --port 8010',
            url: `${TEST_BASE_URL}/login`,
            env: laravelEnv,
            reuseExistingServer: true,
            timeout: 120_000,
        },
        {
            command: 'npm run dev -- --host 127.0.0.1 --port 5180',
            url: `${VITE_URL}/@vite/client`,
            env: laravelEnv,
            reuseExistingServer: true,
            timeout: 120_000,
        },
    ],
    projects: [
        // Logs in once per role and saves session cookies for the suite.
        // Spec tests reuse them via loginAs() instead of the login form.
        { name: 'setup', testMatch: /.*\.setup\.ts/ },
        {
            name: 'chromium',
            dependencies: ['setup'],
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],
});
