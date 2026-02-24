import Layout from '../../Components/Layout';
import SearchableDropdown from '../../Components/SearchableDropdown';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const SCOPES = [
    'Mobilization and Hauling',
    'Foundation Preparation',
    'Column Footing',
    'Column',
    'Wall Footing/Tie Beam',
    'Second Floor Beam, Slab, Stairs',
    'Slab on Fill',
    'CHB Laying with Plastering',
    'Garage Flooring',
    'Roofbeam',
    'Roofing and Tinsmithry',
];

const card = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const input = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
};

const btn = (primary = false) => ({
    border: primary ? 'none' : '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    background: primary ? 'var(--success)' : 'var(--button-bg)',
    color: primary ? '#fff' : 'var(--text-main)',
});

export default function ForemanSubmissions({
    assignedProjects = [],
    projects = [],
    projectScopes = [],
    progressPhotos = [],
}) {
    const { flash } = usePage().props;

    const [weekStart, setWeekStart] = useState('');
    const [scopes, setScopes] = useState(SCOPES.map((s) => ({ scope_of_work: s, percent_completed: '' })));
    const [savingAccomplishment, setSavingAccomplishment] = useState(false);

    const [materials, setMaterials] = useState([{ material_name: '', quantity: '', unit: '', remarks: '' }]);
    const [savingMaterials, setSavingMaterials] = useState(false);

    const [issue, setIssue] = useState({ issue_title: '', description: '', severity: 'medium' });
    const [savingIssue, setSavingIssue] = useState(false);

    const [delivery, setDelivery] = useState({
        item_delivered: '',
        quantity: '',
        delivery_date: '',
        supplier: '',
        status: 'received',
    });
    const [savingDelivery, setSavingDelivery] = useState(false);

    const [proofProjectId, setProofProjectId] = useState('');
    const [proofScopeId, setProofScopeId] = useState('');
    const [proofCaption, setProofCaption] = useState('');
    const [proofPhoto, setProofPhoto] = useState(null);
    const [proofPhotoInputKey, setProofPhotoInputKey] = useState(0);
    const [uploadingProof, setUploadingProof] = useState(false);

    const projectOptions = useMemo(
        () => projects.map((p) => ({ id: p.id, name: p.name })),
        [projects]
    );

    const scopeOptions = useMemo(() => {
        const projectId = String(proofProjectId || '');
        return projectScopes
            .filter((s) => !projectId || String(s.project_id) === projectId)
            .map((s) => ({ id: s.id, name: s.scope_name }));
    }, [projectScopes, proofProjectId]);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        if (!proofScopeId) return;
        if (!scopeOptions.some((s) => String(s.id) === String(proofScopeId))) {
            setProofScopeId('');
        }
    }, [proofScopeId, scopeOptions]);

    const submitAccomplishment = () => {
        const payloadScopes = scopes.filter((s) => String(s.percent_completed).trim() !== '');
        if (!weekStart) return toast.error('Week start is required.');
        if (payloadScopes.length === 0) return toast.error('Enter at least one accomplishment.');

        setSavingAccomplishment(true);
        router.post(
            '/foreman/submit-all',
            { week_start: weekStart, scopes: payloadScopes },
            {
                preserveScroll: true,
                onSuccess: () => setScopes(SCOPES.map((s) => ({ scope_of_work: s, percent_completed: '' }))),
                onFinish: () => setSavingAccomplishment(false),
            }
        );
    };

    const submitMaterials = () => {
        const items = materials.filter((m) => String(m.material_name).trim() !== '');
        if (items.length === 0) return toast.error('Add at least one material item.');

        setSavingMaterials(true);
        router.post(
            '/foreman/submit-all',
            { material_items: items },
            {
                preserveScroll: true,
                onSuccess: () => setMaterials([{ material_name: '', quantity: '', unit: '', remarks: '' }]),
                onFinish: () => setSavingMaterials(false),
            }
        );
    };

    const submitIssue = () => {
        if (!issue.issue_title || !issue.description) {
            return toast.error('Issue title and description are required.');
        }

        setSavingIssue(true);
        router.post('/foreman/submit-all', issue, {
            preserveScroll: true,
            onSuccess: () => setIssue({ issue_title: '', description: '', severity: 'medium' }),
            onFinish: () => setSavingIssue(false),
        });
    };

    const submitDelivery = () => {
        if (!delivery.item_delivered || !delivery.delivery_date) {
            return toast.error('Item delivered and delivery date are required.');
        }

        setSavingDelivery(true);
        router.post('/foreman/submit-all', delivery, {
            preserveScroll: true,
            onSuccess: () =>
                setDelivery({
                    item_delivered: '',
                    quantity: '',
                    delivery_date: '',
                    supplier: '',
                    status: 'received',
                }),
            onFinish: () => setSavingDelivery(false),
        });
    };

    const uploadProof = () => {
        if (!proofPhoto) return toast.error('Select an image first.');

        setUploadingProof(true);
        router.post(
            '/foreman/progress-photo',
            {
                project_id: proofProjectId || null,
                scope_id: proofScopeId || null,
                caption: proofCaption,
                photo: proofPhoto,
            },
            {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => {
                    setProofProjectId('');
                    setProofScopeId('');
                    setProofCaption('');
                    setProofPhoto(null);
                    setProofPhotoInputKey((k) => k + 1);
                },
                onFinish: () => setUploadingProof(false),
            }
        );
    };

    return (
        <>
            <Head title="Foreman Submissions" />
            <Layout title="Foreman Submissions">
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontWeight: 700 }}>Separated Submission Forms</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Submit each section individually. No global submit-all button.
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Link href="/foreman" style={{ ...btn(false), textDecoration: 'none' }}>Dashboard</Link>
                                <Link href="/foreman/attendance" style={{ ...btn(false), textDecoration: 'none' }}>Attendance</Link>
                                <Link href="/foreman/workers" style={{ ...btn(false), textDecoration: 'none' }}>Workers</Link>
                            </div>
                        </div>
                    </div>

                    <div style={card}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Assigned Projects</div>
                        {assignedProjects.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No assigned projects yet.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: 8 }}>
                                {assignedProjects.map((p) => (
                                    <div key={p.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{p.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.client || '-'} • {p.phase || '-'} • {p.status || '-'}</div>
                                        </div>
                                        <a href={p.public_submit_url} target="_blank" rel="noreferrer" style={{ ...btn(true), textDecoration: 'none' }}>Public Submit</a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={card}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>Weekly Accomplishment</div>
                            <div style={{ display: 'grid', gap: 10 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Week Start</label>
                                    <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} style={input} />
                                </div>
                                <div style={{ display: 'grid', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                                    {scopes.map((s, idx) => (
                                        <div key={s.scope_of_work} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                                            <div style={{ ...input, background: 'var(--surface-2)' }}>{s.scope_of_work}</div>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                placeholder="%"
                                                value={s.percent_completed}
                                                onChange={(e) => {
                                                    const next = [...scopes];
                                                    next[idx] = { ...next[idx], percent_completed: e.target.value };
                                                    setScopes(next);
                                                }}
                                                style={input}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={submitAccomplishment} disabled={savingAccomplishment} style={btn(true)}>
                                        {savingAccomplishment ? 'Submitting...' : 'Submit Accomplishment'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={card}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>Material Request</div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {materials.map((m, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr 0.6fr 1fr auto', gap: 8 }}>
                                        <input value={m.material_name} onChange={(e) => setMaterials((prev) => prev.map((row, i) => i === idx ? { ...row, material_name: e.target.value } : row))} style={input} placeholder="Material" />
                                        <input value={m.quantity} onChange={(e) => setMaterials((prev) => prev.map((row, i) => i === idx ? { ...row, quantity: e.target.value } : row))} style={input} placeholder="Qty" />
                                        <input value={m.unit} onChange={(e) => setMaterials((prev) => prev.map((row, i) => i === idx ? { ...row, unit: e.target.value } : row))} style={input} placeholder="Unit" />
                                        <input value={m.remarks} onChange={(e) => setMaterials((prev) => prev.map((row, i) => i === idx ? { ...row, remarks: e.target.value } : row))} style={input} placeholder="Remarks" />
                                        {materials.length > 1 ? (
                                            <button type="button" onClick={() => setMaterials((prev) => prev.filter((_, i) => i !== idx))} style={btn(false)}>X</button>
                                        ) : <div />}
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                    <button type="button" onClick={() => setMaterials((prev) => [...prev, { material_name: '', quantity: '', unit: '', remarks: '' }])} style={btn(false)}>
                                        + Add Item
                                    </button>
                                    <button type="button" onClick={submitMaterials} disabled={savingMaterials} style={btn(true)}>
                                        {savingMaterials ? 'Submitting...' : 'Submit Material Request'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={card}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>Issue Report</div>
                            <div style={{ display: 'grid', gap: 10 }}>
                                <input value={issue.issue_title} onChange={(e) => setIssue((prev) => ({ ...prev, issue_title: e.target.value }))} style={input} placeholder="Issue title" />
                                <select value={issue.severity} onChange={(e) => setIssue((prev) => ({ ...prev, severity: e.target.value }))} style={input}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                                <textarea value={issue.description} onChange={(e) => setIssue((prev) => ({ ...prev, description: e.target.value }))} rows={4} style={{ ...input, resize: 'vertical' }} placeholder="Description" />
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={submitIssue} disabled={savingIssue} style={btn(true)}>
                                        {savingIssue ? 'Submitting...' : 'Submit Issue'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={card}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>Delivery Confirmation</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <input value={delivery.item_delivered} onChange={(e) => setDelivery((prev) => ({ ...prev, item_delivered: e.target.value }))} style={input} placeholder="Item delivered" />
                                <input value={delivery.quantity} onChange={(e) => setDelivery((prev) => ({ ...prev, quantity: e.target.value }))} style={input} placeholder="Quantity" />
                                <input type="date" value={delivery.delivery_date} onChange={(e) => setDelivery((prev) => ({ ...prev, delivery_date: e.target.value }))} style={input} />
                                <input value={delivery.supplier} onChange={(e) => setDelivery((prev) => ({ ...prev, supplier: e.target.value }))} style={input} placeholder="Supplier" />
                                <select value={delivery.status} onChange={(e) => setDelivery((prev) => ({ ...prev, status: e.target.value }))} style={{ ...input, gridColumn: '1 / -1' }}>
                                    <option value="received">Received</option>
                                    <option value="incomplete">Incomplete</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                                <button type="button" onClick={submitDelivery} disabled={savingDelivery} style={btn(true)}>
                                    {savingDelivery ? 'Submitting...' : 'Submit Delivery'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={card}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Progress Proof Photo</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <SearchableDropdown
                                options={projectOptions}
                                value={proofProjectId}
                                onChange={(value) => setProofProjectId(value || '')}
                                getOptionLabel={(o) => o.name}
                                getOptionValue={(o) => o.id}
                                placeholder="Project (optional)"
                                searchPlaceholder="Search projects..."
                                emptyMessage="No projects"
                                clearable
                                style={{ ...input, minHeight: 38 }}
                                dropdownWidth={280}
                            />
                            <SearchableDropdown
                                options={scopeOptions}
                                value={proofScopeId}
                                onChange={(value) => setProofScopeId(value || '')}
                                getOptionLabel={(o) => o.name}
                                getOptionValue={(o) => o.id}
                                placeholder="Scope (optional)"
                                searchPlaceholder="Search scopes..."
                                emptyMessage="No scopes"
                                clearable
                                style={{ ...input, minHeight: 38 }}
                                dropdownWidth={280}
                            />
                            <input key={proofPhotoInputKey} type="file" accept="image/*" onChange={(e) => setProofPhoto(e.target.files?.[0] ?? null)} />
                        </div>
                        <textarea value={proofCaption} onChange={(e) => setProofCaption(e.target.value)} rows={3} style={{ ...input, resize: 'vertical', marginBottom: 8 }} placeholder="Caption (optional)" />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                            <button type="button" onClick={uploadProof} disabled={uploadingProof} style={btn(true)}>
                                {uploadingProof ? 'Uploading...' : 'Upload Proof Photo'}
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                            {progressPhotos.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No uploaded proof photos yet.</div>
                            ) : (
                                progressPhotos.map((photo) => (
                                    <a key={photo.id} href={`/storage/${photo.photo_path}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--surface-2)', padding: 8 }}>
                                        <img src={`/storage/${photo.photo_path}`} alt={photo.caption || 'Progress proof'} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} />
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>{photo.project_name || 'Unassigned'}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {photo.caption || 'No caption'}
                                        </div>
                                    </a>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </Layout>
        </>
    );
}
