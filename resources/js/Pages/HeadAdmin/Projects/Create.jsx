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

export default function HeadAdminProjectsCreate() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        client: '',
        type: '',
        location: '',
        assigned: '',
        target: '',
        status: 'PLANNING',
        phase: 'DESIGN',
        overall_progress: 0,
    });

    const submit = (e) => {
        e.preventDefault();
        post('/projects', {
            onSuccess: () => toast.success('Project created.'),
            onError: () => toast.error('Please check required fields.'),
        });
    };

    return (
        <>
            <Head title="Create Project" />
            <Layout title="Create Project">
                <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
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
                        <input type="date" value={data.target} onChange={(e) => setData('target', e.target.value)} style={inputStyle} />
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
                        <button type="submit" disabled={processing} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1 }}>
                            {processing ? 'Saving...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </Layout>
        </>
    );
}
