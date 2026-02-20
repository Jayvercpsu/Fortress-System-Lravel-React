import Layout from '../../Components/Layout';
import { Head, Link } from '@inertiajs/react';

const statusColor = { pending: '#8b949e', ready: '#fbbf24', approved: '#4ade80', paid: '#60a5fa' };

export default function HRDashboard({ payrolls, totalPayable }) {
    return (
        <>
            <Head title="HR Dashboard" />
            <Layout title="HR Dashboard">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '20px 24px' }}>
                        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase' }}>Total Payroll Payable</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24', fontFamily: "'DM Mono', monospace" }}>₱{Number(totalPayable).toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '20px 24px' }}>
                        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase' }}>Total Entries</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80', fontFamily: "'DM Mono', monospace" }}>{payrolls.length}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <Link href="/payroll" style={{ background: '#2ea043', color: '#fff', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                        Manage Payroll →
                    </Link>
                </div>

                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Worker', 'Role', 'Hours', 'Rate', 'Gross', 'Net', 'Status'].map(h => (
                                    <th key={h} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payrolls.slice(0, 10).map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #21262d' }}>
                                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{p.worker_name}</td>
                                    <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 12 }}>{p.role}</td>
                                    <td style={{ padding: '10px 16px', fontFamily: "'DM Mono', monospace" }}>{p.hours}</td>
                                    <td style={{ padding: '10px 16px', fontFamily: "'DM Mono', monospace" }}>₱{Number(p.rate_per_hour).toLocaleString()}</td>
                                    <td style={{ padding: '10px 16px', fontFamily: "'DM Mono', monospace" }}>₱{Number(p.gross).toLocaleString()}</td>
                                    <td style={{ padding: '10px 16px', fontFamily: "'DM Mono', monospace", fontWeight: 600, color: '#4ade80' }}>₱{Number(p.net).toLocaleString()}</td>
                                    <td style={{ padding: '10px 16px' }}>
                                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, color: statusColor[p.status], background: `${statusColor[p.status]}22`, border: `1px solid ${statusColor[p.status]}44` }}>
                                            {p.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Layout>
        </>
    );
}