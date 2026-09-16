import { useLayoutTitle } from '../../Components/Layout';
import ActionButton from '../../Components/ActionButton';
import DatePickerInput from '../../Components/DatePickerInput';
import SearchableDropdown from '../../Components/SearchableDropdown';
import TextInput from '../../Components/TextInput';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import ConfirmationModal from '../../Components/ConfirmationModal';
import OptimizedImage from '../../Components/OptimizedImage';
import { toastMessages } from '../../constants/toastMessages';
import { formatYmdHmAmPm } from '../../Utils/dateTimeFormat';
import {
    addDays,
    displayPercent,
    isMondayDate,
    normalizePercentInput,
    normalizeToMonday,
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

/**
 * Independent PM accomplishment grid: the PM's own weekly percents and scope
 * photos for one assigned project. Foreman JotForm rows are never edited
 * here — rows come from the project scope plan merged with this PM's saved
 * rows for the selected week. Each row has a Compare button opening a
 * read-only modal against the foreman's submission for the same week.
 */
export default function ProjectManagerAccomplishments({
    projects = [],
    selectedProjectId = 0,
    selectedProjectName = '',
    selectedWeek = '',
    currentWeekStart = '',
    planScopes = [],
    savedScopes = [],
    scopePhotoMap = {},
    pmProgress = null,
    foremanScopes = [],
    assignedForemen = [],
}) {
    useLayoutTitle('Accomplishment');

    const projectOptions = useMemo(
        () => (Array.isArray(projects) ? projects.map((project) => ({ id: String(project.id), name: project.name })) : []),
        [projects]
    );

    const selectProject = (value) => {
        router.get('/project-manager/accomplishments', { project_id: value }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // ---- PM rows: plan scopes merged with this PM's saved rows for the week ----
    const savedByScope = useMemo(() => {
        const map = {};
        (Array.isArray(savedScopes) ? savedScopes : []).forEach((row) => {
            const key = String(row?.scope_of_work || '').trim().toLowerCase();
            if (key) map[key] = row;
        });
        return map;
    }, [savedScopes]);

    const baseRows = useMemo(() => {
        const plans = Array.isArray(planScopes) ? planScopes : [];
        const rows = plans
            .map((plan) => String(plan?.scope_of_work || '').trim())
            .filter(Boolean)
            .map((name, index) => {
                const saved = savedByScope[name.toLowerCase()];
                const plan = plans.find((p) => String(p?.scope_of_work || '').trim().toLowerCase() === name.toLowerCase());
                return {
                    row_key: `plan-${index}-${name}`,
                    scope_of_work: name,
                    weight_percent: Number(plan?.weight_percent ?? 0),
                    percent_completed: saved ? String(saved.percent_completed ?? '') : '',
                    is_manual: false,
                };
            });
        (Array.isArray(savedScopes) ? savedScopes : []).forEach((saved, index) => {
            const name = String(saved?.scope_of_work || '').trim();
            if (!name) return;
            const inPlan = plans.some((plan) => String(plan?.scope_of_work || '').trim().toLowerCase() === name.toLowerCase());
            if (!inPlan) {
                rows.push({
                    row_key: `manual-${index}-${name}`,
                    scope_of_work: name,
                    weight_percent: 0,
                    percent_completed: String(saved.percent_completed ?? ''),
                    is_manual: true,
                });
            }
        });
        return rows;
    }, [planScopes, savedScopes, savedByScope]);

    const scopePhotoLookup = useMemo(() => {
        const source = collection(scopePhotoMap);
        return Object.entries(source).reduce((acc, [key, photos]) => {
            acc[String(key || '').toLowerCase()] = Array.isArray(photos) ? photos : [];
            return acc;
        }, {});
    }, [scopePhotoMap]);

    // Read-only foreman counter-check rows (latest submission per scope for
    // the selected week), keyed by lower-cased scope name for Compare.
    const foremanByScope = useMemo(() => {
        const map = {};
        (Array.isArray(foremanScopes) ? foremanScopes : []).forEach((row) => {
            const key = String(row?.scope_of_work || '').trim().toLowerCase();
            if (key) map[key] = row;
        });
        return map;
    }, [foremanScopes]);

    const assignedForemanNames = useMemo(
        () => (Array.isArray(assignedForemen) ? assignedForemen : [])
            .map((foreman) => String(foreman?.fullname || '').trim())
            .filter(Boolean),
        [assignedForemen]
    );

    const serverWeek = normalizeToMonday(String(selectedWeek || currentWeekStart || ''));
    const [weekStart, setWeekStart] = useState(serverWeek);
    const [rows, setRows] = useState(baseRows);
    const [removedScopes, setRemovedScopes] = useState([]);
    const [saving, setSaving] = useState(false);
    const [previewPhoto, setPreviewPhoto] = useState(null);
    const [weeklyPhotoKey, setWeeklyPhotoKey] = useState(0);

    // Re-seed local drafts whenever the server payload or selection changes.
    useEffect(() => {
        setRows(baseRows.map((row) => ({ ...row, weekly_photos: [], weekly_photo_caption: '' })));
        setRemovedScopes([]);
        setWeekStart(serverWeek);
    }, [baseRows, serverWeek, selectedProjectId]);

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

    const setRowPercent = (index, value) => {
        const nextValue = normalizePercentInput(value);
        setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, percent_completed: nextValue } : row)));
    };

    const [photoDeleteTarget, setPhotoDeleteTarget] = useState(null);
    const [deletingPhotoId, setDeletingPhotoId] = useState(null);
    const [compareScope, setCompareScope] = useState(null);

    const deleteScopePhoto = (photoId) => {
        if (!photoId) return;
        setDeletingPhotoId(photoId);
        router.delete(`/project-manager/scope-photos/${photoId}`, {
            preserveScroll: true,
            onSuccess: () => {
                setPreviewPhoto(null);
                toast.success('Photo deleted.');
            },
            onError: () => toast.error('Unable to delete the photo. Please try again.'),
            onFinish: () => {
                setDeletingPhotoId(null);
                setPhotoDeleteTarget(null);
            },
        });
    };

    const removeScopeRow = (index) => {
        const row = rows[index];
        const scopeKey = String(row?.scope_of_work || '').trim().toLowerCase();
        if (scopeKey) {
            setRemovedScopes((prev) => {
                if (prev.some((scope) => String(scope || '').trim().toLowerCase() === scopeKey)) return prev;
                return [...prev, String(row.scope_of_work).trim()];
            });
        }
        setRows((prev) => prev.filter((_, idx) => idx !== index));
    };

    const saveAccomplishments = () => {
        if (!selectedProjectId) {
            toast.error('Select a project first.');
            return;
        }
        if (weeklyLocked) {
            toast.error('Only the current week is editable. Previous and upcoming weeks are locked.');
            return;
        }

        const scopes = rows
            .map((row) => ({
                scope_of_work: String(row?.scope_of_work || '').trim(),
                percent_completed: String(row?.percent_completed ?? '').trim(),
                photo_caption: String(row?.weekly_photo_caption || '').trim(),
                photos: Array.isArray(row?.weekly_photos) ? row.weekly_photos.filter(Boolean) : [],
            }))
            .filter((row) => row.scope_of_work !== '' && (row.percent_completed !== '' || row.photos.length > 0));

        const removed = removedScopes.filter((scope) => {
            const scopeKey = String(scope || '').trim().toLowerCase();
            if (!scopeKey) return false;
            return !scopes.some((row) => row.scope_of_work.toLowerCase() === scopeKey);
        });

        if (scopes.length === 0 && removed.length === 0) {
            toast.error('Enter at least one percent or photo before saving.');
            return;
        }

        setSaving(true);
        router.post('/project-manager/accomplishments', {
            project_id: selectedProjectId,
            week_start: normalizeToMonday(weekStart),
            scopes,
            removed_scopes: removed,
        }, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setRows((prev) => prev.map((row) => ({ ...row, weekly_photos: [] })));
                setWeeklyPhotoKey((key) => key + 1);
                toast.success('Accomplishment updated successfully.');
            },
            onError: (errors) => {
                const firstError = errors && typeof errors === 'object'
                    ? Object.values(errors).flat().find((message) => String(message || '').trim() !== '')
                    : null;
                toast.error(firstError ? String(firstError) : 'Unable to update the accomplishment. Please review the form and try again.');
            },
            onFinish: () => setSaving(false),
        });
    };

    const projectDropdown = selectedProjectId
        ? String(selectedProjectId)
        : (projectOptions[0]?.id ?? '');

    return (
        <>
            <Head title="Accomplishment" />

            <div style={{ display: 'grid', gap: 16 }}>
                <div style={cardStyle}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                        Weekly Accomplishment %
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                        Your own scope progress for assigned projects. Foreman submissions are never edited here — use Compare on a row for a read-only foreman check.
                        {pmProgress !== null && pmProgress !== undefined ? ` PM Progress: ${Number(pmProgress).toFixed(2)}%.` : ''}
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ minWidth: 260, flex: '1 1 260px' }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                                Project (assigned to you)
                            </div>
                            <SearchableDropdown
                                options={projectOptions}
                                value={projectDropdown}
                                onChange={(value) => selectProject(value)}
                                placeholder="Select project"
                                searchPlaceholder="Search project..."
                                emptyMessage="No assigned construction projects"
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
                        <span>{selectedProjectName || 'No project selected'}</span>
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
                                        const monday = normalizeToMonday(next);
                                        setWeekStart(monday);
                                        if (selectedProjectId) {
                                            router.get('/project-manager/accomplishments', { project_id: selectedProjectId, week_start: monday }, {
                                                preserveState: true,
                                                preserveScroll: true,
                                            });
                                        }
                                    }}
                                    disabled={!selectedProjectId}
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

                    {rows.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            No scopes in the project plan yet. Add your scope below.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Scope of Works</th>
                                        <th style={{ ...thStyle, width: 140 }}>% Complete</th>
                                        <th style={{ ...thStyle, width: 280 }}>Scope Photos</th>
                                        <th style={{ ...thStyle, width: 130 }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, index) => {
                                        const scopeKey = String(row?.scope_of_work || '').trim().toLowerCase();
                                        const existingScopePhotos = scopeKey !== '' && Array.isArray(scopePhotoLookup[scopeKey])
                                            ? scopePhotosForWeek(scopePhotoLookup[scopeKey], weeklyWeekKey)
                                            : [];

                                        return (
                                            <tr key={row?.row_key || `${row?.scope_of_work || 'scope'}-${index}`}>
                                                <td style={{ ...tdStyle, fontWeight: 600 }}>
                                                    {row?.is_manual ? (
                                                        <input
                                                            style={inputStyle}
                                                            placeholder="Enter other scope of work"
                                                            disabled={weeklyLocked}
                                                            value={row?.scope_of_work || ''}
                                                            onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === index ? { ...r, scope_of_work: e.target.value } : r))}
                                                        />
                                                    ) : (
                                                        <>
                                                            <div>{row?.scope_of_work || '—'}</div>
                                                            <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>
                                                                Weight: {Number(row?.weight_percent ?? 0).toFixed(2)}%
                                                            </div>
                                                        </>
                                                    )}
                                                </td>
                                                <td style={tdStyle}>
                                                    <input
                                                        style={{ ...inputStyle, ...mono, textAlign: 'left' }}
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        disabled={weeklyLocked}
                                                        value={displayPercent(row?.percent_completed)}
                                                        onChange={(e) => setRowPercent(index, e.target.value)}
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    {existingScopePhotos.length === 0 ? (
                                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No existing scope photos.</div>
                                                    ) : (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 64px)', justifyContent: 'flex-start', gap: 6, marginBottom: 8 }}>
                                                            {existingScopePhotos.map((photo) => (
                                                                <span key={photo?.id} style={{ position: 'relative', width: 64, height: 64, display: 'inline-block' }}>
                                                                    <button
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
                                                                    {weeklyLocked ? null : (
                                                                        <button
                                                                            type="button"
                                                                            title="Delete photo"
                                                                            aria-label="Delete scope photo"
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                setPhotoDeleteTarget(photo);
                                                                            }}
                                                                            style={{
                                                                                position: 'absolute',
                                                                                top: -6,
                                                                                right: -6,
                                                                                width: 22,
                                                                                height: 22,
                                                                                borderRadius: '50%',
                                                                                border: '1px solid var(--border-color)',
                                                                                background: 'var(--surface-1)',
                                                                                color: '#f87171',
                                                                                cursor: 'pointer',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                padding: 0,
                                                                            }}
                                                                        >
                                                                            <Trash2 size={13} />
                                                                        </button>
                                                                    )}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {weeklyLocked ? null : (
                                                        <div style={{ display: 'grid', gap: 6 }}>
                                                            <TextInput
                                                                key={`${weeklyPhotoKey}-${row?.row_key || index}`}
                                                                type="file"
                                                                accept="image/*"
                                                                multiple
                                                                onChange={(e) => {
                                                                    const files = Array.from(e.target.files || []);
                                                                    setRows((prev) => prev.map((r, idx) => idx === index ? { ...r, weekly_photos: files } : r));
                                                                }}
                                                            />
                                                            <input
                                                                style={inputStyle}
                                                                placeholder="Caption for new photos (optional)"
                                                                disabled={weeklyLocked}
                                                                value={row?.weekly_photo_caption || ''}
                                                                onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === index ? { ...r, weekly_photo_caption: e.target.value } : r))}
                                                            />
                                                            {Array.isArray(row?.weekly_photos) && row.weekly_photos.length > 0 ? (
                                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.weekly_photos.length} new photo(s) selected</div>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'grid', gap: 6 }}>
                                                        <ActionButton
                                                            type="button"
                                                            variant="view"
                                                            onClick={() => setCompareScope(String(row?.scope_of_work || '').trim())}
                                                            aria-label={`Compare ${String(row?.scope_of_work || 'scope').trim()} with foreman`}
                                                            style={{ padding: '5px 10px', fontSize: 11 }}
                                                        >
                                                            Compare
                                                        </ActionButton>
                                                        {row?.is_manual ? (
                                                            <ActionButton
                                                                type="button"
                                                                variant="danger"
                                                                disabled={weeklyLocked}
                                                                onClick={() => removeScopeRow(index)}
                                                                style={{ padding: '5px 10px', fontSize: 11 }}
                                                            >
                                                                Remove
                                                            </ActionButton>
                                                        ) : null}
                                                    </div>
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
                        disabled={saving || !selectedProjectId || weeklyLocked}
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

            {compareScope ? (
                <CompareModal
                    scopeName={compareScope}
                    projectName={selectedProjectName}
                    weekStart={normalizeToMonday(weekStart)}
                    savedPercent={savedByScope[compareScope.toLowerCase()]?.percent_completed}
                    draftPercent={(rows.find((row) => String(row?.scope_of_work || '').trim().toLowerCase() === compareScope.toLowerCase()))?.percent_completed}
                    foremanRow={foremanByScope[compareScope.toLowerCase()] || null}
                    assignedForemanNames={assignedForemanNames}
                    onClose={() => setCompareScope(null)}
                />
            ) : null}

            <ConfirmationModal
                open={!!photoDeleteTarget}
                title="Delete Scope Photo"
                message={photoDeleteTarget?.caption
                    ? `Are you sure you want to delete "${photoDeleteTarget.caption}"?`
                    : 'Are you sure you want to delete this scope photo?'}
                confirmLabel={deletingPhotoId ? 'Deleting...' : 'Delete'}
                danger
                processing={!!deletingPhotoId}
                onClose={() => setPhotoDeleteTarget(null)}
                onConfirm={() => deleteScopePhoto(photoDeleteTarget?.id)}
            />
        </>
    );
}

