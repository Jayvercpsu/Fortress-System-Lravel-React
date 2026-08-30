import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Upload, Camera, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import Modal from './Modal';
import AiConfirmationModal from './AiConfirmationModal';
import AiProcessingImage from './AiProcessingImage';

const MAX_IMAGES = 5;

// Theme-aware color helpers using CSS custom properties
const colors = {
    infoBg: 'var(--surface-2)',
    infoBorder: 'var(--border-color)',
    infoText: 'var(--text-muted)',
    label: 'var(--text-main)',
    labelMuted: 'var(--text-muted)',
    dropzoneBorder: 'var(--border-color)',
    dropzoneHover: 'var(--text-muted)',
    icon: 'var(--text-muted)',
    bodyText: 'var(--text-muted)',
    subtleText: 'var(--text-muted-2)',
    textareaBg: 'var(--surface-1)',
    textareaBorder: 'var(--border-color)',
    textareaText: 'var(--text-main)',
    textareaPlaceholder: 'var(--text-muted-2)',
    noticeBg: 'rgba(251, 191, 36, 0.12)',
    noticeBorder: 'rgba(251, 191, 36, 0.4)',
    noticeText: 'var(--text-muted)',
    statusBg: 'rgba(56, 189, 248, 0.12)',
    statusBorder: 'rgba(56, 189, 248, 0.3)',
    statusText: 'var(--text-main)',
    statusTimer: 'var(--text-muted)',
    errorBg: 'var(--toast-error-bg)',
    errorBorder: 'var(--toast-error-border)',
    errorText: 'var(--toast-error-border)',
    errorSubtext: 'var(--text-muted)',
    successBg: 'var(--toast-success-bg)',
    successBorder: 'var(--toast-success-border)',
    successText: 'var(--active-text)',
    resultCardBg: 'var(--surface-2)',
    resultCardBorder: 'var(--border-color)',
    footerBg: 'var(--surface-2)',
    footerBorder: 'var(--border-color)',
    dialogBg: 'var(--surface-1)',
    dialogBorder: 'var(--border-color)',
    dialogText: 'var(--text-main)',
    dialogMuted: 'var(--text-muted)',
};

const recordTypeStyle = (type) => {
    if (type === 'attendance') return { background: 'rgba(59, 130, 246, 0.12)', color: 'var(--status-review-text)' };
    if (type === 'expense') return { background: 'rgba(34, 197, 94, 0.12)', color: 'var(--active-text)' };
    return { background: 'var(--surface-2)', color: 'var(--text-muted)' };
};

const badgePendingStyle = { background: 'rgba(251, 191, 36, 0.18)', color: 'var(--status-proposal-text)' };
const badgeOkStyle = { background: 'rgba(34, 197, 94, 0.18)', color: 'var(--active-text)' };

