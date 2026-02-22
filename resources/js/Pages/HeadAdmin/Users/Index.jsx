import Layout from '../../../Components/Layout';
import DataTable from '../../../Components/DataTable';
import { Head, Link, router } from '@inertiajs/react';

const roleColor = { admin: '#60a5fa', hr: '#fbbf24', foreman: '#4ade80' };

export default function UsersIndex({ users = [], userTable = {} }) {
    const table = {
        search: userTable?.search ?? '',
        perPage: Number(userTable?.per_page ?? 10),
        page: Number(userTable?.current_page ?? 1),
        lastPage: Number(userTable?.last_page ?? 1),
        total: Number(userTable?.total ?? users.length ?? 0),
        from: userTable?.from ?? null,
        to: userTable?.to ?? null,
    };

    const navigateTable = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };

        if (!params.search) delete params.search;

        router.get('/users', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const deleteQueryString = () => {
        const params = new URLSearchParams({
            ...(table.search ? { search: table.search } : {}),
            per_page: String(table.perPage),
            page: String(table.page),
        });
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    };

    const deleteUser = (id) => {
        if (!confirm('Delete this user?')) return;

        router.delete(`/users/${id}${deleteQueryString()}`, {
            preserveScroll: true,
        });
    };

    const columns = [
        {
            key: 'fullname',
            label: 'Full Name',
            render: (user) => <div style={{ fontWeight: 600 }}>{user.fullname}</div>,
            searchAccessor: (user) => user.fullname,
        },
        {
            key: 'email',
            label: 'Email',
            render: (user) => <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user.email}</div>,
            searchAccessor: (user) => user.email,
        },
        {
            key: 'role',
            label: 'Role',
            render: (user) => (
                <span
                    style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: `${(roleColor[user.role] || '#94a3b8')}22`,
                        color: roleColor[user.role] || '#94a3b8',
                        border: `1px solid ${(roleColor[user.role] || '#94a3b8')}44`,
                        fontWeight: 700,
                    }}
                >
                    {String(user.role || '').toUpperCase()}
                </span>
            ),
            searchAccessor: (user) => user.role,
        },
        {
            key: 'created_at',
            label: 'Created',
            render: (user) => (
                <div
                    style={{
                        color: 'var(--text-muted-2)',
                        fontSize: 12,
                        fontFamily: "'DM Mono', monospace",
                    }}
                >
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                </div>
            ),
            searchAccessor: (user) => user.created_at,
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (user) => (
                <button
                    type="button"
                    onClick={() => deleteUser(user.id)}
                    style={{
                        background: 'rgba(248,81,73,0.12)',
                        color: '#f87171',
                        border: '1px solid rgba(248,81,73,0.25)',
                        borderRadius: 6,
                        padding: '5px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                    }}
                >
                    Delete
                </button>
            ),
        },
    ];

    return (
        <>
            <Head title="Users" />
            <Layout title="User Management">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                    <Link
                        href="/users/create"
                        style={{
                            background: 'var(--success)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '9px 20px',
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: 'none',
                        }}
                    >
                        + Create User
                    </Link>
                </div>

                <div
                    style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12,
                        padding: 12,
                    }}
                >
                    <DataTable
                        columns={columns}
                        rows={users}
                        rowKey="id"
                        searchPlaceholder="Search users..."
                        emptyMessage="No users yet. Create one to get started."
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
