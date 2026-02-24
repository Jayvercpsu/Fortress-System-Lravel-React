import Layout from '../../Components/Layout';
import DataTable from '../../Components/DataTable';
import ActionButton from '../../Components/ActionButton';
import SearchableDropdown from '../../Components/SearchableDropdown';
import Modal from '../../Components/Modal';
import DatePickerInput from '../../Components/DatePickerInput';
import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text-main)',
    fontSize: 13,
    outline: 'none',
    width: '100%',
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
    const raw = String(time).slice(0, 5);
    const [hour, minute] = raw.split(':').map(Number);
    if ([hour, minute].some((n) => Number.isNaN(n))) return raw;
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

export default function ForemanAttendance({
    projects = [],
    workers = [],
    attendances = [],
    attendanceTable = {},
    stats = {},
}) {
    const { flash } = usePage().props;
    const [editingId, setEditingId] = useState(null);
    const [editRow, setEditRow] = useState({
        worker_name: '',
        worker_role: 'Labor',
        project_id: '',
        time_in: '',
        time_out: '',
        hours: 0,
    });

    const table = useMemo(
        () => ({
            search: attendanceTable?.search ?? '',
            date: attendanceTable?.date ?? '',
            perPage: Number(attendanceTable?.per_page ?? 50),
            page: Number(attendanceTable?.current_page ?? 1),
            lastPage: Number(attendanceTable?.last_page ?? 1),
            total: Number(attendanceTable?.total ?? attendances.length ?? 0),
            from: attendanceTable?.from ?? null,
            to: attendanceTable?.to ?? null,
        }),
        [attendanceTable, attendances.length]
    );

    const [rows, setRows] = useState([
        { worker_name: '', worker_role: 'Labor', project_id: '', time_in: '', time_out: '', hours: 0 },
    ]);
    const [clockTick, setClockTick] = useState(Date.now());
    const phTodayIso = useMemo(() => getPhDateIso(clockTick), [clockTick]);
    const todayLabel = useMemo(() => getPhTodayLabel(clockTick), [clockTick]);

    const projectOptions = useMemo(
        () => (Array.isArray(projects) ? projects.map((project) => ({ id: String(project.id), name: project.name })) : []),
        [projects]
    );
    const workerOptions = useMemo(
        () =>
            (Array.isArray(workers)
                ? workers.map((worker) => ({
                    ...worker,
                    id: String(worker.id),
                    project_id: worker.project_id ? String(worker.project_id) : '',
                }))
                : []),
        [workers]
    );
    const workersByProjectId = useMemo(() => {
        const grouped = {};
        workerOptions.forEach((worker) => {
            const key = String(worker.project_id || '');
            if (!key) return;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(worker);
        });
        return grouped;
    }, [workerOptions]);
    const workerByName = useMemo(() => {
        const map = new Map();
        workerOptions.forEach((worker) => {
            if (!worker?.name) return;
            map.set(String(worker.name), worker);
        });
        return map;
    }, [workerOptions]);
    const roleOptions = useMemo(
        () => ['Skilled', 'Labor'].map((role) => ({ id: role, name: role })),
        []
    );

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    const computeHours = (entry) => {
        if (!entry?.time_in || !entry?.time_out) return null;
        const [inHour, inMinute] = String(entry.time_in).split(':').map(Number);
        const [outHour, outMinute] = String(entry.time_out).split(':').map(Number);
        if ([inHour, inMinute, outHour, outMinute].some((n) => Number.isNaN(n))) return null;
        const start = inHour * 60 + inMinute;
        const end = outHour * 60 + outMinute;
        if (end <= start) return null;
        return Math.round(((end - start) / 60) * 10) / 10;
    };

    const updateRow = (idx, field, value, option = null) => {
        setRows((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            if (field === 'project_id') {
                const selectedProjectId = String(value || '');
                const selectedWorker = next[idx].worker_name ? workerByName.get(String(next[idx].worker_name)) : null;
                if (selectedWorker && String(selectedWorker.project_id || '') !== selectedProjectId) {
                    next[idx].worker_name = '';
                }
            }
            if (field === 'worker_name' && option?.role) {
                next[idx].worker_role = option.role;
            }
            if (field === 'worker_name' && option?.project_id && !next[idx].project_id) {
                next[idx].project_id = String(option.project_id);
            }
            const computed = computeHours(next[idx]);
            if (computed !== null) next[idx].hours = computed;
            return next;
        });
    };

    const addRow = () =>
        setRows((prev) => [...prev, { worker_name: '', worker_role: 'Labor', project_id: '', time_in: '', time_out: '', hours: 0 }]);

    const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

    const buildListParams = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            date: overrides.date !== undefined ? overrides.date : (table.date || phTodayIso),
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };
        if (!params.search) delete params.search;
        return params;
    };

    const navigateTable = (overrides = {}) => {
        router.get('/foreman/attendance', buildListParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitAttendance = (e) => {
        e.preventDefault();

        const payloadRows = rows.filter((row) => row.worker_name);
        if (payloadRows.length === 0) {
            toast.error('Add at least one attendance row with worker name.');
            return;
        }
        const payload = payloadRows.map(({ hours, ...row }) => row);

        const params = new URLSearchParams(buildListParams());
        const qs = params.toString();

        router.post(
            `/foreman/attendance${qs ? `?${qs}` : ''}`,
            { attendance: payload },
            {
                preserveScroll: true,
                onError: () => toast.error('Unable to submit attendance. Check the form fields.'),
                onSuccess: () => {
                    setRows([{ worker_name: '', worker_role: 'Labor', project_id: '', time_in: '', time_out: '', hours: 0 }]);
                },
            }
        );
    };

    const startEdit = (row) => {
        setEditingId(row.id);
        setEditRow({
            worker_name: row.worker_name ?? '',
            worker_role: row.worker_role ?? 'Labor',
            project_id: row.project_id ? String(row.project_id) : '',
            time_in: row.time_in ? String(row.time_in).slice(0, 5) : '',
            time_out: row.time_out ? String(row.time_out).slice(0, 5) : '',
            hours: Number(row.hours ?? 0),
        });
    };

    const updateEditRow = (field, value) => {
        setEditRow((prev) => {
            const next = { ...prev, [field]: value };
            const computed = computeHours(next);
            if (computed !== null) next.hours = computed;
            return next;
        });
    };

    const saveEdit = (rowId) => {
        const params = new URLSearchParams(buildListParams());
        const qs = params.toString();

        router.patch(
            `/foreman/attendance/${rowId}${qs ? `?${qs}` : ''}`,
            {
                worker_name: editRow.worker_name,
                worker_role: editRow.worker_role,
                project_id: editRow.project_id || null,
                time_in: editRow.time_in || null,
                time_out: editRow.time_out || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => setEditingId(null),
                onError: () => toast.error('Unable to update attendance log.'),
            }
        );
    };

    const columns = [
        {
            key: 'date',
            label: 'Date',
            width: 120,
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.date || '-'}</span>,
            searchAccessor: (row) => row.date,
        },
        {
            key: 'worker_name',
            label: 'Worker',
            render: (row) => (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{row.worker_name}</span>
                    {row.is_foreman_self_log && (
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 999,
                                border: '1px solid rgba(59, 130, 246, 0.22)',
                                background: 'rgba(59, 130, 246, 0.10)',
                                color: '#60a5fa',
                                lineHeight: 1.4,
                            }}
                        >
                            You
                        </span>
                    )}
                </div>
            ),
            searchAccessor: (row) => row.worker_name,
        },
        {
            key: 'worker_role',
            label: 'Role',
            width: 90,
            render: (row) => row.worker_role,
            searchAccessor: (row) => row.worker_role,
        },
        {
            key: 'project_name',
            label: 'Project',
            render: (row) => row.project_name || '-',
            searchAccessor: (row) => row.project_name,
        },
        {
            key: 'time',
            label: 'Time In/Out',
            width: 190,
            render: (row) => `${timeLabel(row.time_in)} - ${timeLabel(row.time_out)}`,
        },
        {
            key: 'hours',
            label: 'Hours',
            width: 90,
            align: 'right',
            render: (row) => <div style={{ fontWeight: 700 }}>{Number(row.hours || 0).toFixed(1)}</div>,
            searchAccessor: (row) => row.hours,
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            width: 160,
            render: (row) =>
                row.can_edit_today ? (
                    <ActionButton type="button" variant="edit" onClick={() => startEdit(row)}>
                        Edit
                    </ActionButton>
                ) : row.is_foreman_self_log && row.date === phTodayIso && !row.time_out ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Use Time Out</span>
                ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Locked</span>
                ),
        },
    ];

    return (
        <>
            <Head title="Foreman Attendance" />
            <Layout title="Attendance">
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                        <div style={cardStyle}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Today Logs</div>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>{Number(stats?.today_logs ?? 0)}</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>This Week Hours</div>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>{Number(stats?.this_week_hours ?? 0).toFixed(1)}</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Total Logs</div>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>{Number(stats?.total_logs ?? 0)}</div>
                        </div>
                    </div>

                    <form onSubmit={submitAttendance} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700 }}>Daily Attendance</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Attendance Date: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{todayLabel}</span> (today)
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                            <thead>
                                <tr>
                                    {['Company / Project', 'Worker Name', 'Role', 'Time In', 'Time Out', ''].map((h, i) => (
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
                                {rows.map((entry, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                                        <td style={{ padding: '6px 8px', minWidth: 220 }}>
                                            <SearchableDropdown
                                                options={projectOptions}
                                                value={entry.project_id ?? ''}
                                                onChange={(value) => updateRow(idx, 'project_id', value || '')}
                                                getOptionLabel={(option) => option.name}
                                                getOptionValue={(option) => option.id}
                                                placeholder="Select company / project"
                                                searchPlaceholder="Search projects..."
                                                emptyMessage="No projects found"
                                                disabled={projectOptions.length === 0}
                                                clearable={false}
                                                style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                                dropdownWidth={320}
                                            />
                                        </td>
                                        <td style={{ padding: '6px 8px', minWidth: 220 }}>
                                            <SearchableDropdown
                                                options={workersByProjectId[String(entry.project_id || '')] || []}
                                                value={entry.worker_name}
                                                onChange={(selectedName, option) => updateRow(idx, 'worker_name', selectedName, option)}
                                                getOptionLabel={(option) => option.name}
                                                getOptionValue={(option) => option.name}
                                                placeholder={entry.project_id ? 'Select worker' : 'Select project first'}
                                                searchPlaceholder="Search workers..."
                                                emptyMessage="No workers found"
                                                disabled={!entry.project_id || workerOptions.length === 0}
                                                clearable
                                                style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                                dropdownWidth={320}
                                            />
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <div style={{ minWidth: 150 }}>
                                                <SearchableDropdown
                                                    options={roleOptions}
                                                    value={entry.worker_role}
                                                    onChange={(value) => updateRow(idx, 'worker_role', value || 'Labor')}
                                                    getOptionLabel={(option) => option.name}
                                                    getOptionValue={(option) => option.id}
                                                    placeholder="Select role"
                                                    searchPlaceholder="Search roles..."
                                                    emptyMessage="No roles found"
                                                    style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                                    dropdownWidth={240}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <input type="time" value={entry.time_in ?? ''} onChange={(e) => updateRow(idx, 'time_in', e.target.value)} style={{ ...inputStyle, minWidth: 110 }} />
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <input type="time" value={entry.time_out ?? ''} onChange={(e) => updateRow(idx, 'time_out', e.target.value)} style={{ ...inputStyle, minWidth: 110 }} />
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>
                                            {rows.length > 1 && (
                                                <ActionButton type="button" variant="danger" onClick={() => removeRow(idx)}>
                                                    Delete
                                                </ActionButton>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Hours are auto-calculated when both Time In and Time Out are provided.
                                {workerOptions.length === 0 ? ' Add workers first in the Workers page to use the worker dropdown.' : ''}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <ActionButton type="button" variant="neutral" onClick={addRow} style={{ padding: '8px 12px', fontSize: 13 }}>
                                    + Add Row
                                </ActionButton>
                                <ActionButton type="submit" variant="success" style={{ padding: '8px 12px', fontSize: 13 }}>
                                    Submit Attendance
                                </ActionButton>
                            </div>
                        </div>
                    </form>

                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                            <div style={{ fontWeight: 700 }}>My Attendance Logs</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Date
                                </span>
                                <DatePickerInput
                                    name="attendance-log-date"
                                    value={table.date || phTodayIso}
                                    onChange={(value) => navigateTable({ date: value || phTodayIso, page: 1 })}
                                    style={{ ...inputStyle, width: 170, minWidth: 170 }}
                                />
                                <ActionButton
                                    type="button"
                                    variant="neutral"
                                    onClick={() => navigateTable({ date: phTodayIso, page: 1 })}
                                    style={{ padding: '8px 12px', fontSize: 13 }}
                                >
                                    Today
                                </ActionButton>
                            </div>
                        </div>
                        <DataTable
                            columns={columns}
                            rows={attendances}
                            rowKey="id"
                            searchPlaceholder="Search my attendance..."
                            emptyMessage="No attendance logs yet."
                            serverSide
                            serverSearchValue={table.search}
                            serverPage={table.page}
                            serverPerPage={table.perPage}
                            serverTotalItems={table.total}
                            serverTotalPages={table.lastPage}
                            serverFrom={table.from}
                            serverTo={table.to}
                            onServerSearchChange={(value) => navigateTable({ search: value, page: 1 })}
                            onServerPerPageChange={(value) => navigateTable({ per_page: value, page: 1 })}
                            onServerPageChange={(value) => navigateTable({ page: value })}
                            getRowStyle={(row) => {
                                if (!(row?.is_foreman_self_log && row?.date === phTodayIso)) return undefined;
                                return row?.time_out
                                    ? { background: 'rgba(59, 130, 246, 0.06)' }
                                    : { background: 'rgba(34, 197, 94, 0.08)' };
                            }}
                        />
                    </div>
                </div>

                <Modal
                    open={!!editingId}
                    onClose={() => setEditingId(null)}
                    title="Edit Attendance Log"
                    maxWidth={720}
                >
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Company / Project</div>
                                <SearchableDropdown
                                    options={projectOptions}
                                    value={editRow.project_id ?? ''}
                                    onChange={(value) => {
                                        const nextProjectId = value || '';
                                        updateEditRow('project_id', nextProjectId);
                                        const selectedWorker = editRow.worker_name ? workerByName.get(String(editRow.worker_name)) : null;
                                        if (selectedWorker && String(selectedWorker.project_id || '') !== String(nextProjectId)) {
                                            updateEditRow('worker_name', '');
                                        }
                                    }}
                                    getOptionLabel={(option) => option.name}
                                    getOptionValue={(option) => option.id}
                                    placeholder="Select project"
                                    searchPlaceholder="Search projects..."
                                    emptyMessage="No projects found"
                                    disabled={projectOptions.length === 0}
                                    clearable
                                    style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                    dropdownWidth={360}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Worker</div>
                                <SearchableDropdown
                                    options={workersByProjectId[String(editRow.project_id || '')] || []}
                                    value={editRow.worker_name}
                                    onChange={(selectedName, option) => {
                                        updateEditRow('worker_name', selectedName);
                                        if (option?.role) updateEditRow('worker_role', option.role);
                                        if (option?.project_id && !editRow.project_id) updateEditRow('project_id', String(option.project_id));
                                    }}
                                    getOptionLabel={(option) => option.name}
                                    getOptionValue={(option) => option.name}
                                    placeholder={editRow.project_id ? 'Select worker' : 'Select project first'}
                                    searchPlaceholder="Search workers..."
                                    emptyMessage="No workers found"
                                    disabled={!editRow.project_id || workerOptions.length === 0}
                                    clearable
                                    style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                    dropdownWidth={320}
                                />
                            </div>
                        </div>

                        <div style={{ maxWidth: 320 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Role</div>
                            <SearchableDropdown
                                options={roleOptions}
                                value={editRow.worker_role}
                                onChange={(value) => updateEditRow('worker_role', value || 'Labor')}
                                getOptionLabel={(option) => option.name}
                                getOptionValue={(option) => option.id}
                                placeholder="Select role"
                                searchPlaceholder="Search roles..."
                                emptyMessage="No roles found"
                                style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                dropdownWidth={240}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Time In</div>
                                <input
                                    type="time"
                                    value={editRow.time_in ?? ''}
                                    onChange={(e) => updateEditRow('time_in', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Time Out</div>
                                <input
                                    type="time"
                                    value={editRow.time_out ?? ''}
                                    onChange={(e) => updateEditRow('time_out', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Hours are auto-calculated when both Time In and Time Out are provided.
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <ActionButton type="button" variant="neutral" onClick={() => setEditingId(null)}>
                                Cancel
                            </ActionButton>
                            <ActionButton
                                type="button"
                                variant="success"
                                onClick={() => editingId && saveEdit(editingId)}
                            >
                                Save
                            </ActionButton>
                        </div>
                    </div>
                </Modal>
            </Layout>
        </>
    );
}
