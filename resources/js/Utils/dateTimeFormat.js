export function formatYmdHmAmPm(value, fallback = '-') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;

    // If the value is already just a date, keep it as-is (no fake midnight time).
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }

    // Prefer stable string parsing to avoid timezone shifts on "YYYY-MM-DD HH:MM:SS".
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
    if (match) {
        const datePart = match[1];
        const hour24 = Number(match[2]);
        const minute = match[3];
        const suffix = hour24 >= 12 ? 'PM' : 'AM';
        const hour12 = ((hour24 + 11) % 12) + 1;
        return `${datePart} ${String(hour12).padStart(2, '0')}:${minute}${suffix}`;
    }

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hour24 = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, '0');
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = ((hour24 + 11) % 12) + 1;
    return `${yyyy}-${mm}-${dd} ${String(hour12).padStart(2, '0')}:${minute}${suffix}`;
}

// Date-only formatter: returns YYYY-MM-DD for inputs like "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS".
export function formatYmd(value, fallback = '-') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const match = raw.match(/^(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}/);
    if (match) return match[1];

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
