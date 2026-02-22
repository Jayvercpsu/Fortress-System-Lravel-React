import Layout from '../../../Components/Layout';
import DatePickerInput from '../../../Components/DatePickerInput';
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

export default function HeadAdminProjectsCreate({ foremen = [] }) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        client: '',
        type: '',
        location: '',
        assigned: '',
        target: '',
        status: 'PLANNING',
        phase: 'DESIGN',
    });

    const submit = (e) => {
        e.preventDefault();
        post('/projects', {
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
                    ].map(([key, label]) => (
                        <label key={key}>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
                            <input value={data[key]} onChange={(e) => setData(key, e.target.value)} style={inputStyle} />
                            {errors[key] && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors[key]}</div>}
                        </label>
                    ))}

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned To</div>
                        <select
                            value={data.assigned}
                            onChange={(e) => setData('assigned', e.target.value)}
                            style={inputStyle}
                            disabled={foremen.length === 0}
                        >
                            <option value="">{foremen.length === 0 ? 'No foreman users available' : 'Select foreman'}</option>
                            {foremen.map((foreman) => (
                                <option key={foreman.id} value={foreman.fullname}>
                                    {foreman.fullname}
                                </option>
                            ))}
                        </select>
                        {foremen.length === 0 && (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                                Add a user with role `foreman` first to assign this project.
                            </div>
                        )}
                        {errors.assigned && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.assigned}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Target Date</div>
                        <DatePickerInput value={data.target} onChange={(value) => setData('target', value)} style={inputStyle} />
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
                        <button type="submit" disabled={processing} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1 }}>
                            {processing ? 'Saving...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </Layout>
        </>
    );
}
