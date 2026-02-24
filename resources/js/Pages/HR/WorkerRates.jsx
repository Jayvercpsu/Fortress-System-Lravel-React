import Layout from '../../Components/Layout';
import DataTable from '../../Components/DataTable';
import ActionButton from '../../Components/ActionButton';
import Modal from '../../Components/Modal';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
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

const mono = { fontFamily: "'DM Mono', monospace" };
const money = (value) =>
    value === null || value === undefined || value === ''
        ? '-'
        : `P ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function WorkerRates({ workerRates = [], workerRateTable = {} }) {
    const { flash } = usePage().props;
    const [editingRow, setEditingRow] = useState(null);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    const table = {
        search: workerRateTable?.search ?? '',
        perPage: Number(workerRateTable?.per_page ?? 10),
        page: Number(workerRateTable?.current_page ?? 1),
        lastPage: Number(workerRateTable?.last_page ?? 1),
        total: Number(workerRateTable?.total ?? workerRates.length ?? 0),
        from: workerRateTable?.from ?? null,
        to: workerRateTable?.to ?? null,
    };

    const form = useForm({
        default_rate_per_hour: '',
    });

    const queryParams = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };
        if (!params.search) delete params.search;
        return params;
    };

    const queryString = (overrides = {}) => {
        const params = new URLSearchParams(queryParams(overrides));
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    };

    const navigateTable = (overrides = {}) => {
        router.get('/payroll/worker-rates', queryParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const openEdit = (row) => {
        setEditingRow(row);
        form.setData('default_rate_per_hour', row?.default_rate_per_hour != null ? String(row.default_rate_per_hour) : '');
        form.clearErrors();
    };

    const closeEdit = () => {
        setEditingRow(null);
        form.clearErrors();
    };

    const saveRate = (e) => {
        e.preventDefault();
        if (!editingRow?.id) return;

        const basePath =
            editingRow.entity_type === 'foreman'
                ? `/payroll/foreman-rates/${editingRow.id}`
                : `/payroll/worker-rates/${editingRow.id}`;

        form.patch(`${basePath}${queryString()}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => closeEdit(),
            onError: () => toast.error('Unable to update worker rate.'),
        });
    };

    const columns = useMemo(
        () => [
            {
                key: 'name',
                label: 'Name',
                width: 220,
                render: (row) => <div style={{ fontWeight: 600 }}>{row.name}</div>,
                searchAccessor: (row) => row.name,
            },
            {
                key: 'person_type',
                label: 'Type',
                width: 90,
                render: (row) => row.person_type || '-',
                searchAccessor: (row) => row.person_type,
            },
            {
                key: 'foreman_name',
                label: 'Foreman',
                width: 180,
                render: (row) => (row.entity_type === 'foreman' ? 'Self' : row.foreman_name || '-'),
                searchAccessor: (row) => row.foreman_name,
            },
            {
                key: 'sex',
                label: 'Sex',
                width: 90,
                render: (row) => row.sex || '-',
                searchAccessor: (row) => row.sex,
            },
            {
                key: 'phone',
                label: 'Phone',
                width: 140,
                render: (row) => row.phone || '-',
                searchAccessor: (row) => row.phone,
            },
            {
                key: 'default_rate_per_hour',
                label: 'Default Rate / Hour',
                width: 170,
                align: 'right',
                render: (row) => <span style={mono}>{money(row.default_rate_per_hour)}</span>,
            },
            {
                key: 'actions',
                label: 'Actions',
                width: 110,
                align: 'right',
                render: (row) => (
                    <ActionButton type="button" variant="edit" onClick={() => openEdit(row)}>
                        Edit
                    </ActionButton>
                ),
            },
        ],
        []
    );

    return (
        <>
            <Head title="Worker Rates" />
            <Layout title="Worker Rates">
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

                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>HR Worker Rate Management</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Foreman records attendance only. HR sets default hourly rates for both workers and foremen used by payroll generation.
                            </div>
                        </div>
                    </div>

                    <div style={{ ...cardStyle, padding: 12 }}>
                        <DataTable
                            columns={columns}
                            rows={workerRates}
                            rowKey="id"
                            searchPlaceholder="Search workers / foreman..."
                            emptyMessage="No workers or foremen found."
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

                <Modal
                    open={!!editingRow}
                    onClose={closeEdit}
                    title={editingRow ? `Edit ${editingRow.person_type || 'Rate'} - ${editingRow.name}` : 'Edit Rate'}
                    maxWidth={560}
                >
                    {editingRow && (
                        <form onSubmit={saveRate} style={{ display: 'grid', gap: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>{editingRow.entity_type === 'foreman' ? 'Foreman' : 'Worker'}</div>
                                    <input value={editingRow.name} readOnly style={{ ...inputStyle, opacity: 0.85 }} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>{editingRow.entity_type === 'foreman' ? 'Type' : 'Foreman'}</div>
                                    <input
                                        value={editingRow.entity_type === 'foreman' ? 'Foreman' : editingRow.foreman_name || '-'}
                                        readOnly
                                        style={{ ...inputStyle, opacity: 0.85 }}
                                    />
                                </label>
                            </div>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Default Rate / Hour (P)</div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.data.default_rate_per_hour}
                                    onChange={(e) => form.setData('default_rate_per_hour', e.target.value)}
                                    style={inputStyle}
                                    autoFocus
                                />
                                {form.errors.default_rate_per_hour && (
                                    <div style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{form.errors.default_rate_per_hour}</div>
                                )}
                            </label>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <ActionButton type="button" variant="neutral" onClick={closeEdit}>
                                    Cancel
                                </ActionButton>
                                <ActionButton type="submit" variant="success" disabled={form.processing}>
                                    {form.processing ? 'Saving...' : 'Save Rate'}
                                </ActionButton>
                            </div>
                        </form>
                    )}
                </Modal>
            </Layout>
        </>
    );
}
