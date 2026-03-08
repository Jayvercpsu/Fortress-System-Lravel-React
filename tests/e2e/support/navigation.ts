import { expect, Page } from '@playwright/test';
import { RouteExpectation } from './routes';

export async function visitRoute(page: Page, route: RouteExpectation) {
    const response = await page.goto(route.path);

    expect(response?.ok(), `Expected ${route.path} to load successfully.`).toBeTruthy();
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(route.path);
    await expect(page.locator('body')).toContainText(route.bodyText);
}

export async function expectForbidden(page: Page, path: string) {
    const response = await page.goto(path);
    expect(response?.status(), `Expected ${path} to be forbidden.`).toBe(403);
}
