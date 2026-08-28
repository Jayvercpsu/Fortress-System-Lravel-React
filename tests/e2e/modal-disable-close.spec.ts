import { test, expect } from '@playwright/test';
import { loginAs } from './support/auth';

/**
 * We test disableClose through the AI Upload modal since it passes
 * disableClose={processing} to Modal. When processing is active the
 * modal should ignore outside clicks, Escape, and the header Close button.
 */

test.describe('Modal disableClose prop', () => {
    test('modal closes on outside click when disableClose is false', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();

        // Click outside the modal — should close
        await page.mouse.click(10, 10);
        await expect(page.locator('text=AI Record Processing')).not.toBeVisible();
    });

    test('modal closes on Escape when disableClose is false', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();

        // Press Escape — should close
        await page.keyboard.press('Escape');
        await expect(page.locator('text=AI Record Processing')).not.toBeVisible();
    });

    test('modal closes on header Close button when disableClose is false', async ({ page }) => {
        await loginAs(page, 'head_admin');
        await page.goto('/projects');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /AI Upload/i }).click();
        await expect(page.locator('text=AI Record Processing')).toBeVisible();

        // Click header Close button — should close
        await page.locator('button:has-text("Close")').first().click();
        await expect(page.locator('text=AI Record Processing')).not.toBeVisible();
    });

    test('modal stays open on outside click when disableClose is true', async ({ page }) => {
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

        // Start processing — this sets disableClose=true
        await page.getByRole('button', { name: /Process/i }).click();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();

        // Click outside the modal — should NOT close
        await page.mouse.click(10, 10);
        await expect(page.locator('text=AI Record Processing')).toBeVisible();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();
    });

    test('modal stays open on Escape when disableClose is true', async ({ page }) => {
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

        // Press Escape — should NOT close
        await page.keyboard.press('Escape');
        await expect(page.locator('text=AI Record Processing')).toBeVisible();
        await expect(page.locator('text=AI is analyzing')).toBeVisible();
    });

    test('header Close button is disabled when disableClose is true', async ({ page }) => {
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

        // Header Close button should be disabled
        const closeButton = page.locator('button:has-text("Close")').first();
        await expect(closeButton).toBeDisabled();
    });
});
