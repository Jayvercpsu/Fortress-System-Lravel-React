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
                    <Link href="/users/create" style={{ background: '#2ea043', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                        + Create User
                    </Link>
                </div>

                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Full Name', 'Email', 'Role', 'Created', 'Actions'].map(h => (
                                    <th key={h} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #30363d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid #21262d' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{user.fullname}</td>
                                    <td style={{ padding: '12px 16px', color: '#8b949e', fontSize: 13 }}>{user.email}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${roleColor[user.role]}22`, color: roleColor[user.role], border: `1px solid ${roleColor[user.role]}44` }}>
                                            {user.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#6e7681', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <button onClick={() => deleteUser(user.id)} style={{ background: 'rgba(248,81,73,0.12)', color: '#f87171', border: '1px solid rgba(248,81,73,0.25)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#6e7681' }}>No users yet. Create one to get started.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Layout>
        </>
    );
}