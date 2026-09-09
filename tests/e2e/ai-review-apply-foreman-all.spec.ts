import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

const RECORD_ID = 9001;
const SCOPE_A = 'E2E ApplyAll Scope A';
const SCOPE_B = 'E2E ApplyAll Scope B';
const FOREMAN = 'Fortress Demo Foreman';

const stubUploadResponse = {
    saved: 1,
    skipped: 0,
    records: [
        {
            id: RECORD_ID,
            record_type: 'accomplishment',
            status: 'pending',
            project_id: DEMO_PROJECT_ID,
            project: { id: DEMO_PROJECT_ID, name: 'Fortress Building' },
            image_index: 0,
            ai_parsed_data: {
                date: '2026-09-08',
                scopes: [
                    {
                        scope_name: SCOPE_A,
                        contract_amount: 1000,
                        weight_percent: 5,
                        progress_percent: 10,
                        status: 'NOT_STARTED',
                        assigned_personnel: '',
                        remarks: '',
                    },
                    {
                        scope_name: SCOPE_B,
                        contract_amount: 2000,
                        weight_percent: 5,
                        progress_percent: 20,
                        status: 'NOT_STARTED',
                        assigned_personnel: '',
                        remarks: '',
                    },
                ],
            },
        },
    ],
    accomplishment_context: {
        [DEMO_PROJECT_ID]: {
            foreman_options: [
                { id: 11, fullname: FOREMAN },
                { id: 12, fullname: 'Fortress Demo Co-Foreman' },
            ],
            scopes: [],
        },
    },
};

test('review records can apply one foreman to all scopes at once', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/projects');
    await page.waitForLoadState('load');

    let putBody = null;
    await page.route('**/processed-records', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(stubUploadResponse),
        });
    });
    await page.route(`**/processed-records/${RECORD_ID}/edit`, async (route) => {
        putBody = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
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
    await expect(page.locator('body')).toContainText(SCOPE_A);
    await expect(page.locator('body')).toContainText(SCOPE_B);

    const applyAll = page.getByLabel(`Apply foreman to all scopes in record ${RECORD_ID}`);
    await expect(applyAll).toBeVisible();

    const putPromise = page.waitForResponse(`**/processed-records/${RECORD_ID}/edit`, { timeout: 20000 });
    await applyAll.selectOption(FOREMAN);
    await putPromise;

    await expect(page.locator('body')).toContainText('Foreman applied to 2 scopes');
    await expect(page.getByLabel(`Assign foreman for ${SCOPE_A}`)).toHaveValue(FOREMAN);
    await expect(page.getByLabel(`Assign foreman for ${SCOPE_B}`)).toHaveValue(FOREMAN);

    expect(putBody?.ai_parsed_data?.scopes).toHaveLength(2);
    for (const scope of putBody.ai_parsed_data.scopes) {
        expect(scope.assigned_personnel).toBe(FOREMAN);
    }

    // Every scope now has a foreman, so the bulk-apply row and hint hide.
    await expect(page.getByLabel(`Apply foreman to all scopes in record ${RECORD_ID}`)).toBeHidden();
    await expect(page.getByText('Some scopes have no foreman yet')).toBeHidden();
});

test('apply to all stays hidden when every scope already has a foreman', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/projects');
    await page.waitForLoadState('load');

    await page.route('**/processed-records', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                saved: 1,
                skipped: 0,
                records: [
                    {
                        id: RECORD_ID,
                        record_type: 'accomplishment',
                        status: 'pending',
                        project_id: DEMO_PROJECT_ID,
                        project: { id: DEMO_PROJECT_ID, name: 'Fortress Building' },
                        image_index: 0,
                        ai_parsed_data: {
                            date: '2026-09-08',
                            scopes: [
                                {
                                    scope_name: SCOPE_A,
                                    contract_amount: 1000,
                                    weight_percent: 5,
                                    progress_percent: 10,
                                    status: 'NOT_STARTED',
                                    assigned_personnel: 'fortress demo foreman',
                                    remarks: '',
                                },
                                {
                                    scope_name: SCOPE_B,
                                    contract_amount: 2000,
                                    weight_percent: 5,
                                    progress_percent: 20,
                                    status: 'NOT_STARTED',
                                    assigned_personnel: '',
                                    remarks: '',
                                },
                            ],
                        },
                    },
                ],
                accomplishment_context: {
                    [DEMO_PROJECT_ID]: {
                        foreman_options: [
                            { id: 11, fullname: FOREMAN },
                            { id: 12, fullname: 'Fortress Demo Co-Foreman' },
                        ],
                        scopes: [
                            { scope_name: SCOPE_B, assigned_personnel: 'Fortress Demo Co-Foreman' },
                        ],
                    },
                },
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
    await expect(page.locator('body')).toContainText(SCOPE_A);

    await expect(page.getByLabel(`Apply foreman to all scopes in record ${RECORD_ID}`)).toBeHidden();
    await expect(page.getByText('Some scopes have no foreman yet')).toBeHidden();
});

