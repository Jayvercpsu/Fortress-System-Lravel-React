import Layout from '../../../Components/Layout';
import ActionButton from '../../../Components/ActionButton';
import DataTable from '../../../Components/DataTable';
import DatePickerInput from '../../../Components/DatePickerInput';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

const today = () => new Date().toISOString().slice(0, 10);

export default function HeadAdminBuildShow({
    projectId,
    build,
    expenses = [],
    expenseTotal = 0,
    expenseCategoryTotals = [],
    materialOptions = [],
    expenseTable = {},
}) {
    const [activeTab, setActiveTab] = useState(() => {
        const tab = new URLSearchParams(window.location.search).get('tab');
        return tab === 'expenses' ? 'expenses' : 'tracker';
    });
    const [editingExpenseId, setEditingExpenseId] = useState(null);

    const { data, setData, patch, processing, errors } = useForm({
        construction_contract: build.construction_contract ?? 0,
        total_client_payment: build.total_client_payment ?? 0,
    });

    const availableCategories = Array.isArray(materialOptions) ? materialOptions : [];

    const {
        data: expenseData,
        setData: setExpenseData,
        post: postExpense,
        processing: creatingExpense,
        errors: expenseErrors,
        reset: resetExpense,
    } = useForm({
        category: availableCategories[0] ?? '',
        amount: '',
        note: '',
        date: today(),
    });

    const {
        data: editData,
        setData: setEditData,
        patch: patchExpense,
        processing: updatingExpense,
        errors: editErrors,
    } = useForm({
        category: '',
        amount: '',
        note: '',
        date: today(),
    });

    const totalExpenseAmount = Number(expenseTotal || 0);
    const expenseBreakdown = Array.isArray(expenseCategoryTotals) ? expenseCategoryTotals : [];
    const expenseTableState = {
        search: expenseTable?.search ?? '',
        perPage: Number(expenseTable?.per_page ?? 5),
        page: Number(expenseTable?.current_page ?? 1),
        lastPage: Number(expenseTable?.last_page ?? 1),
        total: Number(expenseTable?.total ?? expenses.length ?? 0),
        from: expenseTable?.from ?? null,
        to: expenseTable?.to ?? null,
    };
    const totalExpenses = totalExpenseAmount;
    const remainingBudget = Number(data.total_client_payment || 0) - totalExpenses;
    const budgetVsActual = Number(data.construction_contract || 0) - totalExpenses;
    const paymentProgress =
        Number(data.construction_contract || 0) > 0
            ? (Number(data.total_client_payment || 0) / Number(data.construction_contract || 0)) * 100
            : 0;
    const remainingIncome = Number(data.construction_contract || 0) - totalExpenseAmount;

    useEffect(() => {
        const url = new URL(window.location.href);
        if (activeTab === 'expenses') {
            url.searchParams.set('tab', 'expenses');
        } else {
            url.searchParams.delete('tab');
        }
        window.history.replaceState({}, '', url.toString());
    }, [activeTab]);

    useEffect(() => {
        if (availableCategories.length === 0) return;
        if (!expenseData.category || !availableCategories.includes(expenseData.category)) {
            setExpenseData('category', availableCategories[0]);
        }
    }, [availableCategories, expenseData.category]);

    const buildExpenseQueryParams = (overrides = {}) => {
        const params = {
            tab: 'expenses',
            expense_search:
                overrides.expense_search !== undefined ? overrides.expense_search : expenseTableState.search,
            expense_per_page:
                overrides.expense_per_page !== undefined ? overrides.expense_per_page : expenseTableState.perPage,
            expense_page:
                overrides.expense_page !== undefined ? overrides.expense_page : expenseTableState.page,
        };

        if (!params.expense_search) delete params.expense_search;
        return params;
    };

    const navigateExpenseTable = (overrides = {}) => {
        router.get(`/projects/${projectId}/build`, buildExpenseQueryParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const expenseActionQuery = (overrides = {}) => {
        const params = new URLSearchParams(buildExpenseQueryParams(overrides));
        const queryString = params.toString();
        return queryString ? `?${queryString}` : '';
    };

    const submit = (e) => {
        e.preventDefault();
        patch(`/projects/${projectId}/build`, {
            preserveScroll: true,
            onSuccess: () => toast.success('Build tracker updated.'),
            onError: () => toast.error('Please fix the highlighted fields and try again.'),
        });
    };

    const submitExpense = (e) => {
        e.preventDefault();
        postExpense(`/projects/${projectId}/expenses${expenseActionQuery({ expense_page: 1 })}`, {
            preserveScroll: true,
            onSuccess: () => {
                resetExpense('category', 'amount', 'note');
                setExpenseData('date', today());
                toast.success('Expense added.');
            },
            onError: () => toast.error('Unable to add expense. Check the form fields.'),
        });
    };

    const startEditExpense = (expense) => {
        setEditingExpenseId(expense.id);
        setEditData({
            category: expense.category ?? '',
            amount: expense.amount ?? '',
            note: expense.note ?? '',
            date: expense.date ?? today(),
        });
    };

    const submitEditExpense = (e, expenseId) => {
        e.preventDefault();
        patchExpense(`/expenses/${expenseId}${expenseActionQuery()}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingExpenseId(null);
                toast.success('Expense updated.');
            },
            onError: () => toast.error('Unable to update expense.'),
        });
    };

    const deleteExpense = (expenseId) => {
        router.delete(`/expenses/${expenseId}${expenseActionQuery()}`, {
            preserveScroll: true,
            onSuccess: () => toast.success('Expense deleted.'),
            onError: () => toast.error('Unable to delete expense.'),
        });
    };

    const expenseTableColumns = [
        {
            key: 'category',
            label: 'Category',
            render: (expense) =>
                editingExpenseId === expense.id ? (
                    <select value={editData.category} onChange={(e) => setEditData('category', e.target.value)} style={inputStyle}>
                        {Array.from(new Set([...(availableCategories || []), editData.category].filter(Boolean))).map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{expense.category || '-'}</div>
                ),
            searchAccessor: (expense) => expense.category,
        },
        {
            key: 'date',
            label: 'Date',
            render: (expense) =>
                editingExpenseId === expense.id ? (
                    <DatePickerInput value={editData.date} onChange={(value) => setEditData('date', value)} style={inputStyle} />
                ) : (
                    <div style={{ fontSize: 13 }}>{expense.date || '-'}</div>
                ),
            searchAccessor: (expense) => expense.date,
        },
        {
            key: 'note',
            label: 'Note',
            render: (expense) =>
                editingExpenseId === expense.id ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                        <input value={editData.note} onChange={(e) => setEditData('note', e.target.value)} style={inputStyle} />
                        {(editErrors.category || editErrors.amount || editErrors.date || editErrors.note) && (
                            <div style={{ color: '#f87171', fontSize: 12 }}>
                                {editErrors.category || editErrors.amount || editErrors.date || editErrors.note}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ fontSize: 13, color: expense.note ? 'var(--text-main)' : 'var(--text-muted)' }}>{expense.note || '-'}</div>
                ),
            searchAccessor: (expense) => expense.note,
        },
        {
            key: 'amount',
            label: 'Amount',
            align: 'right',
            render: (expense) =>
                editingExpenseId === expense.id ? (
                    <input type="number" step="0.01" min="0" value={editData.amount} onChange={(e) => setEditData('amount', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                ) : (
                    <div style={{ fontWeight: 700 }}>{money(expense.amount)}</div>
                ),
            searchAccessor: (expense) => expense.amount,
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (expense) =>
                editingExpenseId === expense.id ? (
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                        <ActionButton type="button" variant="neutral" onClick={() => setEditingExpenseId(null)}>
                            Cancel
                        </ActionButton>
                        <ActionButton
                            type="button"
                            variant="success"
                            onClick={(e) => submitEditExpense(e, expense.id)}
                            disabled={updatingExpense}
                        >
                            Save
                        </ActionButton>
                    </div>
                ) : (
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                        <ActionButton type="button" variant="edit" onClick={() => startEditExpense(expense)}>
                            Edit
                        </ActionButton>
                        <ActionButton type="button" variant="danger" onClick={() => deleteExpense(expense.id)}>
                            Delete
                        </ActionButton>
                    </div>
                ),
        },
    ];

    return (
        <>
            <Head title={`Build Tracker #${projectId}`} />
            <Layout title={`Build Tracker - Project #${projectId}`}>
                <div style={{ marginBottom: 12 }}>
                    <Link
                        href={`/projects/${projectId}`}
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
                        Back to Project
                    </Link>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('tracker')}
                        style={{
                            border: '1px solid var(--border-color)',
                            background: activeTab === 'tracker' ? 'var(--active-bg)' : 'var(--button-bg)',
                            color: activeTab === 'tracker' ? 'var(--active-text)' : 'var(--text-main)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            cursor: 'pointer',
                        }}
                    >
                        Tracker
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('expenses')}
                        style={{
                            border: '1px solid var(--border-color)',
                            background: activeTab === 'expenses' ? 'var(--active-bg)' : 'var(--button-bg)',
                            color: activeTab === 'expenses' ? 'var(--active-text)' : 'var(--text-main)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            cursor: 'pointer',
                        }}
                    >
                        Expenses
                    </button>
                </div>

                {activeTab === 'tracker' && (
                    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
                        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Total Expenses</div>
                                <div style={{ fontWeight: 700 }}>{money(totalExpenses)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Remaining Budget</div>
                                <div style={{ fontWeight: 700, color: remainingBudget < 0 ? '#f87171' : '#4ade80' }}>{money(remainingBudget)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Budget vs Actual</div>
                                <div style={{ fontWeight: 700, color: budgetVsActual < 0 ? '#f87171' : '#4ade80' }}>{money(budgetVsActual)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Payment Progress</div>
                                <div style={{ fontWeight: 700 }}>{`${Math.max(0, paymentProgress).toFixed(2)}%`}</div>
                            </div>
                        </div>

                        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Construction Contract</div>
                                <input type="number" step="0.01" min="0" value={data.construction_contract} onChange={(e) => setData('construction_contract', e.target.value)} style={inputStyle} />
                                {errors.construction_contract && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.construction_contract}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Total Client Payment</div>
                                <input type="number" step="0.01" min="0" value={data.total_client_payment} onChange={(e) => setData('total_client_payment', e.target.value)} style={inputStyle} />
                                {errors.total_client_payment && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.total_client_payment}</div>}
                            </label>
                            <div style={{ gridColumn: '1 / -1', border: '1px dashed var(--border-color)', borderRadius: 10, padding: 12 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                    Expense totals below are automatically linked to the Expenses tab and Project Overview.
                                </div>
                                {expenseBreakdown.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No expense entries yet.</div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                        {expenseBreakdown.map((item) => (
                                            <div key={item.category} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 10px' }}>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.category}</div>
                                                <div style={{ fontWeight: 600 }}>{money(item.amount)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                                {processing ? 'Saving...' : 'Save Build Tracker'}
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'expenses' && (
                    <div style={{ display: 'grid', gap: 16 }}>
                        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Total Expenses</div>
                                <div style={{ fontWeight: 700 }}>{money(expenseTotal)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Remaining Income</div>
                                <div style={{ fontWeight: 700, color: remainingIncome < 0 ? '#f87171' : '#4ade80' }}>{money(remainingIncome)}</div>
                            </div>
                        </div>

                        <form onSubmit={submitExpense} style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Category</div>
                                <select value={expenseData.category} onChange={(e) => setExpenseData('category', e.target.value)} style={inputStyle} disabled={availableCategories.length === 0}>
                                    {availableCategories.length === 0 ? (
                                        <option value="">No materials yet</option>
                                    ) : (
                                        availableCategories.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))
                                    )}
                                </select>
                                {expenseErrors.category && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{expenseErrors.category}</div>}
                                {availableCategories.length === 0 && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                                        Add categories in the `Materials` page first.
                                    </div>
                                )}
                            </label>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Amount</div>
                                <input type="number" step="0.01" min="0" value={expenseData.amount} onChange={(e) => setExpenseData('amount', e.target.value)} style={inputStyle} />
                                {expenseErrors.amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{expenseErrors.amount}</div>}
                            </label>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Date</div>
                                <DatePickerInput value={expenseData.date} onChange={(value) => setExpenseData('date', value)} style={inputStyle} />
                                {expenseErrors.date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{expenseErrors.date}</div>}
                            </label>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Note</div>
                                <input value={expenseData.note} onChange={(e) => setExpenseData('note', e.target.value)} style={inputStyle} />
                                {expenseErrors.note && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{expenseErrors.note}</div>}
                            </label>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="submit"
                                    disabled={creatingExpense || availableCategories.length === 0}
                                    style={{
                                        background: 'var(--success)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 8,
                                        padding: '10px 16px',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: creatingExpense ? 'not-allowed' : 'pointer',
                                        opacity: creatingExpense ? 0.7 : 1,
                                    }}
                                >
                                    {creatingExpense ? 'Adding...' : 'Add Expense'}
                                </button>
                            </div>
                        </form>

                        <div style={{ ...cardStyle }}>
                            <DataTable
                                columns={expenseTableColumns}
                                rows={expenses}
                                rowKey="id"
                                searchPlaceholder="Search expenses..."
                                emptyMessage="No expenses yet."
                                serverSide
                                serverSearchValue={expenseTableState.search}
                                serverPage={expenseTableState.page}
                                serverPerPage={expenseTableState.perPage}
                                serverTotalItems={expenseTableState.total}
                                serverTotalPages={expenseTableState.lastPage}
                                serverFrom={expenseTableState.from}
                                serverTo={expenseTableState.to}
                                onServerSearchChange={(value) => navigateExpenseTable({ expense_search: value, expense_page: 1 })}
                                onServerPerPageChange={(value) => navigateExpenseTable({ expense_per_page: value, expense_page: 1 })}
                                onServerPageChange={(value) => navigateExpenseTable({ expense_page: value })}
                            />
                        </div>
                    </div>
                )}
            </Layout>
        </>
    );
}

