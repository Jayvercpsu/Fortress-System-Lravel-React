import Layout from '../../Components/Layout';
import DataTable from '../../Components/DataTable';
import DatePickerInput from '../../Components/DatePickerInput';
import SearchableDropdown from '../../Components/SearchableDropdown';
import Modal from '../../Components/Modal';
import ActionButton from '../../Components/ActionButton';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    boxSizing: 'border-box',
};

const money = (value) => `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });

const statusPill = (status) => {
    const colors = {
        pending: '#94a3b8',
        ready: '#f59e0b',
        approved: '#10b981',
        paid: '#60a5fa',
    };
    const color = colors[status] || 'var(--text-muted)';
    return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 999,
        border: `1px solid ${color}33`,
        background: `${color}14`,
        color,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'capitalize',
    };
};

export default function PayrollRun({
    cutoffs = [],
    selectedCutoff = null,
    payrollRows = [],
    payrollTable = {},
    today = '',
}) {
    const [selectedPayrollId, setSelectedPayrollId] = useState(null);
    const [showDeductionsModal, setShowDeductionsModal] = useState(false);
    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);

    const table = {
        search: payrollTable?.search ?? '',
        perPage: Number(payrollTable?.per_page ?? 10),
        page: Number(payrollTable?.current_page ?? 1),
        lastPage: Number(payrollTable?.last_page ?? 1),
        total: Number(payrollTable?.total ?? 0),
        from: payrollTable?.from ?? null,
        to: payrollTable?.to ?? null,
    };

    const generateForm = useForm({
        start_date: selectedCutoff?.start_date ?? '',
        end_date: selectedCutoff?.end_date ?? '',
    });

    const deductionForm = useForm({
        type: 'cash_advance',
        amount: '',
        note: '',
    });

    const markPaidForm = useForm({
        cutoff_id: selectedCutoff?.id ?? '',
        payment_reference: '',
        bank_export_ref: '',
    });

    useEffect(() => {
        if (!generateForm.data.start_date && selectedCutoff?.start_date) {
            generateForm.setData('start_date', selectedCutoff.start_date);
        }
        if (!generateForm.data.end_date && selectedCutoff?.end_date) {
            generateForm.setData('end_date', selectedCutoff.end_date);
        }
        markPaidForm.setData('cutoff_id', selectedCutoff?.id ?? '');
    }, [selectedCutoff?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectedPayroll = useMemo(
        () => payrollRows.find((row) => Number(row.id) === Number(selectedPayrollId)) || null,
        [payrollRows, selectedPayrollId]
    );

    useEffect(() => {
        if (showDeductionsModal && selectedPayrollId && !selectedPayroll) {
            setShowDeductionsModal(false);
            setSelectedPayrollId(null);
        }
    }, [showDeductionsModal, selectedPayrollId, selectedPayroll]);

    const buildQuery = (overrides = {}) => {
        const params = {
            cutoff_id: overrides.cutoff_id !== undefined ? overrides.cutoff_id : selectedCutoff?.id,
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };

        return Object.fromEntries(
            Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== '')
        );
    };

    const queryString = (overrides = {}) => {
        const params = new URLSearchParams(buildQuery(overrides));
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    };

    const navigateTable = (overrides = {}) => {
        router.get('/payroll/run', buildQuery(overrides), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const submitGenerate = (e) => {
        e.preventDefault();
        generateForm.post('/payroll/run/generate', {
            preserveScroll: true,
            onSuccess: () => toast.success('Payroll generated from attendance.'),
            onError: () => toast.error('Unable to generate payroll. Check cutoff dates and attendance records.'),
        });
    };

    const openDeductions = (row) => {
        setSelectedPayrollId(row.id);
        deductionForm.reset();
        deductionForm.setData({ type: 'cash_advance', amount: '', note: '' });
        setShowDeductionsModal(true);
    };

    const submitDeduction = (e) => {
        e.preventDefault();
        if (!selectedPayroll) return;

        deductionForm.post(`/payroll/${selectedPayroll.id}/deductions${queryString()}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                deductionForm.reset();
                deductionForm.setData({ type: 'cash_advance', amount: '', note: '' });
                toast.success('Deduction added.');
            },
            onError: () => toast.error('Unable to add deduction.'),
        });
    };

    const deleteDeduction = (deductionId) => {
        if (!selectedPayroll) return;

        router.delete(`/payroll-deductions/${deductionId}${queryString()}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => toast.success('Deduction removed.'),
            onError: () => toast.error('Unable to remove deduction.'),
        });
    };

    const submitMarkPaid = (e) => {
        e.preventDefault();
        if (!selectedCutoff?.id) return;

        markPaidForm.post(`/payroll/run/mark-paid${queryString()}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setShowMarkPaidModal(false);
                toast.success('Payroll cutoff marked as paid.');
            },
            onError: () => toast.error('Unable to mark cutoff as paid.'),
        });
    };

    const columns = [
        { key: 'worker_name', label: 'Worker', render: (row) => <div style={{ fontWeight: 700 }}>{row.worker_name}</div>, searchAccessor: (row) => row.worker_name },
        { key: 'role', label: 'Role', width: 120 },
        { key: 'hours', label: 'Hours', width: 100, align: 'right', render: (row) => <span style={{ fontFamily: "'DM Mono', monospace" }}>{num(row.hours)}</span> },
        { key: 'rate_per_hour', label: 'Rate', width: 120, align: 'right', render: (row) => <span style={{ fontFamily: "'DM Mono', monospace" }}>{money(row.rate_per_hour)}</span> },
        { key: 'gross', label: 'Gross', width: 120, align: 'right', render: (row) => <span style={{ fontFamily: "'DM Mono', monospace" }}>{money(row.gross)}</span> },
        { key: 'deductions', label: 'Deductions', width: 120, align: 'right', render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", color: '#f87171' }}>{money(row.deductions)}</span> },
        { key: 'net', label: 'Net Pay', width: 120, align: 'right', render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: '#4ade80' }}>{money(row.net)}</span> },
        { key: 'status', label: 'Status', width: 100, render: (row) => <span style={statusPill(row.status)}>{row.status}</span> },
        {
            key: 'actions',
            label: 'Actions',
            width: 140,
            align: 'right',
            render: (row) => (
                <ActionButton
                    type="button"
                    variant={row.can_edit_deductions ? 'edit' : 'neutral'}
                    disabled={!row.can_edit_deductions}
                    onClick={() => openDeductions(row)}
                >
                    Deductions
                </ActionButton>
            ),
        },
    ];

    const cutoffSelectControl = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>View Cutoff</span>
            <div style={{ minWidth: 280, width: 340 }}>
                <SearchableDropdown
                    options={cutoffs.map((cutoff) => ({
                        id: cutoff.id,
                        label: `${cutoff.start_date} to ${cutoff.end_date} (${cutoff.status})`,
                    }))}
                    value={selectedCutoff?.id ?? ''}
                    onChange={(value) => navigateTable({ cutoff_id: value || '', page: 1 })}
                    placeholder="Select cutoff"
                    searchPlaceholder="Search cutoffs..."
                    emptyMessage="No cutoffs found"
                />
            </div>
        </div>
    );

    return (
        <>
            <Head title="Payroll Run" />
            <Layout title="Payroll Run">
                <div style={{ display: 'grid', gap: 16 }}>
                    <form onSubmit={submitGenerate} style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 28,
                                flexWrap: 'wrap',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-start', paddingTop: 24, gap: 8, flexWrap: 'wrap' }}>
                                <ActionButton href="/payroll/worker-rates" variant="success" style={{ padding: '10px 16px', fontSize: 13 }}>
                                    Worker Rates
                                </ActionButton>
                                <ActionButton href="/payroll" variant="success" style={{ padding: '10px 16px', fontSize: 13 }}>
                                    Manual Payroll
                                </ActionButton>
                            </div>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, minmax(220px, 320px)) auto',
                                    gap: 12,
                                    alignItems: 'start',
                                    justifyContent: 'start',
                                }}
                            >
                                <label style={{ display: 'grid', alignContent: 'start' }}>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Cutoff Start</div>
                                    <DatePickerInput
                                        value={generateForm.data.start_date}
                                        onChange={(value) => generateForm.setData('start_date', value)}
                                        style={inputStyle}
                                        maxDate={today || undefined}
                                    />
                                    {generateForm.errors.start_date ? (
                                        <div style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>
                                            {generateForm.errors.start_date}
                                        </div>
                                    ) : null}
                                </label>

                                <label style={{ display: 'grid', alignContent: 'start' }}>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Cutoff End</div>
                                    <DatePickerInput
                                        value={generateForm.data.end_date}
                                        onChange={(value) => generateForm.setData('end_date', value)}
                                        style={inputStyle}
                                        minDate={generateForm.data.start_date || undefined}
                                        maxDate={today || undefined}
                                    />
                                    {generateForm.errors.end_date ? (
                                        <div style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>
                                            {generateForm.errors.end_date}
                                        </div>
                                    ) : null}
                                </label>

                                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'start', paddingTop: 24 }}>
                                    <ActionButton type="submit" variant="success" disabled={generateForm.processing} style={{ padding: '10px 16px', fontSize: 13 }}>
                                        {generateForm.processing ? 'Generating...' : 'Generate Payroll'}
                                    </ActionButton>
                                </div>
                            </div>
                        </div>
                    </form>

                    {selectedCutoff ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                                <div style={cardStyle}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Cutoff</div>
                                    <div style={{ fontWeight: 700 }}>{selectedCutoff.start_date} to {selectedCutoff.end_date}</div>
                                    <div style={{ marginTop: 6 }}><span style={statusPill(selectedCutoff.status)}>{selectedCutoff.status}</span></div>
                                </div>
                                <div style={cardStyle}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Hours / Rows</div>
                                    <div style={{ fontWeight: 700 }}>{num(selectedCutoff.total_hours)} hrs</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedCutoff.payroll_count} payroll rows</div>
                                </div>
                                <div style={cardStyle}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Gross / Deductions</div>
                                    <div style={{ fontWeight: 700 }}>{money(selectedCutoff.total_gross)}</div>
                                    <div style={{ fontSize: 12, color: '#f87171' }}>- {money(selectedCutoff.total_deductions)}</div>
                                </div>
                                <div style={cardStyle}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Net Pay</div>
                                    <div style={{ fontWeight: 700, color: '#4ade80' }}>{money(selectedCutoff.total_net)}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedCutoff.paid_count} paid rows</div>
                                </div>
                            </div>

                            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Rates are reused from the latest payroll history per worker (or role fallback). Rows with zero rates can still be handled in the manual payroll page.
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <ActionButton
                                        type="button"
                                        variant="success"
                                        onClick={() => {
                                            markPaidForm.setData('cutoff_id', selectedCutoff.id);
                                            setShowMarkPaidModal(true);
                                        }}
                                        disabled={selectedCutoff.status === 'paid' || selectedCutoff.payroll_count === 0}
                                    >
                                        Mark Paid
                                    </ActionButton>
                                    <ActionButton href={`/payroll/export?cutoff_id=${selectedCutoff.id}`} external variant="neutral">
                                        Export CSV
                                    </ActionButton>
                                </div>
                            </div>

                            <div style={cardStyle}>
                                <DataTable
                                    columns={columns}
                                    rows={payrollRows}
                                    rowKey="id"
                                    searchPlaceholder="Search payroll rows..."
                                    emptyMessage="No payroll rows generated for this cutoff."
                                    topLeftExtra={cutoffSelectControl}
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
                        </>
                    ) : (
                        <div style={{ ...cardStyle, color: 'var(--text-muted)' }}>
                            No payroll cutoff selected yet. Generate a cutoff to build payroll from attendance.
                        </div>
                    )}
                </div>

                <Modal
                    open={showDeductionsModal && !!selectedPayroll}
                    onClose={() => setShowDeductionsModal(false)}
                    title={selectedPayroll ? `Deductions - ${selectedPayroll.worker_name}` : 'Deductions'}
                    maxWidth={840}
                >
                    {selectedPayroll && (
                        <div style={{ display: 'grid', gap: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                                <div style={cardStyle}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gross Pay</div>
                                    <div style={{ fontWeight: 700 }}>{money(selectedPayroll.gross)}</div>
                                </div>
                                <div style={cardStyle}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Deductions</div>
                                    <div style={{ fontWeight: 700, color: '#f87171' }}>{money(selectedPayroll.deductions)}</div>
                                </div>
                                <div style={cardStyle}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Salary Balance / Net Pay</div>
                                    <div style={{ fontWeight: 700, color: '#4ade80' }}>{money(selectedPayroll.net)}</div>
                                </div>
                            </div>

                            <form onSubmit={submitDeduction} style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                                <div style={{ fontWeight: 700 }}>Add Deduction</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '160px 160px minmax(0, 1fr) auto', gap: 10, alignItems: 'end' }}>
                                    <label>
                                        <div style={{ fontSize: 12, marginBottom: 6 }}>Type</div>
                                        <select value={deductionForm.data.type} onChange={(e) => deductionForm.setData('type', e.target.value)} style={inputStyle}>
                                            <option value="cash_advance">Cash Advance</option>
                                            <option value="loan">Loan</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </label>

                                    <label>
                                        <div style={{ fontSize: 12, marginBottom: 6 }}>Amount</div>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={deductionForm.data.amount}
                                            onChange={(e) => deductionForm.setData('amount', e.target.value)}
                                            style={inputStyle}
                                        />
                                    </label>

                                    <label>
                                        <div style={{ fontSize: 12, marginBottom: 6 }}>Note (optional)</div>
                                        <input value={deductionForm.data.note} onChange={(e) => deductionForm.setData('note', e.target.value)} style={inputStyle} />
                                    </label>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <ActionButton type="submit" variant="success" disabled={deductionForm.processing || !selectedPayroll.can_edit_deductions}>
                                            Add
                                        </ActionButton>
                                    </div>
                                </div>
                                {(deductionForm.errors.type || deductionForm.errors.amount || deductionForm.errors.note || deductionForm.errors.payroll) && (
                                    <div style={{ color: '#f87171', fontSize: 12 }}>
                                        {deductionForm.errors.type || deductionForm.errors.amount || deductionForm.errors.note || deductionForm.errors.payroll}
                                    </div>
                                )}
                            </form>

                            <div style={cardStyle}>
                                <div style={{ fontWeight: 700, marginBottom: 10 }}>Deduction Items</div>
                                {selectedPayroll.deduction_items?.length ? (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {selectedPayroll.deduction_items.map((item) => (
                                            <div
                                                key={item.id}
                                                style={{
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 10,
                                                    padding: 10,
                                                    display: 'grid',
                                                    gridTemplateColumns: '140px 120px minmax(0, 1fr) auto',
                                                    gap: 10,
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <div style={{ fontSize: 12, textTransform: 'capitalize' }}>{String(item.type).replace('_', ' ')}</div>
                                                <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: '#f87171' }}>{money(item.amount)}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.note || '-'}</div>
                                                <ActionButton
                                                    type="button"
                                                    variant="danger"
                                                    disabled={!selectedPayroll.can_edit_deductions}
                                                    onClick={() => deleteDeduction(item.id)}
                                                >
                                                    Delete
                                                </ActionButton>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No deductions yet.</div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>

                <Modal
                    open={showMarkPaidModal && !!selectedCutoff}
                    onClose={() => setShowMarkPaidModal(false)}
                    title="Finalize Payroll Cutoff"
                    maxWidth={680}
                >
                    {selectedCutoff && (
                        <form onSubmit={submitMarkPaid} style={{ display: 'grid', gap: 14 }}>
                            <div style={{ ...cardStyle, display: 'grid', gap: 4 }}>
                                <div style={{ fontWeight: 700 }}>
                                    Cutoff: {selectedCutoff.start_date} to {selectedCutoff.end_date}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Marking this cutoff as paid will lock deductions and store release tracking on all rows.
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Payment Reference (optional)</div>
                                    <input
                                        value={markPaidForm.data.payment_reference}
                                        onChange={(e) => markPaidForm.setData('payment_reference', e.target.value)}
                                        style={inputStyle}
                                    />
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Bank Export Ref (optional)</div>
                                    <input
                                        value={markPaidForm.data.bank_export_ref}
                                        onChange={(e) => markPaidForm.setData('bank_export_ref', e.target.value)}
                                        style={inputStyle}
                                    />
                                </label>
                            </div>

                            {(markPaidForm.errors.cutoff_id || markPaidForm.errors.payroll) && (
                                <div style={{ color: '#f87171', fontSize: 12 }}>
                                    {markPaidForm.errors.cutoff_id || markPaidForm.errors.payroll}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <ActionButton type="button" variant="neutral" onClick={() => setShowMarkPaidModal(false)}>
                                    Cancel
                                </ActionButton>
                                <ActionButton type="submit" variant="success" disabled={markPaidForm.processing}>
                                    {markPaidForm.processing ? 'Saving...' : 'Confirm Mark Paid'}
                                </ActionButton>
                            </div>
                        </form>
                    )}
                </Modal>
            </Layout>
        </>
    );
}
