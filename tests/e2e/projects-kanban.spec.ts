import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

test('Projects board no longer allows drag or phase changes from kanban cards', async ({ page }) => {
    await test.step('Go to the login page and login as head admin', async () => {
        await loginAs(page, 'head_admin');
    });

    await test.step('Open the projects board', async () => {
        await page.goto('/projects');
        await expect(page.locator(`[data-testid="kanban-card"][data-project-id="${DEMO_PROJECT_ID}"]`)).toBeVisible();
    });

    await test.step('Card should not expose drag handle or phase dropdown', async () => {
        await expect(page.getByTestId(`kanban-drag-${DEMO_PROJECT_ID}`)).toHaveCount(0);
        await expect(page.getByTestId(`kanban-phase-${DEMO_PROJECT_ID}`)).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Manage' }).first()).toBeVisible();
    });
});

test('Project cards show the assigned PM below the foremen', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/projects');

    const card = page.locator(`[data-testid="kanban-card"][data-project-id="${DEMO_PROJECT_ID}"]`);
    await expect(card).toBeVisible();
    await expect(card.getByText('Foremen', { exact: true })).toBeVisible();
    await expect(card.getByText('PM', { exact: true })).toBeVisible();
});
