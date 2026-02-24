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

export default function MaterialRequestsPage({ materialRequests = [], materialRequestTable = {} }) {
    const table = {
        search: materialRequestTable?.search ?? '',
        perPage: Number(materialRequestTable?.per_page ?? 10),
        page: Number(materialRequestTable?.current_page ?? 1),
        lastPage: Number(materialRequestTable?.last_page ?? 1),
        total: Number(materialRequestTable?.total ?? materialRequests.length ?? 0),
        from: materialRequestTable?.from ?? null,
        to: materialRequestTable?.to ?? null,
    };

    const navigateTable = (overrides = {}) => {
        router.get('/materials', {
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
            key: 'created_at',
            label: 'Submitted',
            width: 170,
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.created_at || '-'}</span>,
            searchAccessor: (row) => row.created_at,
        },
        {
            key: 'foreman_name',
            label: 'Foreman',
            width: 170,
            render: (row) => row.foreman_name || '-',
            searchAccessor: (row) => row.foreman_name,
        },
        {
            key: 'material_name',
            label: 'Material',
            render: (row) => <div style={{ fontWeight: 600 }}>{row.material_name || '-'}</div>,
            searchAccessor: (row) => row.material_name,
        },
        {
            key: 'quantity',
            label: 'Qty',
            width: 130,
            render: (row) => `${row.quantity || '-'} ${row.unit || ''}`.trim(),
            searchAccessor: (row) => `${row.quantity || ''} ${row.unit || ''}`,
        },
        {
            key: 'remarks',
            label: 'Remarks',
            render: (row) => (
                <div style={{ color: row.remarks ? 'var(--text-main)' : 'var(--text-muted)', maxWidth: 320, whiteSpace: 'normal' }}>
                    {row.remarks || '-'}
                </div>
            ),
            searchAccessor: (row) => row.remarks,
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
            searchAccessor: (row) => row.status,
        },
    ];

    return (
        <>
            <Head title="Materials" />
            <Layout title="Materials / Requests">
                <div style={cardStyle}>
                    <DataTable
                        columns={columns}
                        rows={materialRequests}
                        rowKey="id"
                        searchPlaceholder="Search material requests..."
                        emptyMessage="No material requests yet."
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
