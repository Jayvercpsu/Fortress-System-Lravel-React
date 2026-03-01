import { useState } from 'react';
import Layout from './Layout';
import Modal from './Modal';
import ProjectAccordionTable from './ProjectAccordionTable';
import { Head } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

export default function WeeklyAccomplishmentsPage({
    weeklyAccomplishments = [],
    weeklyAccomplishmentTable = {},
    weeklyScopePhotoMap = {},
    statusFilters = [],
}) {
    const [previewPhoto, setPreviewPhoto] = useState(null);
    const columns = [
        {
            key: 'created_at',
            label: 'Submitted',
            width: 170,
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.created_at || '-'}</span>,
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
            render: (row) => row.week_start || '-',
        },
        {
            key: 'scope_of_work',
            label: 'Scope of Work',
            render: (row) => <div style={{ fontWeight: 600, whiteSpace: 'normal' }}>{row.scope_of_work || '-'}</div>,
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
            label: 'Photos',
            width: 220,
            render: (row) => {
                const scopeKey = String(row.scope_of_work || '').trim().toLowerCase();
                const photos = scopeKey && Array.isArray(weeklyScopePhotoMap[scopeKey])
                    ? weeklyScopePhotoMap[scopeKey]
                    : [];

                if (photos.length === 0) {
                    return <div className="jf-note" style={{ fontSize: 12 }}>No scope photos yet.</div>;
                }

                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: 6 }}>
                        {photos.slice(0, 4).map((photo) => (
                            <button
                                key={`scope-photo-${photo.id}`}
                                type="button"
                                onClick={() => setPreviewPhoto({ ...photo, scope: row.scope_of_work })}
                                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                            >
                                <img
                                    src={`/storage/${photo.photo_path}`}
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

    return (
        <>
            <Head title="Weekly Accomplishments" />
            <Layout title="Weekly Accomplishments">
                <div style={cardStyle}>
                <ProjectAccordionTable
                    columns={columns}
                    rows={weeklyAccomplishments}
                    rowKey="id"
                    searchPlaceholder="Search weekly accomplishments..."
                    emptyMessage="No weekly accomplishments yet."
                    routePath="/weekly-accomplishments"
                    table={weeklyAccomplishmentTable}
                    groupPageSize={10}
                    expandAllGroups
                    statusOptions={statusFilters}
                />
            </div>
            <Modal
                open={!!previewPhoto}
                onClose={() => setPreviewPhoto(null)}
                title={previewPhoto?.caption || previewPhoto?.scope || 'Scope Photo'}
                maxWidth={900}
            >
                {previewPhoto && (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <img
                            src={`/storage/${previewPhoto.photo_path}`}
                            alt={previewPhoto.caption || previewPhoto.scope || 'Scope photo'}
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
                            {previewPhoto.scope ? `Scope: ${previewPhoto.scope}` : null}
                            {previewPhoto.scope && previewPhoto.created_at ? ' | ' : ''}
                            {previewPhoto.created_at || '-'}
                        </div>
                    </div>
                )}
            </Modal>
        </Layout>
    </>
);
}
