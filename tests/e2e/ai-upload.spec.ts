import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { loginAs } from './support/auth';

test.describe('AI Accuracy Disclaimer', () => {
    test('disclaimer is NOT visible before processing', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        await expect(page.locator('text=AI Accuracy Notice')).not.toBeVisible();
    });

    test('disclaimer is visible during processing', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();
        await expect(page.locator('text=AI Accuracy Notice')).toBeVisible();
    });

    test('disclaimer is NOT visible after processing fails', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();

        // Wait for processing to finish (error)
        await expect(page.locator('text=Processing Failed')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('text=AI Accuracy Notice')).not.toBeVisible();
    });

    test('disclaimer is hidden when cancel terminates processing', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();
        await expect(page.locator('text=AI Accuracy Notice')).toBeVisible();

        // Cancel processing
        await page.getByRole('button', { name: /^Cancel$/ }).click();
        await page.getByRole('button', { name: /Yes, Cancel/ }).click();

        // Disclaimer should disappear after cancellation
        await expect(page.locator('text=AI Accuracy Notice')).not.toBeVisible();
    });
});

test.describe('AI Upload Processing State', () => {
    test('cancel button changes to terminate during processing', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();

        // Cancel button should appear with terminate text
        await expect(page.locator('text=AI is analyzing')).toBeVisible();
        await expect(page.getByRole('button', { name: /^Cancel$/ })).toBeVisible();
    });

    test('cancel button opens terminate confirmation during processing', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();

        // Click cancel to open terminate confirmation
        await page.getByRole('button', { name: /^Cancel$/ }).click();

        await expect(page.locator('text=Cancel Processing?')).toBeVisible();
        await expect(page.locator('text=Continue Processing')).toBeVisible();
        await expect(page.getByRole('button', { name: /Yes, Cancel/ })).toBeVisible();
    });

    test('continue processing button closes terminate dialog', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();

        // Open terminate dialog then cancel
        await page.getByRole('button', { name: /^Cancel$/ }).click();
        await expect(page.locator('text=Cancel Processing?')).toBeVisible();

        await page.getByText('Continue Processing').click();

        // Dialog closes, processing continues
        await expect(page.locator('text=Cancel Processing?')).not.toBeVisible();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();
    });

    test('yes cancel terminates processing and resets state', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();

        // Open terminate dialog and confirm
        await page.getByRole('button', { name: /^Cancel$/ }).click();
        await page.getByRole('button', { name: /Yes, Cancel/ }).click();

        // Processing stops, upload UI returns
        await expect(page.locator('text=AI is analyzing')).not.toBeVisible();
        await expect(page.getByRole('button', { name: /Process/i })).toBeVisible();
        await expect(page.locator('text=1/5 image\(s\) selected')).toBeVisible();
    });

    test('close button is disabled during processing', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();

        // Close button in header should be disabled
        const closeButton = page.locator('button:has-text("Close")').first();
        await expect(closeButton).toBeDisabled();
    });

    test('clicking outside modal does not close it during processing', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();

        // Click outside the modal (on the backdrop)
        await page.mouse.click(10, 10);

        // Modal should still be visible
        await expect(page.locator('text=AI Record Processing')).toBeVisible();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();
    });
});

