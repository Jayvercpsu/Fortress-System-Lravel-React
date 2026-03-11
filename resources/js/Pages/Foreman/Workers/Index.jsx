import Layout from '../../../Components/Layout';
import DataTable from '../../../Components/DataTable';
import DatePickerInput from '../../../Components/DatePickerInput';
import ActionButton from '../../../Components/ActionButton';
import ConfirmationModal from '../../../Components/ConfirmationModal';
import EditModal from '../../../Components/EditModal';
import SearchableDropdown from '../../../Components/SearchableDropdown';
import TextInput from '../../../Components/TextInput';
import SelectInput from '../../../Components/SelectInput';
import TextareaInput from '../../../Components/TextareaInput';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

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
    boxSizing: 'border-box',
};

export default function ForemanWorkersIndex({ workers = [], workerTable = {}, assignedProjects = [] }) {
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const projectOptions = useMemo(
        () => (Array.isArray(assignedProjects) ? assignedProjects.map((project) => ({ id: String(project.id), name: project.label || project.name })) : []),
        [assignedProjects]
    );
    const defaultProjectId = projectOptions[0]?.id ?? '';

    const table = {
        search: workerTable?.search ?? '',
        perPage: Number(workerTable?.per_page ?? 10),
        page: Number(workerTable?.current_page ?? 1),
        lastPage: Number(workerTable?.last_page ?? 1),
        total: Number(workerTable?.total ?? workers.length ?? 0),
        from: workerTable?.from ?? null,
        to: workerTable?.to ?? null,
    };

    const createForm = useForm({
        project_id: defaultProjectId,
        name: '',
        job_type: 'Worker',
        birth_date: '',
        place_of_birth: '',
        sex: '',
        civil_status: '',
        phone: '',
        address: '',
    });

    const editForm = useForm({
        project_id: '',
        name: '',
        job_type: 'Worker',
        birth_date: '',
        place_of_birth: '',
        sex: '',
        civil_status: '',
        phone: '',
        address: '',
    });

    useEffect(() => {
        if (!projectOptions.some((option) => option.id === String(createForm.data.project_id || ''))) {
            createForm.setData('project_id', defaultProjectId);
        }
    }, [projectOptions, defaultProjectId, createForm.data.project_id]);

    const queryParams = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };
        if (!params.search) delete params.search;
        return params;
    };

    const queryString = (overrides = {}) => {
        const params = new URLSearchParams(queryParams(overrides));
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    };

    const navigateTable = (overrides = {}) => {
        router.get('/foreman/workers', queryParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const normalizeName = (value) => String(value || '').trim().toLowerCase();
    const isDuplicateName = (value, ignoreId = null) => {
        const normalized = normalizeName(value);
        if (!normalized) return false;
        return workers.some((worker) => normalizeName(worker?.name) === normalized && String(worker?.id) !== String(ignoreId ?? ''));
    };

    const submitCreate = (e) => {
        e.preventDefault();
        if (isDuplicateName(createForm.data.name)) {
            if (createForm.setError) createForm.setError('name', 'Worker name already exists.');
            toast.error('Worker name already exists.');
            return;
        }
        createForm.post(`/foreman/workers${queryString({ page: 1 })}`, {
            preserveScroll: true,
            onSuccess: () => {
                createForm.setData({
                    project_id: createForm.data.project_id || defaultProjectId,
                    name: '',
                    job_type: 'Worker',
                    birth_date: '',
                    place_of_birth: '',
                    sex: '',
                    civil_status: '',
                    phone: '',
                    address: '',
                });
                toast.success('Worker added successfully.');
            },
            onError: () => toast.error('Unable to add worker. Check the form fields.'),
        });
    };

    const startEdit = (worker) => {
        setEditTarget(worker);
        if (editForm.clearErrors) editForm.clearErrors();
        editForm.setData({
            project_id: worker.project_id ? String(worker.project_id) : '',
            name: worker.name ?? '',
            job_type: worker.job_type ?? 'Worker',
            birth_date: worker.birth_date ?? '',
            place_of_birth: worker.place_of_birth ?? '',
            sex: worker.sex ?? '',
            civil_status: worker.civil_status ?? '',
            phone: worker.phone ?? '',
            address: worker.address ?? '',
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
        if (isDuplicateName(editForm.data.name, editTarget.id)) {
            if (editForm.setError) editForm.setError('name', 'Worker name already exists.');
            toast.error('Worker name already exists.');
            return;
        }
        editForm.patch(`/foreman/workers/${editTarget.id}${queryString()}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditTarget(null);
                toast.success('Worker updated successfully.');
            },
            onError: () => toast.error('Unable to update worker.'),
        });
    };

    const deleteWorker = (workerId) => {
        setDeleting(true);
        router.delete(`/foreman/workers/${workerId}${queryString()}`, {
            preserveScroll: true,
            onError: () => toast.error('Unable to delete worker.'),
            onSuccess: () => toast.success('Worker deleted successfully.'),
            onFinish: () => {
                setDeleting(false);
                setDeleteTarget(null);
            },
        });
    };

    const columns = [
        {
            key: 'project_name',
            label: 'Project',
            width: 220,
            render: (row) => row.project_name || '-',
            searchAccessor: (row) => row.project_name,
        },
        {
            key: 'name',
            label: 'Worker Name',
            render: (row) => <div style={{ fontWeight: 700 }}>{row.name}</div>,
            searchAccessor: (row) => row.name,
        },
        {
            key: 'job_type',
            label: 'Job Type',
            width: 150,
            render: (row) => row.job_type || 'Worker',
            searchAccessor: (row) => row.job_type,
        },
        {
            key: 'birth_date',
            label: 'Birth Date',
            width: 140,
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.birth_date || '-'}</span>,
            searchAccessor: (row) => row.birth_date,
        },
        {
            key: 'place_of_birth',
            label: 'Place of Birth',
            render: (row) => row.place_of_birth || '-',
            searchAccessor: (row) => row.place_of_birth,
        },
        {
            key: 'sex',
            label: 'Sex',
            width: 110,
            render: (row) => row.sex || '-',
            searchAccessor: (row) => row.sex,
        },
        {
            key: 'phone',
            label: 'Phone',
            width: 140,
            render: (row) => row.phone || '-',
            searchAccessor: (row) => row.phone,
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            width: 200,
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

    return (
        <>
            <Head title="Workers" />
            <Layout title="My Workers">
                <div style={{ display: 'grid', gap: 16 }}>
                    <form onSubmit={submitCreate} style={{ ...cardStyle, display: 'grid', gap: 14 }}>
                        <div style={{ fontWeight: 700 }}>Add Worker</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Assign each worker to one of your projects so they appear in project records and attendance for that project.
                        </div>
                        {projectOptions.length === 0 && (
                            <div style={{ fontSize: 12, color: '#f87171' }}>
                                No assigned projects found. Ask Head Admin to assign you to a project first.
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Project (Assigned)</div>
                                <SearchableDropdown
                                    options={projectOptions}
                                    value={createForm.data.project_id}
                                    onChange={(value) => createForm.setData('project_id', value || '')}
                                    getOptionLabel={(option) => option.name}
                                    getOptionValue={(option) => option.id}
                                    placeholder={projectOptions.length ? 'Select project' : 'No assigned projects'}
                                    searchPlaceholder="Search projects..."
                                    emptyMessage="No projects found"
                                    disabled={projectOptions.length === 0}
                                    clearable={false}
                                    style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                    dropdownWidth={360}
                                />
                                {createForm.errors.project_id && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.project_id}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Worker Name</div>
                                <TextInput value={createForm.data.name} onChange={(e) => createForm.setData('name', e.target.value)} style={inputStyle} />
                                {createForm.errors.name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.name}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Job Type</div>
                                <SelectInput value={createForm.data.job_type} onChange={(e) => createForm.setData('job_type', e.target.value)} style={inputStyle}>
                                    <option value="Worker">Worker</option>
                                    <option value="Skilled Worker">Skilled Worker</option>
                                    <option value="Laborer">Laborer</option>
                                </SelectInput>
                                {createForm.errors.job_type && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.job_type}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Birth Date (optional)</div>
                                <DatePickerInput value={createForm.data.birth_date} onChange={(value) => createForm.setData('birth_date', value)} style={inputStyle} maxDate={new Date()} />
                                {createForm.errors.birth_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.birth_date}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Place of Birth (optional)</div>
                                <TextInput value={createForm.data.place_of_birth} onChange={(e) => createForm.setData('place_of_birth', e.target.value)} style={inputStyle} />
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Sex (optional)</div>
                                <SelectInput value={createForm.data.sex} onChange={(e) => createForm.setData('sex', e.target.value)} style={inputStyle}>
                                    <option value="">Select sex</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </SelectInput>
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Civil Status (optional)</div>
                                <SelectInput value={createForm.data.civil_status} onChange={(e) => createForm.setData('civil_status', e.target.value)} style={inputStyle}>
                                    <option value="">Select civil status</option>
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                    <option value="Widowed">Widowed</option>
                                    <option value="Separated">Separated</option>
                                    <option value="Divorced">Divorced</option>
                                </SelectInput>
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Phone (optional)</div>
                                <TextInput value={createForm.data.phone} onChange={(e) => createForm.setData('phone', e.target.value)} style={inputStyle} />
                            </label>

                            <label style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Address (optional)</div>
                                <TextareaInput value={createForm.data.address} onChange={(e) => createForm.setData('address', e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <ActionButton type="submit" variant="success" disabled={createForm.processing || projectOptions.length === 0} style={{ padding: '10px 14px', fontSize: 13 }}>
                                {createForm.processing ? 'Saving...' : 'Add Worker'}
                            </ActionButton>
                        </div>
                    </form>

                    <div style={cardStyle}>
                        <DataTable
                            columns={columns}
                            rows={workers}
                            rowKey="id"
                            searchPlaceholder="Search workers..."
                            emptyMessage="No workers yet. Add workers to use them in attendance."
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
                <EditModal
                    open={!!editTarget}
                    onClose={closeEdit}
                    onSubmit={submitEdit}
                    title={editTarget ? `Edit Worker - ${editTarget.name}` : 'Edit Worker'}
                    submitLabel="Save Changes"
                    processing={editForm.processing}
                    maxWidth={820}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Project (Assigned)</div>
                            <SearchableDropdown
                                options={projectOptions}
                                value={editForm.data.project_id}
                                onChange={(value) => editForm.setData('project_id', value || '')}
                                getOptionLabel={(option) => option.name}
                                getOptionValue={(option) => option.id}
                                placeholder={projectOptions.length ? 'Select project' : 'No assigned projects'}
                                searchPlaceholder="Search projects..."
                                emptyMessage="No projects found"
                                disabled={projectOptions.length === 0}
                                clearable={false}
                                style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                dropdownWidth={360}
                            />
                            {editForm.errors.project_id && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editForm.errors.project_id}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Worker Name</div>
                            <TextInput value={editForm.data.name} onChange={(e) => editForm.setData('name', e.target.value)} style={inputStyle} />
                            {editForm.errors.name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editForm.errors.name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Job Type</div>
                            <SelectInput value={editForm.data.job_type} onChange={(e) => editForm.setData('job_type', e.target.value)} style={inputStyle}>
                                <option value="Worker">Worker</option>
                                <option value="Skilled Worker">Skilled Worker</option>
                                <option value="Laborer">Laborer</option>
                            </SelectInput>
                            {editForm.errors.job_type && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editForm.errors.job_type}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Birth Date (optional)</div>
                            <DatePickerInput value={editForm.data.birth_date} onChange={(value) => editForm.setData('birth_date', value)} style={inputStyle} maxDate={new Date()} />
                            {editForm.errors.birth_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editForm.errors.birth_date}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Place of Birth (optional)</div>
                            <TextInput value={editForm.data.place_of_birth} onChange={(e) => editForm.setData('place_of_birth', e.target.value)} style={inputStyle} />
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Sex (optional)</div>
                            <SelectInput value={editForm.data.sex} onChange={(e) => editForm.setData('sex', e.target.value)} style={inputStyle}>
                                <option value="">Select sex</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </SelectInput>
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Civil Status (optional)</div>
                            <SelectInput value={editForm.data.civil_status} onChange={(e) => editForm.setData('civil_status', e.target.value)} style={inputStyle}>
                                <option value="">Select civil status</option>
                                <option value="Single">Single</option>
                                <option value="Married">Married</option>
                                <option value="Widowed">Widowed</option>
                                <option value="Separated">Separated</option>
                                <option value="Divorced">Divorced</option>
                            </SelectInput>
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Phone (optional)</div>
                            <TextInput value={editForm.data.phone} onChange={(e) => editForm.setData('phone', e.target.value)} style={inputStyle} />
                        </label>

                        <label style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Address (optional)</div>
                            <TextareaInput value={editForm.data.address} onChange={(e) => editForm.setData('address', e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                        </label>
                    </div>
                </EditModal>
                <ConfirmationModal
                    open={!!deleteTarget}
                    onClose={() => (deleting ? null : setDeleteTarget(null))}
                    onConfirm={() => (deleteTarget ? deleteWorker(deleteTarget.id) : null)}
                    title="Delete Worker"
                    message={deleteTarget ? `Delete "${deleteTarget.name}" from your workers list?` : 'Delete this worker?'}
                    confirmLabel={deleting ? 'Deleting...' : 'Delete'}
                    processing={deleting}
                    danger
                />
            </Layout>
        </>
    );
}
