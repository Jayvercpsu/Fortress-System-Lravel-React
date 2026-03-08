import { expect, Locator, Page } from '@playwright/test';

export function parseMoney(text: string): number {
    const source = String(text || '').trim();
    const negative = source.startsWith('-') || source.includes('(-') || /\(\s*P/i.test(source);
    const digits = source.replace(/[^0-9.]/g, '');
    const value = Number(digits || 0);
    return negative ? -value : value;
}

export async function readMoney(locator: Locator): Promise<number> {
    return parseMoney(await locator.innerText());
}

export async function readStatMoney(page: Page, label: string): Promise<number> {
    const slug = slugify(label);
    return readMoney(page.getByTestId(`stat-value-${slug}`));
}

export async function readLabeledMoney(page: Page, label: string): Promise<number> {
    const slug = slugify(label);
    const stat = page.getByTestId(`stat-value-${slug}`);
    if (await stat.count()) {
        return readMoney(stat);
    }

    return readMoney(page.getByTestId(`summary-value-${slug}`));
}

export async function readStatText(page: Page, label: string): Promise<string> {
    const slug = slugify(label);
    return (await page.getByTestId(`stat-value-${slug}`).innerText()).trim();
}

export async function selectDateInput(page: Page, input: Locator, isoDate: string) {
    const [year, month, day] = isoDate.split('-').map(Number);
    const dayClass = `.react-datepicker__day--0${String(day).padStart(2, '0')}:not(.react-datepicker__day--outside-month)`;

    await input.click();

    const popper = page.locator('.react-datepicker-popper').last();
    await expect(popper).toBeVisible();
    await popper.locator('.bb-datepicker-select').nth(1).selectOption(String(year));
    await popper.locator('.bb-datepicker-select').nth(0).selectOption(String(month - 1));
    await popper.locator(dayClass).first().click();
    await expect(input).toHaveValue(isoDate);
}

export async function selectTimeInput(page: Page, input: Locator, time24h: string) {
    const optionLabel = toTimeOptionLabel(time24h);

    await input.click();

    const popper = page.locator('.react-datepicker-popper').last();
    await expect(popper).toBeVisible();
    await popper
        .locator('.react-datepicker__time-list-item')
        .filter({ hasText: new RegExp(`^${escapeRegExp(optionLabel)}$`) })
        .first()
        .click();

    await expect(input).toHaveValue(time24h);
}

export async function selectSearchableDropdownOption(
    page: Page,
    dropdownButton: Locator,
    optionText: string,
    searchText = optionText
) {
    await dropdownButton.click();

    const dropdownPanel = dropdownButton.locator('xpath=following-sibling::div[1]');
    await expect(dropdownPanel).toBeVisible();

    const searchInput = dropdownPanel.locator('input[placeholder^="Search"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill(searchText);

    const optionButton = dropdownPanel.getByRole('button', {
        name: new RegExp(`^${escapeRegExp(optionText)}$`),
    });

    while ((await optionButton.count()) === 0) {
        const loadMoreButton = dropdownPanel.getByRole('button', { name: /load more/i });
        if (!(await loadMoreButton.count())) {
            break;
        }

        await loadMoreButton.click();
    }

    await optionButton.first().click();
}

export function slugify(value: string): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function escapeRegExp(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toTimeOptionLabel(time24h: string): string {
    const [hourValue, minuteValue] = String(time24h).split(':').map(Number);
    const hour = Number.isFinite(hourValue) ? hourValue : 0;
    const minute = Number.isFinite(minuteValue) ? minuteValue : 0;
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;

    return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}
