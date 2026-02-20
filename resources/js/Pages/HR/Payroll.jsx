import Layout from '../../Components/Layout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';

const statusColor = { pending: '#8b949e', ready: '#fbbf24', approved: '#4ade80', paid: '#60a5fa' };

export default function Payroll({ payrolls, totalPayable }) {
    const [showForm, setShowForm] = useState(false);
    const { data, setData, post, errors, processing, reset } = useForm({
        worker_name: '', role: '', hours: '', rate_per_hour: '', deductions: '0', week_start: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post('/payroll', { onSuccess: () => { reset(); setShowForm(false); } });
    };

    const updateStatus = (id, status) => router.patch(`/payroll/${id}/status`, { status });

    return (
        <>
            <Head title="Payroll" />
            <Layout title="Payroll Management">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '20px 24px' }}>
                        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase' }}>Total Payable</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24', fontFamily: "'DM Mono', monospace" }}>₱{Number(totalPayable).toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowForm(!showForm)} style={{ background: '#2ea043', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {showForm ? 'Cancel' : '+ Add Payroll Entry'}
                        </button>
                    </div>
                </div>

                {showForm && (
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                        <div style={{ fontWeight: 600, marginBottom: 16 }}>New Payroll Entry</div>
                        <form onSubmit={submit}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                                {[
                                    ['Worker Name', 'worker_name', 'text'],
                                    ['Role', 'role', 'text'],
                                    ['Week Start', 'week_start', 'date'],
                                    ['Hours', 'hours', 'number'],
                                    ['Rate / Hour (₱)', 'rate_per_hour', 'number'],
                                    ['Deductions (₱)', 'deductions', 'number'],
                                ].map(([label, key, type]) => (
                                    <div key={key}>
                                        <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 4 }}>{label}</label>
                                        <input type={type} value={data[key]} onChange={e => setData(key, e.target.value)} style={{ width: '100%', background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, padding: '8px 12px', color: '#e6edf3', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                ))}
                            </div>
                            <button type="submit" disabled={processing} style={{ background: '#2ea043', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                {processing ? 'Saving...' : 'Save Entry'}
                            </button>
                        </form>
                    </div>
                )}

                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Worker', 'Role', 'Week', 'Hours', 'Rate', 'Gross', 'Deduct', 'Net', 'Status', 'Action'].map(h => (
                                    <th key={h} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payrolls.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #21262d' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.worker_name}</td>
                                    <td style={{ padding: '10px 12px', color: '#8b949e', fontSize: 12 }}>{p.role}</td>
                                    <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#6e7681' }}>{p.week_start}</td>
                                    <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>{p.hours}</td>
                                    <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>₱{Number(p.rate_per_hour).toLocaleString()}</td>
                                    <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>₱{Number(p.gross).toLocaleString()}</td>
                                    <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace", color: '#f87171' }}>-₱{Number(p.deductions).toLocaleString()}</td>
                                    <td style={{ padding: '10px 12px', fontFamily: "'DM Mono', monospace", fontWeight: 600, color: '#4ade80' }}>₱{Number(p.net).toLocaleString()}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, color: statusColor[p.status], background: `${statusColor[p.status]}22`, border: `1px solid ${statusColor[p.status]}44` }}>{p.status}</span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <select onChange={e => updateStatus(p.id, e.target.value)} value={p.status} style={{ background: '#21262d', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                                            {['pending', 'ready', 'approved', 'paid'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Layout>
        </>
    );
}