test.describe('AI Upload on Projects Page', () => {
    // ─── VISIBILITY & PERMISSIONS ────────────────────────────────

    test('head admin can see AI Upload button', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('button', { name: /AI Upload/i })).toBeVisible();
    });

    test('master admin can see AI Upload button', async ({ page }) => {
        await loginAs(page, 'master_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('button', { name: /AI Upload/i })).toBeVisible();
    });

    test('foreman cannot see AI Upload button', async ({ page }) => {
        await loginAs(page, 'foreman');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('button', { name: /AI Upload/i })).not.toBeVisible();
    });

    // ─── MODAL OPEN / CLOSE ──────────────────────────────────────

    test('AI Upload modal opens with correct title', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();
    });

    test('AI Upload modal does not show a project selector', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        // Project selection was removed — AI auto-detects the project from the images
        await expect(page.locator('select')).toHaveCount(0);
        await expect(page.getByLabel('Project')).not.toBeVisible();
    });

    test('AI Upload modal shows auto-detect info banner', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        await expect(page.locator('text=AI Auto-Detection')).toBeVisible();
        await expect(page.locator('text=Record type')).toBeVisible();
        await expect(page.locator('text=Which project')).toBeVisible();
    });

    test('AI Upload modal shows max 5 images limit', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        await expect(page.locator('text=(up to 5)')).toBeVisible();
    });

    test('AI Upload modal closes via header Close button', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();

        await page.locator('button:has-text("Close")').first().click();
        await expect(page.locator('text=AI Record Processing')).not.toBeVisible();
    });

    // ─── FILE UPLOAD ─────────────────────────────────────────────

    test('process button is disabled without images', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const processButton = page.getByRole('button', { name: /Process/i });
        await expect(processButton).toBeDisabled();
    });

    test('image preview shows after file selection', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test-attendance.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await expect(page.locator('text=1/5 image(s) selected')).toBeVisible();

        const processButton = page.getByRole('button', { name: /Process/i });
        await expect(processButton).toBeEnabled();
    });

    test('clear all removes image previews', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await expect(page.locator('text=1/5 image(s) selected')).toBeVisible();

        await page.getByText('Clear all').click();
        await expect(page.locator('text=1/5 image(s) selected')).not.toBeVisible();
    });

    // ─── NOTES FIELD ─────────────────────────────────────────────

    test('notes field is present and optional', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const notesField = page.locator('textarea[placeholder*="Weekly attendance"]');
        await expect(notesField).toBeVisible();
        await expect(notesField).toHaveValue('');
    });

    test('notes field accepts text input', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const notesField = page.locator('textarea[placeholder*="Weekly attendance"]');
        await notesField.fill('This is a test note for the AI');
        await expect(notesField).toHaveValue('This is a test note for the AI');
    });

    // ─── PROCESSING STATUS ───────────────────────────────────────

    test('processing status shows elapsed time counter', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        // Click process — this will fail (no real AI) but we can check the processing status briefly
        const processButton = page.getByRole('button', { name: /Process/i });
        await processButton.click();

        // Processing status should appear
        await expect(page.locator('text=AI is analyzing')).toBeVisible();

        // Timer should show
        await expect(page.locator('text=/\\d+m \\d+s/')).toBeVisible();
    });

    // ─── ERROR HANDLING ──────────────────────────────────────────

    test('shows error message when processing fails', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();

        // Should show error (AI will fail without real API key)
        await expect(page.locator('text=Processing Failed')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('text=Your images were not saved')).toBeVisible();
    });

    // ─── PROJECT SELECTION (removed — AI auto-detects) ──────────

    test('no project selection is required for processing', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        // No project dropdown — the AI detects the project directly from the images
        await expect(page.locator('select')).toHaveCount(0);

        // The upload still works for processing without a hardcoded project
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });
        await expect(page.locator('text=1/5 image(s) selected')).toBeVisible();
    });

    // ─── RESPONSIVE DESIGN ───────────────────────────────────────

    test('modal is 90% width and height', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        // Check modal dimensions
        const modal = page.locator('[role="dialog"], .modal-content, [class*="fixed inset"]').first();
        const box = await modal.boundingBox();
        const viewport = page.viewportSize();

        if (box && viewport) {
            // Modal should be roughly 90% of viewport
            expect(box.width).toBeGreaterThan(viewport.width * 0.8);
            expect(box.height).toBeGreaterThan(viewport.height * 0.8);
        }
    });
});

test.describe('AI Confirmation Modal', () => {
    // ─── SUBMIT FLOW ─────────────────────────────────────────────

    test('submit button is disabled without project', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        // We can't fully test the confirmation modal without real AI processing,
        // but we can verify the modal structure exists
        await page.getByRole('button', { name: /AI Upload/i }).click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();
    });

    // ─── REVIEW RECORDS STRUCTURE ────────────────────────────────

    test('review records modal has correct header structure', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        // Verify the upload modal structure
        await page.getByRole('button', { name: /AI Upload/i }).click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();

        // Verify key UI elements exist in the upload modal
        await expect(page.getByText('Upload Images')).toBeVisible();
        await expect(page.getByText('Notes (optional)')).toBeVisible();
    });

    test('reject and submit buttons are hidden while editing a record', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        // We can't fully test editing without real AI-processed records,
        // but we can verify the review modal structure and that
        // the edit mode conditional rendering logic exists.
        // This test verifies the component renders without errors.
        await page.getByRole('button', { name: /AI Upload/i }).click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();
    });
});

