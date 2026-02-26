import Layout from '../../Components/Layout';
import DatePickerInput from '../../Components/DatePickerInput';
import InlinePagination from '../../Components/InlinePagination';
import Modal from '../../Components/Modal';
import SearchableDropdown from '../../Components/SearchableDropdown';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

const normalizeScopeKey = (value) => String(value || '').trim().toLowerCase();
const blankScopeRows = () => SCOPES.map((scope) => ({ scope_of_work: scope, percent_completed: '' }));

const buildWeeklyAccomplishmentDraftState = (draft) => {
    const entries = Array.isArray(draft?.entries) ? draft.entries : [];
    const latestByScope = new Map();

    entries.forEach((entry) => {
        const key = normalizeScopeKey(entry?.scope_of_work);
        if (!key || latestByScope.has(key)) return;
        latestByScope.set(key, {
            scope_of_work: String(entry?.scope_of_work || '').trim(),
            percent_completed:
                entry?.percent_completed === null || entry?.percent_completed === undefined
                    ? ''
                    : String(entry.percent_completed),
        });
    });

    const knownScopeKeys = new Set(SCOPES.map(normalizeScopeKey));

    return {
        projectId:
            draft?.project_id === null || draft?.project_id === undefined || draft?.project_id === ''
                ? ''
                : String(draft.project_id),
        weekStart: typeof draft?.week_start === 'string' ? draft.week_start : '',
        scopes: blankScopeRows().map((row) => {
            const hit = latestByScope.get(normalizeScopeKey(row.scope_of_work));
            return hit ? { ...row, percent_completed: hit.percent_completed } : row;
        }),
        customScopes: Array.from(latestByScope.values())
            .filter((row) => !knownScopeKeys.has(normalizeScopeKey(row.scope_of_work)))
            .map((row) => ({
                scope_of_work: row.scope_of_work,
                percent_completed: row.percent_completed,
            })),
    };
};

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

const previewArrowBtn = (enabled, side) => ({
    position: 'absolute',
    top: '50%',
    [side]: 10,
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid var(--border-color)',
    background: enabled ? 'rgba(15, 23, 42, 0.78)' : 'rgba(15, 23, 42, 0.35)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    lineHeight: 1,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.55,
});

const emptyPaginated = {
    data: [],
    current_page: 1,
    last_page: 1,
    total: 0,
    from: 0,
    to: 0,
    prev_page_url: null,
    next_page_url: null,
};

const asPaginated = (value) => {
    if (!value) return emptyPaginated;
    if (Array.isArray(value)) {
        return {
            ...emptyPaginated,
            data: value,
            total: value.length,
            to: value.length,
        };
    }

    return {
        ...emptyPaginated,
        ...value,
        data: Array.isArray(value.data) ? value.data : [],
    };
};

const badge = (fg, bg) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    color: fg,
    background: bg,
    border: `1px solid ${fg}33`,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
});

const materialStatusBadge = (status) => {
    const key = String(status || '').toLowerCase();
    if (key === 'approved') return badge('#22c55e', 'rgba(34,197,94,0.10)');
    if (key === 'rejected') return badge('#f87171', 'rgba(248,113,113,0.10)');
    return badge('#fbbf24', 'rgba(251,191,36,0.10)');
};

const issueSeverityBadge = (severity) => {
    const key = String(severity || '').toLowerCase();
    if (key === 'high') return badge('#f87171', 'rgba(248,113,113,0.10)');
    if (key === 'medium') return badge('#fbbf24', 'rgba(251,191,36,0.10)');
    return badge('#60a5fa', 'rgba(96,165,250,0.10)');
};

const statusBadge = (status) => {
    const key = String(status || '').toLowerCase();
    if (key === 'approved' || key === 'received' || key === 'resolved') return badge('#22c55e', 'rgba(34,197,94,0.10)');
    if (key === 'rejected') return badge('#f87171', 'rgba(248,113,113,0.10)');
    if (key === 'incomplete') return badge('#f59e0b', 'rgba(245,158,11,0.10)');
    return badge('#fbbf24', 'rgba(251,191,36,0.10)');
};

