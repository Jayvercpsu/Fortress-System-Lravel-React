import Layout from '../../Components/Layout';
import { Head } from '@inertiajs/react';

export default function AdminDashboard({ stats }) {
    return (
        <>
            <Head title="Dashboard" />
            <Layout title="Admin Dashboard">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                    {[
                        { label: 'Pending Materials', value: stats.pending_materials, color: '#fbbf24' },
                        { label: 'Open Issues', value: stats.open_issues, color: '#f87171' },
                        { label: "Today's Submissions", value: stats.submissions_today, color: '#4ade80' },
                    ].map(s => (
                        <div key={s.label} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '20px 24px' }}>
                            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
                        </div>
                    ))}
                </div>
                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, color: '#8b949e', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                    <div style={{ fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Admin Control Panel</div>
                    <div style={{ fontSize: 13 }}>Monitor all foreman submissions, approve material requests, and track project progress.</div>
                </div>
            </Layout>
        </>
    );
}