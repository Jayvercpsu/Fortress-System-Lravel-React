import Layout from '../../../Components/Layout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
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

export default function HeadAdminDesignShow({ projectId, design }) {
    const { flash } = usePage().props;

    const { data, setData, patch, processing, errors } = useForm({
        design_contract_amount: design.design_contract_amount ?? 0,
        downpayment: design.downpayment ?? 0,
        total_received: design.total_received ?? 0,
        office_payroll_deduction: design.office_payroll_deduction ?? 0,
        design_progress: design.design_progress ?? 0,
        client_approval_status: design.client_approval_status ?? 'pending',
    });

    const remaining = Number(data.design_contract_amount || 0) - Number(data.total_received || 0);
    const netIncome = Number(data.total_received || 0) - Number(data.office_payroll_deduction || 0);

    useEffect(() => {
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash?.error]);

    const submit = (e) => {
        e.preventDefault();
        patch(`/projects/${projectId}/design`, {
            preserveScroll: true,
            onSuccess: () => toast.success('Design tracker updated.'),
            onError: () => toast.error('Please fix the highlighted fields and try again.'),
        });
    };

    return (
        <>
            <Head title={`Design Tracker #${projectId}`} />
            <Layout title={`Design Tracker - Project #${projectId}`}>
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

                <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
                    <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Contract Amount</div>
                            <div style={{ fontWeight: 700 }}>{money(data.design_contract_amount)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Remaining</div>
                            <div style={{ fontWeight: 700, color: remaining < 0 ? '#f87171' : '#4ade80' }}>{money(remaining)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Net Income</div>
                            <div style={{ fontWeight: 700, color: netIncome < 0 ? '#f87171' : '#4ade80' }}>{money(netIncome)}</div>
                        </div>
                    </div>

                    <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Design Contract Amount</div>
                            <input type="number" step="0.01" min="0" value={data.design_contract_amount} onChange={(e) => setData('design_contract_amount', e.target.value)} style={inputStyle} />
                            {errors.design_contract_amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.design_contract_amount}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Downpayment</div>
                            <input type="number" step="0.01" min="0" value={data.downpayment} onChange={(e) => setData('downpayment', e.target.value)} style={inputStyle} />
                            {errors.downpayment && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.downpayment}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Total Received</div>
                            <input type="number" step="0.01" min="0" value={data.total_received} onChange={(e) => setData('total_received', e.target.value)} style={inputStyle} />
                            {errors.total_received && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.total_received}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Office Payroll Deduction</div>
                            <input type="number" step="0.01" min="0" value={data.office_payroll_deduction} onChange={(e) => setData('office_payroll_deduction', e.target.value)} style={inputStyle} />
                            {errors.office_payroll_deduction && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.office_payroll_deduction}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Design Progress (%)</div>
                            <input type="number" min="0" max="100" value={data.design_progress} onChange={(e) => setData('design_progress', e.target.value)} style={inputStyle} />
                            {errors.design_progress && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.design_progress}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Client Approval Status</div>
                            <select value={data.client_approval_status} onChange={(e) => setData('client_approval_status', e.target.value)} style={inputStyle}>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            {errors.client_approval_status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.client_approval_status}</div>}
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
                            {processing ? 'Saving...' : 'Save Design Tracker'}
                        </button>
                    </div>
                </form>
            </Layout>
        </>
    );
}
