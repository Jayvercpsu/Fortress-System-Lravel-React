import ActionButton from './ActionButton';
import EditModal from './EditModal';
import ConfirmationModal from './ConfirmationModal';
import Modal from './Modal';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import TextareaInput from './TextareaInput';
import DatePickerInput from './DatePickerInput';
import Layout from './Layout';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
};

const shortcutPill = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid var(--border-color)',
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'var(--surface-2)',
};

const boardShell = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    padding: 16,
    display: 'grid',
    gap: 16,
    color: 'var(--text-main)',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
};

const boardToolbar = {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
};

const boardPanel = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
};

const boardInputStyle = {
    width: '100%',
    background: 'var(--surface-1)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '9px 10px',
    fontSize: 12,
    boxSizing: 'border-box',
};

const boardTableHeaderCell = {
    textAlign: 'left',
    borderBottom: '1px solid var(--row-divider)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    padding: '10px 8px',
    whiteSpace: 'nowrap',
};

const boardTableCell = {
    padding: '10px 8px',
    borderBottom: '1px solid var(--row-divider)',
    whiteSpace: 'nowrap',
    color: 'var(--text-main)',
};

const groupColors = ['#38bdf8', '#a3e635', '#fbbf24', '#f472b6', '#f97316', '#22d3ee', '#c084fc'];

const normalizeGroupKey = (value) => {
    const trimmed = String(value || '').trim();
    return trimmed === '' ? 'General' : trimmed;
};

const normalizeStatus = (status, fallback) => {
    const normalized = String(status || '').trim().toUpperCase();
    return normalized === '' ? fallback : normalized;
};

const formatDate = (value) => (value ? String(value) : '-');
const isImageFile = (file) => {
    const mime = String(file?.mime_type || '').toLowerCase();
    if (mime.startsWith('image/')) return true;
    const name = String(file?.original_name || '').toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].some((ext) => name.endsWith(ext));
};

