import Layout from '../../Components/Layout';
import InlinePagination from '../../Components/InlinePagination';
import Modal from '../../Components/Modal';
import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const card = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const btn = (primary = false) => ({
    border: primary ? 'none' : '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    background: primary ? 'var(--success)' : 'var(--button-bg)',
    color: primary ? '#fff' : 'var(--text-main)',
});

const previewArrowBtn = (enabled, side) => ({
    position: 'absolute',
    top: '50%',
    [side]: 10,
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid var(--border-color)',
    background: enabled ? 'rgba(15, 23, 42, 0.78)' : 'rgba(15, 23, 42, 0.35)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    lineHeight: 1,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.55,
});

const emptyPaginated = {
    data: [],
    current_page: 1,
    last_page: 1,
    total: 0,
    from: 0,
    to: 0,
    prev_page_url: null,
    next_page_url: null,
};

const asPaginated = (value) => {
    if (!value) return emptyPaginated;
    if (Array.isArray(value)) {
        return {
            ...emptyPaginated,
            data: value,
            total: value.length,
            to: value.length,
        };
    }

    return {
        ...emptyPaginated,
        ...value,
        data: Array.isArray(value.data) ? value.data : [],
    };
};

const badge = (fg, bg) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    color: fg,
    background: bg,
    border: `1px solid ${fg}33`,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
});

const materialStatusBadge = (status) => {
    const key = String(status || '').toLowerCase();
    if (key === 'approved') return badge('#22c55e', 'rgba(34,197,94,0.10)');
    if (key === 'rejected') return badge('#f87171', 'rgba(248,113,113,0.10)');
    return badge('#fbbf24', 'rgba(251,191,36,0.10)');
};

const issueSeverityBadge = (severity) => {
    const key = String(severity || '').toLowerCase();
    if (key === 'high') return badge('#f87171', 'rgba(248,113,113,0.10)');
    if (key === 'medium') return badge('#fbbf24', 'rgba(251,191,36,0.10)');
    return badge('#60a5fa', 'rgba(96,165,250,0.10)');
};

const statusBadge = (status) => {
    const key = String(status || '').toLowerCase();
    if (key === 'approved' || key === 'received' || key === 'resolved') return badge('#22c55e', 'rgba(34,197,94,0.10)');
    if (key === 'rejected') return badge('#f87171', 'rgba(248,113,113,0.10)');
    if (key === 'incomplete') return badge('#f59e0b', 'rgba(245,158,11,0.10)');
    return badge('#fbbf24', 'rgba(251,191,36,0.10)');
};

const scopePhotoSourceLabel = (source) => {
    const key = String(source || '').toLowerCase();
    if (key === 'weekly_progress') return 'Weekly Progress';
    if (key === 'monitoring_board') return 'Monitoring Board';
    return 'Unknown Source';
};

const scopePhotoSourceBadge = (source) => {
    const key = String(source || '').toLowerCase();
    if (key === 'weekly_progress') return badge('#22c55e', 'rgba(34,197,94,0.10)');
    if (key === 'monitoring_board') return badge('#38bdf8', 'rgba(56,189,248,0.12)');
    return badge('#94a3b8', 'rgba(148,163,184,0.14)');
};

