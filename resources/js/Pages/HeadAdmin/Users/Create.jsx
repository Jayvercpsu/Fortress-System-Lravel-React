import Layout from '../../../Components/Layout';
import { Head, useForm } from '@inertiajs/react';

const input = (label, props) => (
    <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>{label}</label>
        <input {...props} style={{ width: '100%', background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e6edf3', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        {props.error && <p style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{props.error}</p>}
    </div>
);

export default function CreateUser() {
    const { data, setData, post, errors, processing } = useForm({
        fullname: '', email: '', password: '', role: 'foreman',
    });

    const submit = (e) => {
        e.preventDefault();
        post('/users');
    };

    return (
        <>
            <Head title="Create User" />
            <Layout title="Create New User">
                <div style={{ maxWidth: 480 }}>
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 28 }}>
                        <form onSubmit={submit}>
                            {input('Full Name', { type: 'text', value: data.fullname, onChange: e => setData('fullname', e.target.value), error: errors.fullname })}
                            {input('Email', { type: 'email', value: data.email, onChange: e => setData('email', e.target.value), error: errors.email })}
                            {input('Password', { type: 'password', value: data.password, onChange: e => setData('password', e.target.value), error: errors.password })}

                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>Role</label>
                                <select
                                    value={data.role}
                                    onChange={e => setData('role', e.target.value)}
                                    style={{ width: '100%', background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e6edf3', fontSize: 14, outline: 'none' }}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="hr">HR</option>
                                    <option value="foreman">Foreman</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="button" onClick={() => window.history.back()} style={{ flex: 1, background: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: 8, padding: 11, fontSize: 13, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={processing} style={{ flex: 1, background: '#2ea043', color: '#fff', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                    {processing ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </Layout>
        </>
    );
}