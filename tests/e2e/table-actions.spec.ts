import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_ACTIVE_PROJECT_ID } from './support/constants';
import { escapeRegExp } from './support/ui';

test.describe.configure({ mode: 'serial' });

test('head admin can create, edit, and delete users from the users table flow', async ({ page }) => {
    const createdName = `E2E User ${Date.now()}`;
    const updatedName = `${createdName} Updated`;
    const email = `e2e-user-${Date.now()}@example.com`;

    await loginAs(page, 'head_admin');

    await page.goto('/users');
    await page.getByRole('link', { name: '+ Create User' }).click();

    await fieldAfterStandaloneLabel(page, 'Full Name', 'input').fill(createdName);
    await fieldAfterStandaloneLabel(page, 'Email', 'input').fill(email);
    await fieldAfterStandaloneLabel(page, 'Password', 'input').fill('password');
    await fieldAfterStandaloneLabel(page, 'Role', 'select').selectOption('foreman');
    await page.getByRole('button', { name: 'Create User' }).click();

    await expect(page.locator('body')).toContainText(createdName);

    const createdRow = page.locator('tr').filter({ hasText: createdName }).first();
    await createdRow.getByRole('link', { name: 'Edit' }).click();

    await fieldAfterStandaloneLabel(page, 'Full Name', 'input').fill(updatedName);
    await fieldAfterStandaloneLabel(page, 'Phone', 'input').fill('09998887777');
    await fieldAfterStandaloneLabel(page, 'Address', 'textarea').fill('Automation Street, Cebu City');
    await page.getByRole('button', { name: 'Update User' }).click();

    await expect(page.locator('body')).toContainText(updatedName);
    const persistedRow = page.locator('tr').filter({ hasText: updatedName }).first();
    await persistedRow.getByRole('link', { name: 'Edit' }).click();
    await expect(fieldAfterStandaloneLabel(page, 'Phone', 'input')).toHaveValue('09998887777');
    await page.goto('/users');

    const updatedRow = page.locator('tr').filter({ hasText: updatedName }).first();
    await updatedRow.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.locator('body')).not.toContainText(updatedName);
});

test('head admin can use project team, files, and updates table actions', async ({ page }) => {
    const uploadPath = 'C:\\Users\\algad\\Projects\\Fortress-System-Lravel-React\\public\\images\\logo.jpg';
    const updateNote = `E2E project update ${Date.now()}`;

    await loginAs(page, 'head_admin');

    await page.goto(`/projects/${DEMO_ACTIVE_PROJECT_ID}?tab=overview`);
    await page.getByRole('button', { name: 'View Info' }).first().click();
    await expect(page.locator('body')).toContainText('Project Worker Info');
    await expect(page.locator('body')).toContainText('Project');
    await page.getByRole('button', { name: 'Close' }).click();

    await page.goto(`/projects/${DEMO_ACTIVE_PROJECT_ID}?tab=files`);
    await page.locator('input[type="file"]').setInputFiles(uploadPath);
    await page.getByRole('button', { name: 'Upload' }).click();
    await expect(page.locator('body')).toContainText('logo.jpg');

    const fileRow = page.locator('tr').filter({ hasText: 'logo.jpg' }).first();
    await fileRow.getByRole('button', { name: 'Open' }).click();
    await expect(page.locator('body')).toContainText('logo.jpg');
    await expect(page.locator('img[alt="logo.jpg"]').first()).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    const downloadPromise = page.waitForEvent('download');
    await fileRow.getByRole('link', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().toLowerCase()).toMatch(/\.jpg$/);

    await fileRow.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.locator('body')).not.toContainText('logo.jpg');

    await page.goto(`/projects/${DEMO_ACTIVE_PROJECT_ID}?tab=updates`);
    await page.locator('textarea').fill(updateNote);
    await page.getByRole('button', { name: 'Post Update' }).click();
    await expect(page.locator('body')).toContainText(updateNote);
});

test('admin can add, edit, and delete build expense table rows', async ({ page }) => {
    const createdNote = `E2E admin expense ${Date.now()}`;
    const updatedNote = `${createdNote} updated`;

    await loginAs(page, 'admin');

    await page.goto(`/projects/${DEMO_ACTIVE_PROJECT_ID}/build?tab=expenses`);
    await page.locator('label').filter({ hasText: 'Amount' }).locator('input').fill('1111.00');
    await page.locator('label').filter({ hasText: 'Note' }).locator('input').fill(createdNote);
    await page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(page.locator('body')).toContainText(createdNote);

    let expenseRow = page.locator('tr').filter({ hasText: createdNote }).first();
    await expenseRow.getByRole('button', { name: 'Edit' }).click();
    await page.locator('label').filter({ hasText: 'Amount' }).last().locator('input').fill('2222.00');
    await page.locator('label').filter({ hasText: 'Note' }).last().locator('input').fill(updatedNote);
    await page.getByRole('button', { name: 'Save Changes' }).click();

    expenseRow = page.locator('tr').filter({ hasText: updatedNote }).first();
    await expect(expenseRow).toContainText('P 2,222.00');

    await expenseRow.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.locator('body')).not.toContainText(updatedNote);
});

