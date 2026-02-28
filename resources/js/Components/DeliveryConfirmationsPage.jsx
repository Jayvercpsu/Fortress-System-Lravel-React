import Layout from './Layout';
import ProjectAccordionTable from './ProjectAccordionTable';
import { Head } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const statusBadgeStyle = (status) => {
    const key = String(status || '').toLowerCase();
    if (key === 'received') {
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

export default function DeliveryConfirmationsPage({ deliveries = [], deliveryTable = {} }) {
    const columns = [
        {
            key: 'id',
            label: 'ID',
            width: 80,
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>#{row.id}</span>,
        },
        {
            key: 'delivery_date',
            label: 'Delivery Date',
            width: 130,
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.delivery_date || '-'}</span>,
        },
        {
            key: 'project',
            label: 'Project',
            width: 180,
            render: (row) => (
                <div>
                    <div style={{ fontWeight: 600 }}>{row.project_name || 'Unassigned'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Project ID: {row.project_id ?? '-'}
                    </div>
                </div>
            ),
        },
        {
            key: 'foreman_name',
            label: 'Foreman',
            width: 170,
            render: (row) => row.foreman_name || '-',
        },
        {
            key: 'item_delivered',
            label: 'Item Delivered',
            render: (row) => <div style={{ fontWeight: 600 }}>{row.item_delivered || '-'}</div>,
        },
        {
            key: 'quantity',
            label: 'Quantity',
            width: 120,
            render: (row) => row.quantity || '-',
        },
        {
            key: 'supplier',
            label: 'Supplier',
            width: 180,
            render: (row) => row.supplier || <span style={{ color: 'var(--text-muted)' }}>-</span>,
        },
        {
            key: 'photo',
            label: 'Photo',
            width: 120,
            render: (row) => (
                row.photo_path ? (
                    <a href={`/storage/${row.photo_path}`} target="_blank" rel="noreferrer">
                        <img
                            src={`/storage/${row.photo_path}`}
                            alt={row.item_delivered || 'Delivery photo'}
                            style={{ width: 72, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                        />
                    </a>
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
                    {row.status || 'received'}
                </span>
            ),
        },
        {
            key: 'created_at',
            label: 'Logged At',
            width: 170,
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.created_at || '-'}</span>,
        },
    ];

    return (
        <>
            <Head title="Delivery" />
            <Layout title="Delivery Confirmations">
                <div style={cardStyle}>
                    <ProjectAccordionTable
                        columns={columns}
                        rows={deliveries}
                        rowKey="id"
                        searchPlaceholder="Search deliveries..."
                        emptyMessage="No delivery confirmations yet."
                        routePath="/delivery"
                        table={deliveryTable}
                    />
                </div>
            </Layout>
        </>
    );
}
