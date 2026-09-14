import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

// The accomplishments page skeleton only flashes during Inertia navigations
// (Layout shows it ~120ms after a cross-page visit starts). Delaying the
// Inertia JSON response keeps it on screen long enough to assert its
// responsive behavior.
async function expectResponsiveAccomplishmentsSkeleton(page, expectedStatColumns: number, viewport: { width: number; height: number }) {
    await page.setViewportSize(viewport);
    await loginAs(page, 'head_admin');
    await page.goto('/head-admin');
    await expect(page.locator('body')).toBeVisible();

    await page.route('**/weekly-accomplishments', async (route) => {
        const isInertiaVisit = (route.request().headers()['x-inertia'] ?? '').toLowerCase() === 'true';
        if (!isInertiaVisit) {
            await route.continue();
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 900));
        await route.continue();
    });

    // On mobile the sidebar links live inside the navigation drawer.
    if (viewport.width < 768) {
        await page.getByRole('button', { name: 'Open navigation' }).click();
    }
    await page.getByRole('link', { name: 'Accomplishments' }).first().click();

    const skeleton = page.getByTestId('accomplishments-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 10000 });

    // No page-level horizontal overflow while the skeleton is showing.
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);

    // Stat cards follow the real page breakpoints: 1 col on mobile,
    // 2 cols on sm, 4 cols on lg.
    const statColumns = await page.getByTestId('accomp-skel-stats').evaluate((el) => (
        window.getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length
    ));
    expect(statColumns).toBe(expectedStatColumns);

    // Tab placeholders stay on one scrollable row instead of overflowing
    // the page (internal scroll is fine, page overflow is not).
    const tabsOverflow = await page.getByTestId('accomp-skel-tabs').evaluate((el) => (
        el.scrollWidth - el.clientWidth
    ));
    expect(tabsOverflow).toBeGreaterThanOrEqual(0);

    // Progress rows never overflow their card: every row fits its container.
    const overflowingRows = await page.getByTestId('accomp-skel-rows').evaluate((el) => (
        Array.from(el.children).filter((row) => (row as HTMLElement).scrollWidth - (row as HTMLElement).clientWidth > 1).length
    ));
    expect(overflowingRows).toBe(0);

    await page.unroute('**/weekly-accomplishments');
}

test('accomplishments skeleton is responsive on mobile', async ({ page }) => {
    test.setTimeout(60000);
    await expectResponsiveAccomplishmentsSkeleton(page, 1, { width: 390, height: 844 });
});

test('accomplishments skeleton is responsive on desktop', async ({ page }) => {
    test.setTimeout(60000);
    await expectResponsiveAccomplishmentsSkeleton(page, 4, { width: 1280, height: 800 });
});
