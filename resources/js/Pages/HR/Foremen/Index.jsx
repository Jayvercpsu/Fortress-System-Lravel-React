import Layout from '../../../Components/Layout';
import DataTable from '../../../Components/DataTable';
import ActionButton from '../../../Components/ActionButton';
import CheckboxInput from '../../../Components/CheckboxInput';
import ConfirmationModal from '../../../Components/ConfirmationModal';
import EditModal from '../../../Components/EditModal';
import Modal from '../../../Components/Modal';
import TextInput from '../../../Components/TextInput';
import { Head, router, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { toastMessages } from '../../../constants/toastMessages';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 12,
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    boxSizing: 'border-box',
};

export default function HrForemenIndex({
    foremen = [],
    foremanTable = {},
    projectOptions = [],
    assignedProjectIdsByForeman = {},
}) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [createProjectQuery, setCreateProjectQuery] = useState('');
    const [editProjectQuery, setEditProjectQuery] = useState('');

    const table = {
        search: foremanTable?.search ?? '',
        perPage: Number(foremanTable?.per_page ?? 10),
        page: Number(foremanTable?.current_page ?? 1),
        lastPage: Number(foremanTable?.last_page ?? 1),
        total: Number(foremanTable?.total ?? foremen.length ?? 0),
        from: foremanTable?.from ?? null,
        to: foremanTable?.to ?? null,
    };

    const projectList = Array.isArray(projectOptions) ? projectOptions : [];

    const createForm = useForm({
        fullname: '',
        email: '',
        password: '',
        phone: '',
        project_ids: [],
    });

    const editForm = useForm({
        fullname: '',
        email: '',
        password: '',
        phone: '',
        project_ids: [],
    });

    const queryParams = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };

        if (!params.search) delete params.search;
        return params;
    };

    const navigateTable = (overrides = {}) => {
        router.get('/hr/foremen', queryParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitCreate = (e) => {
        e.preventDefault();
        createForm.post('/hr/foremen', {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                toast.success(toastMessages.foremen.addSuccess);
                setShowCreateModal(false);
            },
            onError: () => toast.error(toastMessages.foremen.addError),
        });
    };

    const startEdit = (foreman) => {
        setEditTarget(foreman);
        if (editForm.clearErrors) editForm.clearErrors();
        editForm.setData({
            fullname: foreman.fullname ?? '',
            email: foreman.email ?? '',
            password: '',
            phone: foreman.phone ?? '',
            project_ids: assignedProjectIdsByForeman[foreman.id] ?? foreman.assigned_project_ids ?? [],
        });
    };

    const closeEdit = () => {
        if (editForm.processing) return;
        setEditTarget(null);
        if (editForm.clearErrors) editForm.clearErrors();
    };

    const submitEdit = (e) => {
        e.preventDefault();
        if (!editTarget) return;
        editForm.patch(`/hr/foremen/${editTarget.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditTarget(null);
                toast.success(toastMessages.foremen.updateSuccess);
            },
            onError: () => toast.error(toastMessages.foremen.updateError),
        });
    };

    const deleteForeman = (id) => {
        setDeleting(true);
        router.delete(`/hr/foremen/${id}`, {
            preserveScroll: true,
            onSuccess: () => toast.success(toastMessages.foremen.deleteSuccess),
            onError: () => toast.error(toastMessages.foremen.deleteError),
            onFinish: () => {
                setDeleting(false);
                setDeleteTarget(null);
            },
        });
    };

    const projectOptionsById = useMemo(() => {
        const map = new Map();
        projectList.forEach((project) => {
            map.set(String(project.id), project);
        });
        return map;
    }, [projectList]);

    const filterProjects = (query) => {
        const needle = String(query || '').trim().toLowerCase();
        if (!needle) return projectList;
        return projectList.filter((project) => String(project.label || project.name || '').toLowerCase().includes(needle));
    };

    const createFilteredProjects = useMemo(() => filterProjects(createProjectQuery), [projectList, createProjectQuery]);
    const editFilteredProjects = useMemo(() => filterProjects(editProjectQuery), [projectList, editProjectQuery]);

    const columns = [
        {
            key: 'fullname',
            label: 'Full Name',
            render: (row) => <div style={{ fontWeight: 600 }}>{row.fullname}</div>,
            searchAccessor: (row) => row.fullname,
        },
        {
            key: 'email',
            label: 'Email',
            render: (row) => <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{row.email}</div>,
            searchAccessor: (row) => row.email,
        },
        {
            key: 'phone',
            label: 'Phone',
            render: (row) => row.phone || '-',
            searchAccessor: (row) => row.phone,
        },
        {
            key: 'projects',
            label: 'Assigned Projects',
            render: (row) => {
                const names = row.project_names || [];
                if (names.length === 0) {
                    return <span style={{ color: 'var(--text-muted)' }}>None</span>;
                }
                return (
                    <div style={{ fontSize: 12, color: 'var(--text-main)' }}>
                        {names.join(', ')}
                    </div>
                );
            },
        },
        {
            key: 'created_at',
            label: 'Created',
            render: (row) => (
                <div style={{ color: 'var(--text-muted-2)', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                    {row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}
                </div>
            ),
            searchAccessor: (row) => row.created_at,
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            width: 180,
            render: (row) => (
                <div style={{ display: 'inline-flex', gap: 8 }}>
                    <ActionButton type="button" variant="edit" onClick={() => startEdit(row)}>
                        Edit
                    </ActionButton>
                    <ActionButton
                        type="button"
                        variant="danger"
                        onClick={() => setDeleteTarget(row)}
                        disabled={deleting}
                        loading={deleting && deleteTarget?.id === row.id}
                    >
                        {deleting && deleteTarget?.id === row.id ? 'Deleting...' : 'Delete'}
                    </ActionButton>
                </div>
            ),
        },
    ];

    const selectedProjectsLabel = (ids) =>
        ids
            .map((id) => projectOptionsById.get(String(id))?.label || projectOptionsById.get(String(id))?.name)
            .filter(Boolean)
            .join(', ');

    return (
        <>
            <Head title="Foremen" />
            <Layout title="Foremen">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <ActionButton
                        type="button"
                        variant="success"
                        onClick={() => setShowCreateModal(true)}
                        style={{ padding: '8px 12px', fontSize: 12 }}
                    >
                        Add Foreman
                    </ActionButton>
                </div>
                <div style={cardStyle}>
                    <DataTable
                        columns={columns}
                        rows={foremen}
                        rowKey="id"
                        searchPlaceholder="Search foremen..."
                        emptyMessage="No foremen found."
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
                <Modal
                    open={showCreateModal}
                    onClose={() => (createForm.processing ? null : setShowCreateModal(false))}
                    title="Add Foreman"
                    maxWidth={820}
                >
                    <form onSubmit={submitCreate} style={{ display: 'grid', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Full Name</div>
                                <TextInput value={createForm.data.fullname} onChange={(e) => createForm.setData('fullname', e.target.value)} style={inputStyle} />
                                {createForm.errors.fullname && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.fullname}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Email</div>
                                <TextInput type="email" value={createForm.data.email} onChange={(e) => createForm.setData('email', e.target.value)} style={inputStyle} />
                                {createForm.errors.email && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.email}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Password</div>
                                <TextInput type="password" value={createForm.data.password} onChange={(e) => createForm.setData('password', e.target.value)} style={inputStyle} />
                                {createForm.errors.password && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.password}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Phone (optional)</div>
                                <TextInput value={createForm.data.phone} onChange={(e) => createForm.setData('phone', e.target.value)} style={inputStyle} />
                            </label>

                            <label style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned Projects (optional)</div>
                                <div style={{ display: 'grid', gap: 8 }}>
                                    <TextInput
                                        value={createProjectQuery}
                                        onChange={(e) => setCreateProjectQuery(e.target.value)}
                                        placeholder="Search projects..."
                                        style={inputStyle}
                                    />
                                    <div
                                        style={{
                                            border: '1px dashed var(--border-color)',
                                            borderRadius: 10,
                                            padding: 10,
                                            display: 'grid',
                                            gap: 8,
                                            maxHeight: 200,
                                            overflowY: 'auto',
                                            background: 'color-mix(in srgb, var(--surface-2) 55%, transparent)',
                                        }}
                                    >
                                        {createFilteredProjects.length === 0 ? (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No projects found.</div>
                                        ) : (
                                            createFilteredProjects.map((project) => {
                                                const id = String(project.id);
                                                const selected = (createForm.data.project_ids || []).map(String).includes(id);
                                                return (
                                                    <CheckboxInput
                                                        key={id}
                                                        checked={selected}
                                                        onChange={() => {
                                                            const next = selected
                                                                ? (createForm.data.project_ids || []).map(String).filter((value) => value !== id)
                                                                : [...(createForm.data.project_ids || []).map(String), id];
                                                            createForm.setData('project_ids', next);
                                                        }}
                                                        label={project.label || project.name}
                                                    />
                                                );
                                            })
                                        )}
                                    </div>
                                    {createForm.errors.project_ids && <div style={{ color: '#f87171', fontSize: 12 }}>{createForm.errors.project_ids}</div>}
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        Selected: {createForm.data.project_ids.length ? selectedProjectsLabel(createForm.data.project_ids) : 'None'}
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <ActionButton type="button" variant="neutral" onClick={() => setShowCreateModal(false)} disabled={createForm.processing}>
                                Cancel
                            </ActionButton>
                            <ActionButton type="submit" variant="success" disabled={createForm.processing} style={{ padding: '10px 14px', fontSize: 13 }}>
                                {createForm.processing ? 'Saving...' : 'Add Foreman'}
                            </ActionButton>
                        </div>
                    </form>
                </Modal>
                <EditModal
                    open={!!editTarget}
                    onClose={closeEdit}
                    onSubmit={submitEdit}
                    title={editTarget ? `Edit Foreman - ${editTarget.fullname}` : 'Edit Foreman'}
                    submitLabel="Save Changes"
                    processing={editForm.processing}
                    maxWidth={820}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Full Name</div>
                            <TextInput value={editForm.data.fullname} onChange={(e) => editForm.setData('fullname', e.target.value)} style={inputStyle} />
                            {editForm.errors.fullname && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editForm.errors.fullname}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Email</div>
                            <TextInput type="email" value={editForm.data.email} onChange={(e) => editForm.setData('email', e.target.value)} style={inputStyle} />
                            {editForm.errors.email && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editForm.errors.email}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>New Password (optional)</div>
                            <TextInput
                                type="password"
                                value={editForm.data.password}
                                onChange={(e) => editForm.setData('password', e.target.value)}
                                style={inputStyle}
                            />
                            {editForm.errors.password && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editForm.errors.password}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Phone (optional)</div>
                            <TextInput value={editForm.data.phone} onChange={(e) => editForm.setData('phone', e.target.value)} style={inputStyle} />
                        </label>

                        <label style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned Projects (optional)</div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                <TextInput
                                    value={editProjectQuery}
                                    onChange={(e) => setEditProjectQuery(e.target.value)}
                                    placeholder="Search projects..."
                                    style={inputStyle}
                                />
                                <div
                                    style={{
                                        border: '1px dashed var(--border-color)',
                                        borderRadius: 10,
                                        padding: 10,
                                        display: 'grid',
                                        gap: 8,
                                        maxHeight: 200,
                                        overflowY: 'auto',
                                        background: 'color-mix(in srgb, var(--surface-2) 55%, transparent)',
                                    }}
                                >
                                    {editFilteredProjects.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No projects found.</div>
                                    ) : (
                                        editFilteredProjects.map((project) => {
                                            const id = String(project.id);
                                            const selected = (editForm.data.project_ids || []).map(String).includes(id);
                                            return (
                                                <CheckboxInput
                                                    key={id}
                                                    checked={selected}
                                                    onChange={() => {
                                                        const next = selected
                                                            ? (editForm.data.project_ids || []).map(String).filter((value) => value !== id)
                                                            : [...(editForm.data.project_ids || []).map(String), id];
                                                        editForm.setData('project_ids', next);
                                                    }}
                                                    label={project.label || project.name}
                                                />
                                            );
                                        })
                                    )}
                                </div>
                                {editForm.errors.project_ids && <div style={{ color: '#f87171', fontSize: 12 }}>{editForm.errors.project_ids}</div>}
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    Selected: {editForm.data.project_ids.length ? selectedProjectsLabel(editForm.data.project_ids) : 'None'}
                                </div>
                            </div>
                        </label>
                    </div>
                </EditModal>
                <ConfirmationModal
                    open={!!deleteTarget}
                    onClose={() => (deleting ? null : setDeleteTarget(null))}
                    onConfirm={() => (deleteTarget ? deleteForeman(deleteTarget.id) : null)}
                    title="Delete Foreman"
                    message={deleteTarget ? `Delete "${deleteTarget.fullname}"?` : 'Delete this foreman?'}
                    confirmLabel={deleting ? 'Deleting...' : 'Delete'}
                    processing={deleting}
                    danger
                />
            </Layout>
        </>
    );
}
