import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

test('pm attendance foreman filter follows the selected project', async ({ page }) => {
    await loginAs(page, 'project_manager');
    await page.goto('/project-manager/attendance');
    await expect(page.getByText('Foreman attendance — view only')).toBeVisible();

    const projectFilter = page.getByLabel('Project');
    const foremanFilter = page.getByLabel('Foreman');

    // Both demo foremen are offered before any project is selected.
    await expect(foremanFilter.locator('option')).toHaveText([
        'All Foremen',
        'Fortress Demo Co-Foreman',
        'Fortress Demo Foreman',
    ]);

    // Picking a foreman first, then a project, resets the foreman filter
    // because its options are scoped to the selected project.
    await foremanFilter.selectOption({ label: 'Fortress Demo Foreman' });
    await expect(page).toHaveURL(/foreman_id=\d+/);

    await projectFilter.selectOption({ label: 'Fortress Building' });
    await expect(page).toHaveURL(/project_id=\d+/);
    await expect(page).not.toHaveURL(/foreman_id=/);
    await expect(foremanFilter).toHaveValue('');

    // The scoped options still contain the project's assigned foremen,
    // in the same fullname ordering as the unscoped list.
    await expect(foremanFilter.locator('option')).toHaveText([
        'All Foremen',
        'Fortress Demo Co-Foreman',
        'Fortress Demo Foreman',
    ]);
});
