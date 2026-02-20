import Layout from '../../Components/Layout';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

const mono = { fontFamily: "'DM Mono', monospace" };

const chartData = [40, 65, 55, 80, 70, 90, 75, 85, 60, 95, 72, 88];

const statusColor = {
    pending:   { bg: 'rgba(210,153,34,0.15)',  color: '#fbbf24', border: 'rgba(210,153,34,0.3)'  },
    approved:  { bg: 'rgba(46,160,67,0.15)',   color: '#4ade80', border: 'rgba(46,160,67,0.3)'   },
    received:  { bg: 'rgba(46,160,67,0.15)',   color: '#4ade80', border: 'rgba(46,160,67,0.3)'   },
    high:      { bg: 'rgba(248,81,73,0.15)',   color: '#f87171', border: 'rgba(248,81,73,0.3)'   },
    medium:    { bg: 'rgba(210,153,34,0.15)',  color: '#fbbf24', border: 'rgba(210,153,34,0.3)'  },
    low:       { bg: 'rgba(46,160,67,0.15)',   color: '#4ade80', border: 'rgba(46,160,67,0.3)'   },
};

const Badge = ({ value }) => {
    const s = statusColor[value] || statusColor.pending;
    return (
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600 }}>
            {value}
        </span>
    );
};

const statCard = (label, value, color = '#4ade80') => (
    <div key={label} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color, ...mono }}>{value}</div>
    </div>
);

export default function HeadAdminDashboard({ stats, recentSubmissions }) {
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

    return (
        <>
            <Head title="Dashboard" />
            <Layout title="Head Admin Dashboard">

                {/* STAT CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                    {statCard('Total Users',      stats.total_users)}
                    {statCard('Foremen',          stats.total_foremen,                        '#60a5fa')}
                    {statCard('Open Issues',      stats.open_issues,                          '#f87171')}
                    {statCard('Payroll Payable',  `₱${Number(stats.payroll_pending).toLocaleString()}`, '#fbbf24')}
                </div>

                {/* CHART + PROJECTS ROW */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 20 }}>

                    {/* CHART */}
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 12 }}>Weekly Overview — Activity</div>
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

                    {/* PROJECT BUDGET SUMMARY */}
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Project Budget Summary</div>
                        {[
                            { name: 'Two Storey House',     pct: 62, spent: '₱1,240,000', budget: '₱2,000,000', barColor: 'linear-gradient(90deg,#f59e0b,#fbbf24)' },
                            { name: 'Warehouse Renovation', pct: 34, spent: '₱212,900',   budget: '₱850,000',   barColor: 'linear-gradient(90deg,#1b8a7a,#4ade80)' },
                            { name: 'Commercial Fit-out',   pct: 18, spent: '₱90,500',    budget: '₱500,000',   barColor: 'linear-gradient(90deg,#3b82f6,#60a5fa)' },
                        ].map(p => (
                            <div key={p.name} style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                                    <span style={{ fontWeight: 600, color: '#e6edf3' }}>{p.name}</span>
                                    <span style={{ color: '#8b949e', ...mono }}>{p.pct}%</span>
                                </div>
                                <div style={{ background: '#1c2128', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 2 }}>
                                    <div style={{ width: `${p.pct}%`, height: '100%', background: p.barColor, borderRadius: 4 }} />
                                </div>
                                <div style={{ fontSize: 11, color: '#6e7681', ...mono }}>{p.spent} / {p.budget}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* BOTTOM PANELS ROW */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                    {/* MATERIAL REQUESTS & ISSUES TABS */}
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {tabBtn('materials', 'Materials')}
                                {tabBtn('issues', 'Issues')}
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
                                    {recentSubmissions.materials.map(m => (
                                        <tr key={m.id} style={{ borderBottom: '1px solid #21262d' }}>
                                            <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{m.foreman?.fullname}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 13, color: '#8b949e' }}>{m.material_name}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 13, ...mono }}>{m.quantity} {m.unit}</td>
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
                                    {recentSubmissions.issues.map(i => (
                                        <tr key={i.id} style={{ borderBottom: '1px solid #21262d' }}>
                                            <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{i.foreman?.fullname}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 13, color: '#8b949e' }}>{i.issue_title}</td>
                                            <td style={{ padding: '10px 16px' }}><Badge value={i.severity} /></td>
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

                    {/* PAYROLL PANEL */}
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>Weekly Payroll</div>
                                <div style={{ fontSize: 11.5, color: '#6e7681', marginTop: 2 }}>Review &amp; approve builder payroll</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button style={{ background: '#21262d', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Export</button>
                            </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Builder', 'Hours', 'Rate', 'Gross', 'Status'].map(h => (
                                        <th key={h} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '8px 16px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { name: 'Santos',    role: 'Mason',     hours: 48, rate: 550,  gross: 26400, status: 'ready'    },
                                    { name: 'L. Santos', role: 'Carpenter', hours: 52, rate: 600,  gross: 31200, status: 'pending'  },
                                    { name: 'Reyes',     role: 'Helper',    hours: 44, rate: 450,  gross: 19800, status: 'ready'    },
                                    { name: 'Dela Cruz', role: 'Foreman',   hours: 50, rate: 750,  gross: 37500, status: 'approved' },
                                ].map(p => (
                                    <tr key={p.name} style={{ borderBottom: '1px solid #21262d' }}>
                                        <td style={{ padding: '10px 16px' }}>
                                            <strong>{p.name}</strong>
                                            <span style={{ color: '#6e7681', fontSize: 12, marginLeft: 6 }}>• {p.role}</span>
                                        </td>
                                        <td style={{ padding: '10px 16px', ...mono }}>{p.hours}</td>
                                        <td style={{ padding: '10px 16px', ...mono }}>₱{p.rate.toLocaleString()}</td>
                                        <td style={{ padding: '10px 16px', ...mono, fontWeight: 600 }}>₱{p.gross.toLocaleString()}</td>
                                        <td style={{ padding: '10px 16px' }}><Badge value={p.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ padding: '12px 16px', borderTop: '1px solid #30363d', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button style={{ background: '#21262d', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Review</button>
                            <button style={{ background: '#2ea043', border: '1px solid #2ea043', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Approve All</button>
                        </div>
                    </div>
                </div>

                {/* MANAGE USERS LINK */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Link href="/users" style={{ background: '#2ea043', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                        Manage Users →
                    </Link>
                </div>

            </Layout>
        </>
    );
}