import Layout from '../../../Components/Layout';
import { Head, Link, router } from '@inertiajs/react';

const roleColor = { admin: '#60a5fa', hr: '#fbbf24', foreman: '#4ade80' };

export default function UsersIndex({ users }) {
    const deleteUser = (id) => {
        if (confirm('Delete this user?')) router.delete(`/users/${id}`);
    };

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
                        overflow: 'hidden',
                    }}
                >
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Full Name', 'Email', 'Role', 'Created', 'Actions'].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            fontSize: 11,
                                            color: 'var(--text-muted-2)',
                                            textAlign: 'left',
                                            padding: '10px 16px',
                                            borderBottom: '1px solid var(--border-color)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                                        {user.fullname}
                                    </td>

                                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                                        {user.email}
                                    </td>

                                    <td style={{ padding: '12px 16px' }}>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                padding: '3px 10px',
                                                borderRadius: 20,
                                                background: `${roleColor[user.role]}22`,
                                                color: roleColor[user.role],
                                                border: `1px solid ${roleColor[user.role]}44`,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {user.role.toUpperCase()}
                                        </span>
                                    </td>

                                    <td
                                        style={{
                                            padding: '12px 16px',
                                            color: 'var(--text-muted-2)',
                                            fontSize: 12,
                                            fontFamily: "'DM Mono', monospace",
                                        }}
                                    >
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>

                                    <td style={{ padding: '12px 16px' }}>
                                        <button
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
                                    </td>
                                </tr>
                            ))}

                            {users.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        style={{
                                            padding: 40,
                                            textAlign: 'center',
                                            color: 'var(--text-muted-2)',
                                        }}
                                    >
                                        No users yet. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Layout>
        </>
    );
}