test('head admin can preview and update material and issue rows', async ({ page }) => {
    await loginAs(page, 'head_admin');

    await page.goto('/materials');
    let materialRow = page.locator('tr').filter({ hasText: 'PVC Pipe' }).first();
    await materialRow.locator('button').first().click();
    await expect(page.locator('body')).toContainText('PVC Pipe');
    await page.getByRole('button', { name: 'Close' }).click();

    await materialRow.getByRole('button', { name: 'Approve' }).click();
    materialRow = page.locator('tr').filter({ hasText: 'PVC Pipe' }).first();
    await expect(materialRow).toContainText('approved');

    await materialRow.getByRole('button', { name: 'Reject' }).click();
    materialRow = page.locator('tr').filter({ hasText: 'PVC Pipe' }).first();
    await expect(materialRow).toContainText('rejected');

    await page.goto('/issues');
    let issueRow = page.locator('tr').filter({ hasText: 'Formwork alignment at stair core' }).first();
    await issueRow.locator('button').first().click();
    await expect(page.locator('body')).toContainText('Formwork alignment at stair core');
    await page.getByRole('button', { name: 'Close' }).click();

    await issueRow.getByRole('button', { name: 'Mark Resolved' }).click();
    issueRow = page.locator('tr').filter({ hasText: 'Formwork alignment at stair core' }).first();
    await expect(issueRow.getByRole('button', { name: 'Reopen' })).toBeVisible();

    await issueRow.getByRole('button', { name: 'Reopen' }).click();
    issueRow = page.locator('tr').filter({ hasText: 'Formwork alignment at stair core' }).first();
    await expect(issueRow.getByRole('button', { name: 'Mark Resolved' })).toBeVisible();
});

test('head admin can preview delivery, progress photo, and weekly accomplishment media', async ({ page }) => {
    await loginAs(page, 'head_admin');

    await page.goto('/delivery');
    await page.locator('tr').filter({ hasText: 'PVC Pipe' }).first().locator('button').first().click();
    await expect(page.locator('body')).toContainText('Lapu-Lapu Industrial Depot');
    await page.getByRole('button', { name: 'Close' }).click();

    await page.goto('/progress-photos');
    await page.locator('table tbody button').first().click();
    await expect(page.locator('body')).toContainText('Uploaded by:');
    await page.getByRole('button', { name: 'Close' }).click();

    await page.goto('/weekly-accomplishments');
    await page.locator('table tbody button').first().click();
    await expect(page.locator('body')).toContainText('Scope:');
    await page.getByRole('button', { name: 'Close' }).click();
});

test('hr can manage payroll deductions and manual payroll edits', async ({ page }) => {
    const deductionNote = `E2E deduction ${Date.now()}`;

    await loginAs(page, 'hr');

    await page.goto('/payroll/run');
    let payrollRow = page.locator('tr').filter({ hasText: 'Alex Manuel' }).first();
    await payrollRow.getByRole('button', { name: 'Deductions' }).click();

    await page.locator('label').filter({ hasText: 'Amount' }).locator('input').fill('99.00');
    await page.locator('label').filter({ hasText: 'Note (optional)' }).locator('input').fill(deductionNote);
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('body')).toContainText(deductionNote);

    await page.getByText(deductionNote, { exact: true }).locator('xpath=following-sibling::button[1]').click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.getByText(deductionNote, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close' }).click();

    await page.goto('/payroll');
    await page.getByPlaceholder('Search payroll entries...').fill('Alex Manuel');
    await expect(page.locator('body')).toContainText('Alex Manuel');

    payrollRow = page.locator('tr').filter({ hasText: 'Alex Manuel' }).first();
    await payrollRow.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('combobox', { name: 'Status' }).selectOption('approved');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.locator('tr').filter({ hasText: 'Alex Manuel' }).first()).toContainText('approved');
});

test('foreman can add, edit, and delete worker rows', async ({ page }) => {
    const workerName = `E2E Foreman Worker ${Date.now()}`;

    await loginAs(page, 'foreman');

    await page.goto('/foreman/workers');
    await page.locator('label').filter({ hasText: 'Worker Name' }).locator('input').fill(workerName);
    await page.getByRole('button', { name: 'Add Worker' }).click();
    await expect(page.locator('body')).toContainText(workerName);

    let workerRow = page.locator('tr').filter({ hasText: workerName }).first();
    await workerRow.getByRole('button', { name: 'Edit' }).click();
    await page.locator('label').filter({ hasText: /^Phone \(optional\)$/ }).locator('input').last().fill('09175556666');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    workerRow = page.locator('tr').filter({ hasText: workerName }).first();
    await expect(workerRow).toContainText('09175556666');

    await workerRow.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.locator('body')).not.toContainText(workerName);
});

function fieldAfterStandaloneLabel(page: import('@playwright/test').Page, label: string, tagName: string) {
    return page
        .locator('label')
        .filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`) })
        .locator(`xpath=following-sibling::${tagName}[1]`);
}