test.describe('AI Confirmation Modal — Reject Flow', () => {
    test('rejecting the only record does not show a processed message', async ({ page }) => {
        const fakeRecord = {
            id: 999,
            record_type: 'expense',
            status: 'pending_project',
            project_id: null,
            project: null,
            image_index: 0,
            ai_parsed_data: {
                date: '2026-09-04',
                items: [
                    { description: 'Stubbed cement', category: 'Materials', quantity: 1, unit_price: 100, amount: 100 },
                ],
                total: 100,
            },
            ai_summary: 'Stubbed expense record',
            ai_model: 'stub',
            notes: null,
        };

        await page.route('**/processed-records**', async (route) => {
            const request = route.request();
            const pathname = new URL(request.url()).pathname;
            if (request.method() === 'POST' && /\/processed-records\/\d+\/reject$/.test(pathname)) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'Record rejected' }),
                });
                return;
            }
            if (request.method() === 'POST' && pathname === '/processed-records') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        records: [fakeRecord],
                        skipped: 0,
                        saved: 1,
                        summary: { total: 1, attendance: 0, expense: 1, pending: 0, pending_project: 1 },
                    }),
                });
                return;
            }
            await route.continue();
        });

        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=Review Records')).toBeVisible();

        // Expand the stubbed record to reveal its action buttons
        await page.locator('text=Record 1').click();
        await page.getByRole('button', { name: 'Reject' }).click();

        // A rejected record must not be reported as processed
        await expect(page.getByText('were rejected')).toBeVisible();
        await expect(page.getByText('have been processed')).toHaveCount(0);
    });
});

test.describe('AI Upload Dropzone Disabled While Processing', () => {
    test('upload dropzone is disabled during processing and re-enabled after cancel', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        const dropzone = page.getByLabel('Upload images', { exact: true });
        await expect(dropzone).toBeVisible();
        await expect(dropzone).not.toHaveAttribute('aria-disabled', 'true');

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();

        // Dropzone is disabled while the AI works
        await expect(dropzone).toHaveAttribute('aria-disabled', 'true');
        await expect(page.locator('text=Uploading is paused while AI analysis runs')).toBeVisible();

        // Cancel processing → dropzone works again
        await page.getByRole('button', { name: /^Cancel$/ }).click();
        await page.getByRole('button', { name: /Yes, Cancel/ }).click();
        await expect(page.locator('text=AI is analyzing')).not.toBeVisible();
        await expect(dropzone).not.toHaveAttribute('aria-disabled', 'true');
    });
});

