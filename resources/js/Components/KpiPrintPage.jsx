import { Head } from '@inertiajs/react';
import ActionButton from './ActionButton';

const pageStyle = {
    fontFamily: "'DM Sans', sans-serif",
    background: '#ffffff',
    color: '#0f172a',
    minHeight: '100vh',
    padding: 24,
};

const cardStyle = {
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: 14,
    background: '#ffffff',
};

const formatNumber = (value, digits = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '-';
    }
    return numeric.toFixed(digits);
};

const formatInt = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '-';
    }
    return numeric.toFixed(0);
};

const formatPercent = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '-';
    }
    return `${numeric.toFixed(1)}%`;
};

export default function KpiPrintPage({
    filters = {},
    projects = [],
    summary = {},
    workerKpis = [],
    foremanKpis = [],
    topWorkers = [],
    topForemen = [],
    scoreWeights = {},
    promotionThresholds = {},
}) {
    const projectLabel = (() => {
        if (!filters?.project_id) return 'All projects';
        const match = projects.find((project) => String(project.id) === String(filters.project_id));
        return match?.name || `Project ${filters.project_id}`;
    })();

    const dateLabel = (() => {
        const from = filters?.date_from || '';
        const to = filters?.date_to || '';
        if (!from && !to) return 'All dates';
        if (from && to) return `${from} to ${to}`;
        return from ? `From ${from}` : `Until ${to}`;
    })();

    const promotionReady = Number(promotionThresholds?.promotion_ready ?? 85);
    const promotionTrack = Number(promotionThresholds?.promotion_track ?? 70);

    const promotionLabel = (score) => {
        const numeric = Number(score);
        if (numeric >= promotionReady) return 'Promotion Ready';
        if (numeric >= promotionTrack) return 'On Track';
        return 'Needs Review';
    };

    const appliedParams = {
        date_from: filters?.date_from || undefined,
        date_to: filters?.date_to || undefined,
        project_id: filters?.project_id || undefined,
        delivery_date_basis: filters?.delivery_date_basis || undefined,
        worker_hours: Math.round(Number(scoreWeights?.worker?.hours ?? 0.7) * 100),
        worker_days: Math.round(Number(scoreWeights?.worker?.days ?? 0.3) * 100),
        foreman_attendance: Math.round(Number(scoreWeights?.foreman?.attendance ?? 0.4) * 100),
        foreman_progress: Math.round(Number(scoreWeights?.foreman?.progress ?? 0.4) * 100),
        foreman_activity: Math.round(Number(scoreWeights?.foreman?.activity ?? 0.2) * 100),
        foreman_attendance_hours: Math.round(Number(scoreWeights?.foreman?.attendance_hours ?? 0.7) * 100),
        foreman_attendance_days: Math.round(Number(scoreWeights?.foreman?.attendance_days ?? 0.3) * 100),
        foreman_progress_avg: Math.round(Number(scoreWeights?.foreman?.progress_avg ?? 0.7) * 100),
        foreman_progress_scopes: Math.round(Number(scoreWeights?.foreman?.progress_scopes ?? 0.3) * 100),
        foreman_activity_issues: Math.round(Number(scoreWeights?.foreman?.activity_issues ?? 0.25) * 100),
        foreman_activity_materials: Math.round(Number(scoreWeights?.foreman?.activity_materials ?? 0.25) * 100),
        foreman_activity_deliveries: Math.round(Number(scoreWeights?.foreman?.activity_deliveries ?? 0.25) * 100),
        foreman_activity_photos: Math.round(Number(scoreWeights?.foreman?.activity_photos ?? 0.25) * 100),
        promotion_ready: promotionReady,
        promotion_track: promotionTrack,
    };

    Object.keys(appliedParams).forEach((key) => {
        if (appliedParams[key] === '' || appliedParams[key] === null || appliedParams[key] === undefined) {
            delete appliedParams[key];
        }
    });

    const appliedQuery = new URLSearchParams(appliedParams).toString();
    const backHref = appliedQuery ? `/kpi?${appliedQuery}` : '/kpi';

    const workerRows = Array.isArray(workerKpis) ? workerKpis : [];
    const foremanRows = Array.isArray(foremanKpis) ? foremanKpis : [];
    const topWorkerRows = Array.isArray(topWorkers) && topWorkers.length ? topWorkers : workerRows.slice(0, 5);
    const topForemanRows = Array.isArray(topForemen) && topForemen.length ? topForemen : foremanRows.slice(0, 5);

    return (
        <>
            <Head title="KPI Print" />
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: #ffffff; }
                }
            `}</style>
            <div style={pageStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>KPI Performance Review</div>
                        <div style={{ fontSize: 12, color: '#475569' }}>
                            {dateLabel} | {projectLabel}
                        </div>
                    </div>
                    <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <ActionButton
                            type="button"
                            onClick={() => window.print()}
                            style={{ padding: '8px 12px', fontSize: 13 }}
                        >
                            Print
                        </ActionButton>
                        <ActionButton
                            href={backHref}
                            style={{ padding: '8px 12px', fontSize: 13 }}
                        >
                            Back to KPI
                        </ActionButton>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div style={cardStyle}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Total Workers</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{formatInt(summary?.total_workers ?? 0)}</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Total Foremen</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{formatInt(summary?.total_foremen ?? 0)}</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Avg Worker Hours</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{formatNumber(summary?.average_worker_hours ?? 0, 1)}</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Avg Foreman Progress</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{formatPercent(summary?.average_foreman_progress ?? 0)}</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Avg Worker KPI</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{formatNumber(summary?.average_worker_score ?? 0, 1)}</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Avg Foreman KPI</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{formatNumber(summary?.average_foreman_score ?? 0, 1)}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={cardStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>Top Workers</div>
                        {topWorkerRows.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#64748b' }}>No worker KPI data.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: 6 }}>
                                {topWorkerRows.map((row, index) => (
                                    <div key={`${row.worker_name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                        <span>{index + 1}. {row.worker_name || 'Unnamed'}</span>
                                        <span>{formatNumber(row.kpi_score, 1)} ({promotionLabel(row.kpi_score)})</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={cardStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>Top Foremen</div>
                        {topForemanRows.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#64748b' }}>No foreman KPI data.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: 6 }}>
                                {topForemanRows.map((row, index) => (
                                    <div key={`${row.foreman_name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                        <span>{index + 1}. {row.foreman_name || 'Unnamed'}</span>
                                        <span>{formatNumber(row.kpi_score, 1)} ({promotionLabel(row.kpi_score)})</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ ...cardStyle, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Worker KPI Table</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>
                                {['Worker', 'Role', 'Foreman', 'Projects', 'Days', 'Hours', 'KPI', 'Promotion'].map((header) => (
                                    <th key={header} style={{ textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid #e2e8f0' }}>
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {workerRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: 8, color: '#64748b' }}>No worker KPI data.</td>
                                </tr>
                            ) : (
                                workerRows.map((row, index) => (
                                    <tr key={`${row.worker_name}-${index}`}>
                                        <td style={{ padding: '6px 4px', fontWeight: 600 }}>{row.worker_name || 'Unnamed'}</td>
                                        <td style={{ padding: '6px 4px' }}>{row.worker_role || 'Worker'}</td>
                                        <td style={{ padding: '6px 4px' }}>{row.foreman_name || '-'}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatInt(row.projects_count)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatInt(row.attendance_days)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatNumber(row.attendance_hours, 1)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatNumber(row.kpi_score, 1)}</td>
                                        <td style={{ padding: '6px 4px' }}>{promotionLabel(row.kpi_score)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={cardStyle}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Foreman KPI Table</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>
                                {['Foreman', 'Projects', 'Days', 'Hours', 'Weekly Scopes', 'Avg Progress', 'Issues', 'Materials', 'Deliveries', 'Photos', 'Uploads', 'KPI', 'Promotion'].map((header) => (
                                    <th key={header} style={{ textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid #e2e8f0' }}>
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {foremanRows.length === 0 ? (
                                <tr>
                                    <td colSpan={13} style={{ padding: 8, color: '#64748b' }}>No foreman KPI data.</td>
                                </tr>
                            ) : (
                                foremanRows.map((row, index) => (
                                    <tr key={`${row.foreman_name}-${index}`}>
                                        <td style={{ padding: '6px 4px', fontWeight: 600 }}>{row.foreman_name || 'Unnamed'}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatInt(row.projects_count)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatInt(row.attendance_days)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatNumber(row.attendance_hours, 1)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatInt(row.weekly_scopes)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatPercent(row.avg_percent_completed)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatInt(row.issues_count)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatInt(row.material_requests_count)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatInt(row.deliveries_count)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatInt(row.progress_photos_count)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatInt(row.activity_uploads)}</td>
                                        <td style={{ padding: '6px 4px' }}>{formatNumber(row.kpi_score, 1)}</td>
                                        <td style={{ padding: '6px 4px' }}>{promotionLabel(row.kpi_score)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
