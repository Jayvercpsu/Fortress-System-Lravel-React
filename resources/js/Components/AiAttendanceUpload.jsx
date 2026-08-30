import { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import AiProcessingImage from './AiProcessingImage';
import toast from 'react-hot-toast';
import { X, Upload, Camera, Loader2 } from 'lucide-react';

const MAX_IMAGES = 5;

export default function AiAttendanceUpload({ open, onClose, projectId, projectName, onRecordsSaved }) {
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [notes, setNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const fileInputRef = useRef(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!open) {
            setImageFiles([]);
            setImagePreviews([]);
            setNotes('');
            setProcessing(false);
            setResults(null);
            setError(null);
            setShowConfirmation(false);
            setElapsed(0);
        }
    }, [open]);

    // Timer for elapsed time during processing
    useEffect(() => {
        if (processing) {
            setElapsed(0);
            const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
            return () => clearInterval(interval);
        }
    }, [processing]);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newFiles = [...imageFiles, ...files].slice(0, MAX_IMAGES);
        if (newFiles.length > MAX_IMAGES) {
            toast.error(`Maximum ${MAX_IMAGES} images allowed.`);
            return;
        }

        const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
        setResults(null);
        setError(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeImage = (index) => {
        const newFiles = imageFiles.filter((_, i) => i !== index);
        const newPreviews = imagePreviews.filter((_, i) => i !== index);
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
    };

    const handleProcess = async () => {
        if (imageFiles.length === 0) {
            toast.error('Please select at least one image.');
            return;
        }

        setProcessing(true);
        setError(null);
        setResults(null);

        try {
            const formData = new FormData();
            imageFiles.forEach((file) => formData.append('images[]', file));
            formData.append('mode', 'attendance');
            if (projectId) {
                formData.append('project_id', projectId);
            }
            if (notes.trim()) {
                formData.append('notes', notes.trim());
            }

            const response = await fetch('/processed-records', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Processing failed');
            }

            if (data.mode_message) {
                toast(data.mode_message, { icon: '⚠️', duration: 5000 });
            }

            if (!data.records || data.records.length === 0) {
                toast.error(data.message || 'No attendance records found.');
                setError(data.message || 'No attendance records found.');
                return;
            }

            setResults(data);
            setShowConfirmation(true);
        } catch (err) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleConfirmed = (savedRecords = []) => {
        setShowConfirmation(false);
        setImageFiles([]);
        setImagePreviews([]);
        setNotes('');
        setResults(null);
        if (onRecordsSaved) onRecordsSaved(savedRecords);
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose} title="AI Attendance Scanner" maxWidth={680} forceLightTheme>
            <div className="space-y-4" style={{ color: '#1f2937' }}>
                {/* Info banner */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12 }}>
                    <p style={{ fontSize: 13, color: '#1e40af' }}>
                        📋 Upload an image of an attendance sheet. AI will extract worker names, rates, and attendance data.
                    </p>
                    <p style={{ fontSize: 12, color: '#2563eb', marginTop: 4 }}>
                        ⚠️ AI-generated results may not always be accurate. Please review and edit data before submitting.
                    </p>
                </div>

                {/* Upload area */}
                {!processing && !showConfirmation && (
                    <div className="space-y-3">
                        {/* Notes input */}
                        <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: '#4b5563' }}>Notes (optional)</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                className="w-full rounded-lg p-2 text-sm"
                                style={{ border: '1px solid #d1d5db', background: '#ffffff', color: '#1f2937' }}
                                placeholder="e.g. Weekly attendance for Site A, include worker rates..."
                            />
                        </div>

                        {/* File input */}
                        <div
                            className="rounded-lg p-6 text-center transition cursor-pointer"
                            style={{ border: '2px dashed #d1d5db' }}
                            onClick={() => fileInputRef.current?.click()}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#60a5fa'; e.currentTarget.style.background = '#eff6ff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = 'transparent'; }}
                        >
                            <Camera size={32} style={{ margin: '0 auto 8px', color: '#9ca3af' }} />
                            <p style={{ fontSize: 13, color: '#4b5563' }}>Click to select attendance images</p>
                            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>JPG or PNG, max 10MB each (up to {MAX_IMAGES})</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                        />

                        {/* Image previews — contained to prevent overflow */}
                        {imagePreviews.length > 0 && (
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium mb-2" style={{ color: '#374151' }}>
                                    {imagePreviews.length} image(s) selected
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {imagePreviews.map((preview, index) => (
                                        <div key={index} className="relative group overflow-hidden rounded" style={{ border: '1px solid #e5e7eb' }}>
                                            <img
                                                src={preview}
                                                alt={`Upload ${index + 1}`}
                                                className="w-full h-20 object-cover"
                                            />
                                            <button
                                                onClick={() => removeImage(index)}
                                                className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition z-10"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Process button — always visible below previews */}
                        {imageFiles.length > 0 && (
                            <button
                                onClick={handleProcess}
                                className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium"
                            >
                                <Upload size={16} />
                                Scan Attendance ({imageFiles.length} image{imageFiles.length > 1 ? 's' : ''})
                            </button>
                        )}
                    </div>
                )}

                {/* Processing state */}
                {processing && (
                    <div className="text-center py-8 space-y-3">
                        <Loader2 size={32} style={{ margin: '0 auto', color: '#3b82f6' }} className="animate-spin" />
                        <p style={{ fontSize: 13, color: '#4b5563' }}>
                            AI is analyzing {imageFiles.length} image(s)...
                        </p>
                        <p style={{ fontSize: 12, color: '#9ca3af' }}>{elapsed}s elapsed</p>
                    </div>
                )}

                {/* Error */}
                {error && !processing && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, fontSize: 13, color: '#b91c1c' }}>
                        <p className="font-medium">Processing Failed</p>
                        <p className="mt-1">{error}</p>
                        <p style={{ fontSize: 12, marginTop: 8, color: '#dc2626' }}>
                            Your images were not saved. You can try again.
                        </p>
                        {(error.includes('credits') || error.includes('402')) && (
                            <p style={{ fontSize: 12, marginTop: 8, color: '#2563eb' }}>
                                💡 Tip: Add credits at <a href="https://openrouter.ai/settings/credits" target="_blank" rel="noopener noreferrer" className="underline">openrouter.ai/settings/credits</a> to resolve this.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Inline confirmation — records from this modal */}
            {showConfirmation && results?.records && (
                <InlineAttendanceConfirmation
                    records={results.records}
                    imagePreviews={imagePreviews}
                    projectId={projectId}
                    projectName={projectName}
                    onConfirmed={handleConfirmed}
                    onCancel={() => setShowConfirmation(false)}
                />
            )}
        </Modal>
    );
}

/**
 * Simplified inline confirmation for attendance-only records.
 * Shows each record with its image and extracted data.
 */
function InlineAttendanceConfirmation({ records, imagePreviews, projectId, projectName, onConfirmed, onCancel }) {
    const [loadingId, setLoadingId] = useState(null);
    const [removedIds, setRemovedIds] = useState(new Set());
    const [savedIds, setSavedIds] = useState(new Set());

    const visibleRecords = records.filter((r) => !removedIds.has(r.id));
    const allDone = visibleRecords.filter((r) => r.status !== 'submitted').length === 0;

    const handleSubmit = async (record) => {
        setLoadingId(record.id);
        try {
            // Auto-assign project if record doesn't have one and projectId is provided
            if (!record.project_id && projectId) {
                const assignRes = await fetch(`/processed-records/${record.id}/assign-project`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({ project_id: projectId }),
                });
                if (!assignRes.ok) {
                    const assignData = await assignRes.json();
                    throw new Error(assignData.message || 'Failed to assign project');
                }
            }

            const response = await fetch(`/processed-records/${record.id}/confirm`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to submit');
            }

            toast.success('Attendance saved');
            setRemovedIds((prev) => new Set([...prev, record.id]));
            setSavedIds((prev) => new Set([...prev, record.id]));
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
            setRemovedIds((prev) => new Set([...prev, record.id]));
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoadingId(null);
        }
    };

    // Only pass records that were actually saved (confirmed), not rejected
    const handleDone = () => {
        const savedRecords = records.filter((r) => savedIds.has(r.id));
        onConfirmed(savedRecords);
    };

    if (allDone || visibleRecords.length === 0) {
        return (
            <div style={{ marginTop: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>✅ All attendance records processed!</p>
                <button
                    onClick={handleDone}
                    style={{ marginTop: 12, padding: '8px 16px', background: '#16a34a', color: '#fff', borderRadius: 8, fontSize: 13, border: 'none', cursor: 'pointer' }}
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <div className="mt-4 space-y-3 max-h-[50vh] overflow-y-auto">
            <div className="flex items-center justify-between">
                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                    Review ({visibleRecords.filter((r) => r.status !== 'submitted').length} remaining)
                </h3>
            </div>

            {visibleRecords.map((record) => {
                const isLoading = loadingId === record.id;
                const data = record.ai_parsed_data;
                const workers = data?.workers || [];

                return (
                    <div key={record.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid #e5e7eb', background: '#ffffff' }}>
                        <div className="p-3 space-y-2">
                            {/* Image */}
                            {imagePreviews[record.image_index] && (
                                <img
                                    src={imagePreviews[record.image_index]}
                                    alt="Attendance"
                                    className="max-h-32 rounded border"
                                />
                            )}

                            {/* Workers */}
                            {workers.length > 0 && (
                                <div style={{ background: '#f9fafb', borderRadius: 6, padding: 8 }}>
                                    {workers.map((w, i) => (
                                        <div key={i} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="font-medium" style={{ color: '#1f2937' }}>{w.name} ({w.position || 'Worker'})</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {w.daily_rate && (
                                                    <span style={{ color: '#2563eb' }}>₱{Number(w.daily_rate).toLocaleString()}/day</span>
                                                )}
                                                <span style={{ color: '#6b7280' }}>
                                                    {w.days_present ? `${w.days_present} days` : w.time_in ? `${w.time_in}-${w.time_out}` : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Actions */}
                            {record.status !== 'submitted' && (
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => handleReject(record)}
                                        disabled={isLoading}
                                        style={{ padding: '4px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer' }}
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => handleSubmit(record)}
                                        disabled={isLoading}
                                        style={{ padding: '4px 12px', background: '#16a34a', color: '#fff', borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer', opacity: isLoading ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                                        Save Attendance
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
