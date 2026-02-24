import Layout from '../../Components/Layout';
import InlinePagination from '../../Components/InlinePagination';
import { Head, Link } from '@inertiajs/react';

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

function BreakdownPanel({ title, items = [] }) {
    return (
        <div style={cardStyle}>
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
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                background: 'var(--surface-2)',
                                padding: '8px 10px',
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

export default function AdminDashboard({ kpis = {}, projectSnapshotPager = null }) {
    const projectCounts = kpis.project_counts || {};
    const financialTotals = kpis.financial_totals || {};
    const projects = kpis.projects || [];
    const projectSnapshotRows = projectSnapshotPager?.data || projects.slice(0, 10);

    return (
        <>
            <Head title="Dashboard" />
            <Layout title="Admin Dashboard">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                    <StatCard label="Total Projects" value={projectCounts.total ?? 0} />
                    <StatCard label="Company Progress" value={`${Number(kpis.company_progress_percent || 0).toFixed(1)}%`} color="#60a5fa" />
                    <StatCard label="Contract Sum" value={money(financialTotals.contract_sum)} color="#4ade80" />
                    <StatCard label="Collected Sum" value={money(financialTotals.collected_sum)} color="#22c55e" />
                    <StatCard label="Remaining Sum" value={money(financialTotals.remaining_sum)} color="#fbbf24" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <BreakdownPanel title="Projects by Status" items={projectCounts.by_status || []} />
                    <BreakdownPanel title="Projects by Phase" items={projectCounts.by_phase || []} />
                </div>

                <div style={{ ...cardStyle, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>Project Progress Snapshot</div>
                    {projectSnapshotRows.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No projects yet.</div>
                    ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {projectSnapshotRows.map((project) => (
                                <div
                                    key={project.id}
                                    style={{
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        background: 'var(--surface-2)',
                                        padding: 10,
                                        display: 'grid',
                                        gridTemplateColumns: '1.5fr auto auto auto auto',
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
                                        {money(project.contract_amount)}
                                    </div>
                                    <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                                        {money(project.total_client_payment)}
                                    </div>
                                    <Link
                                        href={`/projects/${project.id}`}
                                        style={{
                                            textDecoration: 'none',
                                            borderRadius: 8,
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--button-bg)',
                                            color: 'var(--text-main)',
                                            padding: '6px 10px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            textAlign: 'center',
                                        }}
                                    >
                                        Open
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                    <InlinePagination pager={projectSnapshotPager} />
                </div>
            </Layout>
        </>
    );
}