export default function ForemanSubmissions({
    assignedProjects = [],
    progressPhotos = emptyPaginated,
    weeklyScopePhotos = emptyPaginated,
    recentMaterialRequests = emptyPaginated,
    recentIssueReports = emptyPaginated,
    recentDeliveries = emptyPaginated,
}) {
    const { flash } = usePage().props;
    const [previewPhoto, setPreviewPhoto] = useState(null);

    const progressPhotosPager = asPaginated(progressPhotos);
    const weeklyScopePhotosPager = asPaginated(weeklyScopePhotos);
    const materialRequestsPager = asPaginated(recentMaterialRequests);
    const issueReportsPager = asPaginated(recentIssueReports);
    const deliveriesPager = asPaginated(recentDeliveries);
    const groupedProgressPhotos = useMemo(() => {
        const groups = new Map();

        progressPhotosPager.data.forEach((photo) => {
            const key = photo.project_id !== null && photo.project_id !== undefined
                ? `project-${photo.project_id}`
                : `unassigned-${String(photo.project_name || 'Unassigned')}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    project_id: photo.project_id ?? null,
                    project_name: photo.project_name || 'Unassigned',
                    photos: [],
                });
            }

            groups.get(key).photos.push(photo);
        });

        return Array.from(groups.values());
    }, [progressPhotosPager.data]);
    const groupedWeeklyScopePhotos = useMemo(() => {
        const groups = new Map();

        weeklyScopePhotosPager.data.forEach((photo) => {
            const key = `${photo.project_id ?? 'unassigned'}-${String(photo.scope_name || 'Unknown Scope')}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    project_id: photo.project_id ?? null,
                    project_name: photo.project_name || 'Unassigned',
                    scope_name: photo.scope_name || 'Unknown Scope',
                    photos: [],
                });
            }

            groups.get(key).photos.push(photo);
        });

        return Array.from(groups.values());
    }, [weeklyScopePhotosPager.data]);

    const currentPreviewIndex = useMemo(() => {
        if (!previewPhoto) return -1;
        return progressPhotosPager.data.findIndex((photo) => Number(photo.id) === Number(previewPhoto.id));
    }, [previewPhoto, progressPhotosPager.data]);
    const canPreviewPrev = currentPreviewIndex > 0;
    const canPreviewNext = currentPreviewIndex >= 0 && currentPreviewIndex < progressPhotosPager.data.length - 1;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        if (!previewPhoto) return;
        if (currentPreviewIndex === -1) {
            setPreviewPhoto(null);
        }
    }, [previewPhoto, currentPreviewIndex]);

    const showPrevPreviewPhoto = () => {
        if (!canPreviewPrev) return;
        setPreviewPhoto(progressPhotosPager.data[currentPreviewIndex - 1] ?? null);
    };

    const showNextPreviewPhoto = () => {
        if (!canPreviewNext) return;
        setPreviewPhoto(progressPhotosPager.data[currentPreviewIndex + 1] ?? null);
    };

    return (
        <>
            <Head title="Foreman Submissions" />
            <Layout title="Foreman Submissions">
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontWeight: 700 }}>Submission Access</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    View project submit links and photo submission history.
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Link href="/foreman" style={{ ...btn(false), textDecoration: 'none' }}>Dashboard</Link>
                                <Link href="/foreman/attendance" style={{ ...btn(false), textDecoration: 'none' }}>Attendance</Link>
                                <Link href="/foreman/workers" style={{ ...btn(false), textDecoration: 'none' }}>Workers</Link>
                            </div>
                        </div>
                    </div>

                    <div style={card}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Assigned Projects</div>
                        {assignedProjects.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No assigned projects yet.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: 8 }}>
                                {assignedProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 8,
                                            padding: 10,
                                            background: 'var(--surface-2)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: 8,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{project.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {project.client || '-'} | {project.phase || '-'} | {project.status || '-'}
                                            </div>
                                        </div>
                                        <a
                                            href={project.public_submit_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ ...btn(true), textDecoration: 'none' }}
                                        >
                                            Open Jotform
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700 }}>Submission History</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Latest records for your material requests, issues, and deliveries
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10, background: 'var(--surface-2)' }}>
                                <div style={{ fontWeight: 700, marginBottom: 8 }}>Material Requests</div>
                                <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                                    {materialRequestsPager.data.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No material request records yet.</div>
                                    ) : (
                                        materialRequestsPager.data.map((row) => (
                                            <div key={row.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 8, background: 'var(--surface-1)' }}>
                                                {row.photo_path ? (
                                                    <a href={`/storage/${row.photo_path}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 6 }}>
                                                        <img
                                                            src={`/storage/${row.photo_path}`}
                                                            alt={row.material_name || 'Material photo'}
                                                            style={{ width: 88, height: 62, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                                                        />
                                                    </a>
                                                ) : null}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{row.material_name}</div>
                                                    <span style={materialStatusBadge(row.status)}>{row.status || 'pending'}</span>
                                                </div>
                                                <div style={{ fontSize: 12, marginTop: 4 }}>
                                                    Qty: {row.quantity || '-'} {row.unit || ''}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                                    {row.remarks ? `Remarks: ${row.remarks}` : 'No remarks'}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{row.created_at || '-'}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <InlinePagination pager={materialRequestsPager} />
                            </div>

                            <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10, background: 'var(--surface-2)' }}>
                                <div style={{ fontWeight: 700, marginBottom: 8 }}>Issue Reports</div>
                                <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                                    {issueReportsPager.data.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No issue report records yet.</div>
                                    ) : (
                                        issueReportsPager.data.map((row) => (
                                            <div key={row.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 8, background: 'var(--surface-1)' }}>
                                                {row.photo_path ? (
                                                    <a href={`/storage/${row.photo_path}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 6 }}>
                                                        <img
                                                            src={`/storage/${row.photo_path}`}
                                                            alt={row.issue_title || 'Issue photo'}
                                                            style={{ width: 88, height: 62, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                                                        />
                                                    </a>
                                                ) : null}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{row.issue_title}</div>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                        <span style={issueSeverityBadge(row.severity)}>{row.severity || 'medium'}</span>
                                                        <span style={statusBadge(row.status)}>{row.status || 'open'}</span>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'normal' }}>
                                                    {row.description || 'No description'}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{row.created_at || '-'}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <InlinePagination pager={issueReportsPager} />
                            </div>

                            <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10, background: 'var(--surface-2)' }}>
                                <div style={{ fontWeight: 700, marginBottom: 8 }}>Delivery Confirmations</div>
                                <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                                    {deliveriesPager.data.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No delivery records yet.</div>
                                    ) : (
                                        deliveriesPager.data.map((row) => (
                                            <div key={row.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 8, background: 'var(--surface-1)' }}>
                                                {row.photo_path ? (
                                                    <a href={`/storage/${row.photo_path}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 6 }}>
                                                        <img
                                                            src={`/storage/${row.photo_path}`}
                                                            alt={row.item_delivered || 'Delivery photo'}
                                                            style={{ width: 88, height: 62, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                                                        />
                                                    </a>
                                                ) : null}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{row.item_delivered}</div>
                                                    <span style={statusBadge(row.status)}>{row.status || 'received'}</span>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                                    Project: {row.project_name || 'Unassigned'} (ID: {row.project_id ?? '-'})
                                                </div>
                                                <div style={{ fontSize: 12, marginTop: 4 }}>Qty: {row.quantity || '-'}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                                    Delivery Date: {row.delivery_date || '-'} {row.supplier ? `| Supplier: ${row.supplier}` : ''}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{row.created_at || '-'}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <InlinePagination pager={deliveriesPager} />
                            </div>
                        </div>
                    </div>

                    <div style={card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700 }}>Progress Photos</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Progress proof photos grouped by project
                            </div>
                        </div>

                        {progressPhotosPager.data.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No uploaded proof photos yet.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {groupedProgressPhotos.map((group) => (
                                    <div
                                        key={group.key}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 10,
                                            padding: 10,
                                            background: 'var(--surface-2)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                            <div style={{ fontWeight: 700 }}>
                                                {group.project_name || 'Unassigned'}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {group.photos.length} photo{group.photos.length === 1 ? '' : 's'}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                                            {group.photos.map((photo) => (
                                                <button
                                                    key={photo.id}
                                                    type="button"
                                                    onClick={() => setPreviewPhoto(photo)}
                                                    style={{
                                                        textDecoration: 'none',
                                                        color: 'inherit',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 8,
                                                        background: 'var(--surface-1)',
                                                        padding: 8,
                                                        cursor: 'pointer',
                                                        width: '100%',
                                                        textAlign: 'left',
                                                    }}
                                                >
                                                    <img
                                                        src={`/storage/${photo.photo_path}`}
                                                        alt={photo.caption || 'Progress proof'}
                                                        style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }}
                                                    />
                                                    <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {photo.caption || 'No caption'}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                                        {photo.created_at || '-'}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <InlinePagination pager={progressPhotosPager} />
                    </div>

                    <div style={card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700 }}>Scope Photos</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Uploaded from Weekly Progress and Monitoring Board, grouped by project and scope
                            </div>
                        </div>

                        {weeklyScopePhotosPager.data.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No scope photos yet.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {groupedWeeklyScopePhotos.map((group) => (
                                    <div
                                        key={group.key}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 10,
                                            padding: 10,
                                            background: 'var(--surface-2)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{group.project_name || 'Unassigned'}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.scope_name || 'Unknown Scope'}</div>
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {group.photos.length} photo{group.photos.length === 1 ? '' : 's'}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                                            {group.photos.map((photo) => (
                                                <a
                                                    key={photo.id}
                                                    href={`/storage/${photo.photo_path}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{
                                                        textDecoration: 'none',
                                                        color: 'inherit',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 8,
                                                        background: 'var(--surface-1)',
                                                        padding: 8,
                                                        display: 'block',
                                                    }}
                                                >
                                                    <img
                                                        src={`/storage/${photo.photo_path}`}
                                                        alt={photo.caption || 'Weekly scope photo'}
                                                        style={{ width: '100%', height: 92, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }}
                                                    />
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                                        <span style={scopePhotoSourceBadge(photo.source)}>
                                                            {scopePhotoSourceLabel(photo.source)}
                                                        </span>
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                        }}
                                                        title={photo.caption || 'No caption'}
                                                    >
                                                        {photo.caption || 'No caption'}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                                        {photo.created_at || '-'}
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <InlinePagination pager={weeklyScopePhotosPager} />
                    </div>
                </div>

                <Modal
                    open={!!previewPhoto}
                    onClose={() => setPreviewPhoto(null)}
                    title={previewPhoto?.caption || 'Progress Photo Preview'}
                    maxWidth={900}
                >
                    {previewPhoto && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            <div style={{ position: 'relative' }}>
                                <img
                                    src={`/storage/${previewPhoto.photo_path}`}
                                    alt={previewPhoto.caption || 'Progress proof'}
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
                                <button
                                    type="button"
                                    onClick={showPrevPreviewPhoto}
                                    disabled={!canPreviewPrev}
                                    aria-label="Previous photo"
                                    style={previewArrowBtn(canPreviewPrev, 'left')}
                                >
                                    <ChevronLeft size={20} strokeWidth={2.25} />
                                </button>
                                <button
                                    type="button"
                                    onClick={showNextPreviewPhoto}
                                    disabled={!canPreviewNext}
                                    aria-label="Next photo"
                                    style={previewArrowBtn(canPreviewNext, 'right')}
                                >
                                    <ChevronRight size={20} strokeWidth={2.25} />
                                </button>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Project: {previewPhoto.project_name || 'Unassigned'} | {previewPhoto.created_at || '-'}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {currentPreviewIndex >= 0 ? `${currentPreviewIndex + 1} / ${progressPhotosPager.data.length} (this page)` : '-'}
                                </div>
                                <a
                                    href={`/storage/${previewPhoto.photo_path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ ...btn(false), textDecoration: 'none' }}
                                >
                                    Open in new tab
                                </a>
                            </div>
                        </div>
                    )}
                </Modal>
            </Layout>
        </>
    );
}
