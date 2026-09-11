import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

test('accomplishments comparison overview renders without affecting existing list', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/weekly-accomplishments');

    // Panel 1 — Overview Dashboard stat cards.
    await expect(page.getByTestId('stat-card-total-projects')).toBeVisible();
    await expect(page.getByTestId('stat-card-on-track')).toBeVisible();
    await expect(page.getByTestId('stat-card-needs-review')).toBeVisible();
    await expect(page.getByTestId('stat-card-with-discrepancy')).toBeVisible();

    // Tabs for PM / Foreman / Comparison filtering.
    await expect(page.getByRole('button', { name: 'Overview' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'PM Submissions' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Foreman Submissions' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Comparison' }).first()).toBeVisible();

    // Panel 2 — Project Progress (PM vs Foreman) table.
    const comparison = page.getByTestId('comparison-table');
    await expect(comparison).toBeVisible();
    await expect(comparison.getByText('Project Progress (PM vs Foreman)')).toBeVisible();
    await expect(comparison.getByPlaceholder('Search projects...')).toBeVisible();

    // Headers render words with icons (no text glyphs).
    await expect(comparison.getByText('PM Progress', { exact: true })).toBeVisible();
    await expect(comparison.getByText('Foreman Progress', { exact: true })).toBeVisible();
    await expect(comparison.getByText('Variance', { exact: true })).toBeVisible();

    // A missing side renders Pending instead of mirrored values (seed-dependent).
    const pendingPills = comparison.getByText('Pending', { exact: true });
    if ((await pendingPills.count()) > 0) {
        await expect(pendingPills.first()).toBeVisible();
    }

    // Variance legend.
    await expect(page.getByText('0 – 5% On Track')).toBeVisible();

    // The bottom week-bucket submissions list is temporarily hidden
    // (SHOW_SUBMISSIONS_LIST = false in WeeklyAccomplishmentsPage.jsx).
    await expect(page.getByTestId('submissions-list')).toHaveCount(0);

    // Comparison tab shows the analytics page (distinct from Overview) with
    // no submissions list.
    await page.getByRole('button', { name: 'Comparison' }).first().click();
    await expect(page).toHaveURL(/#comparison/);
    await expect(page.getByTestId('comparison-analytics')).toBeVisible();
    await expect(page.getByTestId('analytics-matrix')).toBeVisible();
    await expect(page.getByTestId('analytics-trend')).toBeVisible();
    await expect(page.getByTestId('analytics-freshness')).toBeVisible();
    await expect(page.getByTestId('analytics-distribution')).toBeVisible();
    await expect(page.getByTestId('analytics-headtohead')).toBeVisible();
    await expect(page.getByTestId('analytics-queue')).toHaveCount(0);
    await expect(page.getByTestId('comparison-table')).toHaveCount(0);
    await expect(page.getByTestId('submissions-list')).toHaveCount(0);

    // PM tab shows the submissions list filtered to PM rows.
    await page.getByRole('button', { name: 'PM Submissions' }).first().click();
    const submissionsList = page.getByTestId('submissions-list');
    await expect(submissionsList).toBeVisible();
    await expect(page.getByText('Submitted By', { exact: true }).first()).toBeVisible();

    // Tab filter row: search + submitter + single week only (no Project, no ranges).
    await expect(submissionsList.getByPlaceholder('Search weekly accomplishments...')).toBeVisible();
    await expect(submissionsList.locator('label').getByText('Project', { exact: true })).toHaveCount(0);
    await expect(submissionsList.locator('label').getByText('Week', { exact: true })).toBeVisible();
    await expect(submissionsList.locator('label').getByText('Week from', { exact: true })).toHaveCount(0);

    // Submitted By is a custom dropdown (no native select) with role-filtered
    // options, and group counts read submission/submissions.
    const submittedByFilter = submissionsList.getByTestId('filter-submitted-by');
    await expect(submittedByFilter).toBeVisible();
    await expect(submittedByFilter.locator('select')).toHaveCount(0);
    await expect(submissionsList.getByText(/submission/i).first()).toBeVisible();

    // Accordions start collapsed with per-group toggles only — expand the
    // first group, then the View toggle opens the slide-in sidebar.
    const groupToggles = submissionsList.getByTestId('accordion-group-toggle');
    if ((await groupToggles.count()) >= 2) {
        await groupToggles.nth(0).click();
        await expect(groupToggles.nth(0)).toHaveAttribute('aria-expanded', 'true');
        await groupToggles.nth(1).click();
        await expect(groupToggles.nth(1)).toHaveAttribute('aria-expanded', 'true');
        await expect(groupToggles.nth(0)).toHaveAttribute('aria-expanded', 'false');
    }
    if ((await groupToggles.count()) > 0) {
        await groupToggles.first().click();
    }
    const viewButtons = submissionsList.getByRole('button', { name: 'View submission details' });
    if ((await viewButtons.count()) > 0) {
        await viewButtons.first().click();
        const sidebar = page.getByTestId('submission-sidebar');
        await expect(sidebar).toBeVisible();
        await expect(page.getByTestId('submission-drawer')).toBeVisible();

        // Edge chevron toggles maximized size and back.
        const maximizeButton = page.getByRole('button', { name: 'Maximize submission details' });
        await expect(maximizeButton).toBeVisible();
        await maximizeButton.click();
        await expect(page.getByRole('button', { name: 'Restore submission details size' })).toBeVisible();
        await page.getByRole('button', { name: 'Restore submission details size' }).click();
        await expect(page.getByRole('button', { name: 'Maximize submission details' })).toBeVisible();

        // Sidebar photos open the reusable photo preview modal.
        await sidebar.getByRole('button', { name: /^Photos/ }).click();
        const sidebarImages = sidebar.locator('button img');
        if ((await sidebarImages.count()) > 0) {
            await sidebarImages.first().click();
            await expect(page.getByRole('button', { name: 'Prev' })).toBeVisible();
            await page.keyboard.press('Escape');
        }

        // Comments tab has the composer backed by the comments endpoints.
        await sidebar.getByRole('button', { name: 'Comments' }).click();
        await expect(sidebar.getByPlaceholder('Write a comment...')).toBeVisible();
        await expect(sidebar.getByRole('button', { name: /Post comment/ })).toBeVisible();

        // Location tab labels the map frame.
        await sidebar.getByRole('button', { name: 'Location' }).click();
        await expect(sidebar.getByText('Location:')).toBeVisible();

        const hideButton = page.getByRole('button', { name: 'Hide submission details' });
        await expect(hideButton).toBeVisible();
        await hideButton.click();
        await expect(page.getByTestId('submission-sidebar')).toHaveCount(0);
    }

    // Foreman tab shows the same list filtered to foreman rows.
    await page.getByRole('button', { name: 'Foreman Submissions' }).first().click();
    await expect(page.getByTestId('submissions-list')).toBeVisible();
    await expect(page.getByTestId('comparison-table')).toHaveCount(0);
});

