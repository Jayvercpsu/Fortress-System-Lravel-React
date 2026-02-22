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

function timeLabel(time) {
    if (!time) return '-';
    const raw = String(time).trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return raw;

    const hours24 = Number(match[1]);
    const minutes = match[2];
    if (Number.isNaN(hours24)) return raw;

    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${minutes} ${period}`;
}

export default function AttendanceLogsPage({
    attendances = [],
    attendanceTable = {},
    filters = {},
    foremen = [],
    projects = [],
}) {
    const table = useMemo(
        () => ({
            search: attendanceTable?.search ?? '',
            perPage: Number(attendanceTable?.per_page ?? 10),
            page: Number(attendanceTable?.current_page ?? 1),
            lastPage: Number(attendanceTable?.last_page ?? 1),
            total: Number(attendanceTable?.total ?? attendances.length ?? 0),
            from: attendanceTable?.from ?? null,
            to: attendanceTable?.to ?? null,
        }),
        [attendanceTable, attendances.length]
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
        router.get('/attendance', buildParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const columns = [
        {
            key: 'date',
            label: 'Date',
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.date || '-'}</span>,
            searchAccessor: (row) => row.date,
            width: 120,
        },
        {
            key: 'worker_name',
            label: 'Worker',
            render: (row) => <div style={{ fontWeight: 600 }}>{row.worker_name}</div>,
            searchAccessor: (row) => row.worker_name,
        },
        { key: 'worker_role', label: 'Role', searchAccessor: (row) => row.worker_role },
        { key: 'foreman_name', label: 'Foreman', searchAccessor: (row) => row.foreman_name },
        {
            key: 'project_name',
            label: 'Project',
            render: (row) => row.project_name || <span style={{ color: 'var(--text-muted)' }}>-</span>,
            searchAccessor: (row) => row.project_name,
        },
        {
            key: 'time_range',
            label: 'Time In/Out',
            render: (row) => `${timeLabel(row.time_in)} - ${timeLabel(row.time_out)}`,
            searchAccessor: (row) => `${row.time_in || ''} ${row.time_out || ''}`,
            width: 120,
        },
        {
            key: 'hours',
            label: 'Hours',
            align: 'right',
            render: (row) => <div style={{ fontWeight: 700 }}>{Number(row.hours || 0).toFixed(1)}</div>,
            searchAccessor: (row) => row.hours,
            width: 90,
        },
    ];

    return (
        <>
            <Head title="Attendance" />
            <Layout title="Attendance Logs">
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Browse attendance logs with project/foreman/date filters. Times are shown in Philippine time (Asia/Manila).
                        </div>
                        <ActionButton href="/attendance/summary" variant="view" style={{ padding: '8px 12px', fontSize: 13 }}>
                            Cutoff Summary
                        </ActionButton>
                    </div>

                    <div style={cardStyle}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Date From</div>
                                <DatePickerInput
                                    value={draftFilters.date_from}
                                    onChange={(value) => setDraftFilters((prev) => ({ ...prev, date_from: value }))}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Date To</div>
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
                                Apply Filters
                            </ActionButton>
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <DataTable
                            columns={columns}
                            rows={attendances}
                            rowKey="id"
                            searchPlaceholder="Search attendance logs..."
                            emptyMessage="No attendance logs found for the selected filters."
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
