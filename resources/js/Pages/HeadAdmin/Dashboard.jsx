import Layout from '../../Components/Layout';
import { Head, Link } from '@inertiajs/react';

const card = (label, value, color = '#4ade80') => (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
    </div>
);

export default function HeadAdminDashboard({ stats, recentSubmissions }) {
    return (
        <>
            <Head title="Dashboard" />
            <Layout title="Head Admin Dashboard">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                    {card('Total Users', stats.total_users)}
                    {card('Foremen', stats.total_foremen, '#60a5fa')}
                    {card('Open Issues', stats.open_issues, '#f87171')}
                    {card('Payroll Payable', `₱${Number(stats.payroll_pending).toLocaleString()}`, '#fbbf24')}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 600 }}>Recent Material Requests</div>
                            <span style={{ fontSize: 11, background: '#21262d', border: '1px solid #30363d', borderRadius: 20, padding: '2px 10px', color: '#fbbf24' }}>{stats.pending_materials} pending</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Foreman', 'Material', 'Status'].map(h => (
                                        <th key={h} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '8px 16px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentSubmissions.materials.map(m => (
                                    <tr key={m.id}>
                                        <td style={{ padding: '10px 16px', fontSize: 13 }}>{m.foreman?.fullname}</td>
                                        <td style={{ padding: '10px 16px', fontSize: 13, color: '#8b949e' }}>{m.material_name}</td>
                                        <td style={{ padding: '10px 16px' }}>
                                            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: m.status === 'pending' ? 'rgba(251,191,36,0.15)' : 'rgba(46,160,67,0.15)', color: m.status === 'pending' ? '#fbbf24' : '#4ade80', border: `1px solid ${m.status === 'pending' ? 'rgba(251,191,36,0.3)' : 'rgba(46,160,67,0.3)'}` }}>
                                                {m.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid #30363d', fontWeight: 600 }}>Recent Issue Reports</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Foreman', 'Issue', 'Severity'].map(h => (
                                        <th key={h} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '8px 16px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentSubmissions.issues.map(i => (
                                    <tr key={i.id}>
                                        <td style={{ padding: '10px 16px', fontSize: 13 }}>{i.foreman?.fullname}</td>
                                        <td style={{ padding: '10px 16px', fontSize: 13, color: '#8b949e' }}>{i.issue_title}</td>
                                        <td style={{ padding: '10px 16px' }}>
                                            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: i.severity === 'high' ? 'rgba(248,81,73,0.15)' : 'rgba(210,153,34,0.15)', color: i.severity === 'high' ? '#f87171' : '#fbbf24', border: `1px solid ${i.severity === 'high' ? 'rgba(248,81,73,0.3)' : 'rgba(210,153,34,0.3)'}` }}>
                                                {i.severity}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <Link href="/users" style={{ background: '#2ea043', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                        Manage Users →
                    </Link>
                </div>
            </Layout>
        </>
    );
}