test('accomplishments project row opens the standalone detail page', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/weekly-accomplishments');

    const comparison = page.getByTestId('comparison-table');
    await expect(comparison).toBeVisible();

    const detailButtons = comparison.getByRole('button', { name: /View .* details/ });
    const count = await detailButtons.count();
    if (count === 0) {
        // No seeded comparison data — the table shell itself is the assertion.
        await expect(comparison.getByText('Project Progress (PM vs Foreman)')).toBeVisible();
        return;
    }

    await detailButtons.first().click();
    await expect(page).toHaveURL(/\/weekly-accomplishments\/\d+/);
    await expect(page.getByTestId('project-detail')).toBeVisible();
    await expect(page.getByText('Project Detail View')).toBeVisible();

    // Work Item Breakdown lives on the Work Items tab only (the print copy
    // stays hidden on screen — first() resolves the visible one).
    await expect(page.getByTestId('breakdown-title').first()).toBeHidden();
    await page.getByRole('button', { name: 'Work Items' }).click();
    await expect(page).toHaveURL(/#work-items/);
    await expect(page.getByTestId('breakdown-title').first()).toBeVisible();

    // Detail inner tabs persist through the hash.
    await page.getByRole('button', { name: 'Reports' }).click();
    await expect(page).toHaveURL(/#reports/);
    await expect(page.getByTestId('breakdown-title').first()).toBeHidden();
    await page.reload();
    await expect(page).toHaveURL(/#reports/);
    await expect(page.getByTestId('breakdown-title').first()).toBeHidden();
});

test('accomplishments tabs persist through hash deep links and refresh', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/weekly-accomplishments#foreman-submissions');
    await expect(page.getByTestId('submissions-list')).toBeVisible();
    await expect(page.getByTestId('comparison-table')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('submissions-list')).toBeVisible();
    await expect(page.getByTestId('comparison-table')).toHaveCount(0);
});
