import fs from 'node:fs';
import path from 'node:path';
import { APIRequestContext, expect, Page } from '@playwright/test';
import { ACCOUNTS, AccountKey } from './constants';

export const AUTH_STATE_DIR = path.resolve(process.cwd(), 'tests/e2e/.auth');

export const authStatePath = (accountKey: AccountKey): string =>
    path.join(AUTH_STATE_DIR, `${accountKey}.json`);

interface SavedCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}

export async function loginAs(page: Page, accountKey: AccountKey) {
    // Fast path: the auth.setup project persists one session per role per
    // run. Restoring its cookies authenticates instantly without driving
    // the login form (session auth is cookie-only, so origins can be
    // skipped). Falls back to the UI login when no session was saved.
    const stateFile = authStatePath(accountKey);
    if (fs.existsSync(stateFile)) {
        try {
            const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as {
                cookies?: SavedCookie[];
            };
            const cookies = (Array.isArray(raw?.cookies) ? raw.cookies : []).filter(
                (cookie) => typeof cookie?.name === 'string' && typeof cookie?.domain === 'string'
            );
            if (cookies.length > 0) {
                await page.context().addCookies(cookies);
                return;
            }
        } catch {
            // Corrupt state file: fall through to the UI login below.
        }
    }

    const account = ACCOUNTS[accountKey];

    await page.goto('/login');
    await page.locator('input[name="email"]').fill(account.email);
    await page.locator('input[type="password"]').fill(account.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(new RegExp(`${escapeForRegExp(account.landingPath)}(?:\\?|$)`));
}

function escapeForRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Reads the CSRF token without navigating: the Blade shell of any page
// carries the meta tag, so one cheap request replaces a full page load
// for API-driven test setup.
export async function getCsrfToken(request: APIRequestContext): Promise<string> {
    const response = await request.get('/login');
    const html = await response.text();
    return html.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1] ?? '';
}
