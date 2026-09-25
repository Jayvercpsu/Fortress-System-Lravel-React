import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

// The Foreman Submissions tab lists only records actually submitted by a
// foreman. Rows uploaded on a foreman's behalf by a Head Admin / Admin / HR
// (the processed-record import flow) still count toward foreman progress,
// but they must never appear in this list.
test('foreman submissions tab only lists foreman-authored records', async ({ page }) => {
    await loginAs(page, 'head_admin');

    await page.goto(`/weekly-accomplishments/${DEMO_PROJECT_ID}#foreman-submissions`);

    const detail = page.getByTestId('project-detail');
    await expect(detail).toBeVisible();
    await expect(page).toHaveURL(/#foreman-submissions/);

    const emptyState = detail.getByText('No foreman submissions yet.');
    if ((await emptyState.count()) > 0) {
        await expect(emptyState.first()).toBeVisible();
        return;
    }

    const rows = detail.getByTestId('detail-submissions-table').locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    for (let index = 0; index < rowCount; index += 1) {
        // Cell 2 is "Submitted By": the name sits above the role.
        const role = await rows.nth(index).locator('td').nth(1).locator('div').nth(1).innerText();

        expect(role.trim()).toBe('Foreman');
    }
});
