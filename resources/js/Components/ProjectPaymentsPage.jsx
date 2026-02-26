import Layout from './Layout';
import DataTable from './DataTable';
import Modal from './Modal';
import DatePickerInput from './DatePickerInput';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
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
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
};

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProjectPaymentsPage({ project, payments = [], paymentTable = {} }) {
    const { auth, flash } = usePage().props;
    const [paymentToDelete, setPaymentToDelete] = useState(null);

    const {
        data,
        setData,
        post,
        processing,
        errors,
        reset,
    } = useForm({
        amount: '',
        date_paid: '',
        reference: '',
        note: '',
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    const table = {
        search: paymentTable?.search ?? '',
        perPage: Number(paymentTable?.per_page ?? 10),
        page: Number(paymentTable?.current_page ?? 1),
        lastPage: Number(paymentTable?.last_page ?? 1),
        total: Number(paymentTable?.total ?? payments.length ?? 0),
        from: paymentTable?.from ?? null,
        to: paymentTable?.to ?? null,
    };

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
        const qs = new URLSearchParams(queryParams(overrides)).toString();
        return qs ? `?${qs}` : '';
    };

    const navigateTable = (overrides = {}) => {
        router.get(`/projects/${project.id}/payments`, queryParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitPayment = (event) => {
        event.preventDefault();
        post(`/projects/${project.id}/payments${queryString({ page: 1 })}`, {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: () => toast.error('Unable to save payment.'),
        });
    };

    const deletePayment = () => {
        if (!paymentToDelete) return;

        router.delete(`/payments/${paymentToDelete.id}${queryString()}`, {
            preserveScroll: true,
            onSuccess: () => setPaymentToDelete(null),
            onError: () => toast.error('Unable to delete payment.'),
            onFinish: () => setPaymentToDelete(null),
        });
    };

    const columns = [
        {
            key: 'date_paid',
            label: 'Date Paid',
            render: (payment) => payment.date_paid || '-',
            searchAccessor: (payment) => payment.date_paid,
        },
        {
            key: 'amount',
            label: 'Amount',
            align: 'right',
            render: (payment) => <span style={{ fontWeight: 700 }}>{money(payment.amount)}</span>,
            searchAccessor: (payment) => payment.amount,
        },
        {
            key: 'reference',
            label: 'Reference',
            render: (payment) => payment.reference || '-',
            searchAccessor: (payment) => payment.reference,
        },
        {
            key: 'note',
            label: 'Note',
            render: (payment) => payment.note || '-',
            searchAccessor: (payment) => payment.note,
        },
        {
            key: 'created_at',
            label: 'Created At',
            render: (payment) => payment.created_at || '-',
            searchAccessor: (payment) => payment.created_at,
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (payment) => (
                <button
                    type="button"
                    onClick={() => setPaymentToDelete(payment)}
                    style={{
                        background: 'rgba(239,68,68,0.14)',
                        color: '#f87171',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 8,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontSize: 12,
                    }}
                >
                    Delete
                </button>
            ),
        },
    ];

    const backHref = auth?.user?.role === 'head_admin' ? `/projects/${project.id}` : '/hr';

    return (
        <>
            <Head title={`Payments - Project #${project.id}`} />
            <Layout title={`Payments - ${project.name}`}>
                <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <Link
                            href={backHref}
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
                            Back
                        </Link>

                        <Link
                            href={`/projects/${project.id}/financials`}
                            style={{
                                background: 'var(--button-bg)',
                                color: 'var(--text-main)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                padding: '8px 12px',
                                fontSize: 13,
                                fontWeight: 700,
                                textDecoration: 'none',
                            }}
                        >
                            Open Financials
                        </Link>
                    </div>
                </div>

                <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Contract Amount</div>
                        <div style={{ fontWeight: 700 }}>{money(project.contract_amount)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Client Payment</div>
                        <div style={{ fontWeight: 700 }}>{money(project.total_client_payment)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Remaining Balance</div>
                        <div style={{ fontWeight: 700, color: Number(project.remaining_balance) < 0 ? '#f87171' : '#4ade80' }}>
                            {money(project.remaining_balance)}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last Paid Date</div>
                        <div style={{ fontWeight: 700 }}>{project.last_paid_date || '-'}</div>
                    </div>
                </div>

                <form onSubmit={submitPayment} style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Amount</div>
                        <input type="number" min="0" step="0.01" value={data.amount} onChange={(event) => setData('amount', event.target.value)} style={inputStyle} />
                        {errors.amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.amount}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Date Paid</div>
                        <DatePickerInput
                            value={data.date_paid}
                            onChange={(value) => setData('date_paid', value || '')}
                            style={inputStyle}
                        />
                        {errors.date_paid && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.date_paid}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Reference</div>
                        <input value={data.reference} onChange={(event) => setData('reference', event.target.value)} style={inputStyle} placeholder="Receipt no., bank ref, etc." />
                        {errors.reference && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.reference}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Note</div>
                        <input value={data.note} onChange={(event) => setData('note', event.target.value)} style={inputStyle} placeholder="Optional note" />
                        {errors.note && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.note}</div>}
                    </label>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            type="submit"
                            disabled={processing}
                            style={{
                                background: 'var(--success)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '10px 16px',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: processing ? 'not-allowed' : 'pointer',
                                opacity: processing ? 0.7 : 1,
                            }}
                        >
                            {processing ? 'Saving...' : 'Add Payment'}
                        </button>
                    </div>
                </form>

                <div style={cardStyle}>
                    <DataTable
                        columns={columns}
                        rows={payments}
                        rowKey="id"
                        searchPlaceholder="Search payments..."
                        emptyMessage="No payments yet."
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

                <Modal
                    open={Boolean(paymentToDelete)}
                    onClose={() => setPaymentToDelete(null)}
                    title="Delete Payment"
                    maxWidth={500}
                >
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-main)' }}>
                            Delete this payment ({money(paymentToDelete?.amount)})?
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => setPaymentToDelete(null)}
                                style={{
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={deletePayment}
                                style={{
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </Modal>
            </Layout>
        </>
    );
}