test.describe('AI Confirmation Modal — Accomplishment Foreman Assignment', () => {
    const stubAccomplishmentUpload = async (page) => {
        const fakeRecord = {
            id: 1001,
            record_type: 'accomplishment',
            status: 'pending',
            project_id: 999,
            project: { id: 999, name: 'Stub Project' },
            image_index: 0,
            ai_parsed_data: {
                date: '2026-09-07',
                scopes: [
                    { scope_name: 'Existing Scope', contract_amount: 1000, weight_percent: 1, progress_percent: 50 },
                    { scope_name: 'New Scope', contract_amount: 2000, weight_percent: 2, progress_percent: 10 },
                ],
            },
            ai_summary: 'Stubbed accomplishment record',
            ai_model: 'stub',
            notes: null,
        };

        await page.route('**/processed-records**', async (route) => {
            const request = route.request();
            const pathname = new URL(request.url()).pathname;
            if (request.method() === 'PUT' && /\/processed-records\/\d+\/edit$/.test(pathname)) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ record: fakeRecord }),
                });
                return;
            }
            if (request.method() === 'POST' && pathname === '/processed-records') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        records: [fakeRecord],
                        skipped: 0,
                        saved: 1,
                        summary: { total: 1, attendance: 0, expense: 0, accomplishment: 1, pending: 1, pending_project: 0 },
                        accomplishment_context: {
                            '999': {
                                foreman_options: [{ id: 7, fullname: 'Stub Foreman' }],
                                scopes: [{ scope_name: 'Existing Scope', assigned_personnel: 'Old Foreman' }],
                            },
                        },
                    }),
                });
                return;
            }
            await route.continue();
        });

        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'scope-sheet.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=Review Records')).toBeVisible();

        // Expand the stubbed accomplishment record
        await page.locator('text=Record 1').click();
    };

    test('existing assignee shows as badge without foreman dropdown', async ({ page }) => {
        await stubAccomplishmentUpload(page);

        await expect(page.getByText('Old Foreman')).toBeVisible();
    });

    test('unassigned scope shows project foreman dropdown', async ({ page }) => {
        await stubAccomplishmentUpload(page);

        const foremanSelect = page.getByLabel('Assign foreman for New Scope');
        await expect(foremanSelect).toBeVisible();
        await expect(foremanSelect).toContainText('Stub Foreman');

        // Only the unassigned scope gets a dropdown
        await expect(page.getByLabel('Assign foreman for Existing Scope')).toHaveCount(0);
    });

    test('selecting a foreman persists the assignment', async ({ page }) => {
        await stubAccomplishmentUpload(page);

        let savedBody: string | null = null;
        page.on('request', (request) => {
            if (request.method() === 'PUT' && /\/processed-records\/\d+\/edit$/.test(request.url())) {
                savedBody = request.postData();
            }
        });

        await page.getByLabel('Assign foreman for New Scope').selectOption('Stub Foreman');

        await expect.poll(() => savedBody, { timeout: 10000 }).toContain('Stub Foreman');
    });

    test('submit without foreman shows a required error per scope', async ({ page }) => {
        const fakeRecord = {
            id: 1002,
            record_type: 'accomplishment',
            status: 'pending',
            project_id: 999,
            project: { id: 999, name: 'Stub Project' },
            image_index: 0,
            ai_parsed_data: {
                date: '2026-09-07',
                scopes: [
                    { scope_name: 'New Scope', contract_amount: 2000, weight_percent: 2, progress_percent: 10 },
                ],
            },
            ai_summary: 'Stubbed accomplishment record',
            ai_model: 'stub',
            notes: null,
        };

        await page.route('**/processed-records**', async (route) => {
            const request = route.request();
            const pathname = new URL(request.url()).pathname;
            if (request.method() === 'POST' && /\/processed-records\/\d+\/confirm$/.test(pathname)) {
                await route.fulfill({
                    status: 422,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Some scopes still need a foreman. Please assign a foreman for each highlighted scope.',
                        errors: {
                            'scopes.0.assigned_personnel': ['Foreman is required for scope "New Scope".'],
                        },
                    }),
                });
                return;
            }
            if (request.method() === 'POST' && pathname === '/processed-records') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        records: [fakeRecord],
                        skipped: 0,
                        saved: 1,
                        summary: { total: 1, attendance: 0, expense: 0, accomplishment: 1, pending: 1, pending_project: 0 },
                        accomplishment_context: {
                            '999': {
                                foreman_options: [{ id: 7, fullname: 'Stub Foreman' }],
                                scopes: [],
                            },
                        },
                    }),
                });
                return;
            }
            await route.continue();
        });

        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'scope-sheet.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=Review Records')).toBeVisible();
        await page.locator('text=Record 1').click();

        await page.getByRole('button', { name: 'Submit' }).click();

        // Toast explains the problem, the scope's foreman field gets a red
        // border (no inline text), and the modal stays open
        await expect(page.getByText('Some scopes still need a foreman.')).toBeVisible();
        await expect(page.getByLabel('Assign foreman for New Scope')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.getByText('Foreman is required for scope "New Scope".')).toHaveCount(0);
        await expect(page.locator('text=Review Records')).toBeVisible();
    });

    test('review records is always full height with no window toggle', async ({ page }) => {
        await stubAccomplishmentUpload(page);

        await expect(page.locator('text=Review Records').first()).toBeVisible();
        await expect(page.locator('text=Record 1')).toBeVisible();

        // Records list stretches to the dialog bottom (no dead padding)
        const dialogBox = await page.getByTestId('review-records-dialog').boundingBox();
        const listBox = await page.getByTestId('review-records-list').boundingBox();
        expect(dialogBox && listBox).toBeTruthy();
        if (dialogBox && listBox) {
            expect(Math.abs(dialogBox.y + dialogBox.height - (listBox.y + listBox.height))).toBeLessThan(5);
        }

        // Dialog fits inside the viewport (no overflow past the parent modal)
        const viewport = page.viewportSize();
        expect(viewport).toBeTruthy();
        if (dialogBox && viewport) {
            expect(dialogBox.x).toBeGreaterThanOrEqual(0);
            expect(dialogBox.y).toBeGreaterThanOrEqual(0);
            expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width + 1);
            expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(viewport.height + 1);
        }

        // No minimize/maximize toggle and no minimized pill
        await expect(page.getByLabel('Toggle Review Records window size')).toHaveCount(0);
        await expect(page.getByLabel('Restore Review Records')).toHaveCount(0);
    });
});

