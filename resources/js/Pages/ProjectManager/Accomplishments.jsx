import { useLayoutTitle } from '../../Components/Layout';
import ActionButton from '../../Components/ActionButton';
import DatePickerInput from '../../Components/DatePickerInput';
import SearchableDropdown from '../../Components/SearchableDropdown';
import { Head, router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import OptimizedImage from '../../Components/OptimizedImage';
import { toastMessages } from '../../constants/toastMessages';
import { formatYmdHmAmPm } from '../../Utils/dateTimeFormat';
import {
    addDays,
    buildWeeklyRows,
    displayPercent,
    isIsoWeekKey,
    isMondayDate,
    mergeWeeklyRowsWithScopeList,
    monday,
    normalizePercentInput,
    normalizeToMonday,
    nextWeeklyRowKey,
    parseYmdDate,
    scopePhotosForWeek,
    today,
} from '../../Utils/weeklyProgress';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text-main)',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
};

const mono = { fontFamily: "'DM Mono', monospace" };

const thStyle = {
    textAlign: 'left',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: 'var(--text-muted)',
    padding: '8px 10px',
    borderBottom: '1px solid var(--border-color)',
};

const tdStyle = { padding: '10px', borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' };

const collection = (value) => (value && typeof value === 'object' ? value : {});

export default function ProjectManagerAccomplishments({
    projects = [],
    foremen = [],
    selectedProjectId = 0,
    selectedForemanId = 0,
    selectedForemanName = '',
    selectedProjectName = '',
    jotformLink = '',
    weekly = {},
}) {
    useLayoutTitle('Accomplishment');

    const projectOptions = useMemo(
        () => (Array.isArray(projects) ? projects.map((project) => ({ id: String(project.id), name: project.name })) : []),
        [projects]
    );
    const foremanOptions = useMemo(
        () => (Array.isArray(foremen) ? foremen.map((foreman) => ({ id: String(foreman.id), name: foreman.fullname })) : []),
        [foremen]
    );

    const selectProject = (value) => {
        router.get('/project-manager/accomplishments', { project_id: value }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const selectForeman = (value) => {
        router.get('/project-manager/accomplishments', { project_id: selectedProjectId, foreman_id: value }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // ---- Weekly grid (same resolution logic as the JotForm page) ----
    const assignedScopes = Array.isArray(weekly?.weekly_scope_of_works) ? weekly.weekly_scope_of_works : [];
    const baseWeeklyScopes = assignedScopes.length ? assignedScopes : [];
    const weeklyScopePhotoMap = collection(weekly?.weekly_scope_photo_map);
    const currentWeekStartFromServer = normalizeToMonday(String(weekly?.current_week_start || ''));
    const weeklyScopeByWeek = useMemo(() => {
        const source = collection(weekly?.weekly_scope_of_works_by_week);
        return Object.entries(source).reduce((acc, [weekKey, scopeRows]) => {
            const normalizedKey = normalizeToMonday(String(weekKey || '').trim());
            if (!normalizedKey) return acc;
            acc[normalizedKey] = Array.isArray(scopeRows) ? scopeRows : [];
            return acc;
        }, {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekly?.weekly_scope_of_works_by_week]);

    const resolveWeeklyScopeList = useCallback((weekKey) => {
        const normalizedKey = normalizeToMonday(String(weekKey || '').trim());
        const savedScopes = Array.isArray(weeklyScopeByWeek[normalizedKey]) ? weeklyScopeByWeek[normalizedKey] : [];
        const hasComparableWeek = isIsoWeekKey(normalizedKey) && isIsoWeekKey(currentWeekStartFromServer);

        if (hasComparableWeek && normalizedKey < currentWeekStartFromServer && savedScopes.length) {
            return savedScopes;
        }

        if (baseWeeklyScopes.length) {
            return baseWeeklyScopes;
        }

        if (savedScopes.length) {
            return savedScopes;
        }

        return [];
    }, [weeklyScopeByWeek, baseWeeklyScopes, currentWeekStartFromServer]);

    const initialWeeklyDrafts = useMemo(() => {
        const source = collection(weekly?.weekly_saved_by_week);
        return Object.entries(source).reduce((acc, [weekKey, rows]) => {
            acc[weekKey] = mergeWeeklyRowsWithScopeList(Array.isArray(rows) ? rows : [], resolveWeeklyScopeList(weekKey));
            return acc;
        }, {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekly?.weekly_saved_by_week, resolveWeeklyScopeList]);

    const currentWeekStart = currentWeekStartFromServer || monday();
    const [weekStart, setWeekStart] = useState(currentWeekStart);
    const [weeklyWeekDrafts, setWeeklyWeekDrafts] = useState(initialWeeklyDrafts);
    const [weeklyRemovedScopesByWeek, setWeeklyRemovedScopesByWeek] = useState({});
    const [saving, setSaving] = useState(false);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    // Re-seed local drafts whenever the server payload or selection changes,
    // so the grid always reflects what the foreman's JotForm shows.
    useEffect(() => {
        setWeeklyWeekDrafts(initialWeeklyDrafts);
        setWeeklyRemovedScopesByWeek({});
        setWeekStart(currentWeekStart);
    }, [initialWeeklyDrafts, currentWeekStart, selectedProjectId, selectedForemanId]);

    const weeklyWeekKey = normalizeToMonday(weekStart) || '__weekly_empty__';
    const weeklyWeekStartDate = parseYmdDate(weeklyWeekKey === '__weekly_empty__' ? '' : weeklyWeekKey);
    const weeklyWeekEndDate = weeklyWeekStartDate ? addDays(weeklyWeekStartDate, 6) : null;
    const currentDate = parseYmdDate(today());
    const weeklyLocked = !(
        weeklyWeekStartDate &&
        weeklyWeekEndDate &&
        currentDate &&
        currentDate >= weeklyWeekStartDate &&
        currentDate <= weeklyWeekEndDate
    );
    const defaultWeeklyRowsForWeek = useMemo(
        () => buildWeeklyRows(resolveWeeklyScopeList(weeklyWeekKey)),
        [resolveWeeklyScopeList, weeklyWeekKey]
    );
    const weeklyRows = weeklyWeekDrafts[weeklyWeekKey] ?? defaultWeeklyRowsForWeek;

    const setCurrentWeeklyRows = (updater) => {
        setWeeklyWeekDrafts((prev) => {
            const current = prev[weeklyWeekKey] ?? defaultWeeklyRowsForWeek;
            return { ...prev, [weeklyWeekKey]: updater(current) };
        });
    };

    const saveAccomplishments = () => {
        if (!selectedProjectId || !selectedForemanId) {
            toast.error('Select a project and a foreman first.');
            return;
        }
        if (weeklyLocked) {
            toast.error('Only the current week is editable. Previous and upcoming weeks are locked.');
            return;
        }

        const weeklyScopes = weeklyRows
            .map((row) => ({
                scope_of_work: String(row?.scope_of_work || '').trim(),
                percent_completed: String(row?.percent_completed ?? '').trim(),
            }))
            .filter((row) => row.scope_of_work !== '' && row.percent_completed !== '');

        const removedWeeklyScopes = (weeklyRemovedScopesByWeek[weeklyWeekKey] || [])
            .filter((scope) => {
                const scopeKey = String(scope || '').trim().toLowerCase();
                if (!scopeKey) return false;
                return !weeklyScopes.some((row) => row.scope_of_work.toLowerCase() === scopeKey);
            });

        setSaving(true);
        router.post('/project-manager/accomplishments', {
            project_id: selectedProjectId,
            foreman_id: selectedForemanId,
            week_start: normalizeToMonday(weekStart),
            scopes: weeklyScopes,
            removed_scopes: removedWeeklyScopes,
        }, {
            preserveScroll: true,
            onSuccess: () => toast.success('Accomplishment updated successfully.'),
            onError: () => toast.error('Unable to update the accomplishment. Please review the form and try again.'),
            onFinish: () => setSaving(false),
        });
    };

    const removeScopeRow = (index) => {
        const row = weeklyRows[index];
        const scopeKey = String(row?.scope_of_work || '').trim().toLowerCase();
        if (scopeKey) {
            setWeeklyRemovedScopesByWeek((prev) => {
                const existing = Array.isArray(prev[weeklyWeekKey]) ? prev[weeklyWeekKey] : [];
                if (existing.some((scope) => String(scope || '').trim().toLowerCase() === scopeKey)) {
                    return prev;
                }
                return { ...prev, [weeklyWeekKey]: [...existing, String(row.scope_of_work).trim()] };
            });
        }
        setCurrentWeeklyRows((rows) => rows.filter((_, idx) => idx !== index));
    };

    const projectDropdown = selectedProjectId
        ? String(selectedProjectId)
        : (projectOptions[0]?.id ?? '');
    const foremanDropdown = selectedForemanId ? String(selectedForemanId) : '';

    return (
        <>
            <Head title="Accomplishment" />

            <div style={{ display: 'grid', gap: 16 }}>
                <div style={cardStyle}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                        Weekly Accomplishment %
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                        
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ minWidth: 260, flex: '1 1 260px' }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                                Project (Construction phase)
                            </div>
                            <SearchableDropdown
                                options={projectOptions}
                                value={projectDropdown}
                                onChange={(value) => selectProject(value)}
                                placeholder="Select project"
                                searchPlaceholder="Search project..."
                                emptyMessage="No construction projects found"
                            />
                        </div>
                        <div style={{ minWidth: 220, flex: '1 1 220px' }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                                Foreman
                            </div>
                            <SearchableDropdown
                                options={foremanOptions}
                                value={foremanDropdown}
                                onChange={(value) => selectForeman(value)}
                                placeholder="Select foreman"
                                searchPlaceholder="Search foreman..."
                                emptyMessage="No foremen assigned to this project"
                                disabled={foremanOptions.length === 0}
                            />
                        </div>
                    </div>
                </div>

                <div style={cardStyle}>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            marginBottom: 10,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                        }}
                    >
                        <span>
                            {selectedProjectName || 'No project selected'}
                            {selectedForemanName ? ` — ${selectedForemanName}` : ''}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                            Week Start
                            <span style={{ width: 170 }}>
                                <DatePickerInput
                                    value={weekStart}
                                    onChange={(value) => {
                                        const next = value || '';
                                        if (!next) {
                                            setWeekStart('');
                                            return;
                                        }
                                        if (!isMondayDate(next)) {
                                            toast.error(toastMessages.jotform.mondayOnly);
                                            return;
                                        }
                                        setWeekStart(next);
                                    }}
                                    disabled={!selectedProjectId || !selectedForemanId}
                                    style={inputStyle}
                                />
                            </span>
                        </label>
                    </div>

                    {weeklyLocked ? (
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                            Only the current week is editable. Previous and upcoming weeks are locked.
                        </div>
                    ) : null}

                    {weeklyRows.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            No scopes are assigned for this week.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Scope of Works</th>
                                        <th style={{ ...thStyle, width: 140 }}>% Complete</th>
                                        <th style={{ ...thStyle, width: 280 }}>Scope Photos</th>
                                        <th style={{ ...thStyle, width: 100 }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {weeklyRows.map((row, index) => {
                                        const scopeKey = String(row?.scope_of_work || '').trim().toLowerCase();
                                        const existingScopePhotos = scopeKey !== '' && Array.isArray(weeklyScopePhotoMap[scopeKey])
                                            ? scopePhotosForWeek(weeklyScopePhotoMap[scopeKey], weeklyWeekKey)
                                            : [];

                                        return (
                                            <tr key={row?.row_key || `${row?.scope_of_work || 'scope'}-${index}`}>
                                                <td style={{ ...tdStyle, fontWeight: 600 }}>
                                                    {row?.is_manual ? (
                                                        <input
                                                            style={inputStyle}
                                                            placeholder="Enter other scope of work"
                                                            disabled={weeklyLocked || row?.is_unassigned}
                                                            value={row?.scope_of_work || ''}
                                                            onChange={(e) => setCurrentWeeklyRows((rows) => rows.map((r, idx) => idx === index ? { ...r, scope_of_work: e.target.value } : r))}
                                                        />
                                                    ) : (row?.scope_of_work || '—')}
                                                    {row?.is_unassigned ? (
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                                            Assigned to another foreman.
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td style={tdStyle}>
                                                    <input
                                                        style={{ ...inputStyle, ...mono, textAlign: 'left' }}
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        disabled={weeklyLocked || row?.is_unassigned}
                                                        value={displayPercent(row?.percent_completed)}
                                                        onChange={(e) => {
                                                            const nextValue = normalizePercentInput(e.target.value);
                                                            setCurrentWeeklyRows((rows) => rows.map((r, idx) => idx === index ? { ...r, percent_completed: nextValue } : r));
                                                        }}
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    {existingScopePhotos.length === 0 ? (
                                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No existing scope photos.</div>
                                                    ) : (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 64px)', justifyContent: 'flex-start', gap: 6 }}>
                                                            {existingScopePhotos.map((photo) => (
                                                                <button
                                                                    key={photo?.id}
                                                                    type="button"
                                                                    title={photo?.caption || 'Scope photo'}
                                                                    onClick={() => setPreviewPhoto(photo)}
                                                                    style={{
                                                                        width: 64,
                                                                        height: 64,
                                                                        padding: 0,
                                                                        border: '1px solid var(--border-color)',
                                                                        borderRadius: 8,
                                                                        overflow: 'hidden',
                                                                        cursor: 'pointer',
                                                                        background: 'var(--surface-2)',
                                                                    }}
                                                                >
                                                                    <OptimizedImage
                                                                        src={`/files/${photo?.photo_path}`}
                                                                        alt={photo?.caption || 'Scope photo'}
                                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                                    />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={tdStyle}>
                                                    {row?.is_manual ? (
                                                        <ActionButton
                                                            type="button"
                                                            variant="danger"
                                                            disabled={weeklyLocked || row?.is_unassigned}
                                                            onClick={() => removeScopeRow(index)}
                                                            style={{ padding: '5px 10px', fontSize: 11 }}
                                                        >
                                                            Remove
                                                        </ActionButton>
                                                    ) : (
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Default</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <ActionButton
                        type="button"
                        variant="success"
                        loading={saving}
                        disabled={saving || !selectedProjectId || !selectedForemanId}
                        onClick={saveAccomplishments}
                        style={{ padding: '12px 24px' }}
                    >
                        Save Accomplishment
                    </ActionButton>
                </div>
            </div>

            {previewPhoto ? (
                <PhotoPreviewModal photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
            ) : null}
        </>
    );
}

function PhotoPreviewModal({ photo, onClose }) {
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 60,
                padding: 20,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ ...cardStyle, maxWidth: 900, width: '100%' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {photo?.caption || 'Scope photo'}
                    </div>
                    <ActionButton type="button" onClick={onClose} style={{ padding: '5px 12px' }}>
                        Close
                    </ActionButton>
                </div>
                <OptimizedImage
                    src={`/files/${photo?.photo_path}`}
                    alt={photo?.caption || 'Scope photo'}
                    style={{
                        width: '100%',
                        maxHeight: '70vh',
                        objectFit: 'contain',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        background: 'var(--surface-2)',
                        display: 'block',
                    }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    {photo?.created_at ? formatYmdHmAmPm(photo.created_at, '') : ''}
                </div>
            </div>
        </div>
    );
}