import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import Layout from './Layout';
import DataTable from './DataTable';
import DatePickerInput from './DatePickerInput';
import ActionButton from './ActionButton';
import SearchableDropdown from './SearchableDropdown';
import TimeInput from './TimeInput';
import toast from 'react-hot-toast';
import { toastMessages } from '../constants/toastMessages';

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

const PH_TIMEZONE = 'Asia/Manila';

function getPhNowParts(nowValue = Date.now()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: PH_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(new Date(nowValue));

    const read = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);

    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: read('hour'),
        minute: read('minute'),
        second: read('second'),
    };
}

function getPhDateIso(nowValue = Date.now()) {
    const { year, month, day } = getPhNowParts(nowValue);
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getPhTodayLabel(nowValue = Date.now()) {
    return new Intl.DateTimeFormat(undefined, {
        timeZone: PH_TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(new Date(nowValue));
}

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
    workerRoleOptions = [],
    attendanceCodes = [],
}) {
    const defaultRole = workerRoleOptions?.[0] || 'Worker';
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

    const [dailyRows, setDailyRows] = useState([
        { foreman_id: '', project_id: '', time_in: '', time_out: '' },
    ]);
    const [clockTick, setClockTick] = useState(Date.now());
    const phTodayIso = useMemo(() => getPhDateIso(clockTick), [clockTick]);
    const todayLabel = useMemo(() => getPhTodayLabel(clockTick), [clockTick]);

    useEffect(() => {
        const timer = setInterval(() => setClockTick(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    const foremanOptions = useMemo(
        () => (Array.isArray(foremen) ? foremen.map((foreman) => ({ id: String(foreman.id), name: foreman.fullname })) : []),
        [foremen]
    );
    const projectOptions = useMemo(
        () => (Array.isArray(projects) ? projects.map((project) => ({ id: String(project.id), name: project.label || project.name })) : []),
        [projects]
    );
    const roleOptions = useMemo(() => {
        const baseRoles = Array.isArray(workerRoleOptions) && workerRoleOptions.length > 0
            ? workerRoleOptions
            : [defaultRole, 'Skilled Worker', 'Laborer'];
        const knownRoles = [
            ...baseRoles,
            'Foreman',
            ...workerRoles,
        ];
        const uniqueRoles = Array.from(new Set(knownRoles.map((role) => String(role || '').trim()).filter(Boolean)));
        return uniqueRoles.map((role) => ({ id: role, name: role }));
    }, [workerRoleOptions, workerRoles]);

    const entryModeOptions = useMemo(
        () => [
            { id: 'time_log', name: 'Time Log (with in/out)' },
            { id: 'status_based', name: 'Status-Based (weekly/day-code)' },
        ],
        []
    );

    const attendanceCodeOptions = useMemo(
        () =>
            (attendanceCodes.length ? attendanceCodes : ['P', 'A', 'H', 'R', 'F']).map((code) => ({
                id: code,
                name: code,
            })),
        [attendanceCodes]
    );

    const updateDailyRow = (idx, field, value, option = null) => {
        setDailyRows((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };

            return next;
        });
    };

    const addDailyRow = () =>
        setDailyRows((prev) => [...prev, { foreman_id: '', project_id: '', time_in: '', time_out: '' }]);

    const removeDailyRow = (idx) => setDailyRows((prev) => prev.filter((_, i) => i !== idx));

    const submitDailyAttendance = (e) => {
        e.preventDefault();
        const payloadRows = dailyRows.filter((row) => row.foreman_id);
        if (payloadRows.length === 0) {
            toast.error(toastMessages.attendance.addRowRequired);
            return;
        }
        if (payloadRows.some((row) => !row.foreman_id)) {
            toast.error('Select a foreman for each row.');
            return;
        }

        const payload = payloadRows.map((row) => ({
            foreman_id: row.foreman_id,
            project_id: row.project_id || null,
            time_in: row.time_in || null,
            time_out: row.time_out || null,
        }));

        const params = new URLSearchParams(buildParams());
        const qs = params.toString();

        router.post(
            `/attendance${qs ? `?${qs}` : ''}`,
            { attendance: payload },
            {
                preserveScroll: true,
                onError: () => toast.error(toastMessages.attendance.submitError),
                onSuccess: () => {
                    setDailyRows([{ foreman_id: '', project_id: '', time_in: '', time_out: '' }]);
                    toast.success(toastMessages.attendance.submitSuccess);
                },
            }
        );
    };

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
                    <form onSubmit={submitDailyAttendance} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                            <div style={{ fontWeight: 700 }}>Foreman Daily Attendance</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Attendance Date: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{todayLabel}</span> (today)
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                            <thead>
                                <tr>
                                    {['Company / Project', 'Foreman', 'Time In', 'Time Out', ''].map((h, i) => (
                                        <th
                                            key={i}
                                            style={{
                                                fontSize: 11,
                                                color: 'var(--text-muted-2)',
                                                textAlign: 'left',
                                                padding: '8px',
                                                borderBottom: '1px solid var(--border-color)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {dailyRows.map((entry, idx) => {
                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                                            <td style={{ padding: '6px 8px', minWidth: 220 }}>
                                                <SearchableDropdown
                                                    options={projectOptions}
                                                    value={entry.project_id ?? ''}
                                                    onChange={(value) => updateDailyRow(idx, 'project_id', value || '')}
                                                    getOptionLabel={(option) => option.name}
                                                    getOptionValue={(option) => option.id}
                                                    placeholder="Select company / project"
                                                    searchPlaceholder="Search projects..."
                                                    emptyMessage="No projects found"
                                                    clearable
                                                    style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                                    dropdownWidth={320}
                                                />
                                            </td>
                                            <td style={{ padding: '6px 8px', minWidth: 200 }}>
                                                <SearchableDropdown
                                                    options={foremanOptions}
                                                    value={entry.foreman_id ?? ''}
                                                    onChange={(value) => updateDailyRow(idx, 'foreman_id', value || '')}
                                                    getOptionLabel={(option) => option.name}
                                                    getOptionValue={(option) => option.id}
                                                    placeholder="Select foreman"
                                                    searchPlaceholder="Search foremen..."
                                                    emptyMessage="No foremen found"
                                                    clearable
                                                    style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                                    dropdownWidth={280}
                                                />
                                            </td>
                                            <td style={{ padding: '6px 8px', minWidth: 220 }}>
                                                <TimeInput
                                                    value={entry.time_in ?? ''}
                                                    onChange={(value) => updateDailyRow(idx, 'time_in', value || '')}
                                                    style={{ ...inputStyle, minWidth: 110 }}
                                                />
                                            </td>
                                            <td style={{ padding: '6px 8px' }}>
                                                <TimeInput
                                                    value={entry.time_out ?? ''}
                                                    onChange={(value) => updateDailyRow(idx, 'time_out', value || '')}
                                                    style={{ ...inputStyle, minWidth: 110 }}
                                                />
                                            </td>
                                            <td style={{ padding: '6px 8px' }}>
                                                {dailyRows.length > 1 && (
                                                    <ActionButton type="button" variant="danger" onClick={() => removeDailyRow(idx)}>
                                                        Delete
                                                    </ActionButton>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Hours are auto-calculated when both Time In and Time Out are provided.
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <ActionButton type="button" variant="neutral" onClick={addDailyRow} style={{ padding: '8px 12px', fontSize: 13 }}>
                                    + Add Row
                                </ActionButton>
                                <ActionButton type="submit" variant="success" style={{ padding: '8px 12px', fontSize: 13 }}>
                                    Submit Attendance
                                </ActionButton>
                            </div>
                        </div>
                    </form>

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
                                <SearchableDropdown
                                    options={foremanOptions}
                                    value={draftFilters.foreman_id}
                                    onChange={(value) => setDraftFilters((prev) => ({ ...prev, foreman_id: value || '' }))}
                                    getOptionLabel={(option) => option.name}
                                    getOptionValue={(option) => option.id}
                                    placeholder="All foremen"
                                    searchPlaceholder="Search foremen..."
                                    emptyMessage="No foremen found"
                                    clearable
                                    style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                    dropdownWidth={280}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Project</div>
                                <SearchableDropdown
                                    options={projectOptions}
                                    value={draftFilters.project_id}
                                    onChange={(value) => setDraftFilters((prev) => ({ ...prev, project_id: value || '' }))}
                                    getOptionLabel={(option) => option.name}
                                    getOptionValue={(option) => option.id}
                                    placeholder="All projects"
                                    searchPlaceholder="Search projects..."
                                    emptyMessage="No projects found"
                                    clearable
                                    style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                    dropdownWidth={320}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Worker Role</div>
                                <SearchableDropdown
                                    options={roleOptions}
                                    value={draftFilters.worker_role}
                                    onChange={(value) => setDraftFilters((prev) => ({ ...prev, worker_role: value || '' }))}
                                    getOptionLabel={(option) => option.name}
                                    getOptionValue={(option) => option.id}
                                    placeholder="All roles"
                                    searchPlaceholder="Search roles..."
                                    emptyMessage="No roles found"
                                    clearable
                                    style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                    dropdownWidth={240}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Entry Type</div>
                                <SearchableDropdown
                                    options={entryModeOptions}
                                    value={draftFilters.entry_mode}
                                    onChange={(value) => setDraftFilters((prev) => ({ ...prev, entry_mode: value || '' }))}
                                    getOptionLabel={(option) => option.name}
                                    getOptionValue={(option) => option.id}
                                    placeholder="All entry types"
                                    searchPlaceholder="Search entry types..."
                                    emptyMessage="No entry types found"
                                    clearable
                                    style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                    dropdownWidth={260}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Attendance Code</div>
                                <SearchableDropdown
                                    options={attendanceCodeOptions}
                                    value={draftFilters.attendance_code}
                                    onChange={(value) => setDraftFilters((prev) => ({ ...prev, attendance_code: value || '' }))}
                                    getOptionLabel={(option) => option.name}
                                    getOptionValue={(option) => option.id}
                                    placeholder="All codes"
                                    searchPlaceholder="Search codes..."
                                    emptyMessage="No codes found"
                                    clearable
                                    style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                    dropdownWidth={200}
                                />
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
