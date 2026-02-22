import Layout from '../../Components/Layout';
import DataTable from '../../Components/DataTable';
import ActionButton from '../../Components/ActionButton';
import SearchableDropdown from '../../Components/SearchableDropdown';
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

function timeLabel(time) {
    return time ? String(time).slice(0, 5) : '-';
}

export default function ForemanAttendance({ projects = [], workers = [], attendances = [], attendanceTable = {}, stats = {} }) {
    const { flash } = usePage().props;
    const todayLabel = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
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
            perPage: Number(attendanceTable?.per_page ?? 10),
            page: Number(attendanceTable?.current_page ?? 1),
            lastPage: Number(attendanceTable?.last_page ?? 1),
            total: Number(attendanceTable?.total ?? attendances.length ?? 0),
            from: attendanceTable?.from ?? null,
            to: attendanceTable?.to ?? null,
        }),
        [attendanceTable, attendances.length]
    );

    const [rows, setRows] = useState([
        { worker_name: '', worker_role: 'Labor', project_id: '', time_in: '', time_out: '', hours: 8 },
    ]);

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

    const updateRow = (idx, field, value) => {
        setRows((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            const computed = computeHours(next[idx]);
            if (computed !== null) next[idx].hours = computed;
            return next;
        });
    };

    const addRow = () =>
        setRows((prev) => [...prev, { worker_name: '', worker_role: 'Labor', project_id: '', time_in: '', time_out: '', hours: 8 }]);

    const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

    const buildListParams = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
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

        const params = new URLSearchParams(buildListParams());
        const qs = params.toString();

        router.post(
            `/foreman/attendance${qs ? `?${qs}` : ''}`,
            { attendance: payloadRows },
            {
                preserveScroll: true,
                onError: () => toast.error('Unable to submit attendance. Check the form fields.'),
                onSuccess: () => {
                    setRows([{ worker_name: '', worker_role: 'Labor', project_id: '', time_in: '', time_out: '', hours: 8 }]);
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
                hours: editRow.hours,
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
            render: (row) =>
                editingId === row.id ? (
                    <div style={{ minWidth: 220 }}>
                        <SearchableDropdown
                            options={workers}
                            value={editRow.worker_name}
                            onChange={(selectedName) => updateEditRow('worker_name', selectedName)}
                            getOptionLabel={(option) => option.name}
                            getOptionValue={(option) => option.name}
                            placeholder={workers.length ? 'Select worker' : 'No workers yet'}
                            searchPlaceholder="Search workers..."
                            emptyMessage="No workers found"
                            disabled={workers.length === 0}
                            clearable
                            style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                            dropdownWidth={320}
                        />
                    </div>
                ) : (
                    <div style={{ fontWeight: 700 }}>{row.worker_name}</div>
                ),
            searchAccessor: (row) => row.worker_name,
        },
        {
            key: 'worker_role',
            label: 'Role',
            width: 90,
            render: (row) =>
                editingId === row.id ? (
                    <select value={editRow.worker_role} onChange={(e) => updateEditRow('worker_role', e.target.value)} style={inputStyle}>
                        {['Foreman', 'Skilled', 'Labor'].map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                ) : (
                    row.worker_role
                ),
            searchAccessor: (row) => row.worker_role,
        },
        {
            key: 'project_name',
            label: 'Project',
            render: (row) =>
                editingId === row.id ? (
                    <select value={editRow.project_id ?? ''} onChange={(e) => updateEditRow('project_id', e.target.value)} style={inputStyle}>
                        <option value="">Select project (optional)</option>
                        {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                ) : (
                    row.project_name || '-'
                ),
            searchAccessor: (row) => row.project_name,
        },
        {
            key: 'time',
            label: 'Time In/Out',
            width: 190,
            render: (row) =>
                editingId === row.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                        <input type="time" value={editRow.time_in ?? ''} onChange={(e) => updateEditRow('time_in', e.target.value)} style={{ ...inputStyle, minWidth: 84 }} />
                        <input type="time" value={editRow.time_out ?? ''} onChange={(e) => updateEditRow('time_out', e.target.value)} style={{ ...inputStyle, minWidth: 84 }} />
                    </div>
                ) : (
                    `${timeLabel(row.time_in)} - ${timeLabel(row.time_out)}`
                ),
        },
        {
            key: 'hours',
            label: 'Hours',
            width: 90,
            align: 'right',
            render: (row) =>
                editingId === row.id ? (
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={editRow.hours}
                        onChange={(e) => updateEditRow('hours', e.target.value)}
                        style={{ ...inputStyle, width: 80, textAlign: 'right' }}
                    />
                ) : (
                    <div style={{ fontWeight: 700 }}>{Number(row.hours || 0).toFixed(1)}</div>
                ),
            searchAccessor: (row) => row.hours,
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            width: 160,
            render: (row) =>
                editingId === row.id ? (
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                        <ActionButton type="button" variant="neutral" onClick={() => setEditingId(null)}>
                            Cancel
                        </ActionButton>
                        <ActionButton type="button" variant="success" onClick={() => saveEdit(row.id)}>
                            Save
                        </ActionButton>
                    </div>
                ) : row.can_edit_today ? (
                    <ActionButton type="button" variant="edit" onClick={() => startEdit(row)}>
                        Edit
                    </ActionButton>
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
                                    {['Worker Name', 'Role', 'Project', 'Time In', 'Time Out', 'Hours', ''].map((h, i) => (
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
                                                options={workers}
                                                value={entry.worker_name}
                                                onChange={(selectedName) => updateRow(idx, 'worker_name', selectedName)}
                                                getOptionLabel={(option) => option.name}
                                                getOptionValue={(option) => option.name}
                                                placeholder={workers.length ? 'Select worker' : 'No workers yet'}
                                                searchPlaceholder="Search workers..."
                                                emptyMessage="No workers found"
                                                disabled={workers.length === 0}
                                                clearable
                                                style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                                dropdownWidth={320}
                                            />
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <select value={entry.worker_role} onChange={(e) => updateRow(idx, 'worker_role', e.target.value)} style={inputStyle}>
                                                {['Foreman', 'Skilled', 'Labor'].map((r) => (
                                                    <option key={r} value={r}>
                                                        {r}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <select value={entry.project_id ?? ''} onChange={(e) => updateRow(idx, 'project_id', e.target.value)} style={inputStyle}>
                                                <option value="">Select project (optional)</option>
                                                {projects.map((project) => (
                                                    <option key={project.id} value={project.id}>
                                                        {project.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <input type="time" value={entry.time_in ?? ''} onChange={(e) => updateRow(idx, 'time_in', e.target.value)} style={{ ...inputStyle, minWidth: 110 }} />
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <input type="time" value={entry.time_out ?? ''} onChange={(e) => updateRow(idx, 'time_out', e.target.value)} style={{ ...inputStyle, minWidth: 110 }} />
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <input type="number" step="0.1" min="0" value={entry.hours} onChange={(e) => updateRow(idx, 'hours', e.target.value)} style={{ ...inputStyle, width: 80 }} />
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
                                {workers.length === 0 ? ' Add workers first in the Workers page to use the worker dropdown.' : ''}
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
                        <div style={{ fontWeight: 700, marginBottom: 12 }}>My Attendance Logs</div>
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
                        />
                    </div>
                </div>
            </Layout>
        </>
    );
}
