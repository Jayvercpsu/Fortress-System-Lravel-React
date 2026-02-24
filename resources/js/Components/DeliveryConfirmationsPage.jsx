import Layout from './Layout';
import DataTable from './DataTable';
import { Head, router } from '@inertiajs/react';

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
    const table = {
        search: deliveryTable?.search ?? '',
        perPage: Number(deliveryTable?.per_page ?? 10),
        page: Number(deliveryTable?.current_page ?? 1),
        lastPage: Number(deliveryTable?.last_page ?? 1),
        total: Number(deliveryTable?.total ?? deliveries.length ?? 0),
        from: deliveryTable?.from ?? null,
        to: deliveryTable?.to ?? null,
    };

    const navigateTable = (overrides = {}) => {
        router.get('/delivery', {
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const columns = [
        {
            key: 'delivery_date',
            label: 'Delivery Date',
            width: 130,
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.delivery_date || '-'}</span>,
            searchAccessor: (row) => row.delivery_date,
        },
        {
            key: 'foreman_name',
            label: 'Foreman',
            width: 170,
            render: (row) => row.foreman_name || '-',
            searchAccessor: (row) => row.foreman_name,
        },
        {
            key: 'item_delivered',
            label: 'Item Delivered',
            render: (row) => <div style={{ fontWeight: 600 }}>{row.item_delivered || '-'}</div>,
            searchAccessor: (row) => row.item_delivered,
        },
        {
            key: 'quantity',
            label: 'Quantity',
            width: 120,
            render: (row) => row.quantity || '-',
            searchAccessor: (row) => row.quantity,
        },
        {
            key: 'supplier',
            label: 'Supplier',
            width: 180,
            render: (row) => row.supplier || <span style={{ color: 'var(--text-muted)' }}>-</span>,
            searchAccessor: (row) => row.supplier,
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
            searchAccessor: (row) => row.status,
        },
        {
            key: 'created_at',
            label: 'Logged At',
            width: 170,
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.created_at || '-'}</span>,
            searchAccessor: (row) => row.created_at,
        },
    ];

    return (
        <>
            <Head title="Delivery" />
            <Layout title="Delivery Confirmations">
                <div style={cardStyle}>
                    <DataTable
                        columns={columns}
                        rows={deliveries}
                        rowKey="id"
                        searchPlaceholder="Search deliveries..."
                        emptyMessage="No delivery confirmations yet."
                        serverSide
                        serverSearchValue={table.search}
                        serverPage={table.page}
                        serverPerPage={table.perPage}
                        serverTotalItems={table.total}
                        serverTotalPages={table.lastPage}
                        serverFrom={table.from}
                        serverTo={table.to}
                        onServerSearchChange={(value) => navigateTable({ search: value, page: 1 })}
                        onServerPerPageChange={(value) => navigateTable({ per_page: value, page: 1 })}
                        onServerPageChange={(value) => navigateTable({ page: value })}
                    />
                </div>
            </Layout>
        </>
    );
}
