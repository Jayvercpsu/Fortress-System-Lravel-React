import Layout from '../../../Components/Layout';
import { Head } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatCard({ label, value, color = 'var(--text-main)' }) {
    return (
        <div style={cardStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                {label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
        </div>
    );
}

export default function ReportsIndex({ summary = {}, projectProfitability = [] }) {
    return (
        <>
            <Head title="Reports" />
            <Layout title="Reports / Project Profitability">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                    <StatCard label="Projects" value={summary.project_count ?? 0} />
                    <StatCard label="Collected Sum" value={money(summary.collected_sum)} color="#22c55e" />
                    <StatCard label="Allocated Payroll" value={money(summary.allocated_payroll_sum)} color="#fbbf24" />
                    <StatCard label="Expense Sum" value={money(summary.expense_sum)} color="#fb7185" />
                    <StatCard label="Total Cost" value={money(summary.total_cost_sum)} color="#f87171" />
                    <StatCard label="Profit (Collected Basis)" value={money(summary.profit_collected_basis_sum)} color="#4ade80" />
                    <StatCard label="Profit (Contract Basis)" value={money(summary.profit_contract_basis_sum)} color="#60a5fa" />
                    <StatCard label="Unallocated Payroll" value={money(summary.unallocated_payroll_total)} color="#f59e0b" />
                </div>

                <div style={{ ...cardStyle, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>Project Profitability</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {[
                                    'Project',
                                    'Progress',
                                    'Collected',
                                    'Expenses',
                                    'Payroll',
                                    'Total Cost',
                                    'Profit (Collected)',
                                    'Profit (Contract)',
                                ].map((header) => (
                                    <th
                                        key={header}
                                        style={{
                                            padding: '10px 12px',
                                            textAlign: 'left',
                                            fontSize: 11,
                                            color: 'var(--text-muted-2)',
                                            textTransform: 'uppercase',
                                            borderBottom: '1px solid var(--border-color)',
                                        }}
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {projectProfitability.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No project profitability data yet.
                                    </td>
                                </tr>
                            ) : (
                                projectProfitability.map((row) => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ fontWeight: 700 }}>{row.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {row.client} • {row.phase} • {row.status}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>
                                            {row.overall_progress}%
                                        </td>
                                        <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>
                                            {money(row.collected_amount)}
                                        </td>
                                        <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>
                                            {money(row.expense_total)}
                                        </td>
                                        <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>
                                            {money(row.allocated_payroll_total)}
                                        </td>
                                        <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                                            {money(row.total_cost)}
                                        </td>
                                        <td
                                            style={{
                                                padding: '10px 12px',
                                                fontWeight: 700,
                                                color: Number(row.profit_collected_basis || 0) >= 0 ? '#4ade80' : '#f87171',
                                                fontFamily: "'DM Mono', monospace",
                                            }}
                                        >
                                            {money(row.profit_collected_basis)}
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {row.profit_margin_collected_percent == null ? '-' : `${row.profit_margin_collected_percent}%`}
                                            </div>
                                        </td>
                                        <td
                                            style={{
                                                padding: '10px 12px',
                                                fontWeight: 700,
                                                color: Number(row.profit_contract_basis || 0) >= 0 ? '#60a5fa' : '#f87171',
                                                fontFamily: "'DM Mono', monospace",
                                            }}
                                        >
                                            {money(row.profit_contract_basis)}
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {row.profit_margin_contract_percent == null ? '-' : `${row.profit_margin_contract_percent}%`}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Layout>
        </>
    );
}