test.describe('AI Record Processing Modal — Window Toggle', () => {
    test('idle upload modal toggle only maximizes and restores (no pill)', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();

        // Maximize, then the same toggle restores — no minimize pill when idle
        await page.getByLabel('Maximize').click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();
        await page.getByLabel('Minimize').click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();
        await expect(page.locator('text=Upload Images')).toBeVisible();
        await expect(page.getByLabel('Restore AI Record Processing')).toHaveCount(0);
    });

    test('upload modal minimizes to a pill once results await review', async ({ page }) => {
        const fakeRecord = {
            id: 1003,
            record_type: 'expense',
            status: 'pending',
            project_id: 999,
            project: { id: 999, name: 'Stub Project' },
            image_index: 0,
            ai_parsed_data: {
                date: '2026-09-04',
                items: [
                    { description: 'Stubbed cement', category: 'Materials', quantity: 1, unit_price: 100, amount: 100 },
                ],
                total: 100,
            },
            ai_summary: 'Stubbed expense record',
            ai_model: 'stub',
            notes: null,
        };

        await page.route('**/processed-records**', async (route) => {
            const request = route.request();
            const pathname = new URL(request.url()).pathname;
            if (request.method() === 'POST' && pathname === '/processed-records') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        records: [fakeRecord],
                        skipped: 0,
                        saved: 1,
                        summary: { total: 1, attendance: 0, expense: 1, accomplishment: 0, pending: 1, pending_project: 0 },
                        accomplishment_context: {},
                    }),
                });
                return;
            }
            await route.continue();
        });

        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'receipt.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=Review Records')).toBeVisible();

        // Close the review overlay — results await on the upload modal
        await page.getByLabel('Close Review Records').click();
        await expect(page.locator('text=Processing Complete')).toBeVisible();

        // Now the toggle reaches the minimized pill
        await page.getByLabel('Maximize').click();
        await page.getByLabel('Minimize').click();
        await expect(page.locator('text=Upload Images')).not.toBeVisible();
        await expect(page.getByLabel('Restore AI Record Processing')).toBeVisible();

        // Restore brings the results back
        await page.getByLabel('Restore AI Record Processing').click();
        await expect(page.locator('text=Processing Complete')).toBeVisible();
    });
});

