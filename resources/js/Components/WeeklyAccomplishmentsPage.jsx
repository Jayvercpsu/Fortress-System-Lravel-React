import Layout from './Layout';
import DataTable from './DataTable';
import { Head, router } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

export default function WeeklyAccomplishmentsPage({
    weeklyAccomplishments = [],
    weeklyAccomplishmentTable = {},
}) {
    const table = {
        search: weeklyAccomplishmentTable?.search ?? '',
        perPage: Number(weeklyAccomplishmentTable?.per_page ?? 10),
        page: Number(weeklyAccomplishmentTable?.current_page ?? 1),
        lastPage: Number(weeklyAccomplishmentTable?.last_page ?? 1),
        total: Number(weeklyAccomplishmentTable?.total ?? weeklyAccomplishments.length ?? 0),
        from: weeklyAccomplishmentTable?.from ?? null,
        to: weeklyAccomplishmentTable?.to ?? null,
    };

    const navigateTable = (overrides = {}) => {
        router.get('/weekly-accomplishments', {
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
            key: 'project_name',
            label: 'Project',
            width: 180,
            render: (row) => row.project_name || '-',
            searchAccessor: (row) => row.project_name,
        },
        {
            key: 'week_start',
            label: 'Week Start',
            width: 130,
            render: (row) => row.week_start || '-',
            searchAccessor: (row) => row.week_start,
        },
        {
            key: 'scope_of_work',
            label: 'Scope of Work',
            render: (row) => <div style={{ fontWeight: 600, whiteSpace: 'normal' }}>{row.scope_of_work || '-'}</div>,
            searchAccessor: (row) => row.scope_of_work,
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
            searchAccessor: (row) => String(row.percent_completed ?? ''),
        },
    ];

    return (
        <>
            <Head title="Weekly Accomplishments" />
            <Layout title="Weekly Accomplishments">
                <div style={cardStyle}>
                    <DataTable
                        columns={columns}
                        rows={weeklyAccomplishments}
                        rowKey="id"
                        searchPlaceholder="Search weekly accomplishments..."
                        emptyMessage="No weekly accomplishments yet."
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
