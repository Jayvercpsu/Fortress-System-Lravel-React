import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import ActionButton from './ActionButton';
import Layout from './Layout';
import Modal from './Modal';
import ProjectAccordionTable from './ProjectAccordionTable';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const severityBadgeStyle = (severity) => {
    const key = String(severity || '').toLowerCase();
    if (key === 'high') {
        return {
            color: '#f87171',
            background: 'rgba(248, 113, 113, 0.10)',
            border: '1px solid rgba(248, 113, 113, 0.2)',
        };
    }
    if (key === 'medium') {
        return {
            color: '#fbbf24',
            background: 'rgba(251, 191, 36, 0.10)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
        };
    }

    return {
        color: '#60a5fa',
        background: 'rgba(96, 165, 250, 0.10)',
        border: '1px solid rgba(96, 165, 250, 0.2)',
    };
};

const statusBadgeStyle = (status) => {
    const key = String(status || '').toLowerCase();
    if (key === 'resolved') {
        return {
            color: '#22c55e',
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
        };
    }

    return {
        color: '#f97316',
        background: 'rgba(249, 115, 22, 0.10)',
        border: '1px solid rgba(249, 115, 22, 0.2)',
    };
};

export default function IssueReportsPage({ issues = [], issueTable = {}, statusFilters = [] }) {
    const [processingId, setProcessingId] = useState(null);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    const updateStatus = (row, status) => {
        if (processingId === row.id || row.status === status) return;
        setProcessingId(row.id);
        router.patch(`/issues/${row.id}/status`, { status }, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setProcessingId(null),
        });
    };
    const columns = [
        {
            key: 'created_at',
            label: 'Reported At',
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
            key: 'issue_title',
            label: 'Issue',
            render: (row) => <div style={{ fontWeight: 600 }}>{row.issue_title || '-'}</div>,
        },
        {
            key: 'description',
            label: 'Description',
            render: (row) => (
                <div style={{ maxWidth: 360, whiteSpace: 'normal', color: row.description ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {row.description || '-'}
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
                            caption: row.issue_title || 'Issue photo',
                            meta: `${row.severity || 'normal'} issue · ${row.foreman_name || 'Unknown foreman'}`,
                        })}
                        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                    >
                        <img
                            src={`/storage/${row.photo_path}`}
                            alt={row.issue_title || 'Issue photo'}
                            style={{ width: 72, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                        />
                    </button>
                ) : <span style={{ color: 'var(--text-muted)' }}>-</span>
            ),
        },
        {
            key: 'severity',
            label: 'Severity',
            width: 110,
            render: (row) => (
                <span
                    style={{
                        ...severityBadgeStyle(row.severity),
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
                    {row.severity || 'medium'}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            width: 110,
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
                    {row.status || 'open'}
                </span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            width: 190,
            render: (row) => {
                const busy = processingId === row.id;
                return (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {row.status !== 'resolved' ? (
                            <ActionButton
                                type="button"
                                variant="success"
                                disabled={busy}
                                style={{ padding: '6px 10px', fontSize: 11 }}
                                onClick={() => updateStatus(row, 'resolved')}
                            >
                                Mark Resolved
                            </ActionButton>
                        ) : (
                            <ActionButton
                                type="button"
                                variant="neutral"
                                disabled={busy}
                                style={{ padding: '6px 10px', fontSize: 11 }}
                                onClick={() => updateStatus(row, 'open')}
                            >
                                Reopen
                            </ActionButton>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <>
            <Head title="Issues" />
            <Layout title="Issue Reports">
                <div style={cardStyle}>
                <ProjectAccordionTable
                    columns={columns}
                    rows={issues}
                    rowKey="id"
                    searchPlaceholder="Search issues..."
                    emptyMessage="No issue reports yet."
                    routePath="/issues"
                    table={issueTable}
                    groupPageSize={10}
                    expandAllGroups
                    statusOptions={statusFilters}
                />
            </div>
            <Modal
                open={!!previewPhoto}
                onClose={() => setPreviewPhoto(null)}
                title={previewPhoto?.caption || 'Issue Photo'}
                maxWidth={900}
            >
                {previewPhoto && (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <img
                            src={`/storage/${previewPhoto.path}`}
                            alt={previewPhoto.caption || 'Issue photo'}
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