test('submit validation auto-scrolls the first invalid scope into view', async ({ page }) => {
    const scrollScopes = Array.from({ length: 12 }, (_, i) => ({
        scope_name: `E2E Scroll Scope ${i + 1}`,
        contract_amount: 1000,
        weight_percent: 5,
        progress_percent: 10,
        status: 'NOT_STARTED',
        assigned_personnel: '',
        remarks: '',
    }));

    await loginAs(page, 'head_admin');
    await page.goto('/projects');
    await page.waitForLoadState('load');

    await page.route('**/processed-records', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                saved: 1,
                skipped: 0,
                records: [
                    {
                        id: RECORD_ID,
                        record_type: 'accomplishment',
                        status: 'pending',
                        project_id: DEMO_PROJECT_ID,
                        project: { id: DEMO_PROJECT_ID, name: 'Fortress Building' },
                        image_index: 0,
                        ai_parsed_data: { date: '2026-09-08', scopes: scrollScopes },
                    },
                ],
                accomplishment_context: {
                    [DEMO_PROJECT_ID]: {
                        foreman_options: [
                            { id: 11, fullname: FOREMAN },
                            { id: 12, fullname: 'Fortress Demo Co-Foreman' },
                        ],
                        scopes: [],
                    },
                },
            }),
        });
    });
    await page.route(`**/processed-records/${RECORD_ID}/confirm`, async (route) => {
        await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
                message: 'Please fix the highlighted fields',
                errors: { 'scopes.11.assigned_personnel': ['Foreman is required.'] },
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
    await expect(page.locator('body')).toContainText('E2E Scroll Scope 12');

    await page.getByRole('button', { name: 'Submit' }).click();

    const invalidSelect = page.getByLabel('Assign foreman for E2E Scroll Scope 12');
    await expect(invalidSelect).toHaveAttribute('aria-invalid', 'true');
    await expect(invalidSelect).toBeInViewport();
});

test('fixing the top error scrolls to the next record still missing a foreman', async ({ page }) => {
    const makeScopes = (tag) =>
        Array.from({ length: 8 }, (_, i) => ({
            scope_name: `E2E TwoRec ${tag} Scope ${i + 1}`,
            contract_amount: 1000,
            weight_percent: 5,
            progress_percent: 10,
            status: 'NOT_STARTED',
            assigned_personnel: '',
            remarks: '',
        }));

    await loginAs(page, 'head_admin');
    await page.goto('/projects');
    await page.waitForLoadState('load');

    await page.route('**/processed-records', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                saved: 2,
                skipped: 0,
                records: [9001, 9002].map((id, idx) => ({
                    id,
                    record_type: 'accomplishment',
                    status: 'pending',
                    project_id: DEMO_PROJECT_ID,
                    project: { id: DEMO_PROJECT_ID, name: 'Fortress Building' },
                    image_index: 0,
                    ai_parsed_data: {
                        date: '2026-09-08',
                        scopes: makeScopes(idx === 0 ? 'A' : 'B'),
                    },
                })),
                accomplishment_context: {
                    [DEMO_PROJECT_ID]: {
                        foreman_options: [
                            { id: 11, fullname: FOREMAN },
                            { id: 12, fullname: 'Fortress Demo Co-Foreman' },
                        ],
                        scopes: [],
                    },
                },
            }),
        });
    });
    await page.route('**/processed-records/*/edit', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/processed-records/*/confirm', async (route) => {
        await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
                message: 'Please fix the highlighted fields',
                errors: { 'scopes.0.assigned_personnel': ['Foreman is required.'] },
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
    await expect(page.locator('body')).toContainText('E2E TwoRec A Scope 8');

    // Submit the first record: its scope 1 gets flagged and scrolled to.
    const firstRecord = page.locator('[data-testid="review-records-list"] > div').first();
    await firstRecord.getByRole('button', { name: 'Submit' }).click();
    const firstInvalid = page.getByLabel('Assign foreman for E2E TwoRec A Scope 1');
    await expect(firstInvalid).toHaveAttribute('aria-invalid', 'true');
    await expect(firstInvalid).toBeInViewport();

    // Submit the second record too so both records carry an error.
    await page.locator('[data-testid="review-records-list"]').getByText('Record 2').click();
    const secondRecord = page.locator('[data-testid="review-records-list"] > div').nth(1);
    await secondRecord.getByRole('button', { name: 'Submit' }).click();
    const secondInvalid = page.getByLabel('Assign foreman for E2E TwoRec B Scope 1');
    await expect(secondInvalid).toHaveAttribute('aria-invalid', 'true');

    // Fix the top record's error: scroll must move to the remaining error.
    await page.locator('[data-testid="review-records-list"]').getByText('Record 1').click();
    await firstInvalid.selectOption(FOREMAN);
    await expect(secondInvalid).toBeInViewport();
});