export default function AiUploadModal({ projects = [], onClose }) {
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [notes, setNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef(null);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(null);
    const abortControllerRef = useRef(null);
    const fileInputRef = useRef(null);

    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newFiles = [...imageFiles, ...files].slice(0, MAX_IMAGES);

        if (newFiles.length > MAX_IMAGES) {
            toast.error(`Maximum ${MAX_IMAGES} images allowed. You selected ${files.length}.`);
            return;
        }

        const newPreviews = newFiles.map(f => URL.createObjectURL(f));

        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
        setResults(null);
        setError(null);

        // Reset file input so same file can be selected again
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

    // Timer for elapsed time during processing
    useEffect(() => {
        if (processing) {
            setElapsed(0);
            timerRef.current = setInterval(() => {
                setElapsed(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [processing]);

    const handleTerminate = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setProcessing(false);
        setShowTerminateConfirm(false);
        setError(null);
        toast.info('Processing cancelled');
    }, []);

    const handleUpload = async () => {
        if (imageFiles.length === 0) {
            toast.error('Please select at least one image');
            return;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;
        setProcessing(true);
        setError(null);

        const formData = new FormData();
        imageFiles.forEach((file) => {
            formData.append('images[]', file);
        });
        if (notes) formData.append('notes', notes);

        try {
            const response = await fetch('/processed-records', {
                method: 'POST',
                body: formData,
                signal: controller.signal,
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Processing failed');
            }

            if (data.saved === 0 && data.skipped > 0) {
                setError(`No construction records found. ${data.skipped} image(s) were not relevant.`);
                toast.error('No records found in images');
                return;
            }

            setResults(data);
            setShowConfirmation(true);
            toast.success(`Processed ${data.saved} record(s)!`);
        } catch (err) {
            if (err.name === 'AbortError') return; // Terminated — already handled
            setError(err.message);
            toast.error(err.message);
        } finally {
            abortControllerRef.current = null;
            setProcessing(false);
        }
    };

    const handleConfirmed = () => {
        setShowConfirmation(false);
        setResults(null);
        setImageFiles([]);
        setImagePreviews([]);
        onClose?.();
    };

    // Keyboard navigation for image preview
    useEffect(() => {
        if (previewIndex === null) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setPreviewIndex(null);
            if (e.key === 'ArrowLeft') setPreviewIndex(prev => prev > 0 ? prev - 1 : imagePreviews.length - 1);
            if (e.key === 'ArrowRight') setPreviewIndex(prev => prev < imagePreviews.length - 1 ? prev + 1 : 0);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [previewIndex, imagePreviews.length]);

    const recordTypeIcon = (type) => {
        if (type === 'attendance') return '📋';
        if (type === 'expense') return '🧾';
        return '❓';
    };

    return (
        <Modal open={true} onClose={onClose} title="AI Record Processing" width="90vw" height="90vh" disableClose={processing}>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Info Banner */}
                <div style={{
                    background: colors.infoBg,
                    border: `1px solid ${colors.infoBorder}`,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 13,
                    color: colors.infoText,
                }}>
                    💡 <strong>AI Auto-Detection:</strong> Upload up to {MAX_IMAGES} images at once. The AI will automatically detect:
                    <ul style={{ marginTop: 4, marginLeft: 16 }}>
                        <li>Record type (attendance or expense)</li>
                        <li>Which project it belongs to</li>
                        <li>Extract all relevant data</li>
                    </ul>
                </div>

                {/* Image Upload */}
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.label }}>
                        Upload Images <span style={{ color: colors.labelMuted, fontWeight: 400 }}>(up to {MAX_IMAGES})</span>
                    </label>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${colors.dropzoneBorder}`,
                            borderRadius: 8,
                            padding: 24,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.dropzoneHover}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = colors.dropzoneBorder}
                    >
                        <Camera size={48} style={{ margin: '0 auto', color: colors.icon }} />
                        <p style={{ color: colors.bodyText, marginTop: 8 }}>
                            Click to upload attendance notes and/or expense receipts
                        </p>
                        <p style={{ fontSize: 13, color: colors.subtleText, marginTop: 4 }}>
                            JPG, PNG — up to 10MB each — up to {MAX_IMAGES} images
                        </p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                    />
                </div>

                {/* Image Previews */}
                {imagePreviews.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium" style={{ color: colors.label }}>
                                {imageFiles.length}/{MAX_IMAGES} image(s) selected
                            </span>
                            <button
                                type="button"
                                onClick={() => { setImageFiles([]); setImagePreviews([]); }}
                                className="text-xs hover:opacity-80"
                                style={{ color: 'var(--toast-error-border)' }}
                            >
                                Clear all
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {imagePreviews.map((preview, index) => (
                                <div key={index} className="relative group">
                                    <AiProcessingImage
                                        src={preview}
                                        alt={`Upload ${index + 1}`}
                                        processing={processing}
                                        onClick={() => !processing && setPreviewIndex(index)}
                                    />
                                    {!processing && (
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="absolute top-1 right-1 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ background: 'var(--toast-error-border)' }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                    <div className="absolute bottom-1 left-1 text-white text-xs px-1 rounded" style={{ background: 'rgba(0,0,0,0.5)' }}>
                                        {index + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Notes */}
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.label }}>
                        Notes (optional)
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg p-2 text-sm"
                        style={{
                            border: `1px solid ${colors.textareaBorder}`,
                            background: colors.textareaBg,
                            color: colors.textareaText,
                        }}
                        placeholder="e.g. Weekly attendance for Site A, include worker hours..."
                    />
                </div>

                {/* Processing Status */}
                {processing && (
                    <>
                        <div style={{
                            background: colors.noticeBg,
                            border: `1px solid ${colors.noticeBorder}`,
                            borderRadius: 8,
                            padding: 12,
                            fontSize: 13,
                            color: colors.noticeText,
                        }}>
                            ⚠️ <strong>AI Accuracy Notice:</strong> Results are generated by AI and may not always be fully accurate or complete. Please carefully review the extracted data before submitting. AI performance depends on image quality and model capabilities.
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-lg" style={{
                            background: colors.statusBg,
                            border: `1px solid ${colors.statusBorder}`,
                            color: colors.statusText,
                        }}>
                            <Loader2 size={20} className="animate-spin" />
                            <span className="flex-1">AI is analyzing {imageFiles.length} image(s)...</span>
                            <span className="text-xs font-mono" style={{ color: colors.statusTimer }}>
                                {Math.floor(elapsed / 60)}m {elapsed % 60}s
                            </span>
                        </div>
                    </>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg" style={{
                        background: colors.errorBg,
                        border: `1px solid ${colors.errorBorder}`,
                        color: colors.errorText,
                    }}>
                        <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Processing Failed</p>
                            <p className="text-sm mt-1" style={{ color: colors.dialogText }}>{error}</p>
                            <p className="text-xs mt-2" style={{ color: colors.errorSubtext }}>
                                Your images were not saved. You can try again.
                            </p>
                            {(error.includes('credits') || error.includes('402')) && (
                                <p className="text-xs mt-2" style={{ color: 'var(--active-text)' }}>
                                    💡 Tip: Add credits at <a href="https://openrouter.ai/settings/credits" target="_blank" rel="noopener noreferrer" className="underline">openrouter.ai/settings/credits</a> to resolve this.
                                </p>
                            )}
                            {error.includes('rate limit') && (
                                <p className="text-xs mt-2" style={{ color: 'var(--active-text)' }}>
                                    💡 Tip: Add $10 credits at openrouter.ai/credits to increase your daily limit from 50 to 1,000 requests.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Results Summary (before confirmation modal) */}
                {results && !showConfirmation && (
                    <div className="space-y-3">
                        <div className="rounded-lg p-3" style={{
                            background: colors.successBg,
                            border: `1px solid ${colors.successBorder}`,
                        }}>
                            <div className="flex items-center gap-2 font-medium" style={{ color: colors.successText }}>
                                <CheckCircle size={18} />
                                Processing Complete
                            </div>
                            {results.summary && (
                                <div className="mt-2 text-sm" style={{ color: colors.successText }}>
                                    📋 {results.summary.attendance} attendance |
                                    🧾 {results.summary.expense} expense |
                                    🚫 {results.skipped} skipped
                                </div>
                            )}
                        </div>

                        {/* Individual Results */}
                        {results.records?.map((record) => (
                            <div key={record.id} className="rounded-lg p-3" style={{
                                background: colors.resultCardBg,
                                border: `1px solid ${colors.resultCardBorder}`,
                            }}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded text-xs font-medium" style={recordTypeStyle(record.record_type)}>
                                                {recordTypeIcon(record.record_type)} {record.record_type}
                                            </span>
                                            {record.status === 'pending_project' ? (
                                                <span className="px-2 py-0.5 rounded text-xs" style={badgePendingStyle}>
                                                    ⚠️ Needs project
                                                </span>
                                            ) : record.project_id ? (
                                                <span className="px-2 py-0.5 rounded text-xs" style={badgeOkStyle}>
                                                    ✅ {record.project?.name || `Project #${record.project_id}`}
                                                </span>
                                            ) : null}
                                        </div>
                                        {record.ai_summary && (
                                            <p className="text-xs mt-1 line-clamp-2" style={{ color: colors.bodyText }}>
                                                {record.ai_summary}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4" style={{
                borderTop: `1px solid ${colors.footerBorder}`,
                background: colors.footerBg,
            }}>
                {processing && (
                    <button
                        onClick={() => setShowTerminateConfirm(true)}
                        className="px-4 py-2 rounded-lg hover:opacity-80"
                        style={{ color: 'var(--toast-error-border)' }}
                    >
                        Cancel
                    </button>
                )}
                {results && !processing && (
                    <button
                        onClick={onClose}
                        className="px-4 py-2 hover:opacity-80"
                        style={{ color: colors.label }}
                    >
                        Done
                    </button>
                )}

                {!results && (
                    <button
                        onClick={handleUpload}
                        disabled={processing || imageFiles.length === 0}
                        className="px-4 py-2 rounded-lg flex items-center gap-2"
                        style={{
                            background: 'var(--active-text)',
                            color: '#fff',
                            opacity: processing || imageFiles.length === 0 ? 0.5 : 1,
                            cursor: processing || imageFiles.length === 0 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {processing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Upload size={16} />
                                Process {imageFiles.length > 1 ? `${imageFiles.length} Images` : 'with AI'}
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Image Preview Lightbox */}
            {previewIndex !== null && (
                <div
                    className="fixed inset-0 z-[1300] flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.8)' }}
                    onClick={() => setPreviewIndex(null)}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setPreviewIndex(prev => prev > 0 ? prev - 1 : imagePreviews.length - 1);
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-3 shadow-lg z-10"
                        style={{ background: 'var(--button-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                    >
                        ‹
                    </button>

                    <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={imagePreviews[previewIndex]}
                            alt={`Preview ${previewIndex + 1}`}
                            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        />
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white text-sm px-3 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.6)' }}>
                            {previewIndex + 1} / {imagePreviews.length}
                        </div>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setPreviewIndex(prev => prev < imagePreviews.length - 1 ? prev + 1 : 0);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-3 shadow-lg z-10"
                        style={{ background: 'var(--button-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                    >
                        ›
                    </button>

                    <button
                        onClick={() => setPreviewIndex(null)}
                        className="absolute top-4 right-4 rounded-full p-2 shadow-lg z-10"
                        style={{ background: 'var(--button-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Terminate Confirmation Dialog */}
            {showTerminateConfirm && (
                <div className="fixed inset-0 z-[1500] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <div className="rounded-lg shadow-xl p-6 max-w-sm w-full mx-4" style={{
                        background: colors.dialogBg,
                        border: `1px solid ${colors.dialogBorder}`,
                    }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: colors.errorBg }}>
                                <AlertCircle size={20} style={{ color: colors.errorText }} />
                            </div>
                            <div>
                                <h3 className="font-semibold" style={{ color: colors.dialogText }}>Cancel Processing?</h3>
                                <p className="text-sm" style={{ color: colors.dialogMuted }}>AI is still analyzing your images.</p>
                            </div>
                        </div>
                        <p className="text-sm mb-5" style={{ color: colors.dialogMuted }}>
                            Are you sure you want to terminate the process? The AI analysis will be stopped and no records will be saved.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowTerminateConfirm(false)}
                                className="px-4 py-2 rounded-lg"
                                style={{
                                    color: colors.label,
                                    border: `1px solid ${colors.dialogBorder}`,
                                    background: 'var(--button-bg)',
                                }}
                            >
                                Continue Processing
                            </button>
                            <button
                                onClick={handleTerminate}
                                className="px-4 py-2 text-white rounded-lg hover:opacity-90"
                                style={{ background: 'var(--toast-error-border)' }}
                            >
                                Yes, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmation && results?.records && (
                <AiConfirmationModal
                    records={results.records}
                    projects={projects}
                    imagePreviews={imagePreviews}
                    onClose={() => setShowConfirmation(false)}
                    onConfirmed={handleConfirmed}
                />
            )}
        </Modal>
    );
}
