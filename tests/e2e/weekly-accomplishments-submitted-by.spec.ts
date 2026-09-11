import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

// TEMPORARY: the bottom week-bucket submissions list is hidden
// (SHOW_SUBMISSIONS_LIST = false in WeeklyAccomplishmentsPage.jsx).
// When the list is restored, revert this spec to assert the
// Submitted By Name (Role) cell format instead.
test('weekly accomplishments submissions list is temporarily hidden', async ({ page }) => {
    await loginAs(page, 'head_admin');

    await page.goto('/weekly-accomplishments?week_from=2026-02-23&week_to=2026-03-08');

    // The comparison overview still renders.
    await expect(page.getByTestId('comparison-table')).toBeVisible();

    // The submissions list (and its Submitted By column) is hidden.
    await expect(page.getByTestId('submissions-list')).toHaveCount(0);
    await expect(page.getByText('Submitted By', { exact: true })).toHaveCount(0);
});
