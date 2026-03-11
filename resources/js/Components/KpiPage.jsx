import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import Layout from './Layout';
import ActionButton from './ActionButton';
import DatePickerInput from './DatePickerInput';
import SearchableDropdown from './SearchableDropdown';
import SelectInput from './SelectInput';
import TextInput from './TextInput';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
    minWidth: 0,
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '9px 10px',
    fontSize: 13,
    boxSizing: 'border-box',
};

const labelStyle = {
    fontSize: 12,
    marginBottom: 6,
    color: 'var(--text-muted)',
};

const defaultThresholdInputs = {
    promotion_ready: '85',
    promotion_track: '70',
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

const toInputValue = (value) => {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
};

function StatCard({ label, value, helper, color = 'var(--text-main)' }) {
    return (
        <div style={cardStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>
                {value}
            </div>
            {helper ? <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>{helper}</div> : null}
        </div>
    );
}

function TopList({ title, rows = [], type = 'worker', scoreBadgeStyle, promotionLabel, testId, rowTestId }) {
    return (
        <div style={cardStyle} data-testid={testId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rows.length} listed</div>
            </div>
            {rows.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No KPI data available.</div>
            ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                    {rows.map((row, index) => (
                        <div
                            key={`${type}-${row.worker_name || row.foreman_name || index}`}
                            data-testid={rowTestId}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border-color)',
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 700 }}>
                                    {index + 1}. {row.worker_name || row.foreman_name || 'Unnamed'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {type === 'worker'
                                        ? `${row.worker_role || 'Worker'} | ${formatInt(row.projects_count)} projects`
                                        : `${formatInt(row.projects_count)} projects | Avg ${formatPercent(row.avg_percent_completed)} | Uploads ${formatInt(row.activity_uploads)}`}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span
                                    style={{
                                        ...scoreBadgeStyle(row.kpi_score),
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 999,
                                        padding: '3px 10px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                    }}
                                >
                                    {formatNumber(row.kpi_score, 1)}
                                </span>
                                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                                    {promotionLabel(row.kpi_score)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function KpiPage({
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
    const [draftFilters, setDraftFilters] = useState({
        date_from: filters?.date_from ?? '',
        date_to: filters?.date_to ?? '',
        project_id: String(filters?.project_id ?? ''),
        delivery_date_basis: String(filters?.delivery_date_basis || 'created_at'),
    });
    const [draftThresholds, setDraftThresholds] = useState({
        promotion_ready: toInputValue(promotionThresholds?.promotion_ready ?? 85),
        promotion_track: toInputValue(promotionThresholds?.promotion_track ?? 70),
    });
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setDraftFilters({
            date_from: filters?.date_from ?? '',
            date_to: filters?.date_to ?? '',
            project_id: String(filters?.project_id ?? ''),
            delivery_date_basis: String(filters?.delivery_date_basis || 'created_at'),
        });
    }, [filters]);

    useEffect(() => {
        setDraftThresholds({
            promotion_ready: toInputValue(promotionThresholds?.promotion_ready ?? 85),
            promotion_track: toInputValue(promotionThresholds?.promotion_track ?? 70),
        });
    }, [promotionThresholds]);

    const normalizedSearch = searchQuery.trim().toLowerCase();

    const workerRows = Array.isArray(workerKpis) ? workerKpis : [];
    const foremanRows = Array.isArray(foremanKpis) ? foremanKpis : [];

    const filteredWorkers = useMemo(() => {
        if (!normalizedSearch) return workerRows;
        return workerRows.filter((row) => {
            const haystack = `${row.worker_name || ''} ${row.worker_role || ''} ${row.foreman_name || ''}`.toLowerCase();
            return haystack.includes(normalizedSearch);
        });
    }, [workerRows, normalizedSearch]);

    const filteredForemen = useMemo(() => {
        if (!normalizedSearch) return foremanRows;
        return foremanRows.filter((row) => {
            const haystack = `${row.foreman_name || ''}`.toLowerCase();
            return haystack.includes(normalizedSearch);
        });
    }, [foremanRows, normalizedSearch]);

    const resolvedTopWorkers = Array.isArray(topWorkers) && topWorkers.length ? topWorkers : workerRows.slice(0, 5);
    const resolvedTopForemen = Array.isArray(topForemen) && topForemen.length ? topForemen : foremanRows.slice(0, 5);
    const topWorkerRows = normalizedSearch ? filteredWorkers.slice(0, 5) : resolvedTopWorkers;
    const topForemanRows = normalizedSearch ? filteredForemen.slice(0, 5) : resolvedTopForemen;

    const buildParams = (overrides = {}) => {
        const params = {
            date_from: overrides.date_from !== undefined ? overrides.date_from : draftFilters.date_from,
            date_to: overrides.date_to !== undefined ? overrides.date_to : draftFilters.date_to,
            project_id: overrides.project_id !== undefined ? overrides.project_id : draftFilters.project_id,
            delivery_date_basis: overrides.delivery_date_basis !== undefined ? overrides.delivery_date_basis : draftFilters.delivery_date_basis,
            promotion_ready: overrides.promotion_ready !== undefined ? overrides.promotion_ready : draftThresholds.promotion_ready,
            promotion_track: overrides.promotion_track !== undefined ? overrides.promotion_track : draftThresholds.promotion_track,
        };

        Object.keys(params).forEach((key) => {
            if (params[key] === '' || params[key] === null || params[key] === undefined) {
                delete params[key];
            }
        });

        return params;
    };

    const navigate = (overrides = {}) => {
        router.get('/kpi', buildParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const promotionReady = Number(promotionThresholds?.promotion_ready ?? 85);
    const promotionTrack = Number(promotionThresholds?.promotion_track ?? 70);

    const scoreBadgeStyle = (score) => {
        const numeric = Number(score);
        if (numeric >= promotionReady) {
            return {
                color: '#22c55e',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
            };
        }
        if (numeric >= promotionTrack) {
            return {
                color: '#fbbf24',
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
            };
        }

        return {
            color: '#f87171',
            background: 'rgba(248, 113, 113, 0.12)',
            border: '1px solid rgba(248, 113, 113, 0.2)',
        };
    };

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
        promotion_ready: promotionReady,
        promotion_track: promotionTrack,
    };

    Object.keys(appliedParams).forEach((key) => {
        if (appliedParams[key] === '' || appliedParams[key] === null || appliedParams[key] === undefined) {
            delete appliedParams[key];
        }
    });

    const appliedQuery = new URLSearchParams(appliedParams).toString();
    const exportHref = appliedQuery ? `/kpi/export?${appliedQuery}` : '/kpi/export';
    const printHref = appliedQuery ? `/kpi/print?${appliedQuery}` : '/kpi/print';
    return (
        <>
            <Head title="KPI" />
            <Layout title="KPI Performance">
                <div style={{ display: 'grid', gap: 16, minWidth: 0, overflowX: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            KPI uses attendance logs, weekly accomplishments, and foreman activity uploads to guide promotion and salary review decisions.
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <ActionButton
                                href={exportHref}
                                external
                                data-testid="kpi-export"
                                style={{ padding: '8px 12px', fontSize: 13 }}
                            >
                                Export CSV
                            </ActionButton>
                            <ActionButton
                                href={printHref}
                                external
                                variant="view"
                                data-testid="kpi-print"
                                style={{ padding: '8px 12px', fontSize: 13 }}
                            >
                                Print View
                            </ActionButton>
                        </div>
                    </div>

                    <div style={cardStyle} data-testid="kpi-filters">
                        <div style={{ display: 'grid', gap: 14 }}>
                            <div style={{ fontWeight: 700 }}>Filters</div>
                            <div>
                                <div style={labelStyle}>Filters</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                                    <div data-testid="kpi-date-from">
                                        <div style={labelStyle}>Date From</div>
                                        <DatePickerInput
                                            value={draftFilters.date_from}
                                            onChange={(value) => setDraftFilters((prev) => ({ ...prev, date_from: value }))}
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div data-testid="kpi-date-to">
                                        <div style={labelStyle}>Date To</div>
                                        <DatePickerInput
                                            value={draftFilters.date_to}
                                            onChange={(value) => setDraftFilters((prev) => ({ ...prev, date_to: value }))}
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <div style={labelStyle}>Project</div>
                                        <SearchableDropdown
                                            value={draftFilters.project_id}
                                            onChange={(value) => setDraftFilters((prev) => ({ ...prev, project_id: value }))}
                                            data-testid="kpi-project-select"
                                            style={inputStyle}
                                            placeholder="All projects"
                                            searchPlaceholder="Search projects..."
                                            pageSize={10}
                                            loadMoreLabel="Load more"
                                            options={[
                                                { value: '', label: 'All projects' },
                                                ...projects.map((project) => ({ value: String(project.id), label: project.name })),
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <div style={labelStyle}>Delivery Date Basis</div>
                                        <SelectInput
                                            value={draftFilters.delivery_date_basis}
                                            onChange={(e) => setDraftFilters((prev) => ({ ...prev, delivery_date_basis: e.target.value }))}
                                            data-testid="kpi-delivery-basis-select"
                                            style={inputStyle}
                                        >
                                            <option value="created_at">Uploaded At</option>
                                            <option value="delivery_date">Delivery Date</option>
                                        </SelectInput>
                                    </div>
                                    <div>
                                        <div style={labelStyle}>Quick Search</div>
                                        <TextInput
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search workers or foremen"
                                            data-testid="kpi-search-input"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div style={labelStyle}>Promotion Thresholds (%)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                                    <div>
                                        <div style={labelStyle}>Promotion Ready</div>
                                        <TextInput
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={draftThresholds.promotion_ready}
                                            onChange={(e) => setDraftThresholds((prev) => ({ ...prev, promotion_ready: e.target.value }))}
                                            data-testid="kpi-promotion-ready"
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <div style={labelStyle}>On Track</div>
                                        <TextInput
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={draftThresholds.promotion_track}
                                            onChange={(e) => setDraftThresholds((prev) => ({ ...prev, promotion_track: e.target.value }))}
                                            data-testid="kpi-promotion-track"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <ActionButton
                                    variant="neutral"
                                    onClick={() => {
                                        const clearedFilters = {
                                            date_from: '',
                                            date_to: '',
                                            project_id: '',
                                            delivery_date_basis: 'created_at',
                                        };
                                        setDraftFilters(clearedFilters);
                                        setDraftThresholds({ ...defaultThresholdInputs });
                                        setSearchQuery('');
                                        navigate({
                                            ...clearedFilters,
                                            ...defaultThresholdInputs,
                                        });
                                    }}
                                    data-testid="kpi-reset"
                                    style={{ padding: '8px 12px', fontSize: 13 }}
                                >
                                    Reset Defaults
                                </ActionButton>
                                <ActionButton
                                    variant="success"
                                    onClick={() => navigate()}
                                    data-testid="kpi-apply"
                                    style={{ padding: '8px 12px', fontSize: 13 }}
                                >
                                    Apply Filters
                                </ActionButton>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, minWidth: 0 }}>
                        <TopList
                            title="Top Workers"
                            rows={topWorkerRows}
                            type="worker"
                            scoreBadgeStyle={scoreBadgeStyle}
                            promotionLabel={promotionLabel}
                            testId="kpi-top-workers"
                            rowTestId="kpi-top-worker-row"
                        />
                        <TopList
                            title="Top Foremen"
                            rows={topForemanRows}
                            type="foreman"
                            scoreBadgeStyle={scoreBadgeStyle}
                            promotionLabel={promotionLabel}
                            testId="kpi-top-foremen"
                            rowTestId="kpi-top-foreman-row"
                        />
                    </div>

                    <div style={cardStyle} data-testid="kpi-worker-table">
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Worker KPI Table</div>
                        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 10, maxWidth: '100%' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
                                <thead>
                                    <tr style={{ background: 'var(--surface-2)' }}>
                                        {['Worker', 'Role', 'Foreman', 'Projects', 'Days', 'Hours', 'KPI', 'Promotion'].map((header) => (
                                            <th
                                                key={header}
                                                style={{
                                                    textAlign: header === 'Projects' || header === 'Days' || header === 'Hours' || header === 'KPI' ? 'right' : 'left',
                                                    padding: '10px 12px',
                                                    fontSize: 12,
                                                    color: 'var(--text-muted)',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredWorkers.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ padding: 14, fontSize: 13, color: 'var(--text-muted)' }}>
                                                No worker KPI data found for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredWorkers.map((row, index) => (
                                            <tr key={`${row.worker_name}-${index}`} data-testid="kpi-worker-row">
                                                <td style={{ padding: '10px 12px', fontWeight: 700 }}>{row.worker_name || 'Unnamed'}</td>
                                                <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                    {row.worker_role || 'Worker'}
                                                </td>
                                                <td style={{ padding: '10px 12px', fontSize: 12 }}>{row.foreman_name || '-'}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatInt(row.projects_count)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatInt(row.attendance_days)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatNumber(row.attendance_hours, 1)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                    <span
                                                        style={{
                                                            ...scoreBadgeStyle(row.kpi_score),
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderRadius: 999,
                                                            padding: '3px 10px',
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {formatNumber(row.kpi_score, 1)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 12px', fontSize: 12 }}>
                                                    {promotionLabel(row.kpi_score)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={cardStyle} data-testid="kpi-foreman-table">
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Foreman KPI Table</div>
                        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 10, maxWidth: '100%' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1360 }}>
                                <thead>
                                    <tr style={{ background: 'var(--surface-2)' }}>
                                        {['Foreman', 'Projects', 'Days', 'Hours', 'Weekly Scopes', 'Avg Progress', 'Issues', 'Materials', 'Deliveries', 'Photos', 'Uploads', 'KPI', 'Promotion'].map((header) => (
                                            <th
                                                key={header}
                                                style={{
                                                    textAlign: header === 'Projects'
                                                        || header === 'Days'
                                                        || header === 'Hours'
                                                        || header === 'Weekly Scopes'
                                                        || header === 'Avg Progress'
                                                        || header === 'Issues'
                                                        || header === 'Materials'
                                                        || header === 'Deliveries'
                                                        || header === 'Photos'
                                                        || header === 'Uploads'
                                                        || header === 'KPI'
                                                        ? 'right'
                                                        : 'left',
                                                    padding: '10px 12px',
                                                    fontSize: 12,
                                                    color: 'var(--text-muted)',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredForemen.length === 0 ? (
                                        <tr>
                                            <td colSpan={13} style={{ padding: 14, fontSize: 13, color: 'var(--text-muted)' }}>
                                                No foreman KPI data found for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredForemen.map((row, index) => (
                                            <tr key={`${row.foreman_name}-${index}`} data-testid="kpi-foreman-row">
                                                <td style={{ padding: '10px 12px', fontWeight: 700 }}>{row.foreman_name || 'Unnamed'}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatInt(row.projects_count)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatInt(row.attendance_days)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatNumber(row.attendance_hours, 1)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatInt(row.weekly_scopes)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatPercent(row.avg_percent_completed)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatInt(row.issues_count)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatInt(row.material_requests_count)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatInt(row.deliveries_count)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatInt(row.progress_photos_count)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                    {formatInt(row.activity_uploads)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                    <span
                                                        style={{
                                                            ...scoreBadgeStyle(row.kpi_score),
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderRadius: 999,
                                                            padding: '3px 10px',
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {formatNumber(row.kpi_score, 1)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 12px', fontSize: 12 }}>
                                                    {promotionLabel(row.kpi_score)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Layout>
        </>
    );
}

