import Layout from './Layout';
import Modal from './Modal';
import SearchableDropdown from './SearchableDropdown';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
};

const STATUS_OPTIONS = ['NOT_STARTED', 'IN_PROGRESS', 'HOLD', 'COMPLETED'];
const normalizeAssignedPersonnelNames = (value) => {
    const rawNames = Array.isArray(value)
        ? value
        : String(value ?? '').split(/[;,]+/);
    const seen = new Set();

    return rawNames
        .map((name) => String(name ?? '').trim())
        .filter((name) => {
            if (!name) return false;
            const key = name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const removeAssignedPersonnelName = (names, toRemove) => {
    const needle = String(toRemove ?? '').trim().toLowerCase();
    if (!needle) return normalizeAssignedPersonnelNames(names);

    return normalizeAssignedPersonnelNames(names).filter((name) => name.toLowerCase() !== needle);
};

const joinAssignedPersonnelNames = (names) => normalizeAssignedPersonnelNames(names).join(', ');

export default function MonitoringBoardPage({ project, scopes = [], foreman_options: foremanOptions = [] }) {
    const { flash } = usePage().props;
    const [editingScopeId, setEditingScopeId] = useState(null);
    const [scopeToDelete, setScopeToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [uploadScopeId, setUploadScopeId] = useState(null);
    const [photoInputKey, setPhotoInputKey] = useState(0);
    const [createAssignedPersonnelNames, setCreateAssignedPersonnelNames] = useState([]);
    const [editAssignedPersonnelNames, setEditAssignedPersonnelNames] = useState([]);
    const assignedPersonnelOptions = useMemo(() => {
        const rows = Array.isArray(foremanOptions) ? foremanOptions : [];

        return rows
            .map((row) => {
                const fullname = String(row?.fullname || '').trim();
                if (fullname === '') return null;
                return {
                    value: fullname,
                    label: fullname,
                };
            })
            .filter(Boolean);
    }, [foremanOptions]);

    const {
        data: createData,
        setData: setCreateData,
        post,
        processing: creating,
        errors: createErrors,
        reset: resetCreateData,
    } = useForm({
        scope_name: '',
        assigned_personnel: '',
        progress_percent: 0,
        status: STATUS_OPTIONS[0],
        remarks: '',
    });

    const {
        data: editData,
        setData: setEditData,
        patch,
        processing: updating,
        errors: editErrors,
    } = useForm({
        scope_name: '',
        assigned_personnel: '',
        progress_percent: 0,
        status: STATUS_OPTIONS[0],
        remarks: '',
    });

    const {
        data: photoData,
        setData: setPhotoData,
        post: postPhoto,
        processing: uploadingPhoto,
        errors: photoErrors,
        reset: resetPhotoData,
    } = useForm({
        photo: null,
        caption: '',
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    const submitCreate = (event) => {
        event.preventDefault();
        post(`/projects/${project.id}/scopes`, {
            preserveScroll: true,
            onSuccess: () => {
                resetCreateData();
                setCreateAssignedPersonnelNames([]);
                setCreateData('progress_percent', 0);
                setCreateData('status', STATUS_OPTIONS[0]);
            },
            onError: () => toast.error('Unable to add scope.'),
        });
    };

    const startEdit = (scope) => {
        setEditingScopeId(scope.id);
        setEditAssignedPersonnelNames(normalizeAssignedPersonnelNames(scope.assigned_personnel ?? ''));
        setEditData({
            scope_name: scope.scope_name ?? '',
            assigned_personnel: scope.assigned_personnel ?? '',
            progress_percent: Number(scope.progress_percent ?? 0),
            status: scope.status ?? STATUS_OPTIONS[0],
            remarks: scope.remarks ?? '',
        });
    };

    const saveEdit = (event, scopeId) => {
        event.preventDefault();
        patch(`/scopes/${scopeId}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingScopeId(null);
                setEditAssignedPersonnelNames([]);
            },
            onError: () => toast.error('Unable to update scope.'),
        });
    };

    const requestDeleteScope = (scope) => {
        setScopeToDelete(scope);
    };

    const closeDeleteModal = () => {
        if (deleting) return;
        setScopeToDelete(null);
    };

    const confirmDeleteScope = () => {
        if (!scopeToDelete) return;

        setDeleting(true);
        router.delete(`/scopes/${scopeToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => setScopeToDelete(null),
            onError: () => toast.error('Unable to delete scope.'),
            onFinish: () => setDeleting(false),
        });
    };

    const openPhotoUploader = (scopeId) => {
        if (uploadingPhoto) return;
        setUploadScopeId(scopeId);
        resetPhotoData();
        setPhotoInputKey((value) => value + 1);
    };

    const cancelPhotoUpload = () => {
        if (uploadingPhoto) return;
        setUploadScopeId(null);
        resetPhotoData();
        setPhotoInputKey((value) => value + 1);
    };

    const submitPhoto = (event, scopeId) => {
        event.preventDefault();

        postPhoto(`/scopes/${scopeId}/photos`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setUploadScopeId(null);
                resetPhotoData();
                setPhotoInputKey((value) => value + 1);
            },
            onError: () => toast.error('Unable to upload scope photo.'),
        });
    };

    const updateCreateAssignedPersonnelNames = (updater) => {
        setCreateAssignedPersonnelNames((prev) => {
            const current = normalizeAssignedPersonnelNames(prev);
            const nextRaw = typeof updater === 'function' ? updater(current) : updater;
            const next = normalizeAssignedPersonnelNames(nextRaw);
            setCreateData('assigned_personnel', joinAssignedPersonnelNames(next));
            return next;
        });
    };

    const updateEditAssignedPersonnelNames = (updater) => {
        setEditAssignedPersonnelNames((prev) => {
            const current = normalizeAssignedPersonnelNames(prev);
            const nextRaw = typeof updater === 'function' ? updater(current) : updater;
            const next = normalizeAssignedPersonnelNames(nextRaw);
            setEditData('assigned_personnel', joinAssignedPersonnelNames(next));
            return next;
        });
    };

    const personnelChipStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 999,
        border: '1px solid var(--border-color)',
        background: 'var(--surface-2)',
        fontSize: 12,
    };

    return (
        <>
            <Head title={`Monitoring Board #${project.id}`} />
            <Layout title={`Monitoring Board - Project #${project.id}`}>
                <div style={{ marginBottom: 12 }}>
                    <Link
                        href={`/projects/${project.id}`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            color: 'var(--text-main)',
                            textDecoration: 'none',
                            border: '1px solid var(--border-color)',
                            background: 'var(--button-bg)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontSize: 13,
                        }}
                    >
                        <ArrowLeft size={16} />
                        Back to Project
                    </Link>
                </div>

                <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Project</div>
                        <div style={{ fontWeight: 700 }}>{project.name}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Overall Progress</div>
                        <div style={{ fontWeight: 700 }}>{project.overall_progress}%</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                        <div style={{ fontWeight: 700 }}>{project.status}</div>
                    </div>
                </div>

                <form onSubmit={submitCreate} style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Scope Name</div>
                        <input
                            value={createData.scope_name}
                            onChange={(event) => setCreateData('scope_name', event.target.value)}
                            style={inputStyle}
                        />
                        {createErrors.scope_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.scope_name}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned Personnel</div>
                        {assignedPersonnelOptions.length > 0 ? (
                            <div style={{ display: 'grid', gap: 6 }}>
                                <SearchableDropdown
                                    options={assignedPersonnelOptions}
                                    value=""
                                    onChange={(value) => {
                                        if (!value) return;
                                        updateCreateAssignedPersonnelNames((prev) => [...prev, value]);
                                    }}
                                    placeholder="Add foreman"
                                    searchPlaceholder="Search foreman..."
                                    emptyMessage="No foreman found"
                                    getOptionValue={(option) => option.value}
                                    getOptionLabel={(option) => option.label}
                                    style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                />
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {createAssignedPersonnelNames.length === 0 ? (
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No foreman selected.</span>
                                    ) : (
                                        createAssignedPersonnelNames.map((name) => (
                                            <span key={`create-assign-${name}`} style={personnelChipStyle}>
                                                <span>{name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => updateCreateAssignedPersonnelNames((prev) => removeAssignedPersonnelName(prev, name))}
                                                    style={{
                                                        border: 'none',
                                                        background: 'transparent',
                                                        color: 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        fontSize: 12,
                                                        padding: 0,
                                                        lineHeight: 1,
                                                    }}
                                                    aria-label={`Remove ${name}`}
                                                >
                                                    x
                                                </button>
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <input
                                value={createData.assigned_personnel}
                                onChange={(event) => setCreateData('assigned_personnel', event.target.value)}
                                style={inputStyle}
                            />
                        )}
                        {createErrors.assigned_personnel && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.assigned_personnel}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Progress (%)</div>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={createData.progress_percent}
                            onChange={(event) => setCreateData('progress_percent', event.target.value)}
                            style={inputStyle}
                        />
                        {createErrors.progress_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.progress_percent}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                        <select
                            value={createData.status}
                            onChange={(event) => setCreateData('status', event.target.value)}
                            style={inputStyle}
                        >
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                        {createErrors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.status}</div>}
                    </label>

                    <label style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Remarks</div>
                        <textarea
                            value={createData.remarks}
                            onChange={(event) => setCreateData('remarks', event.target.value)}
                            style={{ ...inputStyle, minHeight: 90 }}
                        />
                        {createErrors.remarks && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.remarks}</div>}
                    </label>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            type="submit"
                            disabled={creating}
                            style={{
                                background: 'var(--success)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '10px 16px',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: creating ? 'not-allowed' : 'pointer',
                                opacity: creating ? 0.7 : 1,
                            }}
                        >
                            {creating ? 'Adding...' : 'Add Scope'}
                        </button>
                    </div>
                </form>

                <div style={{ ...cardStyle, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr>
                                {['Scope', 'Assigned', 'Progress', 'Status', 'Remarks', 'Photos', 'Updated', 'Actions'].map((label) => (
                                    <th
                                        key={label}
                                        style={{
                                            textAlign: 'left',
                                            borderBottom: '1px solid var(--border-color)',
                                            color: 'var(--text-muted)',
                                            fontWeight: 600,
                                            padding: '10px 8px',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {scopes.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ padding: '14px 8px', color: 'var(--text-muted)' }}>
                                        No scope rows yet.
                                    </td>
                                </tr>
                            )}
                            {scopes.map((scope) => {
                                const isEditing = editingScopeId === scope.id;

                                return (
                                    <tr key={scope.id}>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                            {isEditing ? (
                                                <input
                                                    value={editData.scope_name}
                                                    onChange={(event) => setEditData('scope_name', event.target.value)}
                                                    style={inputStyle}
                                                />
                                            ) : (
                                                scope.scope_name
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                            {isEditing ? (
                                                assignedPersonnelOptions.length > 0 ? (
                                                    <div style={{ display: 'grid', gap: 6 }}>
                                                        <SearchableDropdown
                                                            options={assignedPersonnelOptions}
                                                            value=""
                                                            onChange={(value) => {
                                                                if (!value) return;
                                                                updateEditAssignedPersonnelNames((prev) => [...prev, value]);
                                                            }}
                                                            placeholder="Add foreman"
                                                            searchPlaceholder="Search foreman..."
                                                            emptyMessage="No foreman found"
                                                            getOptionValue={(option) => option.value}
                                                            getOptionLabel={(option) => option.label}
                                                            style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                                        />
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                            {editAssignedPersonnelNames.length === 0 ? (
                                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No foreman selected.</span>
                                                            ) : (
                                                                editAssignedPersonnelNames.map((name) => (
                                                                    <span key={`edit-assign-${scope.id}-${name}`} style={personnelChipStyle}>
                                                                        <span>{name}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateEditAssignedPersonnelNames((prev) => removeAssignedPersonnelName(prev, name))}
                                                                            style={{
                                                                                border: 'none',
                                                                                background: 'transparent',
                                                                                color: 'var(--text-muted)',
                                                                                cursor: 'pointer',
                                                                                fontSize: 12,
                                                                                padding: 0,
                                                                                lineHeight: 1,
                                                                            }}
                                                                            aria-label={`Remove ${name}`}
                                                                        >
                                                                            x
                                                                        </button>
                                                                    </span>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <input
                                                        value={editData.assigned_personnel}
                                                        onChange={(event) => setEditData('assigned_personnel', event.target.value)}
                                                        style={inputStyle}
                                                    />
                                                )
                                            ) : (
                                                scope.assigned_personnel || '-'
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={editData.progress_percent}
                                                    onChange={(event) => setEditData('progress_percent', event.target.value)}
                                                    style={inputStyle}
                                                />
                                            ) : (
                                                `${scope.progress_percent}%`
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                            {isEditing ? (
                                                <select
                                                    value={editData.status}
                                                    onChange={(event) => setEditData('status', event.target.value)}
                                                    style={inputStyle}
                                                >
                                                    {STATUS_OPTIONS.map((status) => (
                                                        <option key={status} value={status}>
                                                            {status}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                scope.status
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                            {isEditing ? (
                                                <textarea
                                                    value={editData.remarks}
                                                    onChange={(event) => setEditData('remarks', event.target.value)}
                                                    style={{ ...inputStyle, minHeight: 60 }}
                                                />
                                            ) : (
                                                scope.remarks || '-'
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'grid', gap: 8, minWidth: 280 }}>
                                                {scope.photos?.length > 0 ? (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                        {scope.photos.map((photo) => (
                                                            <a
                                                                key={photo.id}
                                                                href={`/storage/${photo.photo_path}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                style={{
                                                                    textDecoration: 'none',
                                                                    color: 'inherit',
                                                                    border: '1px solid var(--border-color)',
                                                                    borderRadius: 8,
                                                                    padding: 6,
                                                                    width: 106,
                                                                    background: 'var(--surface-2)',
                                                                }}
                                                            >
                                                                <img
                                                                    src={`/storage/${photo.photo_path}`}
                                                                    alt={photo.caption || 'Scope photo'}
                                                                    style={{
                                                                        width: '100%',
                                                                        height: 68,
                                                                        objectFit: 'cover',
                                                                        borderRadius: 6,
                                                                        marginBottom: 4,
                                                                    }}
                                                                />
                                                                <div style={{ fontSize: 11, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {photo.caption || 'No caption'}
                                                                </div>
                                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {photo.created_at || '-'}
                                                                </div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No photos yet.</div>
                                                )}

                                                {uploadScopeId === scope.id ? (
                                                    <form
                                                        onSubmit={(event) => submitPhoto(event, scope.id)}
                                                        style={{
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: 8,
                                                            padding: 8,
                                                            display: 'grid',
                                                            gap: 8,
                                                            background: 'var(--surface-2)',
                                                        }}
                                                    >
                                                        <input
                                                            key={`photo-input-${scope.id}-${photoInputKey}`}
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(event) => setPhotoData('photo', event.target.files?.[0] ?? null)}
                                                        />
                                                        <input
                                                            value={photoData.caption}
                                                            onChange={(event) => setPhotoData('caption', event.target.value)}
                                                            placeholder="Caption (optional)"
                                                            style={inputStyle}
                                                        />
                                                        {(photoErrors.photo || photoErrors.caption) && (
                                                            <div style={{ color: '#f87171', fontSize: 12 }}>
                                                                {photoErrors.photo || photoErrors.caption}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'inline-flex', gap: 8 }}>
                                                            <button
                                                                type="button"
                                                                onClick={cancelPhotoUpload}
                                                                disabled={uploadingPhoto}
                                                                style={{
                                                                    background: 'var(--button-bg)',
                                                                    color: 'var(--text-main)',
                                                                    border: '1px solid var(--border-color)',
                                                                    borderRadius: 8,
                                                                    padding: '8px 10px',
                                                                    cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                                                                }}
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="submit"
                                                                disabled={uploadingPhoto}
                                                                style={{
                                                                    background: 'var(--success)',
                                                                    color: '#fff',
                                                                    border: 'none',
                                                                    borderRadius: 8,
                                                                    padding: '8px 10px',
                                                                    cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                                                                    opacity: uploadingPhoto ? 0.7 : 1,
                                                                }}
                                                            >
                                                                {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => openPhotoUploader(scope.id)}
                                                        style={{
                                                            background: 'var(--button-bg)',
                                                            color: 'var(--text-main)',
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: 8,
                                                            padding: '8px 10px',
                                                            cursor: 'pointer',
                                                            width: 'fit-content',
                                                        }}
                                                    >
                                                        Add Photo
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                            {scope.updated_at || '-'}
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'inline-flex', gap: 8 }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingScopeId(null);
                                                            setEditAssignedPersonnelNames([]);
                                                        }}
                                                        style={{
                                                            background: 'var(--button-bg)',
                                                            color: 'var(--text-main)',
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: 8,
                                                            padding: '8px 10px',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={updating}
                                                        onClick={(event) => saveEdit(event, scope.id)}
                                                        style={{
                                                            background: 'var(--success)',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: 8,
                                                            padding: '8px 10px',
                                                            cursor: updating ? 'not-allowed' : 'pointer',
                                                            opacity: updating ? 0.7 : 1,
                                                        }}
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'inline-flex', gap: 8 }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(scope)}
                                                        style={{
                                                            background: 'var(--button-bg)',
                                                            color: 'var(--text-main)',
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: 8,
                                                            padding: '8px 10px',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => requestDeleteScope(scope)}
                                                        style={{
                                                            background: '#ef4444',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: 8,
                                                            padding: '8px 10px',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {(editErrors.scope_name || editErrors.progress_percent || editErrors.status || editErrors.assigned_personnel || editErrors.remarks) && (
                        <div style={{ color: '#f87171', fontSize: 12, marginTop: 10 }}>
                            {editErrors.scope_name ||
                                editErrors.progress_percent ||
                                editErrors.status ||
                                editErrors.assigned_personnel ||
                                editErrors.remarks}
                        </div>
                    )}
                </div>

                <Modal
                    open={!!scopeToDelete}
                    onClose={closeDeleteModal}
                    title="Confirm Scope Deletion"
                    maxWidth={520}
                >
                    <div style={{ display: 'grid', gap: 14 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-main)' }}>
                            Delete this scope permanently?
                        </div>
                        <div
                            style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                padding: '10px 12px',
                                background: 'var(--surface-2)',
                            }}
                        >
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Scope Name</div>
                            <div style={{ fontWeight: 600 }}>{scopeToDelete?.scope_name || '-'}</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={deleting}
                                style={{
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    opacity: deleting ? 0.7 : 1,
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteScope}
                                disabled={deleting}
                                style={{
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    opacity: deleting ? 0.7 : 1,
                                }}
                            >
                                {deleting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </Modal>
            </Layout>
        </>
    );
}
