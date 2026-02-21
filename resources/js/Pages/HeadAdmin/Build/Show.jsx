import Layout from '../../../Components/Layout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
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

export default function HeadAdminBuildShow({ projectId, build, expenses = [] }) {
    const { flash } = usePage().props;
    const [activeTab, setActiveTab] = useState(() => {
        const tab = new URLSearchParams(window.location.search).get('tab');
        return tab === 'expenses' ? 'expenses' : 'tracker';
    });
    const [editingExpenseId, setEditingExpenseId] = useState(null);

    const { data, setData, patch, processing, errors } = useForm({
        construction_contract: build.construction_contract ?? 0,
        total_client_payment: build.total_client_payment ?? 0,
        materials_cost: build.materials_cost ?? 0,
        labor_cost: build.labor_cost ?? 0,
        equipment_cost: build.equipment_cost ?? 0,
    });

    const {
        data: expenseData,
        setData: setExpenseData,
        post: postExpense,
        processing: creatingExpense,
        errors: expenseErrors,
        reset: resetExpense,
    } = useForm({
        category: 'materials',
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

    const totalExpenses =
        Number(data.materials_cost || 0) + Number(data.labor_cost || 0) + Number(data.equipment_cost || 0);
    const remainingBudget = Number(data.total_client_payment || 0) - totalExpenses;
    const budgetVsActual = Number(data.construction_contract || 0) - totalExpenses;
    const paymentProgress =
        Number(data.construction_contract || 0) > 0
            ? (Number(data.total_client_payment || 0) / Number(data.construction_contract || 0)) * 100
            : 0;

    const expenseTotal = useMemo(
        () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
        [expenses]
    );
    const remainingIncome = Number(data.construction_contract || 0) - expenseTotal;

    useEffect(() => {
        if (flash?.error) toast.error(flash.error);
        if (flash?.success) toast.success(flash.success);
    }, [flash?.error, flash?.success]);

    useEffect(() => {
        const url = new URL(window.location.href);
        if (activeTab === 'expenses') {
            url.searchParams.set('tab', 'expenses');
        } else {
            url.searchParams.delete('tab');
        }
        window.history.replaceState({}, '', url.toString());
    }, [activeTab]);

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
        postExpense(`/projects/${projectId}/expenses`, {
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
        patchExpense(`/expenses/${expenseId}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingExpenseId(null);
                toast.success('Expense updated.');
            },
            onError: () => toast.error('Unable to update expense.'),
        });
    };

    const deleteExpense = (expenseId) => {
        router.delete(`/expenses/${expenseId}`, {
            preserveScroll: true,
            onSuccess: () => toast.success('Expense deleted.'),
            onError: () => toast.error('Unable to delete expense.'),
        });
    };

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

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Materials Cost</div>
                                <input type="number" step="0.01" min="0" value={data.materials_cost} onChange={(e) => setData('materials_cost', e.target.value)} style={inputStyle} />
                                {errors.materials_cost && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.materials_cost}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Labor Cost</div>
                                <input type="number" step="0.01" min="0" value={data.labor_cost} onChange={(e) => setData('labor_cost', e.target.value)} style={inputStyle} />
                                {errors.labor_cost && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.labor_cost}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Equipment Cost</div>
                                <input type="number" step="0.01" min="0" value={data.equipment_cost} onChange={(e) => setData('equipment_cost', e.target.value)} style={inputStyle} />
                                {errors.equipment_cost && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.equipment_cost}</div>}
                            </label>
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
                                <input value={expenseData.category} onChange={(e) => setExpenseData('category', e.target.value)} style={inputStyle} />
                                {expenseErrors.category && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{expenseErrors.category}</div>}
                            </label>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Amount</div>
                                <input type="number" step="0.01" min="0" value={expenseData.amount} onChange={(e) => setExpenseData('amount', e.target.value)} style={inputStyle} />
                                {expenseErrors.amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{expenseErrors.amount}</div>}
                            </label>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Date</div>
                                <input type="date" value={expenseData.date} onChange={(e) => setExpenseData('date', e.target.value)} style={inputStyle} />
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
                                    disabled={creatingExpense}
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

                        <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                            {expenses.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No expenses yet.</div>}

                            {expenses.map((expense) => (
                                <div key={expense.id} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
                                    {editingExpenseId === expense.id ? (
                                        <form onSubmit={(e) => submitEditExpense(e, expense.id)} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                                            <input value={editData.category} onChange={(e) => setEditData('category', e.target.value)} style={inputStyle} />
                                            <input type="number" step="0.01" min="0" value={editData.amount} onChange={(e) => setEditData('amount', e.target.value)} style={inputStyle} />
                                            <input type="date" value={editData.date} onChange={(e) => setEditData('date', e.target.value)} style={inputStyle} />
                                            <input value={editData.note} onChange={(e) => setEditData('note', e.target.value)} style={inputStyle} />
                                            {(editErrors.category || editErrors.amount || editErrors.date || editErrors.note) && (
                                                <div style={{ gridColumn: '1 / -1', color: '#f87171', fontSize: 12 }}>
                                                    {editErrors.category || editErrors.amount || editErrors.date || editErrors.note}
                                                </div>
                                            )}
                                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                <button type="button" onClick={() => setEditingExpenseId(null)} style={{ ...inputStyle, width: 'auto', padding: '8px 12px', cursor: 'pointer' }}>
                                                    Cancel
                                                </button>
                                                <button type="submit" disabled={updatingExpense} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: updatingExpense ? 'not-allowed' : 'pointer', opacity: updatingExpense ? 0.7 : 1 }}>
                                                    Save
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div style={{ display: 'grid', gap: 6 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                                <div style={{ fontWeight: 600 }}>{expense.category}</div>
                                                <div style={{ fontWeight: 700 }}>{money(expense.amount)}</div>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{expense.date}</div>
                                            {expense.note && <div style={{ fontSize: 13 }}>{expense.note}</div>}
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                                                <button type="button" onClick={() => startEditExpense(expense)} style={{ ...inputStyle, width: 'auto', padding: '6px 10px', cursor: 'pointer' }}>
                                                    Edit
                                                </button>
                                                <button type="button" onClick={() => deleteExpense(expense.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Layout>
        </>
    );
}

