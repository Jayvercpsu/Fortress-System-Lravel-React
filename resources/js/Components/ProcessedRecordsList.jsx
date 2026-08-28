import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, XCircle, Trash2, Eye, ChevronDown, ChevronUp } from 'lucide-react';

const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    processed: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    error: 'bg-red-100 text-red-800',
};

const statusIcons = {
    pending: Clock,
    processed: Eye,
    confirmed: CheckCircle,
    rejected: XCircle,
    error: XCircle,
};

export default function ProcessedRecordsList({ projectId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    const fetchRecords = async () => {
        try {
            const response = await fetch(`/projects/${projectId}/processed-records`, {
                headers: { 'Accept': 'application/json' },
            });
            const data = await response.json();
            setRecords(data.data || []);
        } catch (err) {
            console.error('Failed to fetch records:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [projectId]);

    const handleStatusChange = async (recordId, status) => {
        try {
            const response = await fetch(`/projects/${projectId}/processed-records/${recordId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ status }),
            });

            if (!response.ok) throw new Error('Failed to update');

            toast.success(`Record ${status}`);
            fetchRecords();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleDelete = async (recordId) => {
        if (!confirm('Are you sure you want to delete this record?')) return;

        try {
            const response = await fetch(`/projects/${projectId}/processed-records/${recordId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) throw new Error('Failed to delete');

            toast.success('Record deleted');
            fetchRecords();
        } catch (err) {
            toast.error(err.message);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-8 text-gray-500">
                Loading records...
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No processed records yet. Upload an image to get started.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {records.map((record) => {
                const StatusIcon = statusIcons[record.status] || Clock;
                const isExpanded = expandedId === record.id;

                return (
                    <div
                        key={record.id}
                        className="border rounded-lg overflow-hidden"
                    >
                        {/* Record Header */}
                        <div
                            className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[record.status]}`}>
                                    <StatusIcon size={12} className="inline mr-1" />
                                    {record.status}
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                    {record.record_type === 'attendance' ? '📋 Attendance' : '🧾 Expense'}
                                </span>
                                <span className="text-xs text-gray-500">
                                    by {record.user?.fullname}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {new Date(record.created_at).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {record.status === 'processed' && (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(record.id, 'confirmed'); }}
                                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                                            title="Confirm"
                                        >
                                            <CheckCircle size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(record.id, 'rejected'); }}
                                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                                            title="Reject"
                                        >
                                            <XCircle size={16} />
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <div className="p-4 border-t space-y-3">
                                {/* Image */}
                                {record.image_path && (
                                    <img
                                        src={`/storage/${record.image_path}`}
                                        alt="Uploaded record"
                                        className="max-h-48 rounded border"
                                    />
                                )}

                                {/* AI Summary */}
                                {record.ai_summary && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-1">AI Summary</h4>
                                        <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded">
                                            {record.ai_summary}
                                        </p>
                                    </div>
                                )}

                                {/* Parsed Data */}
                                {record.ai_parsed_data && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-1">Extracted Data</h4>
                                        <pre className="text-xs bg-gray-50 p-2 rounded border overflow-x-auto">
                                            {JSON.stringify(record.ai_parsed_data, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {/* Model Info */}
                                <div className="text-xs text-gray-400">
                                    Model: {record.ai_model}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
