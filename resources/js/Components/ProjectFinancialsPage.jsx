import Layout from './Layout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
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

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProjectFinancialsPage({ project }) {
    const { auth, flash } = usePage().props;
    const role = auth?.user?.role;

    const { data, setData, patch, processing, errors } = useForm({
        contract_amount: String(project?.contract_amount ?? 0),
        design_fee: String(project?.design_fee ?? 0),
        construction_cost: String(project?.construction_cost ?? 0),
        total_client_payment: String(project?.total_client_payment ?? 0),
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        setData(() => ({
            contract_amount: String(project?.contract_amount ?? 0),
            design_fee: String(project?.design_fee ?? 0),
            construction_cost: String(project?.construction_cost ?? 0),
            total_client_payment: String(project?.total_client_payment ?? 0),
        }));
    }, [project?.id, project?.contract_amount, project?.design_fee, project?.construction_cost, project?.total_client_payment]);

    const contractAmount = Number(data.contract_amount || 0);
    const totalClientPayment = Number(data.total_client_payment || 0);
    const remainingBalance = contractAmount - totalClientPayment;
    const backHref = role === 'head_admin' ? `/projects/${project.id}` : `/projects/${project.id}/payments`;

    const submit = (event) => {
        event.preventDefault();

        patch(`/projects/${project.id}/financials?return=financials`, {
            preserveScroll: true,
            onError: () => toast.error('Unable to update financials. Check the form fields.'),
        });
    };

    return (
        <>
            <Head title={`Financials - ${project?.name || 'Project'}`} />
            <Layout title={`Project Financials - ${project?.name || 'Project'}`}>
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Only Head Admin and HR can update project financial fields.
                        </div>
                    </div>

                    <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Project</div>
                            <div style={{ fontWeight: 700 }}>{project?.name || '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Client</div>
                            <div style={{ fontWeight: 700 }}>{project?.client || '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Phase</div>
                            <div style={{ fontWeight: 700 }}>{project?.phase || '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status</div>
                            <div style={{ fontWeight: 700 }}>{project?.status || '-'}</div>
                        </div>
                    </div>

                    <form onSubmit={submit} style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                        <div style={{ fontWeight: 700 }}>Financial Fields</div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Contract Amount</div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={data.contract_amount}
                                    onChange={(e) => setData('contract_amount', e.target.value)}
                                    style={inputStyle}
                                />
                                {errors.contract_amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.contract_amount}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Design Fee</div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={data.design_fee}
                                    onChange={(e) => setData('design_fee', e.target.value)}
                                    style={inputStyle}
                                />
                                {errors.design_fee && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.design_fee}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Construction Cost</div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={data.construction_cost}
                                    onChange={(e) => setData('construction_cost', e.target.value)}
                                    style={inputStyle}
                                />
                                {errors.construction_cost && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.construction_cost}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Total Client Payment</div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={data.total_client_payment}
                                    onChange={(e) => setData('total_client_payment', e.target.value)}
                                    style={inputStyle}
                                />
                                {errors.total_client_payment && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.total_client_payment}</div>}
                            </label>
                        </div>

                        <div style={{ ...cardStyle, padding: 12, background: 'var(--surface-2)' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Computed Remaining Balance (Preview)</div>
                            <div style={{ fontWeight: 700, color: remainingBalance < 0 ? '#f87171' : '#4ade80', fontFamily: "'DM Mono', monospace" }}>
                                {money(remainingBalance)}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                            <Link
                                href={`/projects/${project.id}/payments`}
                                style={{
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '9px 12px',
                                    fontSize: 13,
                                    textDecoration: 'none',
                                }}
                            >
                                Open Payments
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                style={{
                                    background: 'var(--success)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '9px 14px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: processing ? 'not-allowed' : 'pointer',
                                    opacity: processing ? 0.7 : 1,
                                }}
                            >
                                {processing ? 'Saving...' : 'Save Financials'}
                            </button>
                        </div>
                    </form>
                </div>
            </Layout>
        </>
    );
}
