import { useEffect, useRef, useState } from 'react';
import DatePickerInput from './DatePickerInput';
import SelectInput from './SelectInput';
import toast from 'react-hot-toast';
import { X, CheckCircle, XCircle, Edit3, Loader2, ChevronDown, ChevronUp, Send } from 'lucide-react';

const normalizeScopeKey = (value) => String(value || '').trim().toLowerCase();

export default function ConfirmationModal({ records = [], projects = [], imagePreviews = [], accomplishmentContext = {}, onClose, onConfirmed }) {
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [expandedId, setExpandedId] = useState(null);
    const [loadingId, setLoadingId] = useState(null);
    // Which action is loading for the record in loadingId ('submit' | 'reject' | null),
    // so the spinner shows on the button actually clicked.
    const [loadingAction, setLoadingAction] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [contextByProject, setContextByProject] = useState(accomplishmentContext || {});
    const [fetchingProjects, setFetchingProjects] = useState([]);
    const [, setRenderTick] = useState(0);
    // Per-scope submit errors: { [recordId]: { [scopeIndex]: message } }
    const [fieldErrors, setFieldErrors] = useState({});
    // "Apply foreman to all scopes" select value per record (resets after applying).
    const [applyAllForeman, setApplyAllForeman] = useState({});
    // Record id currently in the AI scope-check (resolve-scopes) phase,
    // started right after assigning a project. The scopes list renders
    // skeleton placeholders meanwhile.
    const [checkingScopesId, setCheckingScopesId] = useState(null);

    const scopeFieldError = (record, scopeIndex) => (
        fieldErrors?.[record?.id]?.[scopeIndex] || ''
    );

    const clearScopeFieldError = (record, scopeIndex) => {
        setFieldErrors((prev) => {
            if (!prev?.[record?.id]?.[scopeIndex]) return prev;
            const next = { ...prev, [record.id]: { ...prev[record.id] } };
            delete next[record.id][scopeIndex];
            if (Object.keys(next[record.id]).length === 0) delete next[record.id];
            return next;
        });
    };
    // Auto-scroll the first invalid scope field into view whenever
    // per-scope validation errors arrive (e.g. missing foreman on submit).
    // New errors always take the view; otherwise the view only moves when
    // the expanded record has no errors left (e.g. just fixed the last one
    // there while another record still needs attention).
    const seenFieldErrorKeys = useRef(new Set());
    const prevFieldErrorKeys = useRef([]);
    useEffect(() => {
        const entries = Object.entries(fieldErrors || {});
        const keys = [];
        entries.forEach(([recordId, byIndex]) => {
            Object.keys(byIndex || {}).forEach((index) => keys.push(`${recordId}:${index}`));
        });
        const prevKeys = prevFieldErrorKeys.current;
        prevFieldErrorKeys.current = keys;
        if (keys.length === 0) {
            seenFieldErrorKeys.current = new Set();
            return;
        }
        // Expansion-only change (user browsing records): leave them alone.
        const keysChanged = keys.length !== prevKeys.length || keys.some((key) => !prevKeys.includes(key));
        if (!keysChanged) return;
        const unseen = keys.filter((key) => !seenFieldErrorKeys.current.has(key));
        let targetRecordId;
        if (unseen.length > 0) {
            targetRecordId = unseen[0].split(':')[0];
            seenFieldErrorKeys.current.add(unseen[0]);
        } else {
            const expandedHasErrors = expandedId !== null
                && expandedId !== undefined
                && Object.keys(fieldErrors?.[expandedId] || {}).length > 0;
            if (expandedHasErrors) return;
            targetRecordId = entries.find(([, byIndex]) => Object.keys(byIndex || {}).length > 0)?.[0];
        }
        if (targetRecordId !== undefined) {
            setExpandedId(Number(targetRecordId));
        }
        // Poll briefly for the invalid field: the expanded record can take
        // longer than one tick to render with many scopes, and a single
        // timeout would miss it and never scroll.
        let attempts = 0;
        const timer = window.setInterval(() => {
            attempts += 1;
            const target = document.querySelector(
                '[data-testid="review-records-dialog"] [aria-invalid="true"]'
            );
            if (target || attempts >= 15) {
                window.clearInterval(timer);
                if (!target) return;
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (typeof target.focus === 'function') target.focus({ preventScroll: true });
            }
        }, 100);
        return () => window.clearInterval(timer);
    }, [fieldErrors, expandedId]);

    // Track local status and which records have been removed
    const [removedIds, setRemovedIds] = useState(new Set());
    // Track how each record left the review list so the completion
    // message can distinguish submitted records from rejected ones.
    const [submittedIds, setSubmittedIds] = useState(new Set());
    const [rejectedIds, setRejectedIds] = useState(new Set());

    const irrelevantRecords = records.filter(r => r.record_type === 'irrelevant');

    // Visible records (not removed)
    const visibleRecords = records.filter(r => !removedIds.has(r.id));
    const pendingRecords = visibleRecords.filter(r => r.status === 'pending' || r.status === 'pending_project');
    const doneCount = records.length - irrelevantRecords.length - visibleRecords.filter(r => r.status !== 'submitted').length;
    const totalRelevant = records.length - irrelevantRecords.length;

    const allDone = visibleRecords.filter(r => r.status !== 'submitted').length === 0;

    const handleRemove = (recordId) => {
        setRemovedIds(prev => new Set([...prev, recordId]));
    };

    // Project context for accomplishment review: active foremen (same source
    // as Assigned Foremen on /projects/{id}/edit) + current scope assignees.
    const projectContext = (record) => {
        if (!record?.project_id) return null;
        return contextByProject[String(record.project_id)] || null;
    };

    const foremanOptionsFor = (record) => {
        const options = projectContext(record)?.foreman_options;
        return Array.isArray(options) ? options : [];
    };

    // Assignee already stored on the build Scope of Works table, if any.
    const existingAssigneeFor = (record, scopeName) => {
        const scopes = projectContext(record)?.scopes;
        if (!Array.isArray(scopes)) return '';
        const key = normalizeScopeKey(scopeName);
        if (!key) return '';
        const match = scopes.find((s) => normalizeScopeKey(s.scope_name) === key);
        return String(match?.assigned_personnel || '').trim();
    };

    // Fetch context on demand for projects not included in the upload response
    // (e.g. after the user assigns a different project in the modal).
    useEffect(() => {
        const missing = Array.from(new Set(
            records
                .filter((r) => r.record_type === 'accomplishment' && r.project_id && !contextByProject[String(r.project_id)])
                .map((r) => String(r.project_id))
        )).filter((id) => !fetchingProjects.includes(id));

        if (missing.length === 0) return;

        setFetchingProjects((prev) => [...prev, ...missing]);
        missing.forEach((projectId) => {
            fetch(`/projects/${projectId}/accomplishment-context`, {
                headers: { 'Accept': 'application/json' },
            })
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                    if (data) {
                        setContextByProject((prev) => ({ ...prev, [projectId]: data }));
                    }
                })
                .catch(() => {})
                .finally(() => {
                    setFetchingProjects((prev) => prev.filter((id) => id !== projectId));
                });
        });
    }, [records, contextByProject, fetchingProjects]);

    // Assign a foreman to one detected scope straight from Review Records.
    // Persists into ai_parsed_data so Submit (confirm) picks it up.
    const handleScopeAssignee = async (record, scopeIndex, fullname) => {
        const scopes = record?.ai_parsed_data?.scopes;
        if (!Array.isArray(scopes) || !scopes[scopeIndex]) return;

        scopes[scopeIndex] = { ...scopes[scopeIndex], assigned_personnel: fullname };
        setRenderTick((tick) => tick + 1);
        clearScopeFieldError(record, scopeIndex);

        setLoadingId(record.id);
        try {
            const response = await fetch(`/processed-records/${record.id}/edit`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ ai_parsed_data: record.ai_parsed_data }),
            });

            if (!response.ok) throw new Error('Failed to save foreman assignment');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoadingId(null);
        }
    };

    // Assign one foreman to every detected scope that has no stored
    // assignee yet, straight from Review Records. Persists into
    // ai_parsed_data so Submit (confirm) picks it up.
    const handleApplyForemanToAll = async (record, fullname) => {
        if (!fullname) return;
        const scopes = record?.ai_parsed_data?.scopes;
        if (!Array.isArray(scopes)) return;

        let applied = 0;
        scopes.forEach((scope, scopeIndex) => {
            if (!scope || existingAssigneeFor(record, scope.scope_name)) return;
            scopes[scopeIndex] = { ...scope, assigned_personnel: fullname };
            clearScopeFieldError(record, scopeIndex);
            applied += 1;
        });
        setApplyAllForeman((prev) => ({ ...prev, [record.id]: '' }));
        if (applied === 0) return;

        setRenderTick((tick) => tick + 1);

        setLoadingId(record.id);
        try {
            const response = await fetch(`/processed-records/${record.id}/edit`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ ai_parsed_data: record.ai_parsed_data }),
            });

            if (!response.ok) throw new Error('Failed to save foreman assignments');
            toast.success(`Foreman applied to ${applied} scope${applied === 1 ? '' : 's'}`);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoadingId(null);
        }
    };

    const handleSubmit = async (record) => {
        if (!record.project_id) {
            toast.error('Please assign a project before submitting');
            return;
        }

        setLoadingId(record.id);
        setLoadingAction('submit');
        try {
            const response = await fetch(`/processed-records/${record.id}/confirm`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                // Per-scope validation (e.g. missing foreman) keeps the modal
                // open and highlights the offending scope fields.
                if (data.errors && typeof data.errors === 'object') {
                    const scoped = {};
                    Object.entries(data.errors).forEach(([key, messages]) => {
                        const match = String(key).match(/^scopes\.(\d+)\./);
                        if (match) {
                            const message = Array.isArray(messages) ? messages[0] : String(messages || '');
                            if (message) scoped[match[1]] = message;
                        }
                    });
                    setFieldErrors((prev) => ({ ...prev, [record.id]: scoped }));
                    toast.error(data.message || 'Please fix the highlighted fields');
                    return;
                }
                throw new Error(data.message || 'Failed to submit');
            }

            setFieldErrors((prev) => {
                if (!prev?.[record.id]) return prev;
                const next = { ...prev };
                delete next[record.id];
                return next;
            });
            toast.success(data.message || 'Record submitted to project');
            setSubmittedIds(prev => new Set([...prev, record.id]));
            handleRemove(record.id);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoadingId(null);
            setLoadingAction(null);
        }
    };

    const handleReject = async (record) => {
        setLoadingId(record.id);
        setLoadingAction('reject');
        try {
            const response = await fetch(`/processed-records/${record.id}/reject`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) throw new Error('Failed to reject');

            toast.success('Record rejected');
            setRejectedIds(prev => new Set([...prev, record.id]));
            handleRemove(record.id);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoadingId(null);
            setLoadingAction(null);
        }
    };

    const handleAssignProject = async (record, projectId) => {
        setLoadingId(record.id);
        try {
            const response = await fetch(`/processed-records/${record.id}/assign-project`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ project_id: projectId }),
            });

            if (!response.ok) throw new Error('Failed to assign project');

            const data = await response.json();
            // Update the record in local state
            const idx = records.findIndex(r => r.id === record.id);
            if (idx !== -1) {
                records[idx] = { ...records[idx], ...data.record };
            }
            if (data.accomplishment_context && records[idx]?.project_id) {
                const pid = String(records[idx].project_id);
                setContextByProject((prev) => ({ ...prev, [pid]: data.accomplishment_context }));
            }
            // Accomplishment: let the AI re-check the detected scopes against
            // the newly assigned project's Scope of Works (stays in loading
            // state meanwhile so the user sees the AI is checking).
            const assigned = idx !== -1 ? records[idx] : null;
            if (assigned?.record_type === 'accomplishment' && Array.isArray(assigned?.ai_parsed_data?.scopes)) {
                toast('AI is checking scopes against the project…', { icon: '🔍' });
                setCheckingScopesId(record.id);
                try {
                    const resolveResponse = await fetch(`/processed-records/${record.id}/resolve-scopes`, {
                        method: 'POST',
                        headers: {
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                            'Accept': 'application/json',
                        },
                    });
                    if (resolveResponse.ok) {
                        const resolveData = await resolveResponse.json();
                        const resolveIdx = records.findIndex(r => r.id === record.id);
                        if (resolveIdx !== -1 && resolveData.record) {
                            records[resolveIdx] = { ...records[resolveIdx], ...resolveData.record };
                        }
                        if (Number(resolveData.resolved) > 0) {
                            toast.success(`AI matched ${resolveData.resolved} scope${Number(resolveData.resolved) === 1 ? '' : 's'} to the project`);
                        } else {
                            toast.success('Scope check complete — no changes needed');
                        }
                    }
                } catch {
                    // Best-effort only: assignment already succeeded.
                } finally {
                    setCheckingScopesId(null);
                }
            }
            setRenderTick((tick) => tick + 1);
            setExpandedId(null);
            setTimeout(() => setExpandedId(record.id), 50);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoadingId(null);
        }
    };

    const startEdit = (record) => {
        setEditingId(record.id);
        setEditData(record.ai_parsed_data || {});
    };

    const saveEdit = async (record) => {
        setLoadingId(record.id);
        try {
            const response = await fetch(`/processed-records/${record.id}/edit`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ ai_parsed_data: editData }),
            });

            if (!response.ok) throw new Error('Failed to save edits');

            const data = await response.json();
            toast.success('Record updated');
            setFieldErrors((prev) => {
                if (!prev?.[record.id]) return prev;
                const next = { ...prev };
                delete next[record.id];
                return next;
            });
            const idx = records.findIndex(r => r.id === record.id);
            if (idx !== -1) {
                records[idx] = { ...records[idx], ai_parsed_data: editData, ...(data.record || {}) };
            }
            setEditingId(null);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoadingId(null);
        }
    };

    const renderAttendanceData = (data) => {
        if (!data) return <p className="text-gray-500">No data extracted</p>;

        return (
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">Date:</span> {data.date || data.date_range_start || '—'}</div>
                    <div><span className="text-gray-500">Location:</span> {data.location || '—'}</div>
                </div>
                {data.workers && data.workers.length > 0 && (
                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Workers ({data.workers.length}):</p>
                        <div className="bg-gray-50 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
                            {data.workers.map((worker, i) => (
                                <div key={i} className="text-xs flex justify-between items-center">
                                    <span>{worker.name} ({worker.position || worker.worker_role || 'Worker'})</span>
                                    <div className="flex items-center gap-2">
                                        {worker.daily_rate && (
                                            <span className="text-blue-600 font-medium">₱{Number(worker.daily_rate).toLocaleString()}/day</span>
                                        )}
                                        <span className="text-gray-500">
                                            {worker.time_in && worker.time_out ? `${worker.time_in} - ${worker.time_out}` : worker.days_present ? `${worker.days_present} days present` : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderScopeAssignee = (record, scope, scopeIndex) => {
        const existing = existingAssigneeFor(record, scope.scope_name);
        if (existing) {
            return <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded whitespace-nowrap">👷 {existing}</span>;
        }

        const options = foremanOptionsFor(record);
        const selected = String(scope.assigned_personnel || '').trim();
        const hasError = Boolean(scopeFieldError(record, scopeIndex));
        if (options.length === 0) {
            return (
                <span className="text-xs text-gray-400">{selected ? `👷 ${selected}` : 'Unassigned'}</span>
            );
        }

        return (
            <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-yellow-700">👷</span>
                <SelectInput
                    value={options.some((o) => o.fullname === selected) ? selected : ''}
                    onChange={(e) => handleScopeAssignee(record, scopeIndex, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="border rounded p-1 text-xs bg-white"
                    aria-label={`Assign foreman for ${scope.scope_name || `scope ${scopeIndex + 1}`}`}
                    aria-invalid={hasError ? 'true' : undefined}
                    style={hasError ? { borderColor: '#dc2626' } : undefined}
                >
                    <option value="">Select foreman…</option>
                    {options.map((option) => (
                        <option key={option.id} value={option.fullname}>{option.fullname}</option>
                    ))}
                </SelectInput>
            </span>
        );
    };

    const renderAccomplishmentData = (data, record) => {
        if (!data) return <p className="text-gray-500">No data extracted</p>;
        const scopes = Array.isArray(data.scopes) ? data.scopes : [];
        const foremanChoices = foremanOptionsFor(record);
        // A scope counts as assigned when it has a stored assignee or a
        // draft value matching a project foreman. When every scope is
        // assigned, the hint and the "Apply to all scopes" row stay hidden.
        const scopeMissingForeman = (scope) => {
            if (existingAssigneeFor(record, scope?.scope_name)) return false;
            const draft = String(scope?.assigned_personnel || '').trim().toLowerCase();
            if (draft === '') return true;
            return !foremanChoices.some((o) => String(o.fullname || '').trim().toLowerCase() === draft);
        };
        const needsForeman = Boolean(record?.project_id) && foremanChoices.length > 0 && scopes.some(scopeMissingForeman);

        return (
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">Date:</span> {data.date || data.week_start || '—'}</div>
                    <div><span className="text-gray-500">Scopes:</span> {scopes.length}</div>
                </div>
                {checkingScopesId === record?.id ? (
                    <div aria-label={`Checking scopes for record ${record?.id}`}>
                        <p className="text-sm font-medium text-gray-700 mb-1">Scopes ({scopes.length}):</p>
                        <div className="bg-gray-50 rounded p-2 space-y-2">
                            {scopes.map((_, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="h-3 flex-1 rounded bg-gray-200 animate-pulse" />
                                    <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
                                    <div className="h-5 w-20 rounded bg-gray-200 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {needsForeman && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 space-y-2">
                                <p className="text-xs text-yellow-700">
                                    Some scopes have no foreman yet — pick one per scope from this project's assigned foremen, or apply one foreman to all scopes at once.
                                </p>
                                <label className="flex items-center gap-2 text-xs text-yellow-800">
                                    <span className="font-medium whitespace-nowrap">Apply to all scopes:</span>
                                    <SelectInput
                                        value={applyAllForeman[record.id] || ''}
                                        onChange={(e) => handleApplyForemanToAll(record, e.target.value)}
                                        disabled={loadingId === record.id}
                                        className="border rounded p-1 text-xs bg-white flex-1"
                                        aria-label={`Apply foreman to all scopes in record ${record.id}`}
                                    >
                                        <option value="">Select foreman…</option>
                                        {foremanOptionsFor(record).map((option) => (
                                            <option key={option.id} value={option.fullname}>{option.fullname}</option>
                                        ))}
                                    </SelectInput>
                                </label>
                            </div>
                        )}
                        {scopes.length > 0 && (
                            <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Scopes ({scopes.length}):</p>
                                <div className="bg-gray-50 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
                                    {scopes.map((scope, i) => (
                                        <div key={i} className="text-xs flex justify-between items-center gap-2">
                                            <span className="flex-1 truncate">{scope.scope_name || `Scope ${i + 1}`}</span>
                                            <span className="text-gray-500 whitespace-nowrap">
                                                {scope.contract_amount ? `₱${Number(scope.contract_amount).toLocaleString()}` : '—'}
                                                {scope.weight_percent ? ` • ${scope.weight_percent}% wt` : ''}
                                                {scope.progress_percent !== undefined && scope.progress_percent !== null && scope.progress_percent !== '' ? ` • ${scope.progress_percent}%` : ''}
                                            </span>
                                            {record && renderScopeAssignee(record, scope, i)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    const renderExpenseData = (data) => {
        if (!data) return <p className="text-gray-500">No data extracted</p>;

        return (
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">Date:</span> {data.date || '—'}</div>
                    <div><span className="text-gray-500">Location:</span> {data.location || '—'}</div>
                    {data.receipt_number && <div><span className="text-gray-500">Receipt:</span> {data.receipt_number}</div>}
                    {data.paid_by && <div><span className="text-gray-500">Paid By:</span> {data.paid_by}</div>}
                    {data.payment_method && <div><span className="text-gray-500">Payment:</span> {data.payment_method}</div>}
                </div>
                {data.items && data.items.length > 0 && (
                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Items ({data.items.length}):</p>
                        <div className="bg-gray-50 rounded p-2 space-y-1">
                            {data.items.map((item, i) => (
                                <div key={i} className="text-xs flex justify-between">
                                    <span>{item.description} ({item.quantity || 1} × ₱{(item.unit_price || 0).toLocaleString()})</span>
                                    <span className="font-medium">₱{(item.amount || 0).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 text-sm font-medium text-right">
                            Total: ₱{(data.total || data.subtotal || 0).toLocaleString()}
                        </div>
                    </div>
                )}
                {data.remarks && (
                    <div className="text-xs text-gray-500 italic">Remarks: {data.remarks}</div>
                )}
            </div>
        );
    };

    // Attendance form editor
    const renderAttendanceEditor = () => {
        const data = editData;
        const workers = data?.workers || [];

        const updateField = (field, value) => {
            setEditData(prev => ({ ...prev, [field]: value }));
        };

        const updateWorker = (i, field, value) => {
            const updated = [...workers];
            updated[i] = { ...updated[i], [field]: value };
            setEditData(prev => ({ ...prev, workers: updated }));
        };

        const addWorker = () => {
            setEditData(prev => ({
                ...prev,
                workers: [...workers, { name: '', position: 'Worker', time_in: '', time_out: '', hours: 8 }],
            }));
        };

        const removeWorker = (i) => {
            const updated = workers.filter((_, idx) => idx !== i);
            setEditData(prev => ({ ...prev, workers: updated }));
        };

        return (
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                        <DatePickerInput value={data?.date || ''} onChange={(val) => updateField('date', val)} placeholder="YYYY-MM-DD" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                        <input type="text" value={data?.location || ''} onChange={(e) => updateField('location', e.target.value)} className="w-full border rounded p-1.5 text-sm" />
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-600">Workers ({workers.length})</label>
                        <button onClick={addWorker} className="text-xs text-blue-600 hover:text-blue-800">+ Add Worker</button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {workers.map((w, i) => (
                            <div key={i} className="bg-white border rounded p-2 grid grid-cols-[1fr_100px_70px_70px_50px_24px] gap-1 items-center">
                                <input type="text" placeholder="Name" value={w.name || ''} onChange={(e) => updateWorker(i, 'name', e.target.value)} className="border rounded p-1 text-xs" />
                                <input type="text" placeholder="Position" value={w.position || ''} onChange={(e) => updateWorker(i, 'position', e.target.value)} className="border rounded p-1 text-xs" />
                                <input type="text" placeholder="In" value={w.time_in || ''} onChange={(e) => updateWorker(i, 'time_in', e.target.value)} className="border rounded p-1 text-xs" />
                                <input type="text" placeholder="Out" value={w.time_out || ''} onChange={(e) => updateWorker(i, 'time_out', e.target.value)} className="border rounded p-1 text-xs" />
                                <input type="number" placeholder="Hrs" value={w.hours || ''} onChange={(e) => updateWorker(i, 'hours', parseFloat(e.target.value) || 0)} className="border rounded p-1 text-xs" />
                                <button onClick={() => removeWorker(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // Expense form editor
    const renderExpenseEditor = () => {
        const data = editData;
        const items = data?.items || [];

        const updateField = (field, value) => {
            setEditData(prev => ({ ...prev, [field]: value }));
        };

        const updateItem = (i, field, value) => {
            const updated = [...items];
            updated[i] = { ...updated[i], [field]: value };
            // Auto-calc amount
            if (field === 'quantity' || field === 'unit_price') {
                const qty = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(updated[i].quantity) || 0;
                const price = field === 'unit_price' ? parseFloat(value) || 0 : parseFloat(updated[i].unit_price) || 0;
                updated[i].amount = qty * price;
            }
            setEditData(prev => ({ ...prev, items: updated }));
        };

        const addItem = () => {
            setEditData(prev => ({
                ...prev,
                items: [...items, { description: '', category: 'Other', quantity: 1, unit_price: 0, amount: 0 }],
            }));
        };

        const removeItem = (i) => {
            const updated = items.filter((_, idx) => idx !== i);
            setEditData(prev => ({ ...prev, items: updated }));
        };

        const total = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        return (
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                        <DatePickerInput value={data?.date || ''} onChange={(val) => updateField('date', val)} placeholder="YYYY-MM-DD" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                        <input type="text" value={data?.location || ''} onChange={(e) => updateField('location', e.target.value)} className="w-full border rounded p-1.5 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Receipt #</label>
                        <input type="text" value={data?.receipt_number || ''} onChange={(e) => updateField('receipt_number', e.target.value)} className="w-full border rounded p-1.5 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Paid By</label>
                        <input type="text" value={data?.paid_by || ''} onChange={(e) => updateField('paid_by', e.target.value)} className="w-full border rounded p-1.5 text-sm" />
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-600">Items ({items.length})</label>
                        <button onClick={addItem} className="text-xs text-blue-600 hover:text-blue-800">+ Add Item</button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {items.map((item, i) => (
                            <div key={i} className="bg-white border rounded p-2 grid grid-cols-[1fr_90px_50px_70px_70px_24px] gap-1 items-center">
                                <input type="text" placeholder="Description" value={item.description || ''} onChange={(e) => updateItem(i, 'description', e.target.value)} className="border rounded p-1 text-xs" />
                                <select value={item.category || 'Other'} onChange={(e) => updateItem(i, 'category', e.target.value)} className="border rounded p-1 text-xs">
                                    <option value="Materials">Materials</option>
                                    <option value="Transport">Transport</option>
                                    <option value="Food">Food</option>
                                    <option value="Labor">Labor</option>
                                    <option value="Other">Other</option>
                                </select>
                                <input type="number" placeholder="Qty" value={item.quantity || ''} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="border rounded p-1 text-xs" />
                                <input type="number" placeholder="Price" value={item.unit_price || ''} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} className="border rounded p-1 text-xs" />
                                <span className="text-xs text-right font-medium">₱{(item.amount || 0).toLocaleString()}</span>
                                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            </div>
                        ))}
                    </div>
                    <div className="text-right text-sm font-medium mt-2">Total: ₱{total.toLocaleString()}</div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                    <input type="text" value={data?.remarks || ''} onChange={(e) => updateField('remarks', e.target.value)} className="w-full border rounded p-1.5 text-sm" placeholder="Notes..." />
                </div>
            </div>
        );
    };

    // Accomplishment form editor (scope-of-works sheet)
    const renderAccomplishmentEditor = (record) => {
        const data = editData;
        const scopes = Array.isArray(data?.scopes) ? data.scopes : [];
        const editorForemanOptions = record ? foremanOptionsFor(record) : [];

        const updateField = (field, value) => {
            setEditData(prev => ({ ...prev, [field]: value }));
        };

        const updateScope = (i, field, value) => {
            const updated = [...scopes];
            updated[i] = { ...updated[i], [field]: value };
            setEditData(prev => ({ ...prev, scopes: updated }));
        };

        const addScope = () => {
            setEditData(prev => ({
                ...prev,
                scopes: [...scopes, { scope_name: '', contract_amount: '', weight_percent: '', progress_percent: 0, status: 'NOT_STARTED', assigned_personnel: '', remarks: '' }],
            }));
        };

        const removeScope = (i) => {
            const updated = scopes.filter((_, idx) => idx !== i);
            setEditData(prev => ({ ...prev, scopes: updated }));
        };

        return (
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <DatePickerInput value={data?.date || ''} onChange={(val) => updateField('date', val)} placeholder="YYYY-MM-DD" />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-600">Scopes ({scopes.length})</label>
                        <button onClick={addScope} className="text-xs text-blue-600 hover:text-blue-800">+ Add Scope</button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {scopes.map((scope, i) => {
                            const existing = record ? existingAssigneeFor(record, scope.scope_name) : '';
                            const showForemanSelect = !existing && editorForemanOptions.length > 0;
                            return (
                                <div key={i} className="bg-white border rounded p-2 grid grid-cols-[1fr_80px_52px_52px_110px_24px] gap-1 items-center">
                                    <input type="text" placeholder="Scope name" value={scope.scope_name || ''} onChange={(e) => updateScope(i, 'scope_name', e.target.value)} className="border rounded p-1 text-xs" />
                                    <input type="number" placeholder="Contract" value={scope.contract_amount ?? ''} onChange={(e) => updateScope(i, 'contract_amount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} className="border rounded p-1 text-xs" />
                                    <input type="number" placeholder="WT%" value={scope.weight_percent ?? ''} onChange={(e) => updateScope(i, 'weight_percent', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} className="border rounded p-1 text-xs" />
                                    <input type="number" placeholder="Prog%" value={scope.progress_percent ?? ''} onChange={(e) => updateScope(i, 'progress_percent', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} className="border rounded p-1 text-xs" />
                                    {existing ? (
                                        <span className="text-xs text-green-700 truncate" title={existing}>👷 {existing}</span>
                                    ) : showForemanSelect ? (
                                        <SelectInput
                                            value={editorForemanOptions.some((o) => o.fullname === (scope.assigned_personnel || '')) ? scope.assigned_personnel : ''}
                                            onChange={(e) => { updateScope(i, 'assigned_personnel', e.target.value); clearScopeFieldError(record, i); }}
                                            className="border rounded p-1 text-xs bg-white w-full"
                                            aria-label={`Assign foreman for ${scope.scope_name || `scope ${i + 1}`}`}
                                            aria-invalid={scopeFieldError(record, i) ? 'true' : undefined}
                                            style={scopeFieldError(record, i) ? { borderColor: '#dc2626' } : undefined}
                                        >
                                            <option value="">Foreman…</option>
                                            {editorForemanOptions.map((option) => (
                                                <option key={option.id} value={option.fullname}>{option.fullname}</option>
                                            ))}
                                        </SelectInput>
                                    ) : (
                                        <span className="text-xs text-gray-400 truncate">{scope.assigned_personnel || 'No foreman'}</span>
                                    )}
                                    <button onClick={() => removeScope(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // All records done — show completion message. When every record was
    // rejected (none submitted), do not claim anything was processed.
    const submittedCount = submittedIds.size;
    if (allDone) {
        const nothingSubmitted = submittedCount === 0;
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
                    {nothingSubmitted ? (
                        <XCircle size={48} className="mx-auto text-gray-400 mb-4" />
                    ) : (
                        <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                    )}
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                        {nothingSubmitted ? 'Done' : 'All Done!'}
                    </h2>
                    <p className="text-sm text-gray-500 mb-6">
                        {nothingSubmitted
                            ? `All ${totalRelevant} record(s) were rejected. Nothing was saved.`
                            : `All ${totalRelevant} record(s) have been processed.`}
                    </p>
                    <button
                        onClick={onConfirmed}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    const remainingCount = visibleRecords.filter(r => r.status !== 'submitted').length;

    return (
        <>
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-xl overflow-hidden">
            <div data-testid="review-records-dialog" className="bg-white shadow-xl w-full h-full overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Review Records</h2>
                        <p className="text-sm text-gray-500">
                            {remainingCount} remaining
                            {doneCount > 0 && ` • ${doneCount} done`}
                            {irrelevantRecords.length > 0 && ` • ${irrelevantRecords.length} skipped`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 rounded p-1.5 hover:bg-gray-100"
                        aria-label="Close Review Records"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Records List */}
                <div data-testid="review-records-list" className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                    {visibleRecords.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No records to review
                        </div>
                    ) : (
                        visibleRecords.map((record, index) => {
                            const isEditing = editingId === record.id;
                            const isExpanded = expandedId === record.id;
                            const isLoading = loadingId === record.id;

                            return (
                                <div key={record.id} className="border rounded-lg overflow-hidden">
                                    {/* Record Header */}
                                    <div
                                        className={`flex items-center justify-between p-3 cursor-pointer ${isExpanded ? 'bg-gray-100' : 'bg-gray-50 hover:bg-gray-100'}`}
                                        onClick={() => setExpandedId(isExpanded ? null : record.id)}
                                    >
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                record.record_type === 'attendance' ? 'bg-blue-100 text-blue-800' : record.record_type === 'accomplishment' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                                            }`}>
                                                {record.record_type === 'attendance' ? '📋' : record.record_type === 'accomplishment' ? '🏗️' : '🧾'} {record.record_type}
                                            </span>
                                            {record.project_id ? (
                                                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                                    ✅ {record.project?.name || `Project #${record.project_id}`}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded flex items-center gap-1">
                                                    ⚠️ No project assigned
                                                </span>
                                            )}
                                            {record.status === 'submitted' && (
                                                <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                                                    <CheckCircle size={12} /> Submitted
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-500">
                                                Record {index + 1}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                    </div>

                                    {/* Record Content */}
                                    {isExpanded && record.status !== 'submitted' && (
                                        <div className="p-4 border-t space-y-4 overflow-x-auto min-w-0">
                                            {/* Local preview image */}
                                            {imagePreviews[record.image_index] && (
                                                <div className="cursor-pointer group" onClick={() => setPreviewImage(imagePreviews[record.image_index])}>
                                                    <img
                                                        src={imagePreviews[record.image_index]}
                                                        alt="Uploaded record"
                                                        className="max-h-48 rounded border group-hover:opacity-80 transition-opacity"
                                                    />
                                                    <p className="text-xs text-gray-400 mt-1 group-hover:text-blue-500">Click to enlarge</p>
                                                </div>
                                            )}

                                            {/* Project Selection (if no project) */}
                                            {!record.project_id && (
                                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                    <p className="text-sm font-medium text-yellow-800 mb-2">
                                                        ⚠️ This record needs a project assignment
                                                    </p>
                                                    <select
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                handleAssignProject(record, e.target.value);
                                                            }
                                                        }}
                                                        className="w-full border rounded-lg p-2 text-sm"
                                                    >
                                                        <option value="">Select a project...</option>
                                                        {projects.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Extracted Data */}
                                            {isEditing ? (
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                    <p className="text-sm font-medium text-blue-800 mb-3">Editing record data...</p>

                                                    {record.record_type === 'attendance'
                                                        ? renderAttendanceEditor()
                                                        : record.record_type === 'accomplishment'
                                                            ? renderAccomplishmentEditor(record)
                                                            : renderExpenseEditor()
                                                    }

                                                    <div className="flex gap-2 mt-3">
                                                        <button
                                                            onClick={() => saveEdit(record)}
                                                            disabled={isLoading}
                                                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                                        >
                                                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-gray-50 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-sm font-medium text-gray-700">Extracted Data</h4>
                                                        <button
                                                            onClick={() => startEdit(record)}
                                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                        >
                                                            <Edit3 size={12} /> Edit
                                                        </button>
                                                    </div>
                                                    {record.record_type === 'attendance'
                                                        ? renderAttendanceData(record.ai_parsed_data)
                                                        : record.record_type === 'accomplishment'
                                                            ? renderAccomplishmentData(record.ai_parsed_data, record)
                                                            : renderExpenseData(record.ai_parsed_data)
                                                    }
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            {!isEditing && (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleReject(record)}
                                                        disabled={isLoading}
                                                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {isLoading && loadingAction === 'reject' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleSubmit(record)}
                                                        disabled={isLoading || !record.project_id}
                                                        className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {isLoading && loadingAction === 'submit' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                        Submit
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {/* Irrelevant Records */}
                    {irrelevantRecords.length > 0 && (
                        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <p className="text-sm text-gray-600">
                                🚫 {irrelevantRecords.length} image(s) skipped (not construction records)
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>

        {/* Full-screen image preview modal */}
        {previewImage && (
            <div
                className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 cursor-pointer"
                onClick={() => setPreviewImage(null)}
            >
                <button
                    onClick={() => setPreviewImage(null)}
                    className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
                >
                    <X size={28} />
                </button>
                <img
                    src={previewImage}
                    alt="Full preview"
                    className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        )}
        </>
    );
}
