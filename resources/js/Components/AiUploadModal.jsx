import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Upload, Camera, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import Modal from './Modal';
import AiConfirmationModal from './AiConfirmationModal';
import AiProcessingImage from './AiProcessingImage';

const MAX_IMAGES = 5;

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

    const recordTypeColor = (type) => {
        if (type === 'attendance') return 'bg-blue-100 text-blue-800';
        if (type === 'expense') return 'bg-green-100 text-green-800';
        return 'bg-gray-100 text-gray-800';
    };

    return (
        <Modal open={true} onClose={onClose} title="AI Record Processing" width="90vw" height="90vh" disableClose={processing}>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    {/* Info Banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                        💡 <strong>AI Auto-Detection:</strong> Upload up to {MAX_IMAGES} images at once. The AI will automatically detect:
                        <ul className="mt-1 ml-4 list-disc">
                            <li>Record type (attendance or expense)</li>
                            <li>Which project it belongs to</li>
                            <li>Extract all relevant data</li>
                        </ul>
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload Images <span className="text-gray-400 font-normal">(up to {MAX_IMAGES})</span>
                        </label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                        >
                            <Camera size={48} className="mx-auto text-gray-400" />
                            <p className="text-gray-600 mt-2">
                                Click to upload attendance notes and/or expense receipts
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
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
                                <span className="text-sm font-medium text-gray-700">
                                    {imageFiles.length}/{MAX_IMAGES} image(s) selected
                                </span>
                                <button
                                    type="button"
                                    onClick={() => { setImageFiles([]); setImagePreviews([]); }}
                                    className="text-xs text-red-500 hover:text-red-700"
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
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                        <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                                            {index + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes (optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full border rounded-lg p-2 text-sm"
                            placeholder="e.g. Weekly attendance for Site A, include worker hours..."
                        />
                    </div>

                    {/* Processing Status */}
                    {processing && (
                        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg">
                            <Loader2 size={20} className="animate-spin" />
                            <span className="flex-1">AI is analyzing {imageFiles.length} image(s)...</span>
                            <span className="text-xs font-mono text-blue-500">
                                {Math.floor(elapsed / 60)}m {elapsed % 60}s
                            </span>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">Processing Failed</p>
                                <p className="text-sm mt-1">{error}</p>
                                <p className="text-xs mt-2 text-red-500">
                                    Your images were not saved. You can try again.
                                </p>
                                {error.includes('rate limit') && (
                                    <p className="text-xs mt-2 text-blue-600">
                                        💡 Tip: Add $10 credits at openrouter.ai/credits to increase your daily limit from 50 to 1,000 requests.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Results Summary (before confirmation modal) */}
                    {results && !showConfirmation && (
                        <div className="space-y-3">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-green-700 font-medium">
                                    <CheckCircle size={18} />
                                    Processing Complete
                                </div>
                                {results.summary && (
                                    <div className="mt-2 text-sm text-green-600">
                                        📋 {results.summary.attendance} attendance | 
                                        🧾 {results.summary.expense} expense | 
                                        🚫 {results.skipped} skipped
                                    </div>
                                )}
                            </div>

                            {/* Individual Results */}
                            {results.records?.map((record, index) => (
                                <div key={record.id} className="border rounded-lg p-3 bg-gray-50">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${recordTypeColor(record.record_type)}`}>
                                                    {recordTypeIcon(record.record_type)} {record.record_type}
                                                </span>
                                                {record.status === 'pending_project' ? (
                                                    <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                                                        ⚠️ Needs project
                                                    </span>
                                                ) : record.project_id ? (
                                                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                                        ✅ {record.project?.name || `Project #${record.project_id}`}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {record.ai_summary && (
                                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
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
                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                    {processing && (
                        <button
                            onClick={() => setShowTerminateConfirm(true)}
                            className="px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                        >
                            Cancel
                        </button>
                    )}
                    {results && !processing && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:text-gray-900"
                        >
                            Done
                        </button>
                    )}
                    
                    {!results && (
                        <button
                            onClick={handleUpload}
                            disabled={processing || imageFiles.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/80"
                    onClick={() => setPreviewIndex(null)}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setPreviewIndex(prev => prev > 0 ? prev - 1 : imagePreviews.length - 1);
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-lg z-10"
                    >
                        ‹
                    </button>

                    <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={imagePreviews[previewIndex]}
                            alt={`Preview ${previewIndex + 1}`}
                            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        />
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                            {previewIndex + 1} / {imagePreviews.length}
                        </div>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setPreviewIndex(prev => prev < imagePreviews.length - 1 ? prev + 1 : 0);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-lg z-10"
                    >
                        ›
                    </button>

                    <button
                        onClick={() => setPreviewIndex(null)}
                        className="absolute top-4 right-4 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg z-10"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Terminate Confirmation Dialog */}
            {showTerminateConfirm && (
                <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertCircle size={20} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Cancel Processing?</h3>
                                <p className="text-sm text-gray-500">AI is still analyzing your images.</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-5">
                            Are you sure you want to terminate the process? The AI analysis will be stopped and no records will be saved.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowTerminateConfirm(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Continue Processing
                            </button>
                            <button
                                onClick={handleTerminate}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
