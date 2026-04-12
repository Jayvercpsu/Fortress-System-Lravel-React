import Layout from '../../Components/Layout';
import InlinePagination from '../../Components/InlinePagination';
import ActionButton from '../../Components/ActionButton';
import { Head, usePage } from '@inertiajs/react';

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

const toStatTestId = (label) =>
    String(label || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

function StatCard({ label, value, color = 'var(--text-main)' }) {
    const statId = toStatTestId(label);

    return (
        <div data-testid={`stat-card-${statId}`} style={cardStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                {label}
            </div>
            <div
                data-testid={`stat-value-${statId}`}
                style={{ fontWeight: 700, fontSize: 24, color, fontFamily: "'DM Mono', monospace" }}
            >
                {value}
            </div>
        </div>
    );
}

function SummaryRow({ label, value, strong = false }) {
    const summaryId = toStatTestId(label);

    return (
        <div data-testid={`summary-row-${summaryId}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
            <span>{label}</span>
            <span
                data-testid={`summary-value-${summaryId}`}
                style={{ fontFamily: "'DM Mono', monospace", fontWeight: strong ? 700 : 600 }}
            >
                {value}
            </span>
        </div>
    );
}

export default function HRDashboard({
    payrolls = [],
    totalPayable = 0,
    kpis = {},
    recentPayrollsPager = null,
}) {
    const { auth } = usePage().props;
    const isHeadAdmin = auth?.user?.role === 'head_admin';
    const paymentTotals = kpis.payment_totals || {};
    const companyFinancialSummary = kpis.company_financial_summary || {};
    const payrollStatusCounts = (kpis.payroll_counts_by_status || []).reduce((acc, row) => {
        acc[String(row.label || '').toLowerCase()] = Number(row.count || 0);
        return acc;
    }, {});
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    <StatCard label="Payroll Payable" value={money(kpis.payroll_payable ?? totalPayable)} color="#fbbf24" />
                    <StatCard label="Payroll Deductions" value={money(kpis.payroll_deductions_total)} color="#fb7185" />
                    <StatCard label="Payroll Paid" value={money(kpis.payroll_paid_total)} color="#60a5fa" />
                </div>

                {isHeadAdmin ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
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
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
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
                            <ActionButton
                                href="/payroll/run"
                                variant="success"
                                style={{ padding: '9px 14px', fontSize: 13 }}
                            >
                                Manage Payroll
                            </ActionButton>
                        </div>
                    </div>
                </div>

            </Layout>
        </>
    );
}