export default function ForemanSubmissions({
    assignedProjects = [],
    projects = [],
    projectScopes = [],
    latestWeeklyAccomplishmentDraft = null,
    progressPhotos = emptyPaginated,
    recentMaterialRequests = emptyPaginated,
    recentIssueReports = emptyPaginated,
    recentDeliveries = emptyPaginated,
}) {
    const { flash } = usePage().props;
    const initialWeeklyDraftState = useMemo(
        () => buildWeeklyAccomplishmentDraftState(latestWeeklyAccomplishmentDraft),
        [latestWeeklyAccomplishmentDraft]
    );

    const [weekStart, setWeekStart] = useState(() => initialWeeklyDraftState.weekStart);
    const [accomplishmentProjectId, setAccomplishmentProjectId] = useState(() => initialWeeklyDraftState.projectId);
    const [scopes, setScopes] = useState(() => initialWeeklyDraftState.scopes);
    const [customScopes, setCustomScopes] = useState(() => initialWeeklyDraftState.customScopes);
    const [savingAccomplishment, setSavingAccomplishment] = useState(false);

    const [materials, setMaterials] = useState([{ material_name: '', quantity: '', unit: '', remarks: '' }]);
    const [savingMaterials, setSavingMaterials] = useState(false);

    const [issue, setIssue] = useState({ issue_title: '', description: '', severity: 'medium' });
    const [savingIssue, setSavingIssue] = useState(false);

    const [delivery, setDelivery] = useState({
        delivery_project_id: '',
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
    const [previewPhoto, setPreviewPhoto] = useState(null);

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

    const progressPhotosPager = asPaginated(progressPhotos);
    const materialRequestsPager = asPaginated(recentMaterialRequests);
    const issueReportsPager = asPaginated(recentIssueReports);
    const deliveriesPager = asPaginated(recentDeliveries);
    const currentPreviewIndex = useMemo(() => {
        if (!previewPhoto) return -1;
        return progressPhotosPager.data.findIndex((photo) => Number(photo.id) === Number(previewPhoto.id));
    }, [previewPhoto, progressPhotosPager.data]);
    const canPreviewPrev = currentPreviewIndex > 0;
    const canPreviewNext = currentPreviewIndex >= 0 && currentPreviewIndex < progressPhotosPager.data.length - 1;

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

    useEffect(() => {
        if (!previewPhoto) return;
        if (currentPreviewIndex === -1) {
            setPreviewPhoto(null);
        }
    }, [previewPhoto, currentPreviewIndex]);

    const submitAccomplishment = () => {
        const fixedScopes = scopes.filter((s) => String(s.percent_completed).trim() !== '');
        const manualScopes = customScopes
            .map((s) => ({
                scope_of_work: String(s.scope_of_work || '').trim(),
                percent_completed: String(s.percent_completed || '').trim(),
            }))
            .filter((s) => s.scope_of_work !== '' || s.percent_completed !== '');

        if (manualScopes.some((s) => s.scope_of_work === '' || s.percent_completed === '')) {
            return toast.error('Complete both custom scope name and % for manual entries.');
        }

        const payloadScopes = [...fixedScopes, ...manualScopes];
        if (!accomplishmentProjectId) return toast.error('Project is required for weekly accomplishment.');
        if (!weekStart) return toast.error('Week start is required.');
        if (payloadScopes.length === 0) return toast.error('Enter at least one accomplishment.');

        setSavingAccomplishment(true);
        router.post(
            '/foreman/submit-all',
            { accomplishment_project_id: accomplishmentProjectId, week_start: weekStart, scopes: payloadScopes },
            {
                preserveScroll: true,
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
        if (!delivery.delivery_project_id) {
            return toast.error('Project is required for delivery confirmation.');
        }

        setSavingDelivery(true);
        router.post(
            '/foreman/submit-all',
            {
                ...delivery,
                delivery_project_id: delivery.delivery_project_id || null,
            },
            {
                preserveScroll: true,
                onSuccess: () =>
                    setDelivery({
                        delivery_project_id: '',
                        item_delivered: '',
                        quantity: '',
                        delivery_date: '',
                        supplier: '',
                        status: 'received',
                    }),
                onFinish: () => setSavingDelivery(false),
            }
        );
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

    const showPrevPreviewPhoto = () => {
        if (!canPreviewPrev) return;
        setPreviewPhoto(progressPhotosPager.data[currentPreviewIndex - 1] ?? null);
    };

    const showNextPreviewPhoto = () => {
        if (!canPreviewNext) return;
        setPreviewPhoto(progressPhotosPager.data[currentPreviewIndex + 1] ?? null);
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
                                        <a href={p.public_submit_url} target="_blank" rel="noreferrer" style={{ ...btn(true), textDecoration: 'none' }}>Open Jotform</a>
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
                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Project</label>
                                    <SearchableDropdown
                                        options={projectOptions}
                                        value={accomplishmentProjectId}
                                        onChange={(value) => setAccomplishmentProjectId(value || '')}
                                        getOptionLabel={(o) => o.name}
                                        getOptionValue={(o) => o.id}
                                        placeholder="Select project"
                                        searchPlaceholder="Search projects..."
                                        emptyMessage="No projects"
                                        clearable
                                        style={{ ...input, minHeight: 38 }}
                                        dropdownWidth={320}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Week Start</label>
                                    <DatePickerInput
                                        value={weekStart}
                                        onChange={(value) => setWeekStart(value || '')}
                                        style={input}
                                    />
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
                                <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            Other / manual scope entries
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCustomScopes((prev) => [...prev, { scope_of_work: '', percent_completed: '' }])}
                                            style={btn(false)}
                                        >
                                            + Add Other
                                        </button>
                                    </div>

                                    {customScopes.length > 0 && (
                                        <div style={{ display: 'grid', gap: 6 }}>
                                            {customScopes.map((row, idx) => (
                                                <div key={`custom-scope-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 8 }}>
                                                    <input
                                                        value={row.scope_of_work}
                                                        onChange={(e) =>
                                                            setCustomScopes((prev) =>
                                                                prev.map((item, i) => i === idx ? { ...item, scope_of_work: e.target.value } : item)
                                                            )
                                                        }
                                                        style={input}
                                                        placeholder="Enter custom scope of work"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        placeholder="%"
                                                        value={row.percent_completed}
                                                        onChange={(e) =>
                                                            setCustomScopes((prev) =>
                                                                prev.map((item, i) => i === idx ? { ...item, percent_completed: e.target.value } : item)
                                                            )
                                                        }
                                                        style={input}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setCustomScopes((prev) => prev.filter((_, i) => i !== idx))}
                                                        style={btn(false)}
                                                    >
                                                        X
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <SearchableDropdown
                                        options={projectOptions}
                                        value={delivery.delivery_project_id}
                                        onChange={(value) => setDelivery((prev) => ({ ...prev, delivery_project_id: value || '' }))}
                                        getOptionLabel={(o) => o.name}
                                        getOptionValue={(o) => o.id}
                                        placeholder="Project"
                                        searchPlaceholder="Search projects..."
                                        emptyMessage="No projects"
                                        clearable
                                        style={{ ...input, minHeight: 38 }}
                                        dropdownWidth={320}
                                    />
                                </div>
                                <input value={delivery.item_delivered} onChange={(e) => setDelivery((prev) => ({ ...prev, item_delivered: e.target.value }))} style={input} placeholder="Item delivered" />
                                <input value={delivery.quantity} onChange={(e) => setDelivery((prev) => ({ ...prev, quantity: e.target.value }))} style={input} placeholder="Quantity" />
                                <DatePickerInput
                                    value={delivery.delivery_date}
                                    onChange={(value) => setDelivery((prev) => ({ ...prev, delivery_date: value || '' }))}
                                    style={input}
                                />
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
                            {progressPhotosPager.data.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No uploaded proof photos yet.</div>
                            ) : (
                                progressPhotosPager.data.map((photo) => (
                                    <button
                                        key={photo.id}
                                        type="button"
                                        onClick={() => setPreviewPhoto(photo)}
                                        style={{
                                            textDecoration: 'none',
                                            color: 'inherit',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 8,
                                            background: 'var(--surface-2)',
                                            padding: 8,
                                            cursor: 'pointer',
                                            width: '100%',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <img src={`/storage/${photo.photo_path}`} alt={photo.caption || 'Progress proof'} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} />
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>{photo.project_name || 'Unassigned'}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {photo.caption || 'No caption'}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        <InlinePagination pager={progressPhotosPager} />
                    </div>

                    <div style={card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700 }}>Submission History</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Latest records for your material requests, issues, and deliveries
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10, background: 'var(--surface-2)' }}>
                                <div style={{ fontWeight: 700, marginBottom: 8 }}>Material Requests</div>
                                <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                                    {materialRequestsPager.data.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No material request records yet.</div>
                                    ) : (
                                        materialRequestsPager.data.map((row) => (
                                            <div key={row.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 8, background: 'var(--surface-1)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{row.material_name}</div>
                                                    <span style={materialStatusBadge(row.status)}>{row.status || 'pending'}</span>
                                                </div>
                                                <div style={{ fontSize: 12, marginTop: 4 }}>
                                                    Qty: {row.quantity || '-'} {row.unit || ''}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                                    {row.remarks ? `Remarks: ${row.remarks}` : 'No remarks'}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{row.created_at || '-'}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <InlinePagination pager={materialRequestsPager} />
                            </div>

                            <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10, background: 'var(--surface-2)' }}>
                                <div style={{ fontWeight: 700, marginBottom: 8 }}>Issue Reports</div>
                                <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                                    {issueReportsPager.data.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No issue report records yet.</div>
                                    ) : (
                                        issueReportsPager.data.map((row) => (
                                            <div key={row.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 8, background: 'var(--surface-1)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{row.issue_title}</div>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                        <span style={issueSeverityBadge(row.severity)}>{row.severity || 'medium'}</span>
                                                        <span style={statusBadge(row.status)}>{row.status || 'open'}</span>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'normal' }}>
                                                    {row.description || 'No description'}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{row.created_at || '-'}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <InlinePagination pager={issueReportsPager} />
                            </div>

                            <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10, background: 'var(--surface-2)' }}>
                                <div style={{ fontWeight: 700, marginBottom: 8 }}>Delivery Confirmations</div>
                                <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                                    {deliveriesPager.data.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No delivery records yet.</div>
                                    ) : (
                                        deliveriesPager.data.map((row) => (
                                            <div key={row.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 8, background: 'var(--surface-1)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{row.item_delivered}</div>
                                                    <span style={statusBadge(row.status)}>{row.status || 'received'}</span>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                                    Project: {row.project_name || 'Unassigned'} (ID: {row.project_id ?? '-'})
                                                </div>
                                                <div style={{ fontSize: 12, marginTop: 4 }}>Qty: {row.quantity || '-'}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                                    Delivery Date: {row.delivery_date || '-'} {row.supplier ? `| Supplier: ${row.supplier}` : ''}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{row.created_at || '-'}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <InlinePagination pager={deliveriesPager} />
                            </div>
                        </div>
                    </div>
                </div>

                <Modal
                    open={!!previewPhoto}
                    onClose={() => setPreviewPhoto(null)}
                    title={previewPhoto?.caption || 'Progress Photo Preview'}
                    maxWidth={900}
                >
                    {previewPhoto && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            <div style={{ position: 'relative' }}>
                                <img
                                    src={`/storage/${previewPhoto.photo_path}`}
                                    alt={previewPhoto.caption || 'Progress proof'}
                                    style={{
                                        width: '100%',
                                        maxHeight: '70vh',
                                        objectFit: 'contain',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        background: 'var(--surface-2)',
                                        display: 'block',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={showPrevPreviewPhoto}
                                    disabled={!canPreviewPrev}
                                    aria-label="Previous photo"
                                    style={previewArrowBtn(canPreviewPrev, 'left')}
                                >
                                    <ChevronLeft size={20} strokeWidth={2.25} />
                                </button>
                                <button
                                    type="button"
                                    onClick={showNextPreviewPhoto}
                                    disabled={!canPreviewNext}
                                    aria-label="Next photo"
                                    style={previewArrowBtn(canPreviewNext, 'right')}
                                >
                                    <ChevronRight size={20} strokeWidth={2.25} />
                                </button>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Project: {previewPhoto.project_name || 'Unassigned'} | {previewPhoto.created_at || '-'}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {currentPreviewIndex >= 0 ? `${currentPreviewIndex + 1} / ${progressPhotosPager.data.length} (this page)` : '-'}
                                </div>
                                <a
                                    href={`/storage/${previewPhoto.photo_path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ ...btn(false), textDecoration: 'none' }}
                                >
                                    Open in new tab
                                </a>
                            </div>
                        </div>
                    )}
                </Modal>
            </Layout>
        </>
    );
}
