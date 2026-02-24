import Layout from '../../Components/Layout';
import { Head, Link } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const statusColor = {
    pending: '#8b949e',
    ready: '#fbbf24',
    approved: '#4ade80',
    paid: '#60a5fa',
};

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatCard({ label, value, color = 'var(--text-main)' }) {
    return (
        <div style={cardStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                {label}
            </div>
            <div style={{ fontWeight: 700, fontSize: 24, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
        </div>
    );
}

export default function HRDashboard({ payrolls = [], totalPayable = 0, projects = [], kpis = {} }) {
    const paymentTotals = kpis.payment_totals || {};
    const payrollStatusCounts = (kpis.payroll_counts_by_status || []).reduce((acc, row) => {
        acc[String(row.label || '').toLowerCase()] = Number(row.count || 0);
        return acc;
    }, {});

    return (
        <>
            <Head title="HR Dashboard" />
            <Layout title="HR Dashboard">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                    <StatCard label="Payroll Payable" value={money(kpis.payroll_payable ?? totalPayable)} color="#fbbf24" />
                    <StatCard label="Payroll Deductions" value={money(kpis.payroll_deductions_total)} color="#fb7185" />
                    <StatCard label="Payroll Paid" value={money(kpis.payroll_paid_total)} color="#60a5fa" />
                    <StatCard label="Payments Collected" value={money(paymentTotals.collected_sum)} color="#22c55e" />
                    <StatCard label="Contract Total" value={money(paymentTotals.contract_sum)} color="#4ade80" />
                    <StatCard label="Remaining Receivables" value={money(paymentTotals.remaining_sum)} color="#f87171" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={cardStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Payroll Status Counts</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {['pending', 'ready', 'approved', 'paid'].map((status) => (
                                <div
                                    key={status}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        background: 'var(--surface-2)',
                                        padding: '8px 10px',
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    <span>{status}</span>
                                    <span style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                                        {payrollStatusCounts[status] || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>Actions</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                Manage payroll generation, approvals, releases, and project payment tracking.
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Link
                                href="/payroll/run"
                                style={{
                                    background: 'var(--success)',
                                    color: '#fff',
                                    borderRadius: 8,
                                    padding: '9px 14px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                }}
                            >
                                Manage Payroll
                            </Link>
                            <Link
                                href="/payroll"
                                style={{
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '9px 14px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                }}
                            >
                                Payroll Entries
                            </Link>
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        ...cardStyle,
                        overflow: 'hidden',
                        marginBottom: 16,
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>Project Payments</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                        {projects.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No projects yet.</div>
                        ) : (
                            projects.slice(0, 10).map((project) => (
                                <div
                                    key={project.id}
                                    style={{
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        padding: '10px 12px',
                                        display: 'grid',
                                        gridTemplateColumns: '1.6fr 1fr 1fr auto',
                                        alignItems: 'center',
                                        gap: 8,
                                        background: 'var(--surface-2)',
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{project.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{project.client}</div>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        <div style={{ color: 'var(--text-muted)' }}>Paid</div>
                                        <div style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                                            {money(project.total_client_payment)}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        <div style={{ color: 'var(--text-muted)' }}>Remaining</div>
                                        <div
                                            style={{
                                                fontWeight: 700,
                                                color: Number(project.remaining_balance || 0) < 0 ? '#f87171' : '#4ade80',
                                                fontFamily: "'DM Mono', monospace",
                                            }}
                                        >
                                            {money(project.remaining_balance)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifySelf: 'end' }}>
                                        <Link
                                            href={`/projects/${project.id}/payments`}
                                            style={{
                                                background: 'var(--button-bg)',
                                                color: 'var(--text-main)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 8,
                                                padding: '7px 10px',
                                                textDecoration: 'none',
                                                fontSize: 12,
                                                fontWeight: 700,
                                            }}
                                        >
                                            Payments
                                        </Link>
                                        <Link
                                            href={`/projects/${project.id}/financials`}
                                            style={{
                                                background: 'var(--button-bg)',
                                                color: 'var(--text-main)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 8,
                                                padding: '7px 10px',
                                                textDecoration: 'none',
                                                fontSize: 12,
                                                fontWeight: 700,
                                            }}
                                        >
                                            Financials
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div style={{ ...cardStyle, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Payroll Entries</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Worker', 'Role', 'Hours', 'Rate', 'Gross', 'Net', 'Status'].map((header) => (
                                    <th
                                        key={header}
                                        style={{
                                            fontSize: 11,
                                            color: 'var(--text-muted-2)',
                                            textAlign: 'left',
                                            padding: '10px 12px',
                                            borderBottom: '1px solid var(--border-color)',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payrolls.slice(0, 10).map((row) => (
                                <tr key={row.id} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{row.worker_name}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{row.role}</td>
                                    <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>{row.hours}</td>
                                    <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>{money(row.rate_per_hour)}</td>
                                    <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>{money(row.gross)}</td>
                                    <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{money(row.net)}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                padding: '3px 10px',
                                                borderRadius: 999,
                                                color: statusColor[row.status] || '#8b949e',
                                                background: `${statusColor[row.status] || '#8b949e'}22`,
                                                border: `1px solid ${(statusColor[row.status] || '#8b949e')}44`,
                                                textTransform: 'capitalize',
                                                fontWeight: 700,
                                            }}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}

                            {payrolls.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted-2)' }}>
                                        No payroll records available.
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
