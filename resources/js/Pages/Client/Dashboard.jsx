import { useState } from 'react';
import Layout from '../../Components/Layout';
import DataTable from '../../Components/DataTable';
import Modal from '../../Components/Modal';
import OptimizedImage from '../../Components/OptimizedImage';
import { Head, router } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatCard({ label, value, subtext }) {
    return (
        <div style={cardStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                {label}
            </div>
            <div style={{ fontWeight: 700, fontSize: 20, fontFamily: "'DM Mono', monospace" }}>{value}</div>
            {subtext ? <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 12 }}>{subtext}</div> : null}
        </div>
    );
}

export default function ClientDashboard({
    assignedProject = null,
    photos = [],
    photoTable = {},
    accomplishments = [],
    accomplishmentTable = {},
    weeklyScopePhotoMap = {},
}) {
    const [previewPhoto, setPreviewPhoto] = useState(null);
    const [previewScopePhoto, setPreviewScopePhoto] = useState(null);
    const photosState = {
        search: photoTable?.search ?? '',
        perPage: Number(photoTable?.per_page ?? 10),
        page: Number(photoTable?.current_page ?? 1),
        lastPage: Number(photoTable?.last_page ?? 1),
        total: Number(photoTable?.total ?? photos.length ?? 0),
        from: photoTable?.from ?? null,
        to: photoTable?.to ?? null,
    };

    const accomplishmentsState = {
        search: accomplishmentTable?.search ?? '',
        perPage: Number(accomplishmentTable?.per_page ?? 10),
        page: Number(accomplishmentTable?.current_page ?? 1),
        lastPage: Number(accomplishmentTable?.last_page ?? 1),
        total: Number(accomplishmentTable?.total ?? accomplishments.length ?? 0),
        from: accomplishmentTable?.from ?? null,
        to: accomplishmentTable?.to ?? null,
    };

    const buildQueryParams = (overrides = {}) => {
        const params = {
            photos_search: overrides.photos_search !== undefined ? overrides.photos_search : photosState.search,
            photos_per_page: overrides.photos_per_page !== undefined ? overrides.photos_per_page : photosState.perPage,
            photos_page: overrides.photos_page !== undefined ? overrides.photos_page : photosState.page,
            accomplishments_search:
                overrides.accomplishments_search !== undefined ? overrides.accomplishments_search : accomplishmentsState.search,
            accomplishments_per_page:
                overrides.accomplishments_per_page !== undefined
                    ? overrides.accomplishments_per_page
                    : accomplishmentsState.perPage,
            accomplishments_page:
                overrides.accomplishments_page !== undefined ? overrides.accomplishments_page : accomplishmentsState.page,
        };

        if (!params.photos_search) delete params.photos_search;
        if (!params.accomplishments_search) delete params.accomplishments_search;

        return params;
    };

    const navigate = (overrides = {}) => {
        router.get('/client', buildQueryParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const photoColumns = [
        {
            key: 'photo',
            label: 'Photo',
            width: 120,
            render: (row) =>
                row.photo_path ? (
                    <button
                        type="button"
                        onClick={() => setPreviewPhoto(row)}
                        style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            overflow: 'hidden',
                            padding: 0,
                            background: 'var(--surface-2)',
                            cursor: 'pointer',
                        }}
                    >
                        <OptimizedImage
                            src={`/storage/${row.photo_path}`}
                            alt={row.caption || 'Progress photo'}
                            style={{
                                width: 92,
                                height: 62,
                                objectFit: 'cover',
                                display: 'block',
                            }}
                        />
                    </button>
                ) : (
                    '-'
                ),
        },
        {
            key: 'caption',
            label: 'Caption',
            render: (row) => row.caption || '-',
            searchAccessor: (row) => row.caption,
        },
        {
            key: 'project_name',
            label: 'Project',
            render: (row) => row.project_name || '-',
            searchAccessor: (row) => row.project_name,
        },
        {
            key: 'uploaded_by',
            label: 'Uploaded By',
            render: (row) => row.uploaded_by || '-',
            searchAccessor: (row) => row.uploaded_by,
        },
        {
            key: 'created_at',
            label: 'Date',
            render: (row) => row.created_at || '-',
            searchAccessor: (row) => row.created_at,
        },
    ];

    const accomplishmentColumns = [
        {
            key: 'scope_photos',
            label: 'Photos',
            width: 220,
            render: (row) => {
                const scopeKey = String(row.scope_of_work || '').trim().toLowerCase();
                const photosForScope =
                    scopeKey && Array.isArray(weeklyScopePhotoMap[scopeKey])
                        ? weeklyScopePhotoMap[scopeKey]
                        : [];

                if (photosForScope.length === 0) {
                    return (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            No scope photos yet.
                        </div>
                    );
                }

                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: 6 }}>
                        {photosForScope.slice(0, 4).map((photo) => (
                            <button
                                key={`scope-photo-${photo.id}`}
                                type="button"
                                onClick={() => setPreviewScopePhoto({ ...photo, scope: row.scope_of_work })}
                                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                            >
                                <OptimizedImage
                                    src={`/storage/${photo.photo_path}`}
                                    alt={photo.caption || row.scope_of_work || 'Scope photo'}
                                    style={{
                                        width: '100%',
                                        height: 58,
                                        objectFit: 'cover',
                                        borderRadius: 6,
                                        border: '1px solid var(--border-color)',
                                    }}
                                />
                            </button>
                        ))}
                    </div>
                );
            },
        },
        {
            key: 'week_start',
            label: 'Week Start',
            render: (row) => row.week_start || '-',
            searchAccessor: (row) => row.week_start,
        },
        {
            key: 'scope_of_work',
            label: 'Accomplishment',
            render: (row) => row.scope_of_work || '-',
            searchAccessor: (row) => row.scope_of_work,
        },
        {
            key: 'percent_completed',
            label: 'Percent',
            render: (row) => `${Number(row.percent_completed || 0).toFixed(2)}%`,
            searchAccessor: (row) => row.percent_completed,
        },
        {
            key: 'submitted_by',
            label: 'Submitted By',
            render: (row) => row.submitted_by || '-',
            searchAccessor: (row) => row.submitted_by,
        },
        {
            key: 'created_at',
            label: 'Date',
            render: (row) => row.created_at || '-',
            searchAccessor: (row) => row.created_at,
        },
    ];

    return (
        <>
            <Head title="Client Dashboard" />
            <Layout title="Client Dashboard">
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                        <StatCard
                            label="Assigned Project"
                            value={assignedProject?.name || 'Not Assigned'}
                        />
                        <StatCard
                            label="Contract Amount"
                            value={money(assignedProject?.contract_amount)}
                        />
                        <StatCard
                            label="Downpayment"
                            value={money(assignedProject?.downpayment_amount)}
                            subtext={`${Number(assignedProject?.downpayment_percent || 0).toFixed(2)}% of contract`}
                        />
                        <StatCard
                            label="Remaining Balance"
                            value={money(assignedProject?.remaining_balance)}
                        />
                    </div>

                    <div style={cardStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Progress Photos</div>
                        <DataTable
                            columns={photoColumns}
                            rows={photos}
                            rowKey="id"
                            searchPlaceholder="Search photos..."
                            emptyMessage="No progress photos available for this project."
                            pageSizeOptions={[10, 25, 50]}
                            serverSide
                            serverSearchValue={photosState.search}
                            serverPage={photosState.page}
                            serverPerPage={photosState.perPage}
                            serverTotalItems={photosState.total}
                            serverTotalPages={photosState.lastPage}
                            serverFrom={photosState.from}
                            serverTo={photosState.to}
                            onServerSearchChange={(value) => navigate({ photos_search: value, photos_page: 1 })}
                            onServerPerPageChange={(value) => navigate({ photos_per_page: value, photos_page: 1 })}
                            onServerPageChange={(value) => navigate({ photos_page: value })}
                        />
                    </div>

                    <div style={cardStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Project Accomplishments</div>
                        <DataTable
                            columns={accomplishmentColumns}
                            rows={accomplishments}
                            rowKey="id"
                            searchPlaceholder="Search accomplishments..."
                            emptyMessage="No accomplishments available for this project."
                            pageSizeOptions={[10, 25, 50]}
                            serverSide
                            serverSearchValue={accomplishmentsState.search}
                            serverPage={accomplishmentsState.page}
                            serverPerPage={accomplishmentsState.perPage}
                            serverTotalItems={accomplishmentsState.total}
                            serverTotalPages={accomplishmentsState.lastPage}
                            serverFrom={accomplishmentsState.from}
                            serverTo={accomplishmentsState.to}
                            onServerSearchChange={(value) => navigate({ accomplishments_search: value, accomplishments_page: 1 })}
                            onServerPerPageChange={(value) => navigate({ accomplishments_per_page: value, accomplishments_page: 1 })}
                            onServerPageChange={(value) => navigate({ accomplishments_page: value })}
                        />
                    </div>
                </div>
            </Layout>
            <Modal
                open={Boolean(previewPhoto)}
                onClose={() => setPreviewPhoto(null)}
                title={previewPhoto?.caption || 'Progress Photo'}
                maxWidth={900}
            >
                {previewPhoto && (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <OptimizedImage
                            src={`/storage/${previewPhoto.photo_path}`}
                            alt={previewPhoto.caption || 'Progress photo'}
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
                            Uploaded by: {previewPhoto.uploaded_by || '-'} | Project: {previewPhoto.project_name || '-'} |{' '}
                            {previewPhoto.created_at || '-'}
                        </div>
                    </div>
                )}
            </Modal>
            <Modal
                open={Boolean(previewScopePhoto)}
                onClose={() => setPreviewScopePhoto(null)}
                title={previewScopePhoto?.caption || previewScopePhoto?.scope || 'Scope Photo'}
                maxWidth={900}
            >
                {previewScopePhoto && (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <OptimizedImage
                            src={`/storage/${previewScopePhoto.photo_path}`}
                            alt={previewScopePhoto.caption || previewScopePhoto.scope || 'Scope photo'}
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
                            {previewScopePhoto.scope ? `Scope: ${previewScopePhoto.scope}` : null}
                            {previewScopePhoto.scope && previewScopePhoto.created_at ? ' | ' : ''}
                            {previewScopePhoto.created_at || '-'}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
