import Layout from '../../Components/Layout';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

const mono = { fontFamily: "'DM Mono', monospace" };

const chartData = [55, 72, 48, 88, 63, 91, 70, 84, 57, 95, 66, 80];

const statusColor = {
    pending:    { bg: 'rgba(210,153,34,0.15)',  color: '#fbbf24', border: 'rgba(210,153,34,0.3)'  },
    approved:   { bg: 'rgba(46,160,67,0.15)',   color: '#4ade80', border: 'rgba(46,160,67,0.3)'   },
    received:   { bg: 'rgba(46,160,67,0.15)',   color: '#4ade80', border: 'rgba(46,160,67,0.3)'   },
    rejected:   { bg: 'rgba(248,81,73,0.12)',   color: '#f87171', border: 'rgba(248,81,73,0.25)'  },
    high:       { bg: 'rgba(248,81,73,0.15)',   color: '#f87171', border: 'rgba(248,81,73,0.3)'   },
    medium:     { bg: 'rgba(210,153,34,0.15)',  color: '#fbbf24', border: 'rgba(210,153,34,0.3)'  },
    low:        { bg: 'rgba(46,160,67,0.15)',   color: '#4ade80', border: 'rgba(46,160,67,0.3)'   },
    incomplete: { bg: 'rgba(248,81,73,0.12)',   color: '#f87171', border: 'rgba(248,81,73,0.25)'  },
};

const Badge = ({ value }) => {
    const s = statusColor[value] || statusColor.pending;
    return (
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600 }}>
            {value}
        </span>
    );
};