const formatComparePercent = (value) => {
    const num = Number(value ?? 0);
    return Math.abs(num - Math.round(num)) < 0.05 ? `${Math.round(num)}%` : `${num.toFixed(1)}%`;
};

/**
 * Read-only modal comparing the PM's saved percent for a scope against
 * the assigned foreman's latest submission for the same week.
 */
function CompareModal({
    scopeName,
    projectName,
    weekStart,
    savedPercent,
    draftPercent,
    foremanRow,
    assignedForemanNames = [],
    onClose,
}) {
    const pmPercent = savedPercent !== undefined && savedPercent !== null && String(savedPercent).trim() !== ''
        ? Number(savedPercent)
        : 0;
    const draftValue = draftPercent !== undefined && draftPercent !== null ? String(draftPercent).trim() : '';
    const hasUnsavedChanges = draftValue !== '' && Math.abs(Number(draftValue) - pmPercent) >= 0.5;

    const foremanPercent = foremanRow ? Number(foremanRow.percent_completed ?? 0) : null;
    const foremanName = foremanRow
        ? (String(foremanRow.foreman_name || '').trim() || String(foremanRow.submitted_by_name || '').trim())
        : '';

    let differenceText;
    let differenceColor;
    if (foremanPercent === null) {
        differenceText = 'No foreman submission to compare against yet.';
        differenceColor = 'var(--text-muted)';
    } else if (Math.abs(pmPercent - foremanPercent) < 0.5) {
        differenceText = `Both agree at ${formatComparePercent(pmPercent)}.`;
        differenceColor = 'var(--success)';
    } else if (pmPercent > foremanPercent) {
        differenceText = `PM is ${formatComparePercent(pmPercent - foremanPercent)} ahead of the foreman.`;
        differenceColor = 'var(--active-text)';
    } else {
        differenceText = `PM is ${formatComparePercent(foremanPercent - pmPercent)} behind the foreman.`;
        differenceColor = '#d97706';
    }

    const sideCard = (role, name, percent, note) => (
        <div style={{ ...cardStyle, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>{role}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <div data-testid="compare-side-name" style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
                <div data-testid="compare-side-percent" style={{ fontSize: 16, fontWeight: 700 }}>
                    {percent === null ? '—' : formatComparePercent(percent)}
                </div>
            </div>
            {note ? <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{note}</div> : null}
        </div>
    );

    return (
        <div
            data-testid="compare-modal"
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
                style={{ ...cardStyle, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Scope Comparison</div>
                    <ActionButton type="button" onClick={onClose} style={{ padding: '5px 12px' }}>
                        Close
                    </ActionButton>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{scopeName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    {[projectName, weekStart ? `Week starting ${weekStart}` : ''].filter(Boolean).join(' • ')}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                    {sideCard(
                        'PROJECT MANAGER (YOU)',
                        'Your submission',
                        pmPercent,
                        hasUnsavedChanges ? `Unsaved changes — draft is ${formatComparePercent(Number(draftValue))}.` : null
                    )}
                    {sideCard(
                        'FOREMAN',
                        foremanName || (assignedForemanNames.length > 0 ? assignedForemanNames.join(', ') : 'No assigned foreman'),
                        foremanPercent,
                        !foremanRow
                            ? 'No foreman submission for this scope this week.'
                            : (foremanRow.submitted_at ? `Submitted ${formatYmdHmAmPm(foremanRow.submitted_at, '')}.` : null)
                    )}
                </div>
                <div
                    data-testid="compare-difference"
                    style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid var(--border-color)',
                        fontSize: 13,
                        fontWeight: 600,
                        color: differenceColor,
                        textAlign: 'center',
                    }}
                >
                    {differenceText}
                </div>
            </div>
        </div>
    );
}

function PhotoPreviewModal({ photo, onClose }) {    return (
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
