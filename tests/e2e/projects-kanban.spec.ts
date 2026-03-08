import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

test('Head admin can drag a project card and change its phase', async ({ page }) => {
    await test.step('Go to the login page and login as head admin', async () => {
        await loginAs(page, 'head_admin');
    });

    await test.step('Open the projects board', async () => {
        await page.goto('/projects');
        await expect(page.locator(`[data-testid="kanban-card"][data-project-id="${DEMO_PROJECT_ID}"]`)).toBeVisible();
    });

    await test.step('Drag the project card to another phase column', async () => {
        const sourceColumn = page.getByTestId('kanban-column-construction');
        const targetColumn = page.getByTestId('kanban-column-forbuild');
        await expect(sourceColumn.locator(`[data-project-id="${DEMO_PROJECT_ID}"]`)).toBeVisible();
        await page.getByTestId(`kanban-drag-${DEMO_PROJECT_ID}`).dragTo(targetColumn);
        await expect(targetColumn.locator(`[data-project-id="${DEMO_PROJECT_ID}"]`)).toBeVisible();
    });

    await test.step('Change the project phase using the dropdown', async () => {
        const targetColumn = page.getByTestId('kanban-column-construction');
        await page.getByTestId(`kanban-phase-${DEMO_PROJECT_ID}`).selectOption('Construction');
        await expect(targetColumn.locator(`[data-project-id="${DEMO_PROJECT_ID}"]`)).toBeVisible();
    });
});
