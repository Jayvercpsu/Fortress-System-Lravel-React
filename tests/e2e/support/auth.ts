import { expect, Page } from '@playwright/test';
import { ACCOUNTS, AccountKey } from './constants';

export async function loginAs(page: Page, accountKey: AccountKey) {
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
