import { useForm, Head } from '@inertiajs/react';

export default function Login() {
    const { data, setData, post, errors, processing } = useForm({ email: '', password: '' });

    const submit = (e) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <>
            <Head title="Login" />
            <div style={{
                fontFamily: "'DM Sans', sans-serif",
                background: '#0d1117', minHeight: '100vh',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{ width: 400 }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ width: 56, height: 56, background: '#1b8a7a', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>🏗️</div>
                        <h1 style={{ color: '#e6edf3', fontSize: 24, fontWeight: 700, margin: 0 }}>BuildBooks</h1>
                        <p style={{ color: '#8b949e', fontSize: 13, marginTop: 4 }}>Payroll • Expenses • Projects</p>
                    </div>

                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 32 }}>
                        <form onSubmit={submit}>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>Email</label>
                                <input
                                    type="email"
                                    value={data.email}
                                    onChange={e => setData('email', e.target.value)}
                                    style={{ width: '100%', background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e6edf3', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                                />
                                {errors.email && <p style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{errors.email}</p>}
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>Password</label>
                                <input
                                    type="password"
                                    value={data.password}
                                    onChange={e => setData('password', e.target.value)}
                                    style={{ width: '100%', background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e6edf3', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                style={{ width: '100%', background: '#2ea043', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: processing ? 0.7 : 1 }}
                            >
                                {processing ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}