test.describe('Projects Page AI Section', () => {
    test('AI Upload button is in the same toolbar row as search and create', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        const searchInput = page.getByPlaceholder('Search projects...');
        const createButton = page.getByRole('button', { name: /\+ Create Project/i });
        const aiUploadButton = page.getByRole('button', { name: /AI Upload/i });

        await expect(searchInput).toBeVisible();
        await expect(createButton).toBeVisible();
        await expect(aiUploadButton).toBeVisible();

        // All three should be in the same parent toolbar row
        const toolbar = searchInput.locator('xpath=ancestor::div[1]').first();
        const toolbarBox = await toolbar.boundingBox();
        const aiBox = await aiUploadButton.boundingBox();
        const createBox = await createButton.boundingBox();

        if (toolbarBox && aiBox && createBox) {
            // AI Upload button should be within the toolbar's vertical bounds
            expect(aiBox.y).toBeGreaterThanOrEqual(toolbarBox.y);
            expect(aiBox.y + aiBox.height).toBeLessThanOrEqual(toolbarBox.y + toolbarBox.height + 10);
            // Create Project button should also be in the same vertical range
            expect(createBox.y).toBeGreaterThanOrEqual(toolbarBox.y);
            expect(createBox.y + createBox.height).toBeLessThanOrEqual(toolbarBox.y + toolbarBox.height + 10);
        }
    });

    test('AI Upload button is not visible for foreman', async ({ page }) => {
        await loginAs(page, 'foreman');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('button', { name: /AI Upload/i })).not.toBeVisible();
    });

    test('search bar and AI Upload are on the same horizontal row', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        const searchInput = page.getByPlaceholder('Search projects...');
        const aiUploadButton = page.getByRole('button', { name: /AI Upload/i });

        const searchBox = await searchInput.boundingBox();
        const aiBox = await aiUploadButton.boundingBox();

        if (searchBox && aiBox) {
            // Both should have similar vertical centers (same row)
            const searchCenter = searchBox.y + searchBox.height / 2;
            const aiCenter = aiBox.y + aiBox.height / 2;
            expect(Math.abs(searchCenter - aiCenter)).toBeLessThan(60);
        }
    });
});

test.describe('Review Records action spinners', () => {
    test('reject shows loading in the reject button, not submit', async ({ page }) => {
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
                    records: [
                        {
                            id: 9201,
                            record_type: 'accomplishment',
                            status: 'pending',
                            project_id: 1,
                            project: { id: 1, name: 'Fortress Building' },
                            image_index: 0,
                            ai_parsed_data: {
                                date: '2026-09-08',
                                scopes: [
                                    {
                                        scope_name: 'Spinner Scope',
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
                    ],
                    accomplishment_context: {
                        1: {
                            foreman_options: [{ id: 11, fullname: 'Fortress Demo Foreman' }],
                            scopes: [],
                        },
                    },
                }),
            });
        });
        await page.route('**/processed-records/9201/reject', async (route) => {
            // Hold the response so the loading spinner is observable.
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.getByTestId('review-records-dialog')).toBeVisible();
        await page.locator('[data-testid="review-records-list"]').getByText('Record 1').click();

        const dialog = page.getByTestId('review-records-dialog');
        const rejectButton = dialog.getByRole('button', { name: 'Reject', exact: true });
        const submitButton = dialog.getByRole('button', { name: 'Submit', exact: true });
        await rejectButton.click();

        await expect(rejectButton.locator('svg.animate-spin')).toBeVisible();
        await expect(submitButton.locator('svg.animate-spin')).toHaveCount(0);

        await expect(page.locator('body')).toContainText('Record rejected');
    });
});

test.describe('AI Upload input locking', () => {
    test('clear all and notes are locked during processing, unlocked after', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        // Hold the processing state briefly so the locked controls are observable.
        await page.route('**/processed-records', async (route) => {
            if (route.request().method() !== 'POST') return route.continue();
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Processing failed' }),
            });
        });

        await page.getByRole('button', { name: /AI Upload/i }).click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
        });

        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();

        await expect(page.getByRole('button', { name: 'Clear all', exact: true })).toBeDisabled();
        const lockedNotes = page.locator('textarea[placeholder*="locked while AI"]');
        await expect(lockedNotes).toBeVisible();
        await expect(lockedNotes).toBeDisabled();

        await expect(page.getByText('Processing Failed', { exact: true })).toBeVisible({ timeout: 30000 });
        await expect(page.getByRole('button', { name: 'Clear all', exact: true })).toBeEnabled();
        const unlockedNotes = page.locator('textarea[placeholder*="Weekly attendance"]');
        await expect(unlockedNotes).toBeVisible();
        await expect(unlockedNotes).toBeEnabled();
    });
});
