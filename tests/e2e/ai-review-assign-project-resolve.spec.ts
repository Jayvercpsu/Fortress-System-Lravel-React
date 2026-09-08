import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

const RECORD_ID = 9101;
const FOREMAN = 'Fortress Demo Foreman';

const stubRecord = {
    id: RECORD_ID,
    record_type: 'accomplishment',
    status: 'pending_project',
    project_id: null,
    project: null,
    image_index: 0,
    ai_parsed_data: {
        date: '2026-09-08',
        scopes: [
            {
                scope_name: 'floor',
                contract_amount: 1000,
                weight_percent: 5,
                progress_percent: 10,
                status: 'NOT_STARTED',
                assigned_personnel: '',
                remarks: '',
            },
        ],
    },
};

const stubContext = {
    foreman_options: [
        { id: 11, fullname: FOREMAN },
        { id: 12, fullname: 'Fortress Demo Co-Foreman' },
    ],
    scopes: [{ scope_name: 'Floor', assigned_personnel: '' }],
};

test('assigning a project triggers an AI scope check with loading state', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    await page.route('**/processed-records', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                saved: 1,
                skipped: 0,
                records: [stubRecord],
                accomplishment_context: {},
            }),
        });
    });
    await page.route(`**/processed-records/${RECORD_ID}/assign-project`, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                record: {
                    ...stubRecord,
                    project_id: DEMO_PROJECT_ID,
                    status: 'pending',
                    project: { id: DEMO_PROJECT_ID, name: 'Fortress Building' },
                },
                accomplishment_context: stubContext,
            }),
        });
    });
    await page.route(`**/processed-records/${RECORD_ID}/resolve-scopes`, async (route) => {
        // Hold the response briefly so the AI-checking state is observable.
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                record: {
                    ...stubRecord,
                    project_id: DEMO_PROJECT_ID,
                    status: 'pending',
                    project: { id: DEMO_PROJECT_ID, name: 'Fortress Building' },
                    ai_parsed_data: {
                        date: '2026-09-08',
                        scopes: [
                            {
                                scope_name: 'Floor',
                                contract_amount: 1000,
                                weight_percent: 5,
                                progress_percent: 10,
                                status: 'NOT_STARTED',
                                assigned_personnel: '',
                                remarks: '',
                            },
                        ],
                    },
                },
                resolved: 1,
                message: 'AI matched 1 scope(s) to the project.',
            }),
        });
    });

    await page.getByRole('button', { name: /AI Upload/i }).click();
    await page.locator('input[type="file"]').setInputFiles({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
    });
    await page.getByRole('button', { name: /Process/i }).click();

    await expect(page.getByTestId('review-records-dialog')).toBeVisible();
    await page.locator('[data-testid="review-records-list"]').getByText('Record 1').click();
    await expect(page.locator('body')).toContainText('This record needs a project assignment');

    await page.getByTestId('review-records-dialog').locator('select').selectOption(String(DEMO_PROJECT_ID));

    await expect(page.getByLabel('Checking scopes for record 9101')).toBeVisible();
    await expect(page.locator('body')).toContainText('AI is checking scopes');
    await expect(page.locator('body')).toContainText('AI matched 1 scope to the project');
    await expect(page.getByLabel('Assign foreman for Floor')).toBeVisible();
});
