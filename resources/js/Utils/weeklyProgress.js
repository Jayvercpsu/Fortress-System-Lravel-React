// Shared weekly-progress (accomplishment %) helpers used by the public JotForm page
// AND the Project Manager Accomplishment page, so both render/validate the same grid.

export const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const today = () => formatLocalDate(new Date());

export const monday = () => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return formatLocalDate(d);
};

export const isMondayDate = (value) => {
    if (!value) return false;
    const parts = String(value).split('-').map((v) => Number(v));
    if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) return false;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (Number.isNaN(d.getTime())) return false;
    return d.getDay() === 1;
};

export const normalizeToMonday = (value) => {
    if (!value) return '';
    const parts = String(value).split('-').map((v) => Number(v));
    if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) return String(value);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (Number.isNaN(d.getTime())) return String(value);
    const mondayOffset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - mondayOffset);
    return formatLocalDate(d);
};

export const parseYmdDate = (value) => {
    if (!value) return null;
    const parts = String(value).split('-').map((v) => Number(v));
    if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) return null;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (Number.isNaN(d.getTime())) return null;
    return d;
};

export const addDays = (date, days) => {
    const clone = new Date(date.getTime());
    clone.setDate(clone.getDate() + days);
    return clone;
};

export const isIsoWeekKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());

let weeklyRowSeed = 0;

export const nextWeeklyRowKey = () => {
    weeklyRowSeed += 1;
    return `weekly-row-${weeklyRowSeed}`;
};

export const buildWeeklyRows = (scopeRows = []) => scopeRows.map((scope) => ({
    row_key: nextWeeklyRowKey(),
    scope_of_work: scope,
    percent_completed: '',
    is_manual: false,
    is_unassigned: false,
    weekly_photos: [],
    weekly_photo_caption: '',
}));

export const cloneWeeklyRows = (rows = [], options = {}) => rows.map((row) => ({
    row_key: row?.row_key || nextWeeklyRowKey(),
    scope_of_work: String(row?.scope_of_work || ''),
    percent_completed: String(row?.percent_completed || ''),
    is_manual: !!row?.is_manual,
    is_unassigned: !!row?.is_unassigned,
    weekly_photos: options.keepWeeklyPhotos
        ? (Array.isArray(row?.weekly_photos) ? [...row.weekly_photos] : [])
        : [],
    weekly_photo_caption: String(row?.weekly_photo_caption || ''),
}));

export const mergeWeeklyRowsWithScopeList = (rows = [], scopeRows = [], options = {}) => {
    const orderedScopes = [];
    const orderedScopeKeys = new Set();
    (scopeRows || []).forEach((scope) => {
        const scopeName = String(scope || '').trim();
        if (scopeName === '') return;
        const scopeKey = scopeName.toLowerCase();
        if (orderedScopeKeys.has(scopeKey)) return;
        orderedScopeKeys.add(scopeKey);
        orderedScopes.push({ key: scopeKey, name: scopeName });
    });

    const existingRows = cloneWeeklyRows(rows, options);
    const existingByKey = new Map();
    const manualRows = [];

    existingRows.forEach((row) => {
        const scopeName = String(row?.scope_of_work || '').trim();
        if (scopeName === '') {
            manualRows.push(row);
            return;
        }
        const scopeKey = scopeName.toLowerCase();
        if (!existingByKey.has(scopeKey)) {
            existingByKey.set(scopeKey, row);
        } else {
            manualRows.push({ ...row, is_manual: true, is_unassigned: true });
        }
    });

    const mergedRows = orderedScopes.map(({ key, name }) => {
        if (existingByKey.has(key)) {
            return {
                ...existingByKey.get(key),
                scope_of_work: name,
                is_manual: false,
                is_unassigned: false,
            };
        }

        return {
            row_key: nextWeeklyRowKey(),
            scope_of_work: name,
            percent_completed: '',
            is_manual: false,
            is_unassigned: false,
            weekly_photos: [],
            weekly_photo_caption: '',
        };
    });

    existingByKey.forEach((row, key) => {
        if (orderedScopeKeys.has(key)) return;
        manualRows.push({ ...row, is_manual: true, is_unassigned: true });
    });

    return [...mergedRows, ...manualRows];
};

export const findLatestWeekBefore = (targetWeekKey, ...weekMaps) => {
    const normalizedTarget = normalizeToMonday(String(targetWeekKey || '').trim());
    if (!isIsoWeekKey(normalizedTarget)) return null;
    const targetDate = parseYmdDate(normalizedTarget);
    if (!targetDate) return null;
    const candidates = new Set();

    weekMaps.forEach((map) => {
        if (!map || typeof map !== 'object') return;
        Object.keys(map).forEach((key) => {
            const normalizedKey = normalizeToMonday(String(key || '').trim());
            if (isIsoWeekKey(normalizedKey)) {
                candidates.add(normalizedKey);
            }
        });
    });

    let bestKey = null;
    let bestDate = null;
    candidates.forEach((key) => {
        const date = parseYmdDate(key);
        if (!date || date >= targetDate) return;
        if (!bestDate || date > bestDate) {
            bestDate = date;
            bestKey = key;
        }
    });

    return bestKey;
};

export const scopePhotosForWeek = (photoRows = [], targetWeekKey = '') => {
    const normalizedTarget = String(targetWeekKey || '').trim();
    return (Array.isArray(photoRows) ? photoRows : []).filter((photo) => {
        const weekStart = String(photo?.week_start || '').trim();
        if (!isIsoWeekKey(normalizedTarget)) return true;
        if (!isIsoWeekKey(weekStart)) return true;
        return weekStart <= normalizedTarget;
    });
};

export const normalizePercentInput = (value) => {
    const raw = String(value ?? '').trim();
    if (raw === '') return '';
    const numeric = Number(raw);
    if (Number.isNaN(numeric)) return '';
    const clamped = Math.max(0, Math.min(100, numeric));
    return String(clamped);
};

export const displayPercent = (value) => {
    const raw = String(value ?? '').trim();
    return raw === '' ? '0' : raw;
};