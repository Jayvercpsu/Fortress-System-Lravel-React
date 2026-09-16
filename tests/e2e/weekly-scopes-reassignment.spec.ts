import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { CO_FOREMAN_PUBLIC_TOKEN, DEMO_PROJECT_ID, PRIMARY_PUBLIC_TOKEN } from './support/constants';

test.describe.configure({ mode: 'serial' });

/**
 * Regression: reassigning a scope to another foreman moves it fully.
 * After the move, the previous foreman's jotform must not show the scope
 * anymore (not even as "Assigned to another foreman"), while the new
 * assignee's jotform lists it with the shared plan progress.
 */
test('reassigned scope leaves the previous foreman jotform and joins the new one', async ({ page }) => {
    const scopeName = `E2E reassign scope ${Date.now()}`;
    const coForeman = 'Fortress Demo Co-Foreman';
    const mainForeman = 'Fortress Demo Foreman';

    // 1. Admin creates the scope assigned to the co-foreman.
    await loginAs(page, 'admin');
    await page.goto(`/projects/${DEMO_PROJECT_ID}/build`);
    await page.getByRole('button', { name: 'Add Scope' }).click();
    await page.locator('label').filter({ hasText: 'Scope Name' }).locator('input').fill(scopeName);
    await page.locator('label').filter({ hasText: 'Assigned Personnel' }).getByRole('button').first().click();
    await page.getByPlaceholder('Search foreman...').fill(coForeman);
    await page.getByRole('button', { name: coForeman, exact: true }).click();
    await page.locator('label').filter({ hasText: 'Contract Amount' }).locator('input').fill('1000');
    await page.locator('label').filter({ hasText: 'Weight %' }).locator('input').fill('0');
    await page.getByRole('button', { name: 'Add Scope' }).last().click();
    // Scope creation from the build page redirects back to the build page.
    await expect(page).toHaveURL(new RegExp(`/projects/${DEMO_PROJECT_ID}/build`));
    await expect(page.locator('body')).toContainText(scopeName);

    // 2. Co-foreman submits progress so the scope carries their history.
    await page.goto(`/progress-submit/${CO_FOREMAN_PUBLIC_TOKEN}`);
    await page.getByRole('button', { name: /Weekly Progress \(Accomplishment %\)/i }).click();
    const coRow = page.getByRole('row', { name: new RegExp(scopeName) });
    await expect(coRow).toBeVisible();
    await coRow.locator('input[type="number"]').fill('30');
    await page.getByRole('button', { name: 'Submit All' }).click();
    await expect(page.getByText('Jotform submitted successfully.')).toBeVisible();

    // 3. Admin reassigns the scope to the main foreman.
    await page.goto(`/projects/${DEMO_PROJECT_ID}/build`);
    await expect(page.locator('body')).toContainText(scopeName);
    await page.locator('tr').filter({ hasText: scopeName }).first().locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Edit Selected' }).click();
    await page.locator('label').filter({ hasText: 'Assigned Personnel' }).getByRole('button').first().click();
    await page.getByPlaceholder('Search foreman...').fill(mainForeman);
    await page.getByRole('button', { name: mainForeman, exact: true }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.locator('body')).toContainText(scopeName);

    // 4. The scope is gone from the previous foreman's jotform entirely.
    await page.goto(`/progress-submit/${CO_FOREMAN_PUBLIC_TOKEN}`);
    await page.getByRole('button', { name: /Weekly Progress \(Accomplishment %\)/i }).click();
    await expect(page.getByRole('row', { name: new RegExp(scopeName) })).toHaveCount(0);

    // 5. ...and now lives on the new assignee's jotform.
    await page.goto(`/progress-submit/${PRIMARY_PUBLIC_TOKEN}`);
    await page.getByRole('button', { name: /Weekly Progress \(Accomplishment %\)/i }).click();
    await expect(page.getByRole('row', { name: new RegExp(scopeName) })).toBeVisible();

    // 6. Cleanup so later specs see a clean grid.
    await loginAs(page, 'admin');
    await page.goto(`/projects/${DEMO_PROJECT_ID}/build`);
    await page.locator('tr').filter({ hasText: scopeName }).first().locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: /Delete Selected/ }).click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.locator('body')).not.toContainText(scopeName);
});
