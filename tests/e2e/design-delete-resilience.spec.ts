import { expect, test } from '@playwright/test';
import { getCsrfToken, loginAs } from './support/auth';

test('deleting an entry removes it without stranding the page at /design/{id}', async ({ page }) => {
    const stamp = Date.now();
    const department = `E2E Delete Dept ${stamp}`;
    const doomed = `E2E Doomed Item ${stamp}`;
    const survivor = `E2E Survivor Item ${stamp}`;

    await loginAs(page, 'head_admin');

    // API seeding below needs a CSRF token; read it without a page load.
    const csrfToken = await getCsrfToken(page.request);

    for (const projectName of [doomed, survivor]) {
        const response = await page.request.post('/design', {
            headers: { 'X-CSRF-TOKEN': csrfToken ?? '' },
            form: {
                department,
                client_name: 'Delete Client',
                project_name: projectName,
                project_type: 'Commercial',
                location: 'Cebu City',
                status: 'IN_REVIEW',
                progress_percent: 10,
            },
        });
        expect([200, 302, 303]).toContain(response.status());
    }

    try {
        await page.goto('/design');
        await expect(page.getByText(department, { exact: true })).toBeVisible();
        await expect(page.getByText(doomed, { exact: true })).toBeVisible();

        const panel = page.getByText(department, { exact: true }).locator('xpath=ancestor::div[3]');

        // Delete the doomed row through the UI confirm modal.
        const doomedRow = panel.locator('tr', { has: page.getByText(doomed, { exact: true }) });
        await doomedRow.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(page.getByText('Delete Monitoring Entry')).toBeVisible();
        // Confirmation modals render after the board rows, so the last
        // exact "Delete" button is the modal confirm action.
        await page.getByRole('button', { name: 'Delete', exact: true }).last().click();

        await expect(page.getByText('Delete Monitoring Entry')).toHaveCount(0);
        await expect(page.getByText(doomed, { exact: true })).toHaveCount(0);
        await expect(page.getByText(survivor, { exact: true })).toBeVisible();
        // The board stays on /design: never stranded at /design/{id}.
        await expect(page).toHaveURL(/\/design(\?|$)/);
        await expect(page.getByText('Entry Not Found')).toHaveCount(0);

        // Deleting the same id again (stale row / double submit) refreshes
        // the board instead of rendering a 404 page at /design/{id}.
        const version = await page.evaluate(() => {
            const raw = document.querySelector('[data-page]')?.getAttribute('data-page');
            try {
                return (JSON.parse(raw ?? '{}') as { version?: string }).version ?? '';
            } catch {
                return '';
            }
        });
        const listResponse = await page.request.get('/design', {
            headers: { Accept: 'application/json', 'X-Inertia': 'true', 'X-Inertia-Version': version },
        });
        const payload = (await listResponse.json()) as {
            props: { items: { id: number; project_name: string }[] };
        };
        const doomedEntry = payload.props.items.find((item) => item.project_name === doomed);
        expect(doomedEntry).toBeUndefined();

        const csrf = await page.locator('meta[name="csrf-token"]').getAttribute('content');
        // Resolve the (now deleted) id from the survivor's sibling is
        // impossible, so repeat-delete a real survivor id after removing it
        // via API to simulate the stale second delete deterministically.
        const survivorRow = payload.props.items.find((item) => item.project_name === survivor);
        expect(survivorRow).toBeDefined();
        const firstDelete = await page.request.delete(`/design/${survivorRow?.id}`, {
            headers: { 'X-CSRF-TOKEN': csrf ?? '' },
        });
        expect([200, 302, 303]).toContain(firstDelete.status());
        const staleDelete = await page.request.delete(`/design/${survivorRow?.id}`, {
            headers: { 'X-CSRF-TOKEN': csrf ?? '' },
        });
        expect([200, 302, 303]).toContain(staleDelete.status());

        await page.goto('/design');
        await expect(page).toHaveURL(/\/design(\?|$)/);
        await expect(page.getByText('Entry Not Found')).toHaveCount(0);
    } finally {
        const version = await page.evaluate(() => {
            const raw = document.querySelector('[data-page]')?.getAttribute('data-page');
            try {
                return (JSON.parse(raw ?? '{}') as { version?: string }).version ?? '';
            } catch {
                return '';
            }
        });
        const listResponse = await page.request.get('/design', {
            headers: { Accept: 'application/json', 'X-Inertia': 'true', 'X-Inertia-Version': version },
        });
        const departments = ((await listResponse.json()) as {
            props: { departments: { id: number; name: string }[] };
        }).props.departments;
        const target = departments.find((entry) => entry.name === department);
        if (target) {
            const csrf = await page.locator('meta[name="csrf-token"]').getAttribute('content');
            await page.request.delete(`/design/departments/${target.id}`, {
                headers: { 'X-CSRF-TOKEN': csrf ?? '' },
            });
        }
        await page.goto('/design');
        await expect(page.getByText(department, { exact: true })).toHaveCount(0);
    }
});
