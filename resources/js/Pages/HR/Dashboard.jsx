import Layout from '../../Components/Layout';
import InlinePagination from '../../Components/InlinePagination';
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

function SummaryRow({ label, value, strong = false }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
            <span>{label}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: strong ? 700 : 600 }}>{value}</span>
        </div>
    );
}

export default function HRDashboard({
    payrolls = [],
    totalPayable = 0,
    projects = [],
    kpis = {},
    projectPaymentsPager = null,
    recentPayrollsPager = null,
}) {
    const paymentTotals = kpis.payment_totals || {};
    const companyFinancialSummary = kpis.company_financial_summary || {};
    const payrollStatusCounts = (kpis.payroll_counts_by_status || []).reduce((acc, row) => {
        acc[String(row.label || '').toLowerCase()] = Number(row.count || 0);
        return acc;
    }, {});
    const projectPaymentRows = projectPaymentsPager?.data || projects.slice(0, 10);
    const payrollRows = recentPayrollsPager?.data || payrolls.slice(0, 10);
    const totalContractValue = Number(companyFinancialSummary.total_contract_value ?? paymentTotals.contract_sum ?? 0);
    const materialsTotal = Number(companyFinancialSummary.materials ?? 0);
    const laborPayrollTotal = Number(companyFinancialSummary.labor_payroll ?? 0);
    const subcontractorsTotal = Number(companyFinancialSummary.subcontractors ?? 0);
    const miscellaneousTotal = Number(companyFinancialSummary.miscellaneous ?? 0);
    const equipmentTotal = Number(companyFinancialSummary.equipment ?? 0);
    const totalExpenses = Number(companyFinancialSummary.total_expenses ?? 0);
    const netProfit = Number(companyFinancialSummary.net_profit ?? 0);
    const netMarginPercent = Number(companyFinancialSummary.net_margin_percent ?? 0);

    return (
        <>
            <Head title="HR Dashboard" />
            <Layout title="HR Dashboard">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                    <StatCard label="Payroll Payable" value={money(kpis.payroll_payable ?? totalPayable)} color="#fbbf24" />
                    <StatCard label="Payroll Deductions" value={money(kpis.payroll_deductions_total)} color="#fb7185" />
                    <StatCard label="Payroll Paid" value={money(kpis.payroll_paid_total)} color="#60a5fa" />
                    <StatCard label="Collected Contract Value" value={money(paymentTotals.collected_sum)} color="#22c55e" />
                    <StatCard label="Total Contract Value" value={money(paymentTotals.contract_sum)} color="#4ade80" />
                    <StatCard label="Uncollected Contract Value" value={money(paymentTotals.remaining_sum)} color="#f87171" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={cardStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Net Profit Formula</div>
                        <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                            <div><strong>Total Contract Value</strong></div>
                            <div>- Total Materials</div>
                            <div>- Total Labor (Payroll)</div>
                            <div>- Total Subcontractors</div>
                            <div>- Total Miscellaneous</div>
                            <div>- Total Equipment (if applicable)</div>
                            <div style={{ marginTop: 4, fontWeight: 700 }}>= Net Profit</div>
                        </div>
                        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                            Net profit uses contract value (not collected amount).
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>Company Financial Summary</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Revenue</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            <SummaryRow label="Total Contract Value" value={money(totalContractValue)} strong />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 6px' }}>Expenses</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            <SummaryRow label="Materials" value={money(materialsTotal)} />
                            <SummaryRow label="Labor (Payroll)" value={money(laborPayrollTotal)} />
                            <SummaryRow label="Subcontractors" value={money(subcontractorsTotal)} />
                            <SummaryRow label="Miscellaneous" value={money(miscellaneousTotal)} />
                            <SummaryRow label="Equipment (if applicable)" value={money(equipmentTotal)} />
                            <SummaryRow label="Total Expenses" value={money(totalExpenses)} strong />
                            <SummaryRow label="Net Profit" value={money(netProfit)} strong />
                            <SummaryRow label="Net Margin %" value={`${netMarginPercent.toFixed(2)}%`} strong />
                        </div>
                    </div>
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
                        {projectPaymentRows.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No projects yet.</div>
                        ) : (
                            projectPaymentRows.map((project) => (
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
                    <InlinePagination pager={projectPaymentsPager} />
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
                            {payrollRows.map((row) => (
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

                            {payrollRows.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted-2)' }}>
                                        No payroll records available.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <InlinePagination pager={recentPayrollsPager} />
                </div>
            </Layout>
        </>
    );
}
