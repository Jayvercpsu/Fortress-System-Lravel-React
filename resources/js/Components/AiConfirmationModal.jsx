import { useState } from 'react';
import DatePickerInput from './DatePickerInput';
import toast from 'react-hot-toast';
import { X, CheckCircle, XCircle, Edit3, Loader2, ChevronDown, ChevronUp, Send } from 'lucide-react';

export default function ConfirmationModal({ records = [], projects = [], imagePreviews = [], onClose, onConfirmed }) {
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [expandedId, setExpandedId] = useState(null);
    const [loadingId, setLoadingId] = useState(null);
    // Track local status and which records have been removed
    const [removedIds, setRemovedIds] = useState(new Set());

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

    const handleSubmit = async (record) => {
        if (!record.project_id) {
            toast.error('Please assign a project before submitting');
            return;
        }

        setLoadingId(record.id);
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
                throw new Error(data.message || 'Failed to submit');
            }

            toast.success('Record submitted to project');
            handleRemove(record.id);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoadingId(null);
        }
    };

    const handleReject = async (record) => {
        setLoadingId(record.id);
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
            handleRemove(record.id);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoadingId(null);
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
            toast.success('Project assigned');
            // Update the record in local state
            const idx = records.findIndex(r => r.id === record.id);
            if (idx !== -1) {
                records[idx] = { ...records[idx], ...data.record };
            }
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
                                <div key={i} className="text-xs flex justify-between">
                                    <span>{worker.name} ({worker.position || worker.worker_role || 'Worker'})</span>
                                    <span>{worker.time_in && worker.time_out ? `${worker.time_in} - ${worker.time_out}` : worker.days_present ? `${worker.days_present} days present` : ''}</span>
                                </div>
                            ))}
                        </div>
                    </div>
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

    // All records done — show completion message
    if (allDone) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
                    <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">All Done!</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        All {totalRelevant} record(s) have been processed.
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

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Review Records</h2>
                        <p className="text-sm text-gray-500">
                            {visibleRecords.filter(r => r.status !== 'submitted').length} remaining
                            {doneCount > 0 && ` • ${doneCount} done`}
                            {irrelevantRecords.length > 0 && ` • ${irrelevantRecords.length} skipped`}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Records List */}
                <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
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
                                                record.record_type === 'attendance' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                            }`}>
                                                {record.record_type === 'attendance' ? '📋' : '🧾'} {record.record_type}
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
                                        <div className="p-4 border-t space-y-4">
                                            {/* Local preview image */}
                                            {imagePreviews[record.image_index] && (
                                                <img
                                                    src={imagePreviews[record.image_index]}
                                                    alt="Uploaded record"
                                                    className="max-h-48 rounded border"
                                                />
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
                                                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 flex items-center gap-1"
                                                    >
                                                        <XCircle size={14} /> Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleSubmit(record)}
                                                        disabled={isLoading || !record.project_id}
                                                        className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
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
    );
}