export default function MonitoringBoardIndexPage({ items = [], status_options: statusOptions = [] }) {
    const resolvedStatusOptions = statusOptions.length > 0 ? statusOptions : ['PROPOSAL', 'IN_REVIEW', 'APPROVED', 'DONE'];

    const {
        data: createData,
        setData: setCreateData,
        post,
        processing: creating,
        errors: createErrors,
        reset: resetCreateData,
    } = useForm({
        department: '',
        client_name: '',
        project_name: '',
        project_type: '',
        location: '',
        assigned_to: '',
        status: resolvedStatusOptions[0],
        start_date: '',
        timeline: '',
        due_date: '',
        date_paid: '',
        progress_percent: 0,
        remarks: '',
    });

    const {
        data: fileData,
        setData: setFileData,
        post: postFile,
        processing: uploadingFile,
        errors: fileErrors,
        reset: resetFileData,
    } = useForm({
        file: null,
    });

    const {
        data: editData,
        setData: setEditData,
        patch,
        processing: updating,
        errors: editErrors,
        clearErrors: clearEditErrors,
    } = useForm({
        department: '',
        client_name: '',
        project_name: '',
        project_type: '',
        location: '',
        assigned_to: '',
        status: resolvedStatusOptions[0],
        start_date: '',
        timeline: '',
        due_date: '',
        date_paid: '',
        progress_percent: 0,
        remarks: '',
    });

    const [search, setSearch] = useState('');
    const [editItem, setEditItem] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [filesItem, setFilesItem] = useState(null);
    const [fileToDelete, setFileToDelete] = useState(null);
    const [deletingFileId, setDeletingFileId] = useState(null);
    const [filesPage, setFilesPage] = useState(1);
    const [previewFile, setPreviewFile] = useState(null);
    const [savingId, setSavingId] = useState(null);
    const [progressDrafts, setProgressDrafts] = useState({});
    const [statusDrafts, setStatusDrafts] = useState({});

    useEffect(() => {
        const nextProgress = {};
        const nextStatus = {};

        items.forEach((item) => {
            nextProgress[item.id] = item.progress_percent ?? 0;
            nextStatus[item.id] = normalizeStatus(item.status, resolvedStatusOptions[0]);
        });

        setProgressDrafts(nextProgress);
        setStatusDrafts(nextStatus);
    }, [items, resolvedStatusOptions]);

    useEffect(() => {
        if (!filesItem) return;
        const updated = items.find((item) => item.id === filesItem.id);
        if (updated && updated !== filesItem) {
            setFilesItem(updated);
        }
    }, [items, filesItem]);

    useEffect(() => {
        if (filesItem) {
            setFilesPage(1);
        }
    }, [filesItem?.id]);

    const filesList = filesItem?.files ?? [];
    const filesPerPage = 5;
    const filesPageCount = Math.max(1, Math.ceil(filesList.length / filesPerPage));
    const safeFilesPage = Math.min(filesPage, filesPageCount);
    const filesStartIndex = (safeFilesPage - 1) * filesPerPage;
    const filesEndIndex = Math.min(filesStartIndex + filesPerPage, filesList.length);
    const pagedFiles = filesList.slice(filesStartIndex, filesEndIndex);

    useEffect(() => {
        if (filesPage > filesPageCount) {
            setFilesPage(filesPageCount);
        }
    }, [filesPage, filesPageCount]);

    const groupedItems = useMemo(() => {
        const needle = String(search || '').trim().toLowerCase();
        const filtered = needle === ''
            ? items
            : items.filter((item) => (
                [
                    item.department,
                    item.client_name,
                    item.project_name,
                    item.project_type,
                    item.location,
                    item.assigned_to,
                    item.status,
                ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(needle))
            ));

        const groups = new Map();
        filtered.forEach((item) => {
            const key = normalizeGroupKey(item.department);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(item);
        });

        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([department, rows]) => ({ department, rows }));
    }, [items, search]);

    const submitCreate = (event) => {
        event.preventDefault();
        post('/monitoring-board', {
            preserveScroll: true,
            onSuccess: () => {
                resetCreateData();
                setCreateData('progress_percent', 0);
                setCreateData('status', resolvedStatusOptions[0]);
                toast.success('Monitoring entry added.');
            },
            onError: () => toast.error('Unable to add entry.'),
        });
    };

    const openEdit = (item) => {
        setEditItem(item);
        if (clearEditErrors) clearEditErrors();
        setEditData({
            department: item.department ?? '',
            client_name: item.client_name ?? '',
            project_name: item.project_name ?? '',
            project_type: item.project_type ?? '',
            location: item.location ?? '',
            assigned_to: item.assigned_to ?? '',
            status: normalizeStatus(item.status, resolvedStatusOptions[0]),
            start_date: item.start_date ?? '',
            timeline: item.timeline ?? '',
            due_date: item.due_date ?? '',
            date_paid: item.date_paid ?? '',
            progress_percent: Number(item.progress_percent ?? 0),
            remarks: item.remarks ?? '',
        });
    };

    const closeEdit = () => {
        if (updating) return;
        setEditItem(null);
        if (clearEditErrors) clearEditErrors();
    };

    const submitEdit = (event) => {
        event.preventDefault();
        if (!editItem) return;
        patch(`/monitoring-board/${editItem.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditItem(null);
                toast.success('Monitoring entry updated.');
            },
            onError: () => toast.error('Unable to update entry.'),
        });
    };

    const confirmDelete = () => {
        if (!itemToDelete) return;
        setDeletingId(itemToDelete.id);
        router.delete(`/monitoring-board/${itemToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setItemToDelete(null);
                toast.success('Monitoring entry deleted.');
            },
            onError: () => toast.error('Unable to delete entry.'),
            onFinish: () => setDeletingId(null),
        });
    };

    const saveQuickUpdate = (item) => {
        if (!item) return;
        if (item.project_id) return;

        const nextProgress = Math.max(0, Math.min(100, Number(progressDrafts[item.id] ?? item.progress_percent ?? 0)));
        const nextStatus = normalizeStatus(statusDrafts[item.id] ?? item.status, resolvedStatusOptions[0]);

        setSavingId(item.id);
        router.patch(
            `/monitoring-board/${item.id}`,
            {
                department: item.department,
                client_name: item.client_name,
                project_name: item.project_name,
                project_type: item.project_type,
                location: item.location,
                assigned_to: item.assigned_to,
                status: nextStatus,
                start_date: item.start_date,
                timeline: item.timeline,
                due_date: item.due_date,
                date_paid: item.date_paid,
                progress_percent: nextProgress,
                remarks: item.remarks,
            },
            {
                preserveScroll: true,
                onSuccess: () => toast.success('Progress updated.'),
                onError: () => toast.error('Unable to update progress.'),
                onFinish: () => setSavingId(null),
            }
        );
    };

    const openFiles = (item) => {
        setFilesItem(item);
        resetFileData();
        setFileToDelete(null);
        setFilesPage(1);
        setPreviewFile(null);
    };

    const closeFiles = () => {
        if (uploadingFile) return;
        setFilesItem(null);
        setFileToDelete(null);
        resetFileData();
        setPreviewFile(null);
    };

    const submitFile = (event) => {
        event.preventDefault();
        if (!filesItem) return;
        if (!fileData.file) {
            toast.error('Please choose a file.');
            return;
        }
        if (fileData.file.size > 5 * 1024 * 1024) {
            toast.error('File must be 5MB or smaller.');
            return;
        }
        const filesItemId = filesItem.id;

        postFile(`/monitoring-board/${filesItem.id}/files`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: (page) => {
                resetFileData();
                if (page?.props?.items && filesItemId) {
                    const updated = page.props.items.find((item) => item.id === filesItemId);
                    if (updated) setFilesItem(updated);
                }
                toast.success('File uploaded.');
            },
            onError: () => toast.error('Unable to upload file.'),
        });
    };

    const confirmDeleteFile = () => {
        if (!fileToDelete) return;
        const filesItemId = filesItem?.id;
        setDeletingFileId(fileToDelete.id);
        router.delete(`/monitoring-board-files/${fileToDelete.id}`, {
            preserveScroll: true,
            onSuccess: (page) => {
                setFileToDelete(null);
                if (previewFile?.id === fileToDelete.id) {
                    setPreviewFile(null);
                }
                if (page?.props?.items && filesItemId) {
                    const updated = page.props.items.find((item) => item.id === filesItemId);
                    if (updated) setFilesItem(updated);
                }
                toast.success('File deleted.');
            },
            onError: () => toast.error('Unable to delete file.'),
            onFinish: () => setDeletingFileId(null),
        });
    };

    return (
        <>
            <Head title="Monitoring Board" />
            <Layout title="Monitoring Board">
                <div style={boardShell}>
                    <div style={boardToolbar}>
                        <div style={{ flex: '1 1 280px', minWidth: 220 }}>
                            <TextInput
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search"
                                style={boardInputStyle}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Manual progress controls are saved per row
                            </div>
                            <div style={shortcutPill}>{items.length} items</div>
                        </div>
                    </div>

                    <form onSubmit={submitCreate} style={{ ...boardPanel, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>New project name/client</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Department</div>
                            <TextInput
                                value={createData.department}
                                onChange={(event) => setCreateData('department', event.target.value)}
                                placeholder="Autocad"
                                style={boardInputStyle}
                            />
                            {createErrors.department && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.department}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Client Name</div>
                            <TextInput
                                value={createData.client_name}
                                onChange={(event) => setCreateData('client_name', event.target.value)}
                                style={boardInputStyle}
                            />
                            {createErrors.client_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.client_name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Project Name</div>
                            <TextInput
                                value={createData.project_name}
                                onChange={(event) => setCreateData('project_name', event.target.value)}
                                style={boardInputStyle}
                            />
                            {createErrors.project_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.project_name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Type</div>
                            <TextInput
                                value={createData.project_type}
                                onChange={(event) => setCreateData('project_type', event.target.value)}
                                style={boardInputStyle}
                            />
                            {createErrors.project_type && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.project_type}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Location</div>
                            <TextInput
                                value={createData.location}
                                onChange={(event) => setCreateData('location', event.target.value)}
                                style={boardInputStyle}
                            />
                            {createErrors.location && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.location}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned</div>
                            <TextInput
                                value={createData.assigned_to}
                                onChange={(event) => setCreateData('assigned_to', event.target.value)}
                                style={boardInputStyle}
                            />
                            {createErrors.assigned_to && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.assigned_to}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                            <SelectInput
                                value={createData.status}
                                onChange={(event) => setCreateData('status', event.target.value)}
                                style={boardInputStyle}
                            >
                                {resolvedStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </SelectInput>
                            {createErrors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.status}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Start Date</div>
                            <DatePickerInput
                                value={createData.start_date}
                                onChange={(value) => setCreateData('start_date', value)}
                                style={boardInputStyle}
                            />
                            {createErrors.start_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.start_date}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Timeline</div>
                            <TextInput
                                value={createData.timeline}
                                onChange={(event) => setCreateData('timeline', event.target.value)}
                                style={boardInputStyle}
                            />
                            {createErrors.timeline && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.timeline}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Due Date</div>
                            <DatePickerInput
                                value={createData.due_date}
                                onChange={(value) => setCreateData('due_date', value)}
                                style={boardInputStyle}
                            />
                            {createErrors.due_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.due_date}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Date Paid</div>
                            <DatePickerInput
                                value={createData.date_paid}
                                onChange={(value) => setCreateData('date_paid', value)}
                                style={boardInputStyle}
                            />
                            {createErrors.date_paid && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.date_paid}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Progress (%)</div>
                            <TextInput
                                type="number"
                                min="0"
                                max="100"
                                value={createData.progress_percent}
                                onChange={(event) => setCreateData('progress_percent', event.target.value)}
                                style={{ ...boardInputStyle, maxWidth: 120 }}
                            />
                            {createErrors.progress_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.progress_percent}</div>}
                        </label>
                    </div>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Remarks</div>
                        <TextareaInput
                            value={createData.remarks}
                            onChange={(event) => setCreateData('remarks', event.target.value)}
                            style={{ ...boardInputStyle, minHeight: 90 }}
                        />
                        {createErrors.remarks && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.remarks}</div>}
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <ActionButton type="submit" variant="success" disabled={creating} style={{ padding: '10px 16px', fontSize: 13 }}>
                            {creating ? 'Saving...' : 'Add Entry'}
                        </ActionButton>
                    </div>
                </form>

                {groupedItems.length === 0 ? (
                    <div style={{ ...boardPanel, fontSize: 13, color: 'var(--text-muted)' }}>No monitoring entries found.</div>
                ) : (
                    groupedItems.map((group, groupIndex) => {
                        const groupColor = groupColors[groupIndex % groupColors.length];

                        return (
                            <div key={group.department} style={boardPanel}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: 12,
                                        marginBottom: 12,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                                        <span
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: '50%',
                                                background: groupColor,
                                                boxShadow: `0 0 0 3px ${groupColor}30`,
                                            }}
                                        />
                                        {group.department}
                                    </div>
                                    <div style={shortcutPill}>{group.rows.length} items</div>
                                </div>
                                <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', minWidth: 0 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1500 }}>
                                        <thead>
                                            <tr>
                                                {[
                                                    'Client',
                                                    'Project',
                                                    'Type',
                                                    'Location',
                                                    'Assigned',
                                                    'Start Date',
                                                    'Timeline',
                                                    'Due Date',
                                                    'Date Paid',
                                                    'Status',
                                                    'Progress',
                                                    'Files',
                                                    'Converted',
                                                    'Actions',
                                                ].map((label) => (
                                                    <th key={label} style={boardTableHeaderCell}>
                                                        {label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.rows.map((item) => {
                                                const isConverted = Boolean(item.project_id);
                                                const progressValue = progressDrafts[item.id] ?? item.progress_percent ?? 0;
                                                const statusValue = statusDrafts[item.id] ?? item.status ?? resolvedStatusOptions[0];
                                                const fileCount = Array.isArray(item.files) ? item.files.length : 0;

                                                return (
                                                    <tr key={item.id}>
                                                        <td style={boardTableCell}>{item.client_name}</td>
                                                        <td style={{ ...boardTableCell, fontWeight: 600 }}>{item.project_name}</td>
                                                        <td style={boardTableCell}>{item.project_type}</td>
                                                        <td style={boardTableCell}>{item.location}</td>
                                                        <td style={boardTableCell}>{item.assigned_to || '-'}</td>
                                                        <td style={boardTableCell}>{formatDate(item.start_date)}</td>
                                                        <td style={boardTableCell}>{item.timeline || '-'}</td>
                                                        <td style={boardTableCell}>{formatDate(item.due_date)}</td>
                                                        <td style={boardTableCell}>{formatDate(item.date_paid)}</td>
                                                        <td style={boardTableCell}>
                                                            <SelectInput
                                                                value={statusValue}
                                                                onChange={(event) => setStatusDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                                                                style={{ ...boardInputStyle, minWidth: 140 }}
                                                                disabled={isConverted}
                                                            >
                                                                {resolvedStatusOptions.map((status) => (
                                                                    <option key={status} value={status}>
                                                                        {status}
                                                                    </option>
                                                                ))}
                                                            </SelectInput>
                                                        </td>
                                                        <td style={boardTableCell}>
                                                            <TextInput
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={progressValue}
                                                                onChange={(event) => setProgressDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                                                                style={{ ...boardInputStyle, maxWidth: 90 }}
                                                                disabled={isConverted}
                                                            />
                                                        </td>
                                                        <td style={boardTableCell}>
                                                            <ActionButton
                                                                type="button"
                                                                variant="neutral"
                                                                onClick={() => openFiles(item)}
                                                                style={{ padding: '6px 10px' }}
                                                            >
                                                                {fileCount ? `Files (${fileCount})` : 'Add Files'}
                                                            </ActionButton>
                                                        </td>
                                                        <td style={boardTableCell}>
                                                            {isConverted ? (
                                                                <ActionButton href={`/projects/${item.project_id}`} variant="view" style={{ padding: '6px 10px' }}>
                                                                    Open Project
                                                                </ActionButton>
                                                            ) : (
                                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not yet</span>
                                                            )}
                                                        </td>
                                                        <td style={boardTableCell}>
                                                            <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                                                                <ActionButton
                                                                    type="button"
                                                                    variant="success"
                                                                    onClick={() => saveQuickUpdate(item)}
                                                                    disabled={savingId === item.id || isConverted}
                                                                    style={{ padding: '6px 10px' }}
                                                                >
                                                                    {savingId === item.id ? 'Saving...' : 'Save'}
                                                                </ActionButton>
                                                                <ActionButton
                                                                    type="button"
                                                                    variant="edit"
                                                                    onClick={() => openEdit(item)}
                                                                    disabled={isConverted}
                                                                    style={{ padding: '6px 10px' }}
                                                                >
                                                                    Edit
                                                                </ActionButton>
                                                                <ActionButton
                                                                    type="button"
                                                                    variant="danger"
                                                                    onClick={() => setItemToDelete(item)}
                                                                    disabled={deletingId === item.id}
                                                                    style={{ padding: '6px 10px' }}
                                                                >
                                                                    Delete
                                                                </ActionButton>
                                                            </div>
                                                            {isConverted && (
                                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                                                                    Moved to Projects on {item.converted_at || 'recently'}.
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })
                )}

                </div>

                <Modal
                    open={!!filesItem}
                    onClose={closeFiles}
                    title={filesItem ? `Files - ${filesItem.project_name}` : 'Files'}
                    maxWidth={720}
                >
                    <div style={{ display: 'grid', gap: 16 }}>
                        <form onSubmit={submitFile} style={{ display: 'grid', gap: 10 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Upload photos or supporting files for this monitoring entry.
                            </div>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontSize: 12 }}>File</div>
                                <TextInput
                                    type="file"
                                    onChange={(event) => setFileData('file', event.target.files?.[0] ?? null)}
                                    style={inputStyle}
                                />
                                {fileErrors.file && <div style={{ color: '#f87171', fontSize: 12 }}>{fileErrors.file}</div>}
                            </label>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <ActionButton type="submit" variant="success" disabled={uploadingFile}>
                                    {uploadingFile ? 'Uploading...' : 'Upload File'}
                                </ActionButton>
                            </div>
                        </form>

                        <div style={{ display: 'grid', gap: 10 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>Attached Files</div>
                                {pagedFiles.length ? (
                                    pagedFiles.map((file) => {
                                        const fileUrl = file.file_path ? `/storage/${file.file_path}` : '#';
                                        const isImage = isImageFile(file);

                                        return (
                                            <div
                                                key={file.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 12,
                                                padding: 10,
                                                borderRadius: 10,
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--surface-2)',
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{file.original_name || 'File'}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {(file.mime_type || 'file').toUpperCase()} • {file.created_at || 'Uploaded'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <ActionButton
                                                    type="button"
                                                    variant="view"
                                                    style={{ padding: '6px 10px' }}
                                                    disabled={!file.file_path}
                                                    href={!isImage ? fileUrl : undefined}
                                                    external={!isImage}
                                                    onClick={() => {
                                                        if (isImage && file.file_path) {
                                                            setPreviewFile(file);
                                                        }
                                                    }}
                                                >
                                                    {isImage ? 'Preview' : 'Open'}
                                                </ActionButton>
                                                <ActionButton
                                                    type="button"
                                                    variant="danger"
                                                    style={{ padding: '6px 10px' }}
                                                    onClick={() => setFileToDelete(file)}
                                                >
                                                    Delete
                                                </ActionButton>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No files uploaded yet.</div>
                            )}
                            {filesList.length > filesPerPage && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        Showing {filesList.length ? filesStartIndex + 1 : 0}-{filesEndIndex} of {filesList.length}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <ActionButton
                                            type="button"
                                            variant="neutral"
                                            onClick={() => setFilesPage((page) => Math.max(1, page - 1))}
                                            disabled={safeFilesPage <= 1}
                                        >
                                            Prev
                                        </ActionButton>
                                        <ActionButton
                                            type="button"
                                            variant="neutral"
                                            onClick={() => setFilesPage((page) => Math.min(filesPageCount, page + 1))}
                                            disabled={safeFilesPage >= filesPageCount}
                                        >
                                            Next
                                        </ActionButton>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>

                <Modal
                    open={!!previewFile}
                    onClose={() => setPreviewFile(null)}
                    title={previewFile ? previewFile.original_name || 'Image Preview' : 'Image Preview'}
                    maxWidth={820}
                >
                    {previewFile ? (
                        <div style={{ display: 'grid', gap: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {previewFile.mime_type || 'image'}
                            </div>
                            <div
                                style={{
                                    borderRadius: 12,
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--surface-2)',
                                    padding: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <img
                                    src={previewFile.file_path ? `/storage/${previewFile.file_path}` : ''}
                                    alt={previewFile.original_name || 'Preview'}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '70vh',
                                        objectFit: 'contain',
                                        borderRadius: 8,
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <ActionButton
                                    href={previewFile.file_path ? `/storage/${previewFile.file_path}` : '#'}
                                    external
                                    variant="view"
                                >
                                    Open in New Tab
                                </ActionButton>
                            </div>
                        </div>
                    ) : null}
                </Modal>

                <EditModal
                    open={!!editItem}
                    onClose={closeEdit}
                    onSubmit={submitEdit}
                    title={editItem ? `Edit Monitoring Entry - ${editItem.project_name}` : 'Edit Monitoring Entry'}
                    submitLabel="Save Changes"
                    processing={updating}
                    maxWidth={860}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Department</div>
                            <TextInput
                                value={editData.department}
                                onChange={(event) => setEditData('department', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.department && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.department}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Client Name</div>
                            <TextInput
                                value={editData.client_name}
                                onChange={(event) => setEditData('client_name', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.client_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.client_name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Project Name</div>
                            <TextInput
                                value={editData.project_name}
                                onChange={(event) => setEditData('project_name', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.project_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.project_name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Type</div>
                            <TextInput
                                value={editData.project_type}
                                onChange={(event) => setEditData('project_type', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.project_type && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.project_type}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Location</div>
                            <TextInput
                                value={editData.location}
                                onChange={(event) => setEditData('location', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.location && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.location}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned</div>
                            <TextInput
                                value={editData.assigned_to}
                                onChange={(event) => setEditData('assigned_to', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.assigned_to && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.assigned_to}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                            <SelectInput
                                value={editData.status}
                                onChange={(event) => setEditData('status', event.target.value)}
                                style={inputStyle}
                            >
                                {resolvedStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </SelectInput>
                            {editErrors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.status}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Start Date</div>
                            <DatePickerInput
                                value={editData.start_date}
                                onChange={(value) => setEditData('start_date', value)}
                                style={inputStyle}
                            />
                            {editErrors.start_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.start_date}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Timeline</div>
                            <TextInput
                                value={editData.timeline}
                                onChange={(event) => setEditData('timeline', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.timeline && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.timeline}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Due Date</div>
                            <DatePickerInput
                                value={editData.due_date}
                                onChange={(value) => setEditData('due_date', value)}
                                style={inputStyle}
                            />
                            {editErrors.due_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.due_date}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Date Paid</div>
                            <DatePickerInput
                                value={editData.date_paid}
                                onChange={(value) => setEditData('date_paid', value)}
                                style={inputStyle}
                            />
                            {editErrors.date_paid && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.date_paid}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Progress (%)</div>
                            <TextInput
                                type="number"
                                min="0"
                                max="100"
                                value={editData.progress_percent}
                                onChange={(event) => setEditData('progress_percent', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.progress_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.progress_percent}</div>}
                        </label>
                    </div>

                    <label style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12 }}>Remarks</div>
                        <TextareaInput
                            value={editData.remarks}
                            onChange={(event) => setEditData('remarks', event.target.value)}
                            style={{ ...inputStyle, minHeight: 90 }}
                        />
                        {editErrors.remarks && <div style={{ color: '#f87171', fontSize: 12 }}>{editErrors.remarks}</div>}
                    </label>
                </EditModal>

                <ConfirmationModal
                    open={!!itemToDelete}
                    title="Delete Monitoring Entry"
                    message={itemToDelete ? `Delete \"${itemToDelete.project_name}\"? This action cannot be undone.` : 'Delete this entry?'}
                    confirmLabel={deletingId ? 'Deleting...' : 'Delete'}
                    cancelLabel="Cancel"
                    danger
                    processing={Boolean(deletingId)}
                    onClose={() => (deletingId ? null : setItemToDelete(null))}
                    onConfirm={confirmDelete}
                />

                <ConfirmationModal
                    open={!!fileToDelete}
                    title="Delete File"
                    message={fileToDelete ? `Delete \"${fileToDelete.original_name || 'this file'}\"?` : 'Delete this file?'}
                    confirmLabel={deletingFileId ? 'Deleting...' : 'Delete'}
                    cancelLabel="Cancel"
                    danger
                    processing={Boolean(deletingFileId)}
                    onClose={() => (deletingFileId ? null : setFileToDelete(null))}
                    onConfirm={confirmDeleteFile}
                />
            </Layout>
        </>
    );
}
