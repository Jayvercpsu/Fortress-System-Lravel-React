import { expect, test } from '@playwright/test';
import { getCsrfToken, loginAs } from './support/auth';

test('non-completed departments paginate like the completed department', async ({ page }) => {
    const department = `E2E Pagination Dept ${Date.now()}`;
    const prefix = `E2E Page Item ${Date.now()}`;

    await loginAs(page, 'head_admin');

    // API seeding below needs a CSRF token; read it without a page load.
    const csrfToken = await getCsrfToken(page.request);

    // Seed 11 entries via API so the department spans two pages at 10 per page.
    for (let i = 1; i <= 11; i += 1) {
        const response = await page.request.post('/design', {
            headers: { 'X-CSRF-TOKEN': csrfToken ?? '' },
            form: {
                department,
                client_name: 'Pagination Client',
                project_name: `${prefix} ${i}`,
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

        const panel = page.getByText(department, { exact: true }).locator('xpath=ancestor::div[3]');
        const bodyRows = () => panel.locator('table tbody tr');
        const nextButton = () => panel.getByRole('button', { name: 'Next' });
        const prevButton = () => panel.getByRole('button', { name: 'Prev' });

        // Fixed 10 per page: 10 data rows on page one, 1 data + 9 filler rows on page two.
        await expect(bodyRows()).toHaveCount(10);
        await expect(nextButton()).toBeEnabled();
        await expect(prevButton()).toBeDisabled();

        await nextButton().click();
        await expect(bodyRows()).toHaveCount(10);
        await expect(nextButton()).toBeDisabled();
        await expect(prevButton()).toBeEnabled();

        // Empty filler rows carry full grid cells (vertical borders included).
        await expect
            .poll(async () => panel.locator('tr[aria-hidden="true"]').first().locator('td').count())
            .toBeGreaterThan(1);

        await prevButton().click();
        await expect(bodyRows()).toHaveCount(10);

        // Horizontal dividers paint on body cells.
        await expect
            .poll(async () =>
                bodyRows().locator('td').first().evaluate((el) => getComputedStyle(el).borderBottomWidth),
            )
            .toBe('1px');

        // Steady height: full and short pages measure the same.
        const tableWrapper = () => panel.locator('table').locator('xpath=..');
        const fullPageHeight = (await tableWrapper().boundingBox())?.height ?? 0;
        expect(fullPageHeight).toBeGreaterThan(0);
        await nextButton().click();
        await expect(bodyRows()).toHaveCount(10);
        expect((await tableWrapper().boundingBox())?.height ?? 0).toBe(fullPageHeight);
        await prevButton().click();
        await expect(bodyRows()).toHaveCount(10);

        // Non-completed footers show Prev/Next only: no counts, no size selector.
        await expect(panel.getByText(/Showing/)).toHaveCount(0);
        await expect(panel.locator('select')).toHaveCount(2);

        await page.getByPlaceholder('Search', { exact: true }).fill(prefix);
        await expect(page).toHaveURL(/search=/);
        await expect(page.getByText('Architecture', { exact: true })).toHaveCount(0);
        await expect(bodyRows()).toHaveCount(10);
        await page.getByPlaceholder('Search', { exact: true }).fill('');
        await expect(bodyRows()).toHaveCount(10);

        // Sticky select-all column: stays put and turns white with a
        // separation shadow on horizontal scroll, while content scrolls away.
        // The witness is read from the first visible row so it never depends
        // on the board's sort order (newest entries sort first by default).
        await panel.scrollIntoViewIfNeeded();
        const scroller = panel.locator('table').locator('xpath=..');
        const selectAll = panel.getByRole('button', { name: 'Select all rows' });
        const witnessName = ((await bodyRows().first().locator('td').nth(1).textContent()) ?? '').trim();
        expect(witnessName.length).toBeGreaterThan(0);
        const witness = panel.getByText(witnessName, { exact: true });
        await expect(selectAll).toBeInViewport();
        await expect(witness).toBeInViewport();
        const firstCell = () => panel.locator('table tbody td').first();
        const plainBg = await firstCell().evaluate((el) => getComputedStyle(el).backgroundColor);
        await scroller.evaluate((el) => { el.scrollLeft = 600; });
        await expect(selectAll).toBeInViewport();
        await expect(witness).not.toBeInViewport();
        await expect.poll(async () => firstCell().evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(plainBg);
        await expect
            .poll(async () => firstCell().evaluate((el) => getComputedStyle(el).boxShadow))
            .not.toBe('none');
        await scroller.evaluate((el) => { el.scrollLeft = 0; });

        // Fewer than 10 total items: the table fits its content, no forced height.
        const smallWrapper = page
            .locator('table', { has: page.getByText('Harbor View Dormitory', { exact: true }) })
            .locator('xpath=..');
        const smallHeight = (await smallWrapper.boundingBox())?.height ?? 0;
        expect(smallHeight).toBeGreaterThan(0);
        expect(smallHeight).toBeLessThan(400);
    } finally {
        // Remove the seeded department via API (also removes its items).
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

test('each department pager stays in sync with its own page', async ({ page }) => {
    const stamp = Date.now();
    const departmentA = `E2E Sync Dept A ${stamp}`;
    const departmentB = `E2E Sync Dept B ${stamp}`;
    const prefix = `E2E Sync Item ${stamp}`;

    await loginAs(page, 'head_admin');

    // API seeding below needs a CSRF token; read it without a page load.
    const csrfToken = await getCsrfToken(page.request);

    // Department A spans two pages; department B fits on a single page.
    for (let i = 1; i <= 11; i += 1) {
        const response = await page.request.post('/design', {
            headers: { 'X-CSRF-TOKEN': csrfToken ?? '' },
            form: {
                department: departmentA,
                client_name: 'Sync Client',
                project_name: `${prefix} A ${i}`,
                project_type: 'Commercial',
                location: 'Cebu City',
                status: 'IN_REVIEW',
                progress_percent: 10,
            },
        });
        expect([200, 302, 303]).toContain(response.status());
    }
    for (let i = 1; i <= 3; i += 1) {
        const response = await page.request.post('/design', {
            headers: { 'X-CSRF-TOKEN': csrfToken ?? '' },
            form: {
                department: departmentB,
                client_name: 'Sync Client',
                project_name: `${prefix} B ${i}`,
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
        await expect(page.getByText(departmentA, { exact: true })).toBeVisible();
        await expect(page.getByText(departmentB, { exact: true })).toBeVisible();

        const panelA = page.getByText(departmentA, { exact: true }).locator('xpath=ancestor::div[3]');
        const panelB = page.getByText(departmentB, { exact: true }).locator('xpath=ancestor::div[3]');

        // Page one: A can go forward, B (single page) cannot go either way.
        await expect(panelA.getByRole('button', { name: 'Prev' })).toBeDisabled();
        await expect(panelA.getByRole('button', { name: 'Next' })).toBeEnabled();
        await expect(panelB.getByRole('button', { name: 'Prev' })).toBeDisabled();
        await expect(panelB.getByRole('button', { name: 'Next' })).toBeDisabled();

        // Turning A's page must not disturb B's pager.
        await panelA.getByRole('button', { name: 'Next' }).click();
        await expect(panelA.getByRole('button', { name: 'Prev' })).toBeEnabled();
        await expect(panelA.getByRole('button', { name: 'Next' })).toBeDisabled();
        await expect(panelB.getByRole('button', { name: 'Prev' })).toBeDisabled();
        await expect(panelB.getByRole('button', { name: 'Next' })).toBeDisabled();

        // Simulates Add Entry clearing the board query: a fresh load lands
        // every department back on page one with matching button states.
        await page.goto('/design');
        await expect(panelA.getByRole('button', { name: 'Prev' })).toBeDisabled();
        await expect(panelA.getByRole('button', { name: 'Next' })).toBeEnabled();
        await expect(panelB.getByRole('button', { name: 'Prev' })).toBeDisabled();
        await expect(panelB.getByRole('button', { name: 'Next' })).toBeDisabled();

        await panelA.getByRole('button', { name: 'Next' }).click();
        await expect(panelA.getByRole('button', { name: 'Prev' })).toBeEnabled();
        await expect(panelA.getByRole('button', { name: 'Next' })).toBeDisabled();
        await panelA.getByRole('button', { name: 'Prev' }).click();
        await expect(panelA.getByRole('button', { name: 'Prev' })).toBeDisabled();
        await expect(panelA.getByRole('button', { name: 'Next' })).toBeEnabled();
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
        const csrf = await page.locator('meta[name="csrf-token"]').getAttribute('content');
        for (const name of [departmentA, departmentB]) {
            const target = departments.find((entry) => entry.name === name);
            if (target) {
                await page.request.delete(`/design/departments/${target.id}`, {
                    headers: { 'X-CSRF-TOKEN': csrf ?? '' },
                });
            }
        }
        await page.goto('/design');
        await expect(page.getByText(departmentA, { exact: true })).toHaveCount(0);
        await expect(page.getByText(departmentB, { exact: true })).toHaveCount(0);
    }
});
