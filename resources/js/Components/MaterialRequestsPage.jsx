import Layout from './Layout';
import Modal from './Modal';
import ProjectAccordionTable from './ProjectAccordionTable';
import ActionButton from './ActionButton';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const statusBadgeStyle = (status) => {
    const key = String(status || '').toLowerCase();
    if (key === 'approved') {
        return {
            color: '#22c55e',
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
        };
    }
    if (key === 'rejected') {
        return {
            color: '#f87171',
            background: 'rgba(248, 113, 113, 0.10)',
            border: '1px solid rgba(248, 113, 113, 0.2)',
        };
    }

    return {
        color: '#fbbf24',
        background: 'rgba(251, 191, 36, 0.10)',
        border: '1px solid rgba(251, 191, 36, 0.2)',
    };
};

export default function MaterialRequestsPage({
    materialRequests = [],
    materialRequestTable = {},
    statusFilters = [],
}) {
    const [processingId, setProcessingId] = useState(null);
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
            key: 'material_name',
            label: 'Material',
            render: (row) => <div style={{ fontWeight: 600 }}>{row.material_name || '-'}</div>,
        },
        {
            key: 'quantity',
            label: 'Qty',
            width: 130,
            render: (row) => `${row.quantity || '-'} ${row.unit || ''}`.trim(),
        },
        {
            key: 'remarks',
            label: 'Remarks',
            render: (row) => (
                <div style={{ color: row.remarks ? 'var(--text-main)' : 'var(--text-muted)', maxWidth: 320, whiteSpace: 'normal' }}>
                    {row.remarks || '-'}
                </div>
            ),
        },
        {
            key: 'photo',
            label: 'Photo',
            width: 120,
            render: (row) => (
                row.photo_path ? (
                    <button
                        type="button"
                        onClick={() => setPreviewPhoto({
                            path: row.photo_path,
                            caption: row.material_name || 'Material photo',
                            meta: `Requested by ${row.foreman_name || 'unknown'}`,
                        })}
                        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                    >
                        <img
                            src={`/storage/${row.photo_path}`}
                            alt={row.material_name || 'Material photo'}
                            style={{ width: 72, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                        />
                    </button>
                ) : <span style={{ color: 'var(--text-muted)' }}>-</span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            width: 120,
            render: (row) => (
                <span
                    style={{
                        ...statusBadgeStyle(row.status),
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 999,
                        padding: '3px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                    }}
                >
                    {row.status || 'pending'}
                </span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            width: 220,
            render: (row) => {
                const busy = processingId === row.id;
                const mutateStatus = (status) => {
                    if (busy || row.status === status) return;
                    setProcessingId(row.id);
                    router.patch(`/materials/${row.id}/status`, { status }, {
                        preserveScroll: true,
                        preserveState: true,
                        onFinish: () => setProcessingId(null),
                    });
                };

                return (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <ActionButton
                            type="button"
                            variant="success"
                            style={{ padding: '6px 10px', fontSize: 11 }}
                            disabled={busy || row.status === 'approved'}
                            onClick={() => mutateStatus('approved')}
                        >
                            Approve
                        </ActionButton>
                        <ActionButton
                            type="button"
                            variant="danger"
                            style={{ padding: '6px 10px', fontSize: 11 }}
                            disabled={busy || row.status === 'rejected'}
                            onClick={() => mutateStatus('rejected')}
                        >
                            Reject
                        </ActionButton>
                    </div>
                );
            },
        },
    ];

    return (
        <>
            <Head title="Materials" />
            <Layout title="Materials / Requests">
                <div style={cardStyle}>
                <ProjectAccordionTable
                    columns={columns}
                    rows={materialRequests}
                    rowKey="id"
                    searchPlaceholder="Search material requests..."
                    emptyMessage="No material requests yet."
                    routePath="/materials"
                    table={materialRequestTable}
                    groupPageSize={10}
                    expandAllGroups
                    statusOptions={statusFilters}
                />
            </div>
            <Modal
                open={!!previewPhoto}
                onClose={() => setPreviewPhoto(null)}
                title={previewPhoto?.caption || 'Material Photo'}
                maxWidth={900}
            >
                {previewPhoto && (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <img
                            src={`/storage/${previewPhoto.path}`}
                            alt={previewPhoto.caption || 'Material photo'}
                            style={{
                                width: '100%',
                                maxHeight: '70vh',
                                objectFit: 'contain',
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                background: 'var(--surface-2)',
                            }}
                        />
                        {previewPhoto.meta ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {previewPhoto.meta}
                            </div>
                        ) : null}
                    </div>
                )}
            </Modal>
        </Layout>
    </>
);
}
