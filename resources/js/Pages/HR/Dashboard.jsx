import Layout from '../../Components/Layout';
import { Head, Link } from '@inertiajs/react';

const statusColor = {
    pending: '#8b949e',
    ready: '#fbbf24',
    approved: '#4ade80',
    paid: '#60a5fa',
};

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function HRDashboard({ payrolls = [], totalPayable = 0, projects = [] }) {
    return (
        <>
            <Head title="HR Dashboard" />
            <Layout title="HR Dashboard">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div
                        style={{
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 12,
                            padding: '20px 24px',
                        }}
                    >
                        <div
                            style={{
                                fontSize: 12,
                                color: 'var(--text-muted)',
                                marginBottom: 8,
                                textTransform: 'uppercase',
                            }}
                        >
                            Total Payroll Payable
                        </div>
                        <div
                            style={{
                                fontSize: 28,
                                fontWeight: 700,
                                color: '#fbbf24',
                                fontFamily: "'DM Mono', monospace",
                            }}
                        >
                            {money(totalPayable)}
                        </div>
                    </div>

                    <div
                        style={{
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 12,
                            padding: '20px 24px',
                        }}
                    >
                        <div
                            style={{
                                fontSize: 12,
                                color: 'var(--text-muted)',
                                marginBottom: 8,
                                textTransform: 'uppercase',
                            }}
                        >
                            Total Entries
                        </div>
                        <div
                            style={{
                                fontSize: 28,
                                fontWeight: 700,
                                color: '#4ade80',
                                fontFamily: "'DM Mono', monospace",
                            }}
                        >
                            {payrolls.length}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <Link
                        href="/payroll/run"
                        style={{
                            background: 'var(--success)',
                            color: '#fff',
                            borderRadius: 8,
                            padding: '9px 20px',
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: 'none',
                        }}
                    >
                        Manage Payroll
                    </Link>
                </div>

                <div
                    style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        marginBottom: 16,
                    }}
                >
                    <div
                        style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--border-color)',
                            fontWeight: 700,
                        }}
                    >
                        Project Payments
                    </div>
                    <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                        {projects.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted-2)' }}>No projects yet.</div>
                        ) : (
                            projects.slice(0, 8).map((project) => (
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
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{project.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{project.client}</div>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        <div style={{ color: 'var(--text-muted)' }}>Paid</div>
                                        <div style={{ fontWeight: 700 }}>{money(project.total_client_payment)}</div>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                        <div style={{ color: 'var(--text-muted)' }}>Remaining</div>
                                        <div style={{ fontWeight: 700, color: project.remaining_balance < 0 ? '#f87171' : '#4ade80' }}>
                                            {money(project.remaining_balance)}
                                        </div>
                                    </div>
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
                                            fontWeight: 600,
                                        }}
                                    >
                                        Open
                                    </Link>
                                </div>
                            ))
                        )}
                    </div>
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
                                {['Worker', 'Role', 'Hours', 'Rate', 'Gross', 'Net', 'Status'].map((header) => (
                                    <th
                                        key={header}
                                        style={{
                                            fontSize: 11,
                                            color: 'var(--text-muted-2)',
                                            textAlign: 'left',
                                            padding: '10px 16px',
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
                                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{row.worker_name}</td>
                                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{row.role}</td>
                                    <td style={{ padding: '10px 16px', fontFamily: "'DM Mono', monospace" }}>{row.hours}</td>
                                    <td style={{ padding: '10px 16px', fontFamily: "'DM Mono', monospace" }}>{money(row.rate_per_hour)}</td>
                                    <td style={{ padding: '10px 16px', fontFamily: "'DM Mono', monospace" }}>{money(row.gross)}</td>
                                    <td
                                        style={{
                                            padding: '10px 16px',
                                            fontFamily: "'DM Mono', monospace",
                                            fontWeight: 600,
                                            color: '#4ade80',
                                        }}
                                    >
                                        {money(row.net)}
                                    </td>
                                    <td style={{ padding: '10px 16px' }}>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                padding: '3px 10px',
                                                borderRadius: 20,
                                                color: statusColor[row.status],
                                                background: `${statusColor[row.status]}22`,
                                                border: `1px solid ${statusColor[row.status]}44`,
                                                textTransform: 'capitalize',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}

                            {payrolls.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        style={{
                                            padding: 40,
                                            textAlign: 'center',
                                            color: 'var(--text-muted-2)',
                                        }}
                                    >
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
