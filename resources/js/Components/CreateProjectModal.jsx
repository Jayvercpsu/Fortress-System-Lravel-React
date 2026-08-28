import { useState } from 'react';
import toast from 'react-hot-toast';
import { X, Loader2, Plus } from 'lucide-react';

export default function CreateProjectModal({ detectedName, detectedCode, onClose, onCreated }) {
    const [name, setName] = useState(detectedName || '');
    const [code, setCode] = useState(detectedCode || '');
    const [client, setClient] = useState('');
    const [phase, setPhase] = useState('Construction');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) {
            toast.error('Project name is required');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/projects/quick-create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ name, code, client, phase }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create project');
            }

            toast.success('Project created successfully');
            onCreated?.(data.project);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Create New Project</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {detectedName && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                            <p className="font-medium">AI detected project: "{detectedName}"</p>
                            {detectedCode && <p className="text-xs mt-1">Code: {detectedCode}</p>}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border rounded-lg p-2 text-sm"
                            placeholder="e.g., Construction of Barangay Hall"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Code</label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full border rounded-lg p-2 text-sm"
                            placeholder="e.g., PRJ-001"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                        <input
                            type="text"
                            value={client}
                            onChange={(e) => setClient(e.target.value)}
                            className="w-full border rounded-lg p-2 text-sm"
                            placeholder="e.g., ABC Corporation"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
                        <select
                            value={phase}
                            onChange={(e) => setPhase(e.target.value)}
                            className="w-full border rounded-lg p-2 text-sm"
                        >
                            <option value="Design">Design</option>
                            <option value="Construction">Construction</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:text-gray-900"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={loading || !name.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Plus size={16} />
                        )}
                        Create & Assign
                    </button>
                </div>
            </div>
        </div>
    );
}
