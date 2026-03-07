import Layout from './Layout';
import ActionButton from './ActionButton';
import Modal from './Modal';
import EditModal from './EditModal';
import SearchableDropdown from './SearchableDropdown';
import DatePickerInput from './DatePickerInput';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import TextareaInput from './TextareaInput';
import { Head, router, useForm, usePage } from '@inertiajs/react';
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
const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MonitoringBoardPage({ project, scopes = [], foreman_options: foremanOptions = [] }) {
    const { flash } = usePage().props;
    const [editScope, setEditScope] = useState(null);
    const [scopeToDelete, setScopeToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [uploadScopeId, setUploadScopeId] = useState(null);
    const [photoInputKey, setPhotoInputKey] = useState(0);
    const [scopePreview, setScopePreview] = useState(null);
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
    contract_amount: '',
    weight_percent: '',
    start_date: '',
    target_completion: '',
    });

    const {
        data: editData,
        setData: setEditData,
        patch,
        processing: updating,
        errors: editErrors,
        clearErrors: clearEditErrors,
    } = useForm({
    scope_name: '',
    assigned_personnel: '',
    progress_percent: 0,
    status: STATUS_OPTIONS[0],
    remarks: '',
    contract_amount: '',
    weight_percent: '',
    start_date: '',
    target_completion: '',
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
                setCreateData('progress_percent', 0);
                setCreateData('status', STATUS_OPTIONS[0]);
                setCreateData('contract_amount', '');
                setCreateData('weight_percent', '');
                setCreateData('start_date', '');
                setCreateData('target_completion', '');
            },
            onError: () => toast.error('Unable to add scope.'),
        });
    };

    const startEdit = (scope) => {
        setEditScope(scope);
        if (clearEditErrors) clearEditErrors();
        setEditData({
            scope_name: scope.scope_name ?? '',
            assigned_personnel: scope.assigned_personnel ?? '',
            progress_percent: Number(scope.progress_percent ?? 0),
            status: scope.status ?? STATUS_OPTIONS[0],
            remarks: scope.remarks ?? '',
            contract_amount: scope.contract_amount ?? '',
            weight_percent: scope.weight_percent ?? '',
            start_date: scope.start_date ?? '',
            target_completion: scope.target_completion ?? '',
        });
    };

    const closeEdit = () => {
        if (updating) return;
        setEditScope(null);
        if (clearEditErrors) clearEditErrors();
    };

    const saveEdit = (event) => {
        event.preventDefault();
        if (!editScope) return;
        patch(`/scopes/${editScope.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditScope(null);
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

    return (
        <>
            <Head title={`Monitoring Board #${project.id}`} />
            <Layout title={`Monitoring Board - Project #${project.id}`}>
                <div style={{ marginBottom: 12 }}>
                    <ActionButton
                        href={`/projects/${project.id}`}
                        style={{ padding: '8px 12px', fontSize: 13 }}
                    >
                        <ArrowLeft size={16} />
                        Back to Project
                    </ActionButton>
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
                        <TextInput
                            value={createData.scope_name}
                            onChange={(event) => setCreateData('scope_name', event.target.value)}
                            style={inputStyle}
                        />
                        {createErrors.scope_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.scope_name}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned Personnel</div>
                        {assignedPersonnelOptions.length > 0 ? (
                            <SearchableDropdown
                                options={assignedPersonnelOptions}
                                value={createData.assigned_personnel}
                                onChange={(value) => setCreateData('assigned_personnel', value || '')}
                                placeholder="Select foreman"
                                searchPlaceholder="Search foreman..."
                                emptyMessage="No foreman found"
                                getOptionValue={(option) => option.value}
                                getOptionLabel={(option) => option.label}
                                style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                            />
                        ) : (
                            <TextInput
                                value={createData.assigned_personnel}
                                onChange={(event) => setCreateData('assigned_personnel', event.target.value)}
                                style={inputStyle}
                            />
                        )}
                        {createErrors.assigned_personnel && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.assigned_personnel}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Progress (%)</div>
                        <TextInput
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
                        <SelectInput
                            value={createData.status}
                            onChange={(event) => setCreateData('status', event.target.value)}
                            style={inputStyle}
                        >
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </SelectInput>
                        {createErrors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.status}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Contract Amount</div>
                        <TextInput
                            type="number"
                            min="0"
                            step="0.01"
                            value={createData.contract_amount}
                            onChange={(event) => setCreateData('contract_amount', event.target.value)}
                            style={inputStyle}
                        />
                        {createErrors.contract_amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.contract_amount}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Weight %</div>
                        <TextInput
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={createData.weight_percent}
                            onChange={(event) => setCreateData('weight_percent', event.target.value)}
                            style={inputStyle}
                        />
                        {createErrors.weight_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.weight_percent}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Start Date</div>
                        <DatePickerInput value={createData.start_date} onChange={(value) => setCreateData('start_date', value)} style={inputStyle} />
                        {createErrors.start_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.start_date}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Target Completion</div>
                        <DatePickerInput value={createData.target_completion} onChange={(value) => setCreateData('target_completion', value)} style={inputStyle} />
                        {createErrors.target_completion && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.target_completion}</div>}
                    </label>

                    <label style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Remarks</div>
                        <TextareaInput
                            value={createData.remarks}
                            onChange={(event) => setCreateData('remarks', event.target.value)}
                            style={{ ...inputStyle, minHeight: 90 }}
                        />
                        {createErrors.remarks && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.remarks}</div>}
                    </label>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <ActionButton type="submit" variant="success" disabled={creating} style={{ padding: '10px 16px', fontSize: 13 }}>
                            {creating ? 'Adding...' : 'Add Scope'}
                        </ActionButton>
                    </div>
                </form>

                <div style={{ ...cardStyle, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr>
                        {['Scope', 'Contract', 'Weight', 'Start', 'Target', 'Assigned', 'Progress', 'Status', 'Remarks', 'Photos', 'Updated', 'Actions'].map((label) => (
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
                            {scopes.map((scope) => (
                                <tr key={scope.id}>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                        {scope.scope_name}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                        {scope.contract_amount ? money(scope.contract_amount) : '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                        {scope.weight_percent ? `${Number(scope.weight_percent).toFixed(2)}%` : '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                        {scope.start_date || '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                        {scope.target_completion || '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                        {scope.assigned_personnel || '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                        {`${scope.progress_percent}%`}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                        {scope.status}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                        {scope.remarks || '-'}
                                    </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'grid', gap: 8, minWidth: 280 }}>
                                                {scope.photos?.length > 0 ? (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                        {scope.photos.map((photo) => (
                                                            <button
                                                                key={photo.id}
                                                                type="button"
                                                                onClick={() => setScopePreview({ ...photo, scope: scope.scope_name })}
                                                                style={{
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    padding: 0,
                                                                    cursor: 'pointer',
                                                                    width: 106,
                                                                    textAlign: 'left',
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        border: '1px solid var(--border-color)',
                                                                        borderRadius: 8,
                                                                        padding: 6,
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
                                                                </div>
                                                            </button>
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
                                                        <TextInput
                                                            key={`photo-input-${scope.id}-${photoInputKey}`}
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(event) => setPhotoData('photo', event.target.files?.[0] ?? null)}
                                                        />
                                                        <TextInput
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
                                                            <ActionButton type="button" onClick={cancelPhotoUpload} disabled={uploadingPhoto} style={{ padding: '8px 10px' }}>Cancel</ActionButton>
                                                            <ActionButton type="submit" variant="success" disabled={uploadingPhoto} style={{ padding: '8px 10px' }}>
                                                                {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                                                            </ActionButton>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <ActionButton type="button" onClick={() => openPhotoUploader(scope.id)} style={{ padding: '8px 10px', width: 'fit-content' }}>
                                                        Add Photo
                                                    </ActionButton>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                            {scope.updated_at || '-'}
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'inline-flex', gap: 8 }}>
                                                <ActionButton type="button" variant="edit" onClick={() => startEdit(scope)} style={{ padding: '8px 10px' }}>Edit</ActionButton>
                                                <ActionButton
                                                    type="button"
                                                    variant="danger"
                                                    onClick={() => requestDeleteScope(scope)}
                                                    disabled={deleting}
                                                    loading={deleting && scopeToDelete?.id === scope.id}
                                                    style={{ padding: '8px 10px' }}
                                                >
                                                    {deleting && scopeToDelete?.id === scope.id ? 'Deleting...' : 'Delete'}
                                                </ActionButton>
                                            </div>
                                        </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <EditModal
                    open={!!editScope}
                    onClose={closeEdit}
                    onSubmit={saveEdit}
                    title={editScope ? `Edit Scope - ${editScope.scope_name}` : 'Edit Scope'}
                    submitLabel="Save Changes"
                    processing={updating}
                    maxWidth={860}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Scope Name</div>
                            <TextInput
                                value={editData.scope_name}
                                onChange={(event) => setEditData('scope_name', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.scope_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.scope_name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned Personnel</div>
                            {assignedPersonnelOptions.length > 0 ? (
                                <SearchableDropdown
                                    options={assignedPersonnelOptions}
                                    value={editData.assigned_personnel}
                                    onChange={(value) => setEditData('assigned_personnel', value || '')}
                                    placeholder="Select foreman"
                                    searchPlaceholder="Search foreman..."
                                    emptyMessage="No foreman found"
                                    getOptionValue={(option) => option.value}
                                    getOptionLabel={(option) => option.label}
                                    style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                />
                            ) : (
                                <TextInput
                                    value={editData.assigned_personnel}
                                    onChange={(event) => setEditData('assigned_personnel', event.target.value)}
                                    style={inputStyle}
                                />
                            )}
                            {editErrors.assigned_personnel && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.assigned_personnel}</div>}
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

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                            <SelectInput
                                value={editData.status}
                                onChange={(event) => setEditData('status', event.target.value)}
                                style={inputStyle}
                            >
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </SelectInput>
                            {editErrors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.status}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Contract Amount</div>
                            <TextInput
                                type="number"
                                min="0"
                                step="0.01"
                                value={editData.contract_amount}
                                onChange={(event) => setEditData('contract_amount', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.contract_amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.contract_amount}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Weight %</div>
                            <TextInput
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={editData.weight_percent}
                                onChange={(event) => setEditData('weight_percent', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.weight_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.weight_percent}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Start Date</div>
                            <DatePickerInput value={editData.start_date} onChange={(value) => setEditData('start_date', value)} style={inputStyle} />
                            {editErrors.start_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.start_date}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Target Completion</div>
                            <DatePickerInput value={editData.target_completion} onChange={(value) => setEditData('target_completion', value)} style={inputStyle} />
                            {editErrors.target_completion && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.target_completion}</div>}
                        </label>

                        <label style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Remarks</div>
                            <TextareaInput
                                value={editData.remarks}
                                onChange={(event) => setEditData('remarks', event.target.value)}
                                style={{ ...inputStyle, minHeight: 90 }}
                            />
                            {editErrors.remarks && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.remarks}</div>}
                        </label>
                    </div>
                </EditModal>

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
                            <ActionButton type="button" onClick={closeDeleteModal} disabled={deleting} style={{ padding: '8px 12px' }}>Cancel</ActionButton>
                            <ActionButton type="button" variant="danger" onClick={confirmDeleteScope} disabled={deleting} style={{ padding: '8px 12px' }}>
                                {deleting ? 'Deleting...' : 'Confirm Delete'}
                            </ActionButton>
                        </div>
                    </div>
                </Modal>
                <Modal
                    open={!!scopePreview}
                    onClose={() => setScopePreview(null)}
                    title={scopePreview?.caption || scopePreview?.scope || 'Scope Photo'}
                    maxWidth={900}
                >
                    {scopePreview && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            <img
                                src={`/storage/${scopePreview.photo_path}`}
                                alt={scopePreview.caption || scopePreview.scope || 'Scope photo'}
                                style={{
                                    width: '100%',
                                    maxHeight: '70vh',
                                    objectFit: 'contain',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    background: 'var(--surface-2)',
                                }}
                            />
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {scopePreview.scope ? `Scope: ${scopePreview.scope}` : null}
                                {scopePreview.scope && scopePreview.created_at ? ' | ' : ''}
                                {scopePreview.created_at || '-'}
                            </div>
                        </div>
                    )}
                </Modal>
            </Layout>
        </>
    );
}
