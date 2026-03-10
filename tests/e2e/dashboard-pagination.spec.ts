import { expect, Locator, test } from '@playwright/test';
import { loginAs } from './support/auth';

test('head admin dashboard recent projects and payroll are limited to five rows per page', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/head-admin');

    const projectsSection = page.getByTestId('recent-projects-section');
    const payrollSection = page.getByTestId('recent-payroll-section');

    await expect(projectsSection).toBeVisible();
    await expect(payrollSection).toBeVisible();

    await assertMaxRows(projectsSection, 'recent-project-row', 'No projects yet.');
    await assertMaxRows(payrollSection, 'recent-payroll-row', 'No payroll records.');
});

async function assertMaxRows(section: Locator, rowTestId: string, emptyText: string) {
    const emptyState = section.getByText(emptyText);
    const emptyVisible = await emptyState.isVisible();
    const rows = section.getByTestId(rowTestId);
    const count = await rows.count();

    expect(emptyVisible || count > 0).toBeTruthy();

    if (count > 0) {
        expect(count).toBeLessThanOrEqual(5);
    }

    const summary = section.getByText(/Showing \d+-\d+ of \d+/);
    if (await summary.isVisible()) {
        const text = (await summary.textContent()) ?? '';
        const match = /Showing (\d+)-(\d+) of (\d+)/.exec(text);
        if (match) {
            const from = Number(match[1]);
            const to = Number(match[2]);
            expect(to - from + 1).toBeLessThanOrEqual(5);
        }
    }
}