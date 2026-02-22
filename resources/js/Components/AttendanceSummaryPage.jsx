import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import Layout from './Layout';
import DataTable from './DataTable';
import DatePickerInput from './DatePickerInput';
import ActionButton from './ActionButton';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 14,
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

export default function AttendanceSummaryPage({
    rows = [],
    summaryTable = {},
    filters = {},
    foremen = [],
    projects = [],
    summaryTotals = {},
}) {
    const table = useMemo(
        () => ({
            search: summaryTable?.search ?? '',
            perPage: Number(summaryTable?.per_page ?? 10),
            page: Number(summaryTable?.current_page ?? 1),
            lastPage: Number(summaryTable?.last_page ?? 1),
            total: Number(summaryTable?.total ?? rows.length ?? 0),
            from: summaryTable?.from ?? null,
            to: summaryTable?.to ?? null,
        }),
        [summaryTable, rows.length]
    );

    const [draftFilters, setDraftFilters] = useState({
        date_from: filters?.date_from ?? '',
        date_to: filters?.date_to ?? '',
        foreman_id: String(filters?.foreman_id ?? ''),
        project_id: String(filters?.project_id ?? ''),
    });

    useEffect(() => {
        setDraftFilters({
            date_from: filters?.date_from ?? '',
            date_to: filters?.date_to ?? '',
            foreman_id: String(filters?.foreman_id ?? ''),
            project_id: String(filters?.project_id ?? ''),
        });
    }, [filters]);

    const buildParams = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
            date_from: overrides.date_from !== undefined ? overrides.date_from : draftFilters.date_from,
            date_to: overrides.date_to !== undefined ? overrides.date_to : draftFilters.date_to,
            foreman_id: overrides.foreman_id !== undefined ? overrides.foreman_id : draftFilters.foreman_id,
            project_id: overrides.project_id !== undefined ? overrides.project_id : draftFilters.project_id,
        };

        Object.keys(params).forEach((key) => {
            if (params[key] === '' || params[key] === null || params[key] === undefined) {
                delete params[key];
            }
        });

        return params;
    };

    const navigate = (overrides = {}) => {
        router.get('/attendance/summary', buildParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const columns = [
        {
            key: 'worker_name',
            label: 'Worker',
            render: (row) => <div style={{ fontWeight: 700 }}>{row.worker_name}</div>,
            searchAccessor: (row) => row.worker_name,
        },
        { key: 'worker_role', label: 'Role', searchAccessor: (row) => row.worker_role, width: 90 },
        { key: 'foreman_name', label: 'Foreman', searchAccessor: (row) => row.foreman_name },
        {
            key: 'project_name',
            label: 'Project',
            render: (row) => row.project_name || <span style={{ color: 'var(--text-muted)' }}>-</span>,
            searchAccessor: (row) => row.project_name,
        },
        { key: 'days_count', label: 'Days', align: 'right', width: 70, searchAccessor: (row) => row.days_count },
        { key: 'logs_count', label: 'Logs', align: 'right', width: 70, searchAccessor: (row) => row.logs_count },
        {
            key: 'total_hours',
            label: 'Total Hours',
            align: 'right',
            width: 110,
            render: (row) => <div style={{ fontWeight: 700 }}>{Number(row.total_hours || 0).toFixed(1)}</div>,
            searchAccessor: (row) => row.total_hours,
        },
        {
            key: 'range',
            label: 'Range',
            width: 170,
            render: (row) => (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                    {(row.first_date || '-')} to {(row.last_date || '-')}
                </span>
            ),
            searchAccessor: (row) => `${row.first_date || ''} ${row.last_date || ''}`,
        },
    ];

    return (
        <>
            <Head title="Attendance Summary" />
            <Layout title="Attendance Cutoff Summary">
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Generate cutoff totals by worker, foreman, and project. Cutoff/date filters follow Philippine time (Asia/Manila).
                        </div>
                        <ActionButton href="/attendance" variant="view" style={{ padding: '8px 12px', fontSize: 13 }}>
                            View Logs
                        </ActionButton>
                    </div>

                    <div style={cardStyle}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Cutoff Start</div>
                                <DatePickerInput
                                    value={draftFilters.date_from}
                                    onChange={(value) => setDraftFilters((prev) => ({ ...prev, date_from: value }))}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Cutoff End</div>
                                <DatePickerInput
                                    value={draftFilters.date_to}
                                    onChange={(value) => setDraftFilters((prev) => ({ ...prev, date_to: value }))}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Foreman</div>
                                <select
                                    value={draftFilters.foreman_id}
                                    onChange={(e) => setDraftFilters((prev) => ({ ...prev, foreman_id: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">All foremen</option>
                                    {foremen.map((foreman) => (
                                        <option key={foreman.id} value={foreman.id}>
                                            {foreman.fullname}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Project</div>
                                <select
                                    value={draftFilters.project_id}
                                    onChange={(e) => setDraftFilters((prev) => ({ ...prev, project_id: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">All projects</option>
                                    {projects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                            <ActionButton
                                variant="neutral"
                                onClick={() => {
                                    const cleared = { date_from: '', date_to: '', foreman_id: '', project_id: '' };
                                    setDraftFilters(cleared);
                                    navigate({ ...cleared, page: 1 });
                                }}
                                style={{ padding: '8px 12px', fontSize: 13 }}
                            >
                                Clear
                            </ActionButton>
                            <ActionButton
                                variant="success"
                                onClick={() => navigate({ ...draftFilters, page: 1 })}
                                style={{ padding: '8px 12px', fontSize: 13 }}
                            >
                                Generate Summary
                            </ActionButton>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                        {[
                            ['Total Logs', Number(summaryTotals?.total_logs ?? 0)],
                            ['Total Hours', Number(summaryTotals?.total_hours ?? 0).toFixed(1)],
                            ['Unique Workers', Number(summaryTotals?.unique_workers ?? 0)],
                            ['Foremen Covered', Number(summaryTotals?.unique_foremen ?? 0)],
                        ].map(([label, value]) => (
                            <div key={label} style={cardStyle}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
                                <div style={{ fontWeight: 700, fontSize: 20 }}>{value}</div>
                            </div>
                        ))}
                    </div>

                    <div style={cardStyle}>
                        <DataTable
                            columns={columns}
                            rows={rows}
                            rowKey={(row, index) => `${row.worker_name}-${row.project_name || 'none'}-${row.foreman_name || 'none'}-${index}`}
                            searchPlaceholder="Search cutoff summary..."
                            emptyMessage="No attendance summary rows for the selected cutoff filters."
                            serverSide
                            serverSearchValue={table.search}
                            serverPage={table.page}
                            serverPerPage={table.perPage}
                            serverTotalItems={table.total}
                            serverTotalPages={table.lastPage}
                            serverFrom={table.from}
                            serverTo={table.to}
                            onServerSearchChange={(value) => navigate({ search: value, page: 1 })}
                            onServerPerPageChange={(value) => navigate({ per_page: value, page: 1 })}
                            onServerPageChange={(value) => navigate({ page: value })}
                        />
                    </div>
                </div>
            </Layout>
        </>
    );
}
