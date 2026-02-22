import Layout from '../../../Components/Layout';
import DataTable from '../../../Components/DataTable';
import Modal from '../../../Components/Modal';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function HeadAdminProjectsIndex({ projects = [], projectTable = {} }) {
    const [projectToDelete, setProjectToDelete] = useState(null);
    const actionButtonBase = {
        borderRadius: 6,
        padding: '4px 10px',
        fontSize: 12,
        textDecoration: 'none',
        border: '1px solid var(--border-color)',
        background: 'var(--button-bg)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1.3,
    };
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

    const listQueryString = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };

        if (!params.search) delete params.search;
        const qs = new URLSearchParams(params).toString();
        return qs ? `?${qs}` : '';
    };

    const deleteProject = () => {
        if (!projectToDelete) return;

        router.delete(`/projects/${projectToDelete.id}${listQueryString()}`, {
            preserveScroll: true,
            onSuccess: () => toast.success('Project deleted.'),
            onError: () => toast.error('Unable to delete project.'),
            onFinish: () => setProjectToDelete(null),
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
                <div style={{ display: 'inline-flex', gap: 8 }}>
                    <Link
                        href={`/projects/${project.id}`}
                        style={{
                            ...actionButtonBase,
                            color: 'var(--active-text)',
                            border: '1px solid color-mix(in srgb, var(--active-text) 25%, var(--border-color))',
                            background: 'color-mix(in srgb, var(--active-bg) 55%, transparent)',
                        }}
                    >
                        View
                    </Link>
                    <Link
                        href={`/projects/${project.id}/edit`}
                        style={{
                            ...actionButtonBase,
                            color: '#60a5fa',
                            border: '1px solid rgba(96,165,250,0.25)',
                            background: 'rgba(96,165,250,0.08)',
                        }}
                    >
                        Edit
                    </Link>
                    <button
                        type="button"
                        onClick={() => setProjectToDelete({ id: project.id, name: project.name })}
                        style={{
                            ...actionButtonBase,
                            background: 'rgba(248,81,73,0.12)',
                            color: '#f87171',
                            border: '1px solid rgba(248,81,73,0.25)',
                            cursor: 'pointer',
                        }}
                    >
                        Delete
                    </button>
                </div>
            ),
        },
    ];

    return (
        <>
            <Head title="Projects" />
            <Layout title="Projects">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <Link
                        href="/projects/create"
                        style={{
                            background: 'var(--success)',
                            color: '#fff',
                            borderRadius: 8,
                            padding: '9px 14px',
                            textDecoration: 'none',
                            fontSize: 13,
                            fontWeight: 600,
                        }}
                    >
                        + Create Project
                    </Link>
                </div>

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

                <Modal
                    open={Boolean(projectToDelete)}
                    onClose={() => setProjectToDelete(null)}
                    title="Delete Project"
                    maxWidth={520}
                >
                    <div style={{ display: 'grid', gap: 14 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-main)' }}>
                            Delete project <strong>{projectToDelete?.name}</strong>?
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            This will also remove related design/build trackers, expenses, files, and updates.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => setProjectToDelete(null)}
                                style={{
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={deleteProject}
                                style={{
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}
                            >
                                Delete Project
                            </button>
                        </div>
                    </div>
                </Modal>
            </Layout>
        </>
    );
}
