export const cardStyle = {
    background: 'var(--ac-bg, #ffffff)',
    border: '1px solid var(--ac-border, #e8edf3)',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
};

export const innerCardStyle = {
    background: 'var(--ac-bg, #ffffff)',
    border: '1px solid var(--ac-border, #e8edf3)',
    borderRadius: 10,
    padding: 14,
};

export const mockupTableHeadStyle = {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ac-muted, #475569)',
    borderBottom: '1px solid var(--ac-border, #e8edf3)',
    whiteSpace: 'nowrap',
};

export const mockupTableCellStyle = {
    padding: '12px',
    borderBottom: '1px solid var(--ac-border-soft, #f1f5f9)',
    fontSize: 13,
    verticalAlign: 'middle',
};

export const isPmRole = (role) => {
    const normalized = String(role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return normalized === 'project_manager';
};

export const statusForVariance = (variance) => {
    const value = Number(variance ?? 0);
    if (value <= 5) return 'On Track';
    if (value <= 10) return 'Needs Review';
    return 'Investigate';
};

export const statusStyle = (status) => {
    if (status === 'Pending') {
        return { background: 'var(--ac-border-soft, #f1f5f9)', color: 'var(--ac-muted, #64748b)', border: '1px solid #e2e8f0' };
    }
    if (status === 'On Track') {
        return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
    }
    if (status === 'Needs Review') {
        return { background: '#fef9c3', color: '#a16207', border: '1px solid #fde68a' };
    }
    return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' };
};

export const varianceStyle = (variance) => {
    const value = Number(variance ?? 0);
    if (value <= 5) {
        return { background: '#dcfce7', color: '#15803d' };
    }
    if (value <= 10) {
        return { background: '#fef9c3', color: '#a16207' };
    }
    return { background: '#fee2e2', color: '#b91c1c' };
};

export const pillStyle = {
    display: 'inline-block',
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
};

export const barTrackStyle = {
    height: 6,
    borderRadius: 999,
    background: 'var(--ac-track, #e2e8f0)',
    overflow: 'hidden',
    minWidth: 70,
};

export function ProgressBar({ value, color }) {
    if (value === null || value === undefined || value === '') {
        return <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>—</span>;
    }
    const safe = Math.min(100, Math.max(0, Number(value ?? 0)));
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ ...barTrackStyle, flex: 1 }}>
                <div style={{ width: `${safe}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.8s ease-out' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ac-text, #0f172a)', minWidth: 40, textAlign: 'right' }}>
                {safe}%
            </span>
        </div>
    );
}

export const statIconStyle = (bg, color) => ({
    width: 36,
    height: 36,
    borderRadius: 10,
    background: bg,
    color,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 800,
    flexShrink: 0,
});

export const tabStyle = (isActive) => ({
    background: 'none',
    border: 'none',
    borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
    color: isActive ? '#2563eb' : 'var(--ac-muted, #64748b)',
    fontWeight: isActive ? 700 : 500,
    fontSize: 13,
    padding: '10px 4px',
    marginRight: 18,
    cursor: 'pointer',
});

export const innerTabStyle = (isActive) => ({
    background: 'none',
    border: 'none',
    borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
    color: isActive ? '#2563eb' : 'var(--ac-muted, #64748b)',
    fontWeight: isActive ? 700 : 500,
    fontSize: 13,
    padding: '8px 2px',
    marginRight: 16,
    cursor: 'pointer',
});

export const initialsOf = (name) => String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || '–';

// Photos for one scope in one week of one project: exact week_start tag
// match first, then untagged photos whose upload date falls inside that
// Monday–Sunday week, otherwise empty (never the whole scope history, and
// never another project's photos sharing the same scope name).
export const photoProjectId = (photo) => {
    const raw = photo?.project_id;
    if (raw === null || raw === undefined || String(raw).trim() === '' || Number(raw) === 0) {
        return '';
    }
    return String(raw);
};

export const sameProject = (photo, projectId) => {
    const wanted = projectId !== null && projectId !== undefined && String(projectId).trim() !== ''
        ? String(projectId)
        : '';
    const actual = photoProjectId(photo);
    // Back-compat: when either side carries no id, don't exclude.
    if (wanted === '' || actual === '') return true;
    return wanted === actual;
};

export const photosForScopeWeek = (photoMap, scopeOfWork, weekStart, projectId = null) => {
    const scopeKey = String(scopeOfWork ?? '').trim().toLowerCase();
    const rowWeek = String(weekStart ?? '').trim();
    const scopePhotos = scopeKey && Array.isArray(photoMap?.[scopeKey]) ? photoMap[scopeKey] : [];
    const projectPhotos = scopePhotos.filter((photo) => sameProject(photo, projectId));
    if (!rowWeek) return [];

    const exact = projectPhotos.filter((photo) => String(photo?.week_start ?? '').trim() === rowWeek);
    if (exact.length) return exact;

    return projectPhotos.filter((photo) => {
        if (String(photo?.week_start ?? '').trim()) return false;
        const photoDate = String(photo?.created_at || '').slice(0, 10);
        if (!photoDate) return false;
        const rowDate = new Date(`${rowWeek}T00:00:00`);
        const photoTime = new Date(`${photoDate}T00:00:00`);
        const weekEnd = new Date(rowDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return photoTime >= rowDate && photoTime <= weekEnd;
    });
};
