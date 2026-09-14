import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

// Mobile viewport: wide tables become stacked cards, tab bars scroll
// horizontally, and filter controls stack full-width.
test.use({ viewport: { width: 390, height: 844 } });

test('weekly accomplishments index renders mobile cards instead of wide tables', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/weekly-accomplishments');
    await expect(page.getByText('Track and compare submissions')).toBeVisible();

    // Filter controls stack full-width instead of overflowing. The overview
    // tab's project search takes the full row on mobile (the submissions
    // filter bar only renders on the PM/Foreman tabs).
    const search = page.getByLabel('Search projects');
    await expect(search).toBeVisible();
    expect(await search.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(300);

    // Overview comparison renders one stacked card per project (the 980px
    // table is desktop-only).
    const firstCard = page.locator('[data-testid="comparison-table"]');
    await expect(firstCard).toBeVisible();

    // Tab bar scrolls horizontally without page-level horizontal overflow.
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
});

test('weekly accomplishment detail renders mobile cards and stacked grids', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/weekly-accomplishments/1');
    await expect(page.getByTestId('project-detail')).toBeVisible();

    // Work-items tab: scopes render as stacked cards on mobile. The print
    // copy inside #accomplishment-report-area reuses the same testid, so
    // assert on the first (visible) one.
    await page.getByRole('button', { name: 'Work Items', exact: true }).click();
    await expect(page.getByTestId('breakdown-title').first()).toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
});

test('submission details panel is automatically full-width on mobile (PM and Foreman)', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/weekly-accomplishments');

    for (const tabName of ['PM Submissions', 'Foreman Submissions']) {
        await page.getByRole('button', { name: tabName }).first().click();
        const submissionsList = page.getByTestId('submissions-list');
        await expect(submissionsList).toBeVisible();

        const groupToggles = submissionsList.getByTestId('accordion-group-toggle');
        if ((await groupToggles.count()) > 0) {
            await groupToggles.first().click();
        }
        const viewButtons = submissionsList.getByRole('button', { name: 'View submission details' });
        if ((await viewButtons.count()) === 0) {
            continue;
        }
        await viewButtons.first().click();

        const sidebar = page.getByTestId('submission-sidebar');
        await expect(sidebar).toBeVisible();
        const sidebarWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
        expect(sidebarWidth).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 390) - 1);

        // The maximize edge handle is hidden on mobile (already full-width).
        await expect(page.getByRole('button', { name: 'Maximize submission details' })).toHaveCount(0);

        await page.getByRole('button', { name: 'Close submission details' }).click();
        await expect(sidebar).toHaveCount(0);
    }
});

test('detail page submission details panel is automatically full-width on mobile', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/weekly-accomplishments/1');
    await expect(page.getByTestId('project-detail')).toBeVisible();

    for (const tabName of ['PM Submissions', 'Foreman Submissions']) {
        await page.getByRole('button', { name: tabName, exact: true }).click();
        const viewButtons = page.getByRole('button', { name: /View .* details/ });
        if ((await viewButtons.count()) === 0) {
            continue;
        }
        await viewButtons.first().click();

        const sidebar = page.getByTestId('submission-sidebar');
        await expect(sidebar).toBeVisible();
        const sidebarWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
        expect(sidebarWidth).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 390) - 1);

        await expect(page.getByRole('button', { name: 'Maximize submission details' })).toHaveCount(0);

        await page.getByRole('button', { name: 'Close submission details' }).click();
        await expect(sidebar).toHaveCount(0);
    }
});
