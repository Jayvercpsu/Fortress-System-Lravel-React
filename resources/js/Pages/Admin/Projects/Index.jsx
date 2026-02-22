import Layout from '../../../Components/Layout';
import DataTable from '../../../Components/DataTable';
import { Head, Link, router } from '@inertiajs/react';

export default function AdminProjectsIndex({ projects = [], projectTable = {} }) {
    const table = {
        search: projectTable?.search ?? '',
        perPage: Number(projectTable?.per_page ?? 10),
        page: Number(projectTable?.current_page ?? 1),
        lastPage: Number(projectTable?.last_page ?? 1),
        total: Number(projectTable?.total ?? projects.length ?? 0),
        from: projectTable?.from ?? null,
        to: projectTable?.to ?? null,
    };

    const navigateTable = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };

        if (!params.search) delete params.search;

        router.get('/projects', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const columns = [
        {
            key: 'name',
            label: 'Name',
            render: (project) => <div style={{ fontWeight: 600 }}>{project.name}</div>,
            searchAccessor: (project) => project.name,
        },
        {
            key: 'client',
            label: 'Client',
            searchAccessor: (project) => project.client,
        },
        {
            key: 'phase',
            label: 'Phase',
            searchAccessor: (project) => project.phase,
        },
        {
            key: 'status',
            label: 'Status',
            searchAccessor: (project) => project.status,
        },
        {
            key: 'overall_progress',
            label: 'Progress',
            render: (project) => `${project.overall_progress}%`,
            searchAccessor: (project) => project.overall_progress,
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (project) => (
                <Link href={`/projects/${project.id}`} style={{ color: 'var(--active-text)', textDecoration: 'none', fontSize: 13 }}>
                    View
                </Link>
            ),
        },
    ];

    return (
        <>
            <Head title="Projects" />
            <Layout title="Projects">
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 12 }}>
                    <DataTable
                        columns={columns}
                        rows={projects}
                        rowKey="id"
                        searchPlaceholder="Search projects..."
                        emptyMessage="No projects yet."
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
