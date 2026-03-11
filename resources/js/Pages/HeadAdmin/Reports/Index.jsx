import Layout from '../../../Components/Layout';
import ActionButton from '../../../Components/ActionButton';
import { Head } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const receiptLinkStyle = {
    color: 'var(--success)',
    fontWeight: 600,
    textDecoration: 'none',
};

const numericCellStyle = {
    padding: '10px 12px',
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
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
                style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}
            >
                {value}
            </div>
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
                    <StatCard label="Collected Contract Value" value={money(summary.collected_sum)} color="#22c55e" />
                    <StatCard label="Allocated Payroll" value={money(summary.allocated_payroll_sum)} color="#fbbf24" />
                    <StatCard label="Total Expenses" value={money(summary.expense_sum)} color="#fb7185" />
                    <StatCard label="Total Cost" value={money(summary.total_cost_sum)} color="#f87171" />
                    <StatCard label="Net Profit (Collected Basis)" value={money(summary.profit_collected_basis_sum)} color="#4ade80" />
                    <StatCard label="Net Profit (Contract Basis)" value={money(summary.profit_contract_basis_sum)} color="#60a5fa" />
                    <StatCard label="Unallocated Payroll" value={money(summary.unallocated_payroll_total)} color="#f59e0b" />
                </div>

                <div style={cardStyle}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>Project Profitability</div>
                    <div style={{ overflowX: 'auto', width: '100%' }}>
                        <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {[
                                    'Project',
                                    'Progress',
                                    'Weighted Progress',
                                    'Computed Amount',
                                    'Collected',
                                    'Expenses',
                                    'Payroll',
                                    'Total Cost',
                                    'Net Profit (Collected)',
                                    'Net Profit (Contract)',
                                    'Receipt',
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
                                    <td colSpan={11} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
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
                                        <td style={numericCellStyle}>
                                            {row.overall_progress}%
                                        </td>
                                        <td style={numericCellStyle}>
                                            {row.weighted_progress_percent != null ? `${row.weighted_progress_percent.toFixed(2)}%` : '-'}
                                        </td>
                                        <td style={numericCellStyle}>
                                            {money(row.computed_amount_to_date)}
                                        </td>
                                        <td style={numericCellStyle}>
                                            {money(row.collected_amount)}
                                        </td>
                                        <td style={numericCellStyle}>
                                            {money(row.expense_total)}
                                        </td>
                                        <td style={numericCellStyle}>
                                            {money(row.allocated_payroll_total)}
                                        </td>
                                        <td style={{ ...numericCellStyle, fontWeight: 700 }}>
                                            {money(row.total_cost)}
                                        </td>
                                        <td
                                            style={{
                                                ...numericCellStyle,
                                                fontWeight: 700,
                                                color: Number(row.profit_collected_basis || 0) >= 0 ? '#4ade80' : '#f87171',
                                            }}
                                        >
                                            {money(row.profit_collected_basis)}
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {row.profit_margin_collected_percent == null ? '-' : `${row.profit_margin_collected_percent}%`}
                                            </div>
                                        </td>
                                        <td
                                            style={{
                                                ...numericCellStyle,
                                                fontWeight: 700,
                                                color: Number(row.profit_contract_basis || 0) >= 0 ? '#60a5fa' : '#f87171',
                                            }}
                                        >
                                            {money(row.profit_contract_basis)}
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {row.profit_margin_contract_percent == null ? '-' : `${row.profit_margin_contract_percent}%`}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <ActionButton
                                                href={`/projects/${row.id}/client-receipt`}
                                                external
                                                variant="success"
                                                style={{ padding: '6px 10px', fontSize: 11 }}
                                                data-inertia="false"
                                            >
                                                View Receipt
                                            </ActionButton>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        </table>
                    </div>
                </div>
            </Layout>
        </>
    );
}
