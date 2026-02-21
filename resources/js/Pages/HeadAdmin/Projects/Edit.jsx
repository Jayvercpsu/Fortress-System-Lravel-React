import Layout from '../../../Components/Layout';
import { Head, useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';

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

export default function HeadAdminProjectsEdit({ project }) {
    const { data, setData, patch, processing, errors } = useForm({
        name: project.name ?? '',
        client: project.client ?? '',
        type: project.type ?? '',
        location: project.location ?? '',
        assigned: project.assigned ?? '',
        target: project.target ?? '',
        status: project.status ?? 'PLANNING',
        phase: project.phase ?? 'DESIGN',
        overall_progress: project.overall_progress ?? 0,
    });

    const {
        data: financials,
        setData: setFinancials,
        patch: patchFinancials,
        processing: financialProcessing,
        errors: financialErrors,
    } = useForm({
        contract_amount: project.contract_amount ?? 0,
        design_fee: project.design_fee ?? 0,
        construction_cost: project.construction_cost ?? 0,
        total_client_payment: project.total_client_payment ?? 0,
    });

    const submit = (e) => {
        e.preventDefault();
        patch(`/projects/${project.id}`, {
            onSuccess: () => toast.success('Project updated.'),
            onError: () => toast.error('Please check required fields.'),
        });
    };

    const saveFinancials = (e) => {
        e.preventDefault();
        patchFinancials(`/projects/${project.id}/financials`, {
            onSuccess: () => toast.success('Financial overview updated.'),
            onError: () => toast.error('Unable to update financials.'),
        });
    };

    const remainingBalance = Number(financials.contract_amount || 0) - Number(financials.total_client_payment || 0);

    return (
        <>
            <Head title={`Edit Project #${project.id}`} />
            <Layout title={`Edit Project - ${project.name}`}>
                <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    {[
                        ['name', 'Project Name'],
                        ['client', 'Client'],
                        ['type', 'Type'],
                        ['location', 'Location'],
                        ['assigned', 'Assigned To'],
                    ].map(([key, label]) => (
                        <label key={key}>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
                            <input value={data[key]} onChange={(e) => setData(key, e.target.value)} style={inputStyle} />
                            {errors[key] && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors[key]}</div>}
                        </label>
                    ))}

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Target Date</div>
                        <input type="date" value={data.target ?? ''} onChange={(e) => setData('target', e.target.value)} style={inputStyle} />
                        {errors.target && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.target}</div>}
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                        <input value={data.status} onChange={(e) => setData('status', e.target.value)} style={inputStyle} />
                        {errors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.status}</div>}
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Phase</div>
                        <input value={data.phase} onChange={(e) => setData('phase', e.target.value)} style={inputStyle} />
                        {errors.phase && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.phase}</div>}
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Overall Progress (%)</div>
                        <input type="number" min="0" max="100" value={data.overall_progress} onChange={(e) => setData('overall_progress', e.target.value)} style={inputStyle} />
                        {errors.overall_progress && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.overall_progress}</div>}
                    </label>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" disabled={processing} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px' }}>
                            {processing ? 'Saving...' : 'Save Project'}
                        </button>
                    </div>
                </form>

                <form onSubmit={saveFinancials} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
                    <div style={{ gridColumn: '1 / -1', fontSize: 14, fontWeight: 700 }}>Financial Overview</div>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Contract Amount</div>
                        <input type="number" step="0.01" min="0" value={financials.contract_amount} onChange={(e) => setFinancials('contract_amount', e.target.value)} style={inputStyle} />
                        {financialErrors.contract_amount && <div style={{ color: '#f87171', fontSize: 12 }}>{financialErrors.contract_amount}</div>}
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Design Fee</div>
                        <input type="number" step="0.01" min="0" value={financials.design_fee} onChange={(e) => setFinancials('design_fee', e.target.value)} style={inputStyle} />
                        {financialErrors.design_fee && <div style={{ color: '#f87171', fontSize: 12 }}>{financialErrors.design_fee}</div>}
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Construction Cost</div>
                        <input type="number" step="0.01" min="0" value={financials.construction_cost} onChange={(e) => setFinancials('construction_cost', e.target.value)} style={inputStyle} />
                        {financialErrors.construction_cost && <div style={{ color: '#f87171', fontSize: 12 }}>{financialErrors.construction_cost}</div>}
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Total Client Payment</div>
                        <input type="number" step="0.01" min="0" value={financials.total_client_payment} onChange={(e) => setFinancials('total_client_payment', e.target.value)} style={inputStyle} />
                        {financialErrors.total_client_payment && <div style={{ color: '#f87171', fontSize: 12 }}>{financialErrors.total_client_payment}</div>}
                    </label>

                    <div style={{ gridColumn: '1 / -1', fontWeight: 700 }}>
                        Remaining Balance: {money(remainingBalance)}
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" disabled={financialProcessing} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px' }}>
                            {financialProcessing ? 'Saving...' : 'Save Financials'}
                        </button>
                    </div>
                </form>
            </Layout>
        </>
    );
}
