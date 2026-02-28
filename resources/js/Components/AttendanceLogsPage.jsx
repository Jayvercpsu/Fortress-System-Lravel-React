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
    workerRoles = [],
    attendanceCodes = [],
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
        worker_role: String(filters?.worker_role ?? ''),
        entry_mode: String(filters?.entry_mode ?? ''),
        attendance_code: String(filters?.attendance_code ?? ''),
    });

    useEffect(() => {
        setDraftFilters({
            date_from: filters?.date_from ?? '',
            date_to: filters?.date_to ?? '',
            foreman_id: String(filters?.foreman_id ?? ''),
            project_id: String(filters?.project_id ?? ''),
            worker_role: String(filters?.worker_role ?? ''),
            entry_mode: String(filters?.entry_mode ?? ''),
            attendance_code: String(filters?.attendance_code ?? ''),
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
            worker_role: overrides.worker_role !== undefined ? overrides.worker_role : draftFilters.worker_role,
            entry_mode: overrides.entry_mode !== undefined ? overrides.entry_mode : draftFilters.entry_mode,
            attendance_code: overrides.attendance_code !== undefined ? overrides.attendance_code : draftFilters.attendance_code,
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
            key: 'entry_mode',
            label: 'Entry Type',
            width: 140,
            render: (row) =>
                row.entry_mode === 'time_log' ? (
                    <span style={{ fontWeight: 700, color: '#4ade80' }}>Time Log</span>
                ) : (
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Status-Based</span>
                ),
            searchAccessor: (row) => row.entry_mode,
        },
        {
            key: 'attendance_code',
            label: 'Code',
            width: 120,
            render: (row) => {
                if (!row.attendance_code) {
                    return <span style={{ color: 'var(--text-muted)' }}>-</span>;
                }
                return (
                    <span
                        title={row.attendance_code_is_derived ? 'Derived from hours for legacy records' : undefined}
                        style={{ fontWeight: 700 }}
                    >
                        {row.attendance_code}
                        {row.attendance_code_is_derived ? '*' : ''}
                    </span>
                );
            },
            searchAccessor: (row) => `${row.attendance_code || ''}`,
        },
        {
            key: 'time_range',
            label: 'Time In/Out',
            render: (row) =>
                row.entry_mode === 'time_log'
                    ? `${timeLabel(row.time_in)} - ${timeLabel(row.time_out)}`
                    : <span style={{ color: 'var(--text-muted)' }}>N/A (status-based)</span>,
            searchAccessor: (row) => `${row.time_in || ''} ${row.time_out || ''} ${row.entry_mode || ''}`,
            width: 150,
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
                            Browse attendance logs with role and entry type filters. Status-based rows come from weekly/day-code submissions and may not have time in/out.
                        </div>
                        <ActionButton href="/attendance/summary" variant="view" style={{ padding: '8px 12px', fontSize: 13 }}>
                            Cutoff Summary
                        </ActionButton>
                    </div>

                    <div style={cardStyle}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
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
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Worker Role</div>
                                <select
                                    value={draftFilters.worker_role}
                                    onChange={(e) => setDraftFilters((prev) => ({ ...prev, worker_role: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">All roles</option>
                                    {workerRoles.map((role) => (
                                        <option key={role} value={role}>
                                            {role}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Entry Type</div>
                                <select
                                    value={draftFilters.entry_mode}
                                    onChange={(e) => setDraftFilters((prev) => ({ ...prev, entry_mode: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">All entry types</option>
                                    <option value="time_log">Time Log (with in/out)</option>
                                    <option value="status_based">Status-Based (weekly/day-code)</option>
                                </select>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Attendance Code</div>
                                <select
                                    value={draftFilters.attendance_code}
                                    onChange={(e) => setDraftFilters((prev) => ({ ...prev, attendance_code: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">All codes</option>
                                    {(attendanceCodes.length ? attendanceCodes : ['P', 'A', 'H', 'R', 'F']).map((code) => (
                                        <option key={code} value={code}>
                                            {code}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                            Codes: P = Present, A = Absent, H = Half Day, R = Rest Day, F = Field Work. * means derived from old rows without saved code.
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                            <ActionButton
                                variant="neutral"
                                onClick={() => {
                                    const cleared = { date_from: '', date_to: '', foreman_id: '', project_id: '', worker_role: '', entry_mode: '', attendance_code: '' };
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
