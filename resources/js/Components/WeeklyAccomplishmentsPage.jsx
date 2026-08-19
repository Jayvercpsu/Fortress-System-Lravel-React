import { useEffect, useMemo, useState } from 'react';
import { useLayoutTitle } from './Layout';
import Modal from './Modal';
import ProjectAccordionTable from './ProjectAccordionTable';
import SelectInput from './SelectInput';
import DatePickerInput from './DatePickerInput';
import ActionButton from './ActionButton';
import { Head, router } from '@inertiajs/react';
import OptimizedImage from './OptimizedImage';
import { formatYmd, formatYmdHmAmPm } from '../Utils/dateTimeFormat';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const navButtonStyle = (enabled) => ({
    border: '1px solid var(--border-color)',
    background: 'var(--button-bg)',
    color: 'var(--text-main)',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 12,
    opacity: enabled ? 1 : 0.55,
});

export default function WeeklyAccomplishmentsPage({
    weeklyAccomplishments = [],
    weeklyAccomplishmentTable = {},
    weeklyScopePhotoMap = {},
    statusFilters = [],
    projects = [],
    filterProjects = [],
    filterForemen = [],
    groupEmptyMessage = 'No accomplishments for this project.',
}) {
    const routePath = '/weekly-accomplishments';

    const tableFilters = {
        project_id: String(weeklyAccomplishmentTable?.project_id ?? ''),
        foreman_id: String(weeklyAccomplishmentTable?.foreman_id ?? ''),
        week_from: String(weeklyAccomplishmentTable?.week_from ?? ''),
        week_to: String(weeklyAccomplishmentTable?.week_to ?? ''),
        date_from: String(weeklyAccomplishmentTable?.date_from ?? ''),
        date_to: String(weeklyAccomplishmentTable?.date_to ?? ''),
    };

    const hasActiveFilters = Object.values(tableFilters).some((value) => value !== '');

    const filterControlStyle = {
        background: 'var(--surface-2)',
        color: 'var(--text-main)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
        minWidth: 150,
    };

    const applyFilter = (key, value) => {
        const next = { ...tableFilters, [key]: String(value ?? '') };
        router.get(routePath, {
            search: weeklyAccomplishmentTable?.search ?? '',
            per_page: weeklyAccomplishmentTable?.per_page ?? 10,
            page: 1,
            ...next,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearFilters = () => {
        router.get(routePath, {
            search: weeklyAccomplishmentTable?.search ?? '',
            per_page: weeklyAccomplishmentTable?.per_page ?? 10,
            page: 1,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };
    // Photo preview modal state: identify which scope list we are browsing + current index.
    const [photoPreview, setPhotoPreview] = useState(null);

    const previewScopeKey = String(photoPreview?.scopeKey ?? '');
    const previewPhotos = useMemo(() => {
        if (!previewScopeKey) return [];
        const list = weeklyScopePhotoMap?.[previewScopeKey];
        return Array.isArray(list) ? list : [];
    }, [previewScopeKey, weeklyScopePhotoMap]);

    const previewIndex = useMemo(() => {
        if (!photoPreview) return 0;
        const raw = Number(photoPreview.index ?? 0);
        const safe = Number.isFinite(raw) ? raw : 0;
        return Math.min(Math.max(0, safe), Math.max(0, previewPhotos.length - 1));
    }, [photoPreview, previewPhotos.length]);

    const previewPhoto = previewPhotos[previewIndex] || null;
    const canPrev = !!previewPhoto && previewIndex > 0;
    const canNext = !!previewPhoto && previewIndex < previewPhotos.length - 1;

    const closePreview = () => setPhotoPreview(null);
    const goPrev = () => setPhotoPreview((prev) => (
        prev ? { ...prev, index: Math.max(0, Number(prev.index ?? 0) - 1) } : prev
    ));
    const goNext = () => setPhotoPreview((prev) => (
        prev ? { ...prev, index: Number(prev.index ?? 0) + 1 } : prev
    ));

    useEffect(() => {
        if (!previewPhoto) return;

        const onKeyDown = (e) => {
            if (e.key === 'ArrowLeft') {
                if (canPrev) {
                    e.preventDefault();
                    goPrev();
                }
            }
            if (e.key === 'ArrowRight') {
                if (canNext) {
                    e.preventDefault();
                    goNext();
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [previewPhoto, canPrev, canNext]);

    const filterBar = (
        <div className="flex flex-wrap items-end gap-3" style={{ marginBottom: 12 }}>
            <label>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Project</div>
                <SelectInput
                    value={tableFilters.project_id}
                    onChange={(e) => applyFilter('project_id', e.target.value)}
                    style={filterControlStyle}
                >
                    <option value="">All projects</option>
                    {filterProjects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                </SelectInput>
            </label>
            <label>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Foreman</div>
                <SelectInput
                    value={tableFilters.foreman_id}
                    onChange={(e) => applyFilter('foreman_id', e.target.value)}
                    style={filterControlStyle}
                >
                    <option value="">All foremen</option>
                    {filterForemen.map((foreman) => (
                        <option key={foreman.id} value={foreman.id}>{foreman.fullname}</option>
                    ))}
                </SelectInput>
            </label>
            <label>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Week from</div>
                <DatePickerInput
                    value={tableFilters.week_from}
                    onChange={(value) => applyFilter('week_from', value)}
                    style={filterControlStyle}
                />
            </label>
            <label>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Week to</div>
                <DatePickerInput
                    value={tableFilters.week_to}
                    onChange={(value) => applyFilter('week_to', value)}
                    style={filterControlStyle}
                />
            </label>
            <label>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Submitted from</div>
                <DatePickerInput
                    value={tableFilters.date_from}
                    onChange={(value) => applyFilter('date_from', value)}
                    style={filterControlStyle}
                />
            </label>
            <label>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Submitted to</div>
                <DatePickerInput
                    value={tableFilters.date_to}
                    onChange={(value) => applyFilter('date_to', value)}
                    style={filterControlStyle}
                />
            </label>
            {hasActiveFilters ? (
                <ActionButton
                    type="button"
                    onClick={clearFilters}
                    style={{ ...filterControlStyle, cursor: 'pointer' }}
                >
                    Clear filters
                </ActionButton>
            ) : null}
        </div>
    );

    const columns = [
        {
            key: 'submitted_at',
            label: 'Submitted',
            width: 170,
            render: (row) => (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                    {formatYmdHmAmPm(row.submitted_at || row.created_at)}
                </span>
            ),
        },
        {
            key: 'foreman_name',
            label: 'Foreman',
            width: 170,
            render: (row) => row.foreman_name || '-',
        },
        {
            key: 'project_name',
            label: 'Project',
            width: 180,
            render: (row) => row.project_name || '-',
        },
        {
            key: 'week_start',
            label: 'Week Start',
            width: 130,
            render: (row) => (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                    {formatYmd(row.week_start)}
                </span>
            ),
        },
        {
            key: 'scope_of_work',
            label: 'Scope of Work',
            render: (row) => row.empty_week
                ? (
                    <div style={{ fontWeight: 600, whiteSpace: 'normal', color: 'var(--text-muted)' }}>
                        No accomplishments created this week.
                    </div>
                )
                : <div style={{ fontWeight: 600, whiteSpace: 'normal' }}>{row.scope_of_work || '-'}</div>,
        },
        {
            key: 'percent_completed',
            label: '% Completed',
            width: 120,
            render: (row) => (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                    {row.percent_completed ?? '-'}{row.percent_completed !== null && row.percent_completed !== undefined ? '%' : ''}
                </span>
            ),
        },
        {
            key: 'scope_photos',
            label: 'Uploaded Photos',
            width: 220,
            render: (row) => {
                if (row.empty_week) {
                    return '-';
                }

                const scopeKey = String(row.scope_of_work || '').trim().toLowerCase();
                const rowWeek = String(row.week_start || '').trim();
                const scopePhotos = scopeKey && Array.isArray(weeklyScopePhotoMap[scopeKey])
                    ? weeklyScopePhotoMap[scopeKey]
                    : [];
                const photos = rowWeek
                    ? scopePhotos.filter((photo) => {
                        const photoWeek = String(photo.week_start || '').trim();
                        if (photoWeek) {
                            return photoWeek === rowWeek;
                        }
                        const photoDate = String(photo.created_at || '').slice(0, 10);
                        if (!photoDate) {
                            return false;
                        }
                        const rowDate = new Date(`${rowWeek}T00:00:00`);
                        const photoTime = new Date(`${photoDate}T00:00:00`);
                        const weekEnd = new Date(rowDate);
                        weekEnd.setDate(weekEnd.getDate() + 6);
                        return photoTime >= rowDate && photoTime <= weekEnd;
                    })
                    : scopePhotos;

                if (photos.length === 0) {
                    return <div className="jf-note" style={{ fontSize: 12 }}>No photos uploaded yet.</div>;
                }

                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 60px)', gap: 6 }}>
                        {photos.slice(0, 4).map((photo) => (
                            <button
                                key={`scope-photo-${photo.id}`}
                                type="button"
                                onClick={() => {
                                    const clickedIndex = photos.findIndex((item) => String(item?.id) === String(photo?.id));
                                    setPhotoPreview({
                                        scopeKey,
                                        scopeLabel: row.scope_of_work,
                                        index: clickedIndex >= 0 ? clickedIndex : 0,
                                    });
                                }}
                                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                            >
                                <OptimizedImage
                                    src={`/files/${photo.photo_path}`}
                                    alt={photo.caption || row.scope_of_work || 'Scope photo'}
                                    style={{ width: '100%', height: 58, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                                />
                            </button>
                        ))}
                    </div>
                );
            },
        },
    ];

    useLayoutTitle('Weekly Accomplishments');

    return (
        <>
            <Head title="Weekly Accomplishments" />
                <div style={cardStyle}>
                    {filterBar}
                    <ProjectAccordionTable
                        columns={columns}
                        rows={weeklyAccomplishments}
                        projects={projects}
                        rowKey="id"
                        searchPlaceholder="Search weekly accomplishments..."
                        emptyMessage="No weekly accomplishments yet."
                        groupEmptyMessage={groupEmptyMessage}
                        routePath={routePath}
                        table={weeklyAccomplishmentTable}
                        groupPageSize={10}
                        expandAllGroups
                        statusOptions={statusFilters}
                        showGroupId={false}
                        filters={tableFilters}
                    />
                </div>

                <Modal
                    open={!!previewPhoto}
                    onClose={closePreview}
                    title={previewPhoto?.caption || photoPreview?.scopeLabel || 'Scope Photo'}
                    maxHeight="94vh"
                    headerContent={previewPhoto ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {photoPreview?.scopeLabel ? `Scope: ${photoPreview.scopeLabel}` : null}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text-muted)' }}>
                                    {`${previewIndex + 1} / ${previewPhotos.length}`}
                                </span>
                                <button type="button" onClick={goPrev} disabled={!canPrev} style={navButtonStyle(canPrev)}>
                                    Prev
                                </button>
                                <button type="button" onClick={goNext} disabled={!canNext} style={navButtonStyle(canNext)}>
                                    Next
                                </button>
                            </div>
                        </div>
                    ) : null}
                    maxWidth={900}
                >
                    {previewPhoto && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            <OptimizedImage
                                key={previewPhoto.id || previewPhoto.photo_path}
                                src={`/files/${previewPhoto.photo_path}`}
                                alt={previewPhoto.caption || photoPreview?.scopeLabel || 'Scope photo'}
                                style={{
                                    width: '100%',
                                    maxHeight: '70vh',
                                    objectFit: 'contain',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    background: 'var(--surface-2)',
                                }}
                            />
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {photoPreview?.scopeLabel ? `Scope: ${photoPreview.scopeLabel}` : null}
                                {photoPreview?.scopeLabel && previewPhoto.created_at ? ' | ' : ''}
                                {formatYmdHmAmPm(previewPhoto.created_at)}
                            </div>
                        </div>
                    )}
                </Modal>
        </>
    );
}
