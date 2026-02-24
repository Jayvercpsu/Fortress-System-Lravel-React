import Layout from '../../Components/Layout';
import { Head, Link } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const countMap = (items = []) =>
    Object.fromEntries((items || []).map((item) => [item.label, Number(item.count || 0)]));

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

function CountBreakdown({ title, items = [] }) {
    return (
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
            {items.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No data</div>
            ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                    {items.map((row) => (
                        <div
                            key={row.label}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                padding: '8px 10px',
                                background: 'var(--surface-2)',
                            }}
                        >
                            <span style={{ fontSize: 13 }}>{row.label}</span>
                            <span style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{row.count}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function HeadAdminDashboard({
    kpis = {},
    recentSubmissions = { materials: [], issues: [] },
    recentProjects = [],
    recentPayrolls = [],
}) {
    const projectCounts = kpis.project_counts || {};
    const financialTotals = kpis.financial_totals || {};
    const paymentTotals = kpis.payment_totals || {};
    const users = kpis.users || {};
    const operations = kpis.operations || {};
    const payrollCounts = countMap(kpis.payroll_counts_by_status || []);

    return (
        <>
            <Head title="Dashboard" />
            <Layout title="Head Admin Dashboard">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                    <StatCard label="Total Projects" value={projectCounts.total ?? 0} />
                    <StatCard label="Company Progress" value={`${Number(kpis.company_progress_percent || 0).toFixed(1)}%`} color="#60a5fa" />
                    <StatCard label="Contract Sum" value={money(financialTotals.contract_sum)} color="#4ade80" />
                    <StatCard label="Collected Sum" value={money(financialTotals.collected_sum)} color="#22c55e" />
                    <StatCard label="Remaining Sum" value={money(financialTotals.remaining_sum)} color="#fbbf24" />
                    <StatCard label="Payroll Payable" value={money(kpis.payroll_payable)} color="#f87171" />
                    <StatCard label="Payroll Deductions" value={money(kpis.payroll_deductions_total)} color="#fb7185" />
                    <StatCard label="Payroll Paid" value={money(kpis.payroll_paid_total)} color="#38bdf8" />
                    <StatCard label="Users" value={users.total_users ?? 0} />
                    <StatCard label="Foremen" value={users.total_foremen ?? 0} color="#60a5fa" />
                    <StatCard label="Pending Materials" value={operations.pending_materials ?? 0} color="#fbbf24" />
                    <StatCard label="Open Issues" value={operations.open_issues ?? 0} color="#f87171" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <CountBreakdown title="Project Status Breakdown" items={projectCounts.by_status || []} />
                    <CountBreakdown title="Project Phase Breakdown" items={projectCounts.by_phase || []} />
                    <div style={cardStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Payroll Status Breakdown</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {['pending', 'ready', 'approved', 'paid'].map((status) => (
                                <div
                                    key={status}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        padding: '8px 10px',
                                        background: 'var(--surface-2)',
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    <span>{status}</span>
                                    <span style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                                        {payrollCounts[status] || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                            Payment totals mirror project finance snapshots.
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12 }}>
                            Contract: <strong>{money(paymentTotals.contract_sum)}</strong>
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12 }}>
                            Collected: <strong>{money(paymentTotals.collected_sum)}</strong>
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12 }}>
                            Remaining: <strong>{money(paymentTotals.remaining_sum)}</strong>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ ...cardStyle, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Projects</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {(recentProjects || []).length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No projects yet.</div>
                            ) : (
                                recentProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 8,
                                            padding: 10,
                                            background: 'var(--surface-2)',
                                            display: 'grid',
                                            gridTemplateColumns: '1.5fr auto auto auto',
                                            gap: 8,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{project.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {project.client} • {project.phase} • {project.status}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                                            {project.overall_progress}%
                                        </div>
                                        <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                                            {money(project.total_client_payment)}
                                        </div>
                                        <Link
                                            href={`/projects/${project.id}`}
                                            style={{
                                                textDecoration: 'none',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 8,
                                                padding: '6px 10px',
                                                background: 'var(--button-bg)',
                                                color: 'var(--text-main)',
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

                    <div style={{ ...cardStyle, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Payroll</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {recentPayrolls.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No payroll records.</div>
                            ) : (
                                recentPayrolls.map((payroll) => (
                                    <div
                                        key={payroll.id}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 8,
                                            padding: 10,
                                            background: 'var(--surface-2)',
                                            display: 'grid',
                                            gap: 4,
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                            <strong>{payroll.worker_name}</strong>
                                            <span style={{ textTransform: 'capitalize', fontSize: 12 }}>{payroll.status}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{payroll.role}</div>
                                        <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{money(payroll.net)}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ ...cardStyle, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Material Requests</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {(recentSubmissions.materials || []).length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No submissions.</div>
                            ) : (
                                recentSubmissions.materials.map((item) => (
                                    <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, background: 'var(--surface-2)' }}>
                                        <div style={{ fontWeight: 700 }}>{item.material_name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {item.foreman?.fullname || 'Unknown'} • {item.quantity} {item.unit}
                                        </div>
                                        <div style={{ fontSize: 12, marginTop: 3, textTransform: 'capitalize' }}>{item.status}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div style={{ ...cardStyle, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Issues</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {(recentSubmissions.issues || []).length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No issues.</div>
                            ) : (
                                recentSubmissions.issues.map((item) => (
                                    <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, background: 'var(--surface-2)' }}>
                                        <div style={{ fontWeight: 700 }}>{item.issue_title}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {item.foreman?.fullname || 'Unknown'} • {item.severity}
                                        </div>
                                        <div style={{ fontSize: 12, marginTop: 3, textTransform: 'capitalize' }}>{item.status}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </Layout>
        </>
    );
}