export default function AdminDashboard({ stats }) {
    const [activeTab, setActiveTab] = useState('materials');

    const tabBtn = (key, label) => (
        <button
            onClick={() => setActiveTab(key)}
            style={{
                background: activeTab === key ? '#21262d' : 'transparent',
                border: activeTab === key ? '1px solid #30363d' : '1px solid transparent',
                color: activeTab === key ? '#e6edf3' : '#8b949e',
                borderRadius: 6, padding: '5px 14px', fontSize: 12,
                fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.15s',
            }}
        >
            {label}
        </button>
    );

    const recentMaterials = [
        { foreman: 'Dela Cruz', material: 'CHB 4 inch', qty: '500 pcs', status: 'pending'  },
        { foreman: 'Santos',    material: 'Cement Bags', qty: '50 bags', status: 'approved' },
        { foreman: 'Reyes',     material: 'Steel Bar 10mm', qty: '30 pcs', status: 'pending' },
        { foreman: 'Torres',    material: 'Sand (cu.m)', qty: '5 cu.m', status: 'approved' },
    ];

    const recentIssues = [
        { foreman: 'Dela Cruz', title: 'Concrete mix too dry', severity: 'high'   },
        { foreman: 'Santos',    title: 'Missing safety gear',  severity: 'medium' },
        { foreman: 'Reyes',     title: 'Delayed delivery',     severity: 'low'    },
        { foreman: 'Torres',    title: 'Crack on wall footing', severity: 'high'  },
    ];

    const recentDeliveries = [
        { item: 'Cement Bags',     qty: '50 bags', date: '2026-02-14', status: 'received'   },
        { item: 'Steel Bar 10mm',  qty: '30 pcs',  date: '2026-02-15', status: 'incomplete' },
        { item: 'CHB 4 inch',      qty: '500 pcs', date: '2026-02-16', status: 'received'   },
        { item: 'Gravel (cu.m)',   qty: '8 cu.m',  date: '2026-02-17', status: 'rejected'   },
    ];

    const recentAttendance = [
        { worker: 'Bautista', role: 'Skilled', date: '2026-02-19', hours: 9  },
        { worker: 'Lim',      role: 'Labor',   date: '2026-02-19', hours: 8  },
        { worker: 'Aquino',   role: 'Skilled', date: '2026-02-19', hours: 10 },
        { worker: 'Flores',   role: 'Labor',   date: '2026-02-19', hours: 7  },
    ];

    return (
        <>
            <Head title="Dashboard" />
            <Layout title="Admin Dashboard">

                {/* STAT CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                    {[
                        { label: 'Pending Materials',    value: stats.pending_materials,  color: '#fbbf24' },
                        { label: 'Open Issues',          value: stats.open_issues,        color: '#f87171' },
                        { label: "Today's Submissions",  value: stats.submissions_today,  color: '#4ade80' },
                    ].map(s => (
                        <div key={s.label} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '20px 24px' }}>
                            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, ...mono }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* CHART + SCOPE PROGRESS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 20 }}>

                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 12 }}>Weekly Submission Activity</div>
                        <div style={{ height: 90, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                            {chartData.map((h, i) => (
                                <div key={i} style={{
                                    flex: 1, height: `${h}%`,
                                    background: '#1b8a7a', borderRadius: '4px 4px 0 0',
                                    opacity: 0.8, transition: 'opacity 0.2s', cursor: 'pointer',
                                }}
                                    onMouseEnter={e => e.target.style.opacity = 1}
                                    onMouseLeave={e => e.target.style.opacity = 0.8}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Scope of Work Progress</div>
                        {[
                            { label: 'Foundation Preparation', pct: 100, color: '#4ade80' },
                            { label: 'Column Footing',         pct: 85,  color: '#4ade80' },
                            { label: 'Slab on Fill',           pct: 60,  color: '#fbbf24' },
                            { label: 'CHB Laying',             pct: 40,  color: '#fbbf24' },
                            { label: 'Roofing & Tinsmithry',   pct: 10,  color: '#f87171' },
                        ].map(s => (
                            <div key={s.label} style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                                    <span style={{ color: '#8b949e' }}>{s.label}</span>
                                    <span style={{ color: s.color, ...mono, fontWeight: 600 }}>{s.pct}%</span>
                                </div>
                                <div style={{ background: '#1c2128', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                                    <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 4, opacity: 0.8 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* TABS PANEL + DELIVERIES */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                    {/* MATERIALS / ISSUES / ATTENDANCE TABS */}
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {tabBtn('materials',  'Materials')}
                                {tabBtn('issues',     'Issues')}
                                {tabBtn('attendance', 'Attendance')}
                            </div>
                            {activeTab === 'materials' && (
                                <span style={{ fontSize: 11, background: '#21262d', border: '1px solid #30363d', borderRadius: 20, padding: '2px 10px', color: '#fbbf24' }}>
                                    {stats.pending_materials} pending
                                </span>
                            )}
                        </div>

                        {activeTab === 'materials' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Foreman', 'Material', 'Qty', 'Status'].map(h => (
                                            <th key={h} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '8px 16px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentMaterials.map((m, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                                            <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{m.foreman}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 13, color: '#8b949e' }}>{m.material}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 13, ...mono }}>{m.qty}</td>
                                            <td style={{ padding: '10px 16px' }}><Badge value={m.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'issues' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Foreman', 'Issue', 'Severity'].map(h => (
                                            <th key={h} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '8px 16px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentIssues.map((r, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                                            <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{r.foreman}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 13, color: '#8b949e' }}>{r.title}</td>
                                            <td style={{ padding: '10px 16px' }}><Badge value={r.severity} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'attendance' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Worker', 'Role', 'Date', 'Hours'].map(h => (
                                            <th key={h} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '8px 16px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentAttendance.map((a, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                                            <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{a.worker}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 13, color: '#8b949e' }}>{a.role}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#6e7681', ...mono }}>{a.date}</td>
                                            <td style={{ padding: '10px 16px', ...mono, fontWeight: 600, color: '#4ade80' }}>{a.hours}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        <div style={{ padding: '12px 16px', borderTop: '1px solid #30363d', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button style={{ background: '#21262d', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Export</button>
                            <button style={{ background: '#2ea043', border: '1px solid #2ea043', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Approve All</button>
                        </div>
                    </div>

                    {/* DELIVERIES */}
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>Recent Deliveries</div>
                                <div style={{ fontSize: 11.5, color: '#6e7681', marginTop: 2 }}>Confirmed by foremen on-site</div>
                            </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Item', 'Qty', 'Date', 'Status'].map(h => (
                                        <th key={h} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '8px 16px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentDeliveries.map((d, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                                        <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{d.item}</td>
                                        <td style={{ padding: '10px 16px', fontSize: 13, ...mono, color: '#8b949e' }}>{d.qty}</td>
                                        <td style={{ padding: '10px 16px', fontSize: 12, ...mono, color: '#6e7681' }}>{d.date}</td>
                                        <td style={{ padding: '10px 16px' }}><Badge value={d.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ padding: '12px 16px', borderTop: '1px solid #30363d', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button style={{ background: '#21262d', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Export</button>
                        </div>
                    </div>
                </div>

            </Layout>
        </>
    );
}