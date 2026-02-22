import Layout from '../../../Components/Layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
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
    });

    const submit = (e) => {
        e.preventDefault();
        patch(`/projects/${project.id}`, {
            onError: () => toast.error('Please check required fields.'),
        });
    };

    const handleBackToProject = (e) => {
        if (typeof window === 'undefined') return;

        const hasHistory = window.history.length > 1;
        const sameOriginReferrer = document.referrer && document.referrer.startsWith(window.location.origin);

        if (hasHistory && sameOriginReferrer) {
            e.preventDefault();
            window.history.back();
        }
    };

    const remainingBalance = Number(project.contract_amount || 0) - Number(project.total_client_payment || 0);

    return (
        <>
            <Head title={`Edit Project #${project.id}`} />
            <Layout title={`Edit Project - ${project.name}`}>
                <div style={{ marginBottom: 12 }}>
                    <Link
                        href={`/projects/${project.id}`}
                        onClick={handleBackToProject}
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
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" disabled={processing} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px' }}>
                            {processing ? 'Saving...' : 'Save Project'}
                        </button>
                    </div>
                </form>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
                    <div style={{ gridColumn: '1 / -1', fontSize: 14, fontWeight: 700 }}>Financial Overview</div>
                    <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-muted)' }}>
                        Auto-calculated from Design Tracker, Build Tracker, and Expenses.
                    </div>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Contract Amount</div>
                        <input type="text" value={money(project.contract_amount)} readOnly style={inputStyle} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Design Fee</div>
                        <input type="text" value={money(project.design_fee)} readOnly style={inputStyle} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Construction Cost</div>
                        <input type="text" value={money(project.construction_cost)} readOnly style={inputStyle} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Total Client Payment</div>
                        <input type="text" value={money(project.total_client_payment)} readOnly style={inputStyle} />
                    </label>

                    <div style={{ gridColumn: '1 / -1', fontWeight: 700 }}>
                        Remaining Balance: {money(remainingBalance)}
                    </div>
                </div>
            </Layout>
        </>
    );
}
