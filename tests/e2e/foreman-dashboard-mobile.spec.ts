import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

// Mobile viewport: the 860px weekly-projects table becomes stacked cards
// and nothing causes page-level horizontal overflow.
test.use({ viewport: { width: 390, height: 844 } });

test('foreman dashboard renders stacked cards instead of wide tables on mobile', async ({ page }) => {
    await loginAs(page, 'foreman');
    await page.goto('/foreman');
    await expect(page.getByText('Open Submissions')).toBeVisible();

    // Stat cards stack without overflowing the page.
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);

    // Weekly accomplishments section uses cards on mobile (desktop-only table).
    await expect(page.getByText('Weekly Progress Accomplishments by Project')).toBeVisible();
    await expect(page.getByTestId('weekly-projects-table')).toHaveCount(0);
    if ((await page.getByTestId('weekly-projects-cards').count()) > 0) {
        const cards = page.getByTestId('weekly-projects-cards');
        await expect(cards).toBeVisible();

        // Expanding a card keeps everything inside the viewport.
        const toggles = cards.getByRole('button', { name: /View details|Hide details/ });
        if ((await toggles.count()) > 0) {
            await toggles.first().click();
            await expect(cards.getByText(/Latest Week Scope Entries/).first()).toBeVisible();
            const overflowAfterExpand = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            );
            expect(overflowAfterExpand).toBeLessThanOrEqual(1);
        }
    } else {
        await expect(page.getByText('No weekly accomplishment submissions yet.')).toBeVisible();
    }
});
