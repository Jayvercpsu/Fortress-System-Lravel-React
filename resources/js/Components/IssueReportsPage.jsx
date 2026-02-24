import Layout from './Layout';
import DataTable from './DataTable';
import { Head, router } from '@inertiajs/react';

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

export default function IssueReportsPage({ issues = [], issueTable = {} }) {
    const table = {
        search: issueTable?.search ?? '',
        perPage: Number(issueTable?.per_page ?? 10),
        page: Number(issueTable?.current_page ?? 1),
        lastPage: Number(issueTable?.last_page ?? 1),
        total: Number(issueTable?.total ?? issues.length ?? 0),
        from: issueTable?.from ?? null,
        to: issueTable?.to ?? null,
    };

    const navigateTable = (overrides = {}) => {
        router.get('/issues', {
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
            label: 'Reported At',
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
            key: 'issue_title',
            label: 'Issue',
            render: (row) => <div style={{ fontWeight: 600 }}>{row.issue_title || '-'}</div>,
            searchAccessor: (row) => row.issue_title,
        },
        {
            key: 'description',
            label: 'Description',
            render: (row) => (
                <div style={{ maxWidth: 360, whiteSpace: 'normal', color: row.description ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {row.description || '-'}
                </div>
            ),
            searchAccessor: (row) => row.description,
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
            searchAccessor: (row) => row.severity,
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
            searchAccessor: (row) => row.status,
        },
    ];

    return (
        <>
            <Head title="Issues" />
            <Layout title="Issue Reports">
                <div style={cardStyle}>
                    <DataTable
                        columns={columns}
                        rows={issues}
                        rowKey="id"
                        searchPlaceholder="Search issues..."
                        emptyMessage="No issue reports yet."
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
