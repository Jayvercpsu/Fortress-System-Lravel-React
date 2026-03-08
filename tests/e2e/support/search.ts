import { expect, Page } from '@playwright/test';

export type SearchCase = {
    name: string;
    path: string;
    placeholder: string;
    queryParam: string;
    value: string;
    mode?: 'debounce' | 'submit' | 'client';
    submitLabel?: string;
    emptyMessage?: string;
};

export async function verifySearch(page: Page, searchCase: SearchCase) {
    await page.goto(searchCase.path);

    const input = page.getByPlaceholder(searchCase.placeholder);
    await expect(input, `Missing search input: ${searchCase.placeholder}`).toBeVisible();

    if (searchCase.mode === 'client') {
        if (!searchCase.emptyMessage) {
            throw new Error(`Missing emptyMessage for client-side search case: ${searchCase.name}`);
        }

        const emptyLocator = page.getByText(searchCase.emptyMessage);
        await expect(emptyLocator).toHaveCount(0);
        await input.fill(searchCase.value);
        await expect(emptyLocator).toBeVisible({ timeout: 5000 });
        return;
    }

    await input.fill(searchCase.value);

    if (searchCase.mode === 'submit') {
        const label = searchCase.submitLabel ?? 'Search';
        await page.getByRole('button', { name: label }).click();
    }

    await expect.poll(
        () => new URL(page.url()).searchParams.get(searchCase.queryParam),
        { timeout: 5000 }
    ).toBe(searchCase.value);
}
