import Layout from '../../Components/Layout';
import DataTable from '../../Components/DataTable';
import SearchableDropdown from '../../Components/SearchableDropdown';
import ActionButton from '../../Components/ActionButton';
import Modal from '../../Components/Modal';
import DatePickerInput from '../../Components/DatePickerInput';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

const statusColor = {
    pending: '#8b949e',
    ready: '#fbbf24',
    approved: '#4ade80',
    paid: '#60a5fa',
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text-main)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
};

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const money = (value) => `P${Number(value || 0).toLocaleString()}`;
const mono = { fontFamily: "'DM Mono', monospace" };
const dateOnly = (value) => (value ? String(value).slice(0, 10) : '-');

export default function Payroll({ payrolls = [], totalPayable = 0, workerOptions = [] }) {
    const [showForm, setShowForm] = useState(false);
    const [editingRow, setEditingRow] = useState(null);

    const { data, setData, post, errors, processing, reset } = useForm({
        worker_name: '',
        role: '',
        hours: '',
        rate_per_hour: '',
        deductions: '0',
        week_start: '',
    });

    const editForm = useForm({
        worker_name: '',
        role: '',
        week_start: '',
        hours: '',
        rate_per_hour: '',
        deductions: '0',
        status: 'pending',
    });

    const submit = (e) => {
        e.preventDefault();
        post('/payroll', {
            onSuccess: () => {
                reset();
                setShowForm(false);
            },
        });
    };

    const updateStatus = (id, status) => {
        router.patch(`/payroll/${id}/status`, { status }, { preserveScroll: true, preserveState: true });
    };

    const resolvedWorkerOptions = useMemo(() => {
        const map = new Map();

        const addOption = (raw) => {
            const name = String(raw?.label ?? raw?.name ?? raw?.value ?? '').trim();
            if (!name) return;

            const key = name.toLowerCase();
            const existing = map.get(key) || {
                value: name,
                label: name,
                name,
                role: null,
                default_rate_per_hour: null,
            };

            const nextRole = raw?.role ?? existing.role ?? null;
            const nextRate =
                raw?.default_rate_per_hour !== undefined &&
                raw?.default_rate_per_hour !== null &&
                Number(raw.default_rate_per_hour) > 0
                    ? Number(raw.default_rate_per_hour)
                    : existing.default_rate_per_hour;

            map.set(key, {
                ...existing,
                role: nextRole,
                default_rate_per_hour: nextRate,
            });
        };

        (Array.isArray(workerOptions) ? workerOptions : []).forEach(addOption);
        (Array.isArray(payrolls) ? payrolls : []).forEach((row) =>
            addOption({
                name: row.worker_name,
                role: row.role,
                default_rate_per_hour: row.rate_per_hour,
            })
        );

        return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [workerOptions, payrolls]);

    const handleWorkerSelect = (value, option) => {
        setData('worker_name', value || '');
        if (!value) return;

        if (!String(data.role || '').trim() && option?.role) {
            setData('role', String(option.role));
        }

        const currentRate = Number(data.rate_per_hour || 0);
        if ((!data.rate_per_hour || currentRate <= 0) && option?.default_rate_per_hour != null) {
            setData('rate_per_hour', String(option.default_rate_per_hour));
        }
    };

    const handleEditWorkerSelect = (value, option) => {
        editForm.setData('worker_name', value || '');
        if (!value) return;

        if (!String(editForm.data.role || '').trim() && option?.role) {
            editForm.setData('role', String(option.role));
        }

        const currentRate = Number(editForm.data.rate_per_hour || 0);
        if ((!editForm.data.rate_per_hour || currentRate <= 0) && option?.default_rate_per_hour != null) {
            editForm.setData('rate_per_hour', String(option.default_rate_per_hour));
        }
    };

    const openEditModal = (row) => {
        setEditingRow(row);
        editForm.setData({
            worker_name: row.worker_name ?? '',
            role: row.role ?? '',
            week_start: dateOnly(row.week_start) === '-' ? '' : dateOnly(row.week_start),
            hours: String(row.hours ?? ''),
            rate_per_hour: String(row.rate_per_hour ?? ''),
            deductions: String(row.deductions ?? 0),
            status: row.status ?? 'pending',
        });
        editForm.clearErrors();
    };

    const closeEditModal = () => {
        setEditingRow(null);
        editForm.clearErrors();
    };

    const saveEdit = (e) => {
        e.preventDefault();
        if (!editingRow?.id) return;

        editForm.patch(`/payroll/${editingRow.id}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setEditingRow(null);
                editForm.clearErrors();
            },
        });
    };

    const editGross = useMemo(() => {
        const h = Number(editForm.data.hours || 0);
        const r = Number(editForm.data.rate_per_hour || 0);
        return h * r;
    }, [editForm.data.hours, editForm.data.rate_per_hour]);

    const editNet = useMemo(() => editGross - Number(editForm.data.deductions || 0), [editGross, editForm.data.deductions]);

    const columns = useMemo(
        () => [
            {
                key: 'worker_name',
                label: 'Worker',
                width: 180,
                render: (row) => <div style={{ fontWeight: 600 }}>{row.worker_name}</div>,
                searchAccessor: (row) => row.worker_name,
            },
            {
                key: 'role',
                label: 'Role',
                width: 100,
                render: (row) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.role}</span>,
                searchAccessor: (row) => row.role,
            },
            {
                key: 'week_start',
                label: 'Week',
                width: 130,
                render: (row) => (
                    <span style={{ ...mono, fontSize: 12, color: 'var(--text-muted-2)' }}>{dateOnly(row.week_start)}</span>
                ),
                searchAccessor: (row) => row.week_start,
            },
            {
                key: 'hours',
                label: 'Hours',
                width: 90,
                align: 'right',
                render: (row) => <span style={mono}>{Number(row.hours || 0).toFixed(2)}</span>,
            },
            {
                key: 'rate_per_hour',
                label: 'Rate',
                width: 100,
                align: 'right',
                render: (row) => <span style={mono}>{money(row.rate_per_hour)}</span>,
            },
            {
                key: 'gross',
                label: 'Gross',
                width: 100,
                align: 'right',
                render: (row) => <span style={mono}>{money(row.gross)}</span>,
            },
            {
                key: 'deductions',
                label: 'Deduct',
                width: 110,
                align: 'right',
                render: (row) => <span style={{ ...mono, color: '#f87171' }}>-{money(row.deductions)}</span>,
            },
            {
                key: 'net',
                label: 'Net',
                width: 100,
                align: 'right',
                render: (row) => <span style={{ ...mono, fontWeight: 600, color: '#4ade80' }}>{money(row.net)}</span>,
            },
            {
                key: 'status',
                label: 'Status',
                width: 100,
                render: (row) => (
                    <span
                        style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 20,
                            color: statusColor[row.status] || 'var(--text-muted)',
                            background: `${statusColor[row.status] || '#8b949e'}22`,
                            border: `1px solid ${(statusColor[row.status] || '#8b949e')}44`,
                            textTransform: 'capitalize',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                        }}
                    >
                        {row.status}
                    </span>
                ),
                searchAccessor: (row) => row.status,
            },
            {
                key: 'action',
                label: 'Action',
                width: 110,
                align: 'right',
                render: (row) => (
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                        <ActionButton type="button" variant="edit" onClick={() => openEditModal(row)}>
                            Edit
                        </ActionButton>
                    </div>
                ),
            },
        ],
        [payrolls]
    );

    return (
        <>
            <Head title="Payroll" />
            <Layout title="Payroll Management">
                <div style={{ marginBottom: 12 }}>
                    <Link
                        href="/payroll/run"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            color: 'var(--text-main)',
                            textDecoration: 'none',
                            border: '1px solid var(--border-color)',
                            background: 'var(--button-bg)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontSize: 13,
                        }}
                    >
                        <ArrowLeft size={16} />
                        Back to Payroll Run
                    </Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div style={{ ...cardStyle, padding: '20px 24px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                            Total Payable
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24', fontFamily: "'DM Mono', monospace" }}>
                            {money(totalPayable)}
                        </div>
                    </div>

                    <div
                        style={{
                            ...cardStyle,
                            padding: '20px 24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 8,
                            flexWrap: 'wrap',
                        }}
                    >
                        <button
                            onClick={() => setShowForm((v) => !v)}
                            style={{
                                background: showForm ? 'var(--button-bg)' : 'var(--success)',
                                color: showForm ? 'var(--text-muted)' : '#fff',
                                border: showForm ? '1px solid var(--border-color)' : 'none',
                                borderRadius: 8,
                                padding: '9px 20px',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {showForm ? 'Cancel' : '+ Add Payroll Entry'}
                        </button>
                    </div>
                </div>

                {showForm && (
                    <div style={{ ...cardStyle, padding: 24, marginBottom: 24 }}>
                        <div style={{ fontWeight: 600, marginBottom: 16 }}>New Payroll Entry</div>

                        <form onSubmit={submit}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                                {[
                                    ['Worker Name', 'worker_name', 'text'],
                                    ['Role', 'role', 'text'],
                                    ['Week Start', 'week_start', 'date'],
                                    ['Hours', 'hours', 'number'],
                                    ['Rate / Hour (P)', 'rate_per_hour', 'number'],
                                    ['Deductions (P)', 'deductions', 'number'],
                                ].map(([label, key, type]) => (
                                    <div key={key}>
                                        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>
                                            {label}
                                        </label>
                                        {key === 'worker_name' ? (
                                            <SearchableDropdown
                                                options={resolvedWorkerOptions}
                                                value={data.worker_name}
                                                onChange={handleWorkerSelect}
                                                placeholder="Select worker"
                                                searchPlaceholder="Search workers..."
                                                emptyMessage="No workers found"
                                                clearable
                                                style={{ ...inputStyle, padding: '8px 10px' }}
                                            />
                                        ) : key === 'week_start' ? (
                                            <DatePickerInput
                                                value={data.week_start}
                                                onChange={(value) => setData('week_start', value || '')}
                                                style={inputStyle}
                                            />
                                        ) : (
                                            <input
                                                type={type}
                                                value={data[key]}
                                                onChange={(e) => setData(key, e.target.value)}
                                                style={inputStyle}
                                            />
                                        )}
                                        {errors?.[key] && (
                                            <p style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{errors[key]}</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                style={{
                                    background: 'var(--success)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '9px 24px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    opacity: processing ? 0.7 : 1,
                                }}
                            >
                                {processing ? 'Saving...' : 'Save Entry'}
                            </button>
                        </form>
                    </div>
                )}

                <div style={{ ...cardStyle, padding: 12 }}>
                    <DataTable
                        columns={columns}
                        rows={payrolls}
                        rowKey="id"
                        searchPlaceholder="Search payroll entries..."
                        emptyMessage="No payroll entries yet."
                        initialPageSize={10}
                    />
                </div>

                <Modal
                    open={!!editingRow}
                    onClose={closeEditModal}
                    title={editingRow ? `Edit Payroll - ${editingRow.worker_name}` : 'Edit Payroll'}
                    maxWidth={900}
                >
                    {editingRow && (
                        <form onSubmit={saveEdit} style={{ display: 'grid', gap: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Worker Name</div>
                                    <SearchableDropdown
                                        options={resolvedWorkerOptions}
                                        value={editForm.data.worker_name}
                                        onChange={handleEditWorkerSelect}
                                        placeholder="Select worker"
                                        searchPlaceholder="Search workers..."
                                        emptyMessage="No workers found"
                                        clearable
                                        style={{ ...inputStyle, padding: '8px 10px' }}
                                    />
                                    {editForm.errors.worker_name && (
                                        <div style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{editForm.errors.worker_name}</div>
                                    )}
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Role</div>
                                    <input
                                        type="text"
                                        value={editForm.data.role}
                                        onChange={(e) => editForm.setData('role', e.target.value)}
                                        style={inputStyle}
                                    />
                                    {editForm.errors.role && (
                                        <div style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{editForm.errors.role}</div>
                                    )}
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Week Start</div>
                                    <DatePickerInput
                                        value={editForm.data.week_start}
                                        onChange={(value) => editForm.setData('week_start', value || '')}
                                        style={inputStyle}
                                    />
                                    {editForm.errors.week_start && (
                                        <div style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{editForm.errors.week_start}</div>
                                    )}
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Hours</div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editForm.data.hours}
                                        onChange={(e) => editForm.setData('hours', e.target.value)}
                                        style={inputStyle}
                                    />
                                    {editForm.errors.hours && (
                                        <div style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{editForm.errors.hours}</div>
                                    )}
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Rate / Hour (P)</div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editForm.data.rate_per_hour}
                                        onChange={(e) => editForm.setData('rate_per_hour', e.target.value)}
                                        style={inputStyle}
                                    />
                                    {editForm.errors.rate_per_hour && (
                                        <div style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{editForm.errors.rate_per_hour}</div>
                                    )}
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Deductions (P)</div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editForm.data.deductions}
                                        onChange={(e) => editForm.setData('deductions', e.target.value)}
                                        style={inputStyle}
                                    />
                                    {editForm.errors.deductions && (
                                        <div style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{editForm.errors.deductions}</div>
                                    )}
                                </label>

                                <label style={{ gridColumn: '1 / -1', maxWidth: 220 }}>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                                    <select
                                        value={editForm.data.status}
                                        onChange={(e) => editForm.setData('status', e.target.value)}
                                        style={inputStyle}
                                    >
                                        {['pending', 'ready', 'approved', 'paid'].map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                    {editForm.errors.status && (
                                        <div style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{editForm.errors.status}</div>
                                    )}
                                </label>
                            </div>

                            <div
                                style={{
                                    ...cardStyle,
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                    gap: 12,
                                    padding: 12,
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gross</div>
                                    <div style={{ ...mono, fontWeight: 700 }}>{money(editGross)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Deductions</div>
                                    <div style={{ ...mono, fontWeight: 700, color: '#f87171' }}>-{money(editForm.data.deductions)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Net</div>
                                    <div style={{ ...mono, fontWeight: 700, color: '#4ade80' }}>{money(editNet)}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <ActionButton type="button" variant="neutral" onClick={closeEditModal}>
                                    Cancel
                                </ActionButton>
                                <ActionButton type="submit" variant="success" disabled={editForm.processing}>
                                    {editForm.processing ? 'Saving...' : 'Save Changes'}
                                </ActionButton>
                            </div>
                        </form>
                    )}
                </Modal>
            </Layout>
        </>
    );
}
