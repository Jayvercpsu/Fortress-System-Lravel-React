import Layout from '../../../Components/Layout';
import DataTable from '../../../Components/DataTable';
import ActionButton from '../../../Components/ActionButton';
import ConfirmationModal from '../../../Components/ConfirmationModal';
import EditModal from '../../../Components/EditModal';
import SearchableDropdown from '../../../Components/SearchableDropdown';
import TextInput from '../../../Components/TextInput';
import { Head, router, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { toastMessages } from '../../../constants/toastMessages';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'var(--text-main)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
};

function Field({ label, required = false, error, children }) {
    return (
        <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                {label}
                {required ? <span style={{ color: '#f87171' }}> *</span> : null}
            </span>
            {children}
            {error ? <span style={{ color: '#f87171', fontSize: 12 }}>{error}</span> : null}
        </label>
    );
}

export default function ClientsIndex({ clients = [], clientTable = {}, projectOptions = [] }) {
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [editTarget, setEditTarget] = useState(null);

    const table = {
        search: clientTable?.search ?? '',
        perPage: Number(clientTable?.per_page ?? 10),
        page: Number(clientTable?.current_page ?? 1),
        lastPage: Number(clientTable?.last_page ?? 1),
        total: Number(clientTable?.total ?? clients.length ?? 0),
        from: clientTable?.from ?? null,
        to: clientTable?.to ?? null,
    };

    const { data, setData, post, reset, errors, processing } = useForm({
        client_name: '',
        project_id: '',
        location: '',
        email: '',
        phone: '',
        username: '',
        password: '',
        password_confirmation: '',
    });

    const {
        data: editData,
        setData: setEditData,
        patch,
        reset: resetEditData,
        errors: editErrors,
        processing: updating,
        clearErrors: clearEditErrors,
    } = useForm({
        client_name: '',
        project_id: '',
        location: '',
        email: '',
        phone: '',
        username: '',
        password: '',
        password_confirmation: '',
    });

    const projectDropdownOptions = useMemo(
        () =>
            (Array.isArray(projectOptions) ? projectOptions : []).map((option) => ({
                id: String(option.id),
                name: option.label || option.name,
            })),
        [projectOptions]
    );

    const listQueryParams = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };

        if (!params.search) delete params.search;
        return params;
    };

    const listQueryString = (overrides = {}) => {
        const params = new URLSearchParams(listQueryParams(overrides));
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    };

    const navigateTable = (overrides = {}) => {
        router.get('/clients', listQueryParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submit = (e) => {
        e.preventDefault();

        post('/clients', {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(toastMessages.clients.createSuccess);
                reset('client_name', 'project_id', 'location', 'email', 'phone', 'username', 'password', 'password_confirmation');
            },
            onError: () => {
                toast.error(toastMessages.clients.createError);
            },
        });
    };

    const deleteClient = (id) => {
        setDeleting(true);
        router.delete(`/clients/${id}${listQueryString()}`, {
            preserveScroll: true,
            onFinish: () => {
                setDeleting(false);
                setDeleteTarget(null);
            },
        });
    };

    const openEdit = (row) => {
        setEditTarget(row);
        clearEditErrors();
        setEditData({
            client_name: row.fullname ?? '',
            project_id: row.project_id ? String(row.project_id) : '',
            location: row.location ?? '',
            email: row.email ?? '',
            phone: row.phone ?? '',
            username: row.username ?? '',
            password: '',
            password_confirmation: '',
        });
    };

    const closeEdit = () => {
        if (updating) return;
        setEditTarget(null);
        resetEditData();
    };

    const submitEdit = (e) => {
        e.preventDefault();
        if (!editTarget) return;

        patch(`/clients/${editTarget.id}${listQueryString()}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(toastMessages.clients.updateSuccess);
                setEditTarget(null);
                resetEditData();
            },
            onError: () => {
                toast.error(toastMessages.clients.updateError);
            },
        });
    };

    const columns = [
        {
            key: 'fullname',
            label: 'Client Name',
            render: (row) => <div style={{ fontWeight: 700 }}>{row.fullname}</div>,
            searchAccessor: (row) => row.fullname,
        },
        {
            key: 'assigned_project',
            label: 'Assigned Project',
            render: (row) => row.assigned_project || '-',
            searchAccessor: (row) => row.assigned_project,
        },
        {
            key: 'location',
            label: 'Location',
            render: (row) => row.location || '-',
            searchAccessor: (row) => row.location,
        },
        {
            key: 'email',
            label: 'Email',
            render: (row) => row.email || '-',
            searchAccessor: (row) => row.email,
        },
        {
            key: 'phone',
            label: 'Phone',
            render: (row) => row.phone || '-',
            searchAccessor: (row) => row.phone,
        },
        {
            key: 'username',
            label: 'Username',
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.username || '-'}</span>,
            searchAccessor: (row) => row.username,
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <ActionButton
                        type="button"
                        variant="edit"
                        onClick={() => openEdit(row)}
                        style={{ padding: '5px 12px' }}
                        disabled={updating}
                    >
                        Edit
                    </ActionButton>
                    <ActionButton
                        type="button"
                        variant="danger"
                        onClick={() => setDeleteTarget(row)}
                        style={{ padding: '5px 12px' }}
                        disabled={deleting}
                        loading={deleting && deleteTarget?.id === row.id}
                    >
                        {deleting && deleteTarget?.id === row.id ? 'Deleting...' : 'Delete'}
                    </ActionButton>
                </div>
            ),
        },
    ];

    return (
        <>
            <Head title="Clients" />
            <Layout title="Client Management">
                <div style={{ display: 'grid', gap: 16 }}>
                    <form onSubmit={submit} style={cardStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 12 }}>Create Client</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                            <Field label="Client Name" required error={errors.client_name}>
                                <TextInput
                                    type="text"
                                    value={data.client_name}
                                    onChange={(e) => setData('client_name', e.target.value)}
                                    style={inputStyle}
                                />
                            </Field>

                            <Field label="Assigned Project (optional)" error={errors.project_id}>
                                <SearchableDropdown
                                    options={projectDropdownOptions}
                                    value={data.project_id}
                                    onChange={(value) => setData('project_id', value || '')}
                                    getOptionLabel={(option) => option.name}
                                    getOptionValue={(option) => option.id}
                                    placeholder={projectDropdownOptions.length > 0 ? 'Select project (optional)' : 'No projects available'}
                                    searchPlaceholder="Search project..."
                                    emptyMessage="No projects found"
                                    clearable
                                    style={{ ...inputStyle, padding: '8px 10px', minHeight: 40 }}
                                    dropdownWidth={320}
                                />
                            </Field>

                            <Field label="Location (optional)" error={errors.location}>
                                <TextInput
                                    type="text"
                                    value={data.location}
                                    onChange={(e) => setData('location', e.target.value)}
                                    style={inputStyle}
                                />
                            </Field>

                            <Field label="Email (optional)" error={errors.email}>
                                <TextInput
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    style={inputStyle}
                                />
                            </Field>

                            <Field label="Phone (optional)" error={errors.phone}>
                                <TextInput
                                    type="text"
                                    value={data.phone}
                                    onChange={(e) => setData('phone', e.target.value)}
                                    style={inputStyle}
                                />
                            </Field>

                            <Field label="Username" required error={errors.username}>
                                <TextInput
                                    type="text"
                                    value={data.username}
                                    onChange={(e) => setData('username', e.target.value)}
                                    style={inputStyle}
                                />
                            </Field>

                            <Field label="Password" required error={errors.password}>
                                <TextInput
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    style={inputStyle}
                                />
                            </Field>

                            <Field label="Confirm Password" required error={errors.password_confirmation}>
                                <TextInput
                                    type="password"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    style={inputStyle}
                                />
                            </Field>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                            <ActionButton
                                type="submit"
                                variant="success"
                                disabled={processing}
                                style={{ padding: '10px 16px', fontSize: 13 }}
                            >
                                {processing ? 'Saving...' : 'Create Client'}
                            </ActionButton>
                        </div>
                    </form>

                    <div style={cardStyle}>
                        <DataTable
                            columns={columns}
                            rows={clients}
                            rowKey="id"
                            searchPlaceholder="Search clients..."
                            emptyMessage="No clients yet."
                            serverSide
                            serverSearchValue={table.search}
                            serverPage={table.page}
                            serverPerPage={table.perPage}
                            serverTotalItems={table.total}
                            serverTotalPages={table.lastPage}
                            serverFrom={table.from}
                            serverTo={table.to}
                            onServerSearchChange={(value) => navigateTable({ search: value, page: 1 })}
                            onServerPerPageChange={(value) => navigateTable({ per_page: value, page: 1 })}
                            onServerPageChange={(value) => navigateTable({ page: value })}
                        />
                    </div>
                </div>

                <ConfirmationModal
                    open={!!deleteTarget}
                    onClose={() => (deleting ? null : setDeleteTarget(null))}
                    onConfirm={() => (deleteTarget ? deleteClient(deleteTarget.id) : null)}
                    title="Delete Client"
                    message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.fullname}"?` : 'Are you sure you want to delete this client?'}
                    confirmLabel={deleting ? 'Deleting...' : 'Delete'}
                    processing={deleting}
                    danger
                />

                <EditModal
                    open={!!editTarget}
                    onClose={closeEdit}
                    title={editTarget ? `Edit Client - ${editTarget.fullname}` : 'Edit Client'}
                    submitLabel="Update Client"
                    onSubmit={submitEdit}
                    processing={updating}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                        <Field label="Client Name" required error={editErrors.client_name}>
                            <TextInput
                                type="text"
                                value={editData.client_name}
                                onChange={(e) => setEditData('client_name', e.target.value)}
                                style={inputStyle}
                            />
                        </Field>

                        <Field label="Assigned Project (optional)" error={editErrors.project_id}>
                            <SearchableDropdown
                                options={projectDropdownOptions}
                                value={editData.project_id}
                                onChange={(value) => setEditData('project_id', value || '')}
                                getOptionLabel={(option) => option.name}
                                getOptionValue={(option) => option.id}
                                placeholder={projectDropdownOptions.length > 0 ? 'Select project (optional)' : 'No projects available'}
                                searchPlaceholder="Search project..."
                                emptyMessage="No projects found"
                                clearable
                                style={{ ...inputStyle, padding: '8px 10px', minHeight: 40 }}
                                dropdownWidth={320}
                            />
                        </Field>

                        <Field label="Location (optional)" error={editErrors.location}>
                            <TextInput
                                type="text"
                                value={editData.location}
                                onChange={(e) => setEditData('location', e.target.value)}
                                style={inputStyle}
                            />
                        </Field>

                        <Field label="Email (optional)" error={editErrors.email}>
                            <TextInput
                                type="email"
                                value={editData.email}
                                onChange={(e) => setEditData('email', e.target.value)}
                                style={inputStyle}
                            />
                        </Field>

                        <Field label="Phone (optional)" error={editErrors.phone}>
                            <TextInput
                                type="text"
                                value={editData.phone}
                                onChange={(e) => setEditData('phone', e.target.value)}
                                style={inputStyle}
                            />
                        </Field>

                        <Field label="Username" required error={editErrors.username}>
                            <TextInput
                                type="text"
                                value={editData.username}
                                onChange={(e) => setEditData('username', e.target.value)}
                                style={inputStyle}
                            />
                        </Field>

                        <Field label="New Password (optional)" error={editErrors.password}>
                            <TextInput
                                type="password"
                                value={editData.password}
                                onChange={(e) => setEditData('password', e.target.value)}
                                style={inputStyle}
                            />
                        </Field>

                        <Field label="Confirm Password (optional)" error={editErrors.password_confirmation}>
                            <TextInput
                                type="password"
                                value={editData.password_confirmation}
                                onChange={(e) => setEditData('password_confirmation', e.target.value)}
                                style={inputStyle}
                            />
                        </Field>
                    </div>
                </EditModal>
            </Layout>
        </>
    );
}
