import Layout from '../../Components/Layout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';

const SCOPES = [
    'Mobilization and Hauling','Foundation Preparation','Column Footing','Column',
    'Wall Footing/Tie Beam','Second Floor Beam, Slab, Stairs','Slab on Fill',
    'CHB Laying with Plastering','Garage Flooring','Roofbeam','Roofing and Tinsmithry',
];

const sectionStyle = { background: '#161b22', border: '1px solid #30363d', borderRadius: 12, marginBottom: 20, overflow: 'hidden' };
const headerStyle = { background: '#1c2128', padding: '14px 20px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' };
const inputStyle = { background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, padding: '8px 12px', color: '#e6edf3', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };
const btnStyle = { background: '#2ea043', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };

export default function ForemanDashboard({ user, attendances, accomplishments, materialRequests, issueReports, deliveries }) {
    const [open, setOpen] = useState('attendance');
    const [submitting, setSubmitting] = useState(false);

    const [attEntries, setAttEntries] = useState([{ worker_name: '', worker_role: 'Labor', date: '', hours: 8 }]);
    const [weekStart, setWeekStart] = useState('');
    const [scopes, setScopes] = useState(SCOPES.map(s => ({ scope_of_work: s, percent_completed: '' })));
    const [matItems, setMatItems] = useState([{ material_name: '', quantity: '', unit: '', remarks: '' }]);
    const [issue, setIssue] = useState({ issue_title: '', description: '', severity: 'medium' });
    const [delivery, setDelivery] = useState({ item_delivered: '', quantity: '', delivery_date: '', supplier: '', status: 'received' });

    const toggle = (key) => setOpen(open === key ? null : key);

    const addAttRow = () => setAttEntries([...attEntries, { worker_name: '', worker_role: 'Labor', date: '', hours: 8 }]);
    const addMatRow = () => setMatItems([...matItems, { material_name: '', quantity: '', unit: '', remarks: '' }]);

    const handleSubmitAll = () => {
        setSubmitting(true);
        router.post('/foreman/submit-all', {
            attendance: attEntries,
            week_start: weekStart,
            scopes: scopes,
            material_items: matItems,
            issue_title: issue.issue_title,
            description: issue.description,
            severity: issue.severity,
            item_delivered: delivery.item_delivered,
            quantity: delivery.quantity,
            delivery_date: delivery.delivery_date,
            supplier: delivery.supplier,
            status: delivery.status,
        }, {
            onFinish: () => setSubmitting(false),
        });
    };

    return (
        <>
            <Head title="Foreman Dashboard" />
            <Layout title={`Foreman — ${user.fullname}`}>
 
                <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('attendance')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}><i className="fi fi-rr-clipboard-user" style={{ marginRight: 8 }}></i> Daily Attendance</div>
                        <span style={{ color: '#8b949e', fontSize: 12 }}>{open === 'attendance' ? '▲' : '▼'}</span>
                    </div>
                    {open === 'attendance' && (
                        <div style={{ padding: 20 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                                <thead>
                                    <tr>
                                        {['Worker Name', 'Role', 'Date', 'Hours', ''].map((h, i) => (
                                            <th key={i} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '8px 8px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {attEntries.map((entry, idx) => (
                                        <tr key={idx}>
                                            <td style={{ padding: '6px 8px' }}>
                                                <input value={entry.worker_name} onChange={e => { const arr = [...attEntries]; arr[idx].worker_name = e.target.value; setAttEntries(arr); }} style={inputStyle} placeholder="Name" />
                                            </td>
                                            <td style={{ padding: '6px 8px' }}>
                                                <select value={entry.worker_role} onChange={e => { const arr = [...attEntries]; arr[idx].worker_role = e.target.value; setAttEntries(arr); }} style={{ ...inputStyle, width: 'auto' }}>
                                                    {['Foreman','Skilled','Labor'].map(r => <option key={r}>{r}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ padding: '6px 8px' }}>
                                                <input type="date" value={entry.date} onChange={e => { const arr = [...attEntries]; arr[idx].date = e.target.value; setAttEntries(arr); }} style={inputStyle} />
                                            </td>
                                            <td style={{ padding: '6px 8px' }}>
                                                <input type="number" value={entry.hours} onChange={e => { const arr = [...attEntries]; arr[idx].hours = e.target.value; setAttEntries(arr); }} style={{ ...inputStyle, width: 80 }} />
                                            </td>
                                            <td style={{ padding: '6px 8px' }}>
                                                {attEntries.length > 1 && (
                                                    <button onClick={() => setAttEntries(attEntries.filter((_, i) => i !== idx))} style={{ background: 'rgba(248,81,73,0.12)', color: '#f87171', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={addAttRow} style={{ ...btnStyle, background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}>+ Add Row</button>
                        </div>
                    )}
                </div>
 
                <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('accomplishment')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}><i className="fi fi-rr-chart-line-up" style={{ marginRight: 8 }}></i> Weekly Accomplishment</div>
                        <span style={{ color: '#8b949e', fontSize: 12 }}>{open === 'accomplishment' ? '▲' : '▼'}</span>
                    </div>
                    {open === 'accomplishment' && (
                        <div style={{ padding: 20 }}>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 6 }}>Week Start Date</label>
                                <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} style={{ ...inputStyle, width: 200 }} />
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                                <thead>
                                    <tr>
                                        <th style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '8px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>Scope of Work</th>
                                        <th style={{ fontSize: 11, color: '#6e7681', textAlign: 'center', padding: '8px', borderBottom: '1px solid #30363d', textTransform: 'uppercase', width: 140 }}>% Completed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scopes.map((scope, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #21262d' }}>
                                            <td style={{ padding: '8px', color: '#e6edf3', fontSize: 13 }}>{scope.scope_of_work}</td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <input type="number" min="0" max="100" value={scope.percent_completed} onChange={e => { const arr = [...scopes]; arr[idx].percent_completed = e.target.value; setScopes(arr); }} style={{ ...inputStyle, width: 80, textAlign: 'center' }} placeholder="0" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div> 

                <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('material')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}><i className="fi fi-rr-shopping-cart" style={{ marginRight: 8 }}></i> Material Request</div>
                        <span style={{ color: '#8b949e', fontSize: 12 }}>{open === 'material' ? '▲' : '▼'}</span>
                    </div>
                    {open === 'material' && (
                        <div style={{ padding: 20 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                                <thead>
                                    <tr>
                                        {['Material', 'Quantity', 'Unit', 'Remarks', ''].map((h, i) => (
                                            <th key={i} style={{ fontSize: 11, color: '#6e7681', textAlign: 'left', padding: '8px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {matItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td style={{ padding: '6px 8px 6px 0' }}><input value={item.material_name} onChange={e => { const arr = [...matItems]; arr[idx].material_name = e.target.value; setMatItems(arr); }} style={inputStyle} placeholder="e.g. CHB 4 inch" /></td>
                                            <td style={{ padding: '6px 8px' }}><input value={item.quantity} onChange={e => { const arr = [...matItems]; arr[idx].quantity = e.target.value; setMatItems(arr); }} style={inputStyle} placeholder="e.g. 500" /></td>
                                            <td style={{ padding: '6px 8px' }}><input value={item.unit} onChange={e => { const arr = [...matItems]; arr[idx].unit = e.target.value; setMatItems(arr); }} style={inputStyle} placeholder="pcs / bags" /></td>
                                            <td style={{ padding: '6px 8px' }}><input value={item.remarks} onChange={e => { const arr = [...matItems]; arr[idx].remarks = e.target.value; setMatItems(arr); }} style={inputStyle} placeholder="Optional" /></td>
                                            <td style={{ padding: '6px 8px' }}>
                                                {matItems.length > 1 && <button onClick={() => setMatItems(matItems.filter((_, i) => i !== idx))} style={{ background: 'rgba(248,81,73,0.12)', color: '#f87171', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={addMatRow} style={{ ...btnStyle, background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}>+ Add Item</button>
                        </div>
                    )}
                </div>
 
                <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('issue')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}><i className="fi fi-rr-exclamation" style={{ marginRight: 8 }}></i> Issue Report</div>
                        <span style={{ color: '#8b949e', fontSize: 12 }}>{open === 'issue' ? '▲' : '▼'}</span>
                    </div>
                    {open === 'issue' && (
                        <div style={{ padding: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 6 }}>Issue Title</label>
                                    <input value={issue.issue_title} onChange={e => setIssue({ ...issue, issue_title: e.target.value })} style={inputStyle} placeholder="Brief title of issue" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 6 }}>Severity</label>
                                    <select value={issue.severity} onChange={e => setIssue({ ...issue, severity: e.target.value })} style={inputStyle}>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 6 }}>Description</label>
                                <textarea value={issue.description} onChange={e => setIssue({ ...issue, description: e.target.value })} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Describe the issue in detail..." />
                            </div>
                        </div>
                    )}
                </div>
 
                <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('delivery')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}><i className="fi fi-rr-truck-side" style={{ marginRight: 8 }}></i> Delivery Confirmation</div>
                        <span style={{ color: '#8b949e', fontSize: 12 }}>{open === 'delivery' ? '▲' : '▼'}</span>
                    </div>
                    {open === 'delivery' && (
                        <div style={{ padding: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                                {[
                                    ['Item Delivered', 'item_delivered', 'text', 'e.g. Cement Bags'],
                                    ['Quantity', 'quantity', 'text', 'e.g. 50 bags'],
                                    ['Delivery Date', 'delivery_date', 'date', ''],
                                    ['Supplier', 'supplier', 'text', 'Optional'],
                                ].map(([label, key, type, placeholder]) => (
                                    <div key={key}>
                                        <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 6 }}>{label}</label>
                                        <input type={type} value={delivery[key]} onChange={e => setDelivery({ ...delivery, [key]: e.target.value })} style={inputStyle} placeholder={placeholder} />
                                    </div>
                                ))}
                                <div>
                                    <label style={{ display: 'block', color: '#8b949e', fontSize: 12, marginBottom: 6 }}>Status</label>
                                    <select value={delivery.status} onChange={e => setDelivery({ ...delivery, status: e.target.value })} style={inputStyle}>
                                        <option value="received">Received</option>
                                        <option value="incomplete">Incomplete</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
 
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, marginBottom: 32 }}>
                    <button
                        onClick={handleSubmitAll}
                        disabled={submitting}
                        style={{ ...btnStyle, padding: '12px 36px', fontSize: 15, borderRadius: 10, opacity: submitting ? 0.7 : 1 }}
                    >
                        {submitting ? 'Submitting...' : '✔ Submit All'}
                    </button>
                </div>

            </Layout>
        </>
    );
}