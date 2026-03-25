import Layout from '../../../Components/Layout';
import DataTable from '../../../Components/DataTable';
import DatePickerInput from '../../../Components/DatePickerInput';
import ActionButton from '../../../Components/ActionButton';
import ConfirmationModal from '../../../Components/ConfirmationModal';
import EditModal from '../../../Components/EditModal';
import Modal from '../../../Components/Modal';
import SearchableDropdown from '../../../Components/SearchableDropdown';
import TextInput from '../../../Components/TextInput';
import SelectInput from '../../../Components/SelectInput';
import TextareaInput from '../../../Components/TextareaInput';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
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
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    boxSizing: 'border-box',
};

const filterControlStyle = {
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    boxSizing: 'border-box',
};

export default function HrWorkersIndex({
    workers = [],
    workerTable = {},
    foremanOptions = [],
    projectOptions = [],
    foremanAssignments = {},
    filters = {},
}) {
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const table = {
        search: workerTable?.search ?? '',
        perPage: Number(workerTable?.per_page ?? 10),
        page: Number(workerTable?.current_page ?? 1),
        lastPage: Number(workerTable?.last_page ?? 1),
        total: Number(workerTable?.total ?? workers.length ?? 0),
        from: workerTable?.from ?? null,
        to: workerTable?.to ?? null,
    };

    const [foremanFilter, setForemanFilter] = useState(filters?.foreman_id ? String(filters.foreman_id) : '');
    const [projectFilter, setProjectFilter] = useState(filters?.project_id ? String(filters.project_id) : '');

    useEffect(() => {
        setForemanFilter(filters?.foreman_id ? String(filters.foreman_id) : '');
        setProjectFilter(filters?.project_id ? String(filters.project_id) : '');
    }, [filters?.foreman_id, filters?.project_id]);

    const foremanList = Array.isArray(foremanOptions) ? foremanOptions : [];
    const projectList = Array.isArray(projectOptions) ? projectOptions : [];

    const foremanOptionsById = useMemo(() => {
        const map = new Map();
        foremanList.forEach((foreman) => {
            map.set(String(foreman.id), foreman);
        });
        return map;
    }, [foremanList]);

    const foremanIdsByProject = useMemo(() => {
        if (!foremanAssignments || typeof foremanAssignments !== 'object') {
            return {};
        }

        return Object.entries(foremanAssignments).reduce((acc, [key, ids]) => {
            const normalizedIds = Array.isArray(ids)
                ? ids.map((id) => String(id)).filter(Boolean)
                : [];
            acc[String(key)] = normalizedIds;
            return acc;
        }, {});
    }, [foremanAssignments]);

    const foremanOptionsForProject = (projectId) => {
        if (!projectId) {
            return foremanList;
        }

        const ids = foremanIdsByProject[String(projectId)] || [];
        if (ids.length === 0) {
            return [];
        }

        return ids
            .map((id) => foremanOptionsById.get(String(id)))
            .filter(Boolean);
    };

    useEffect(() => {
        if (!projectFilter) {
            return;
        }

        const allowed = foremanOptionsForProject(projectFilter);
        const isAllowed = allowed.some((foreman) => String(foreman.id) === String(foremanFilter));
        if (!isAllowed && foremanFilter) {
            setForemanFilter('');
        }
    }, [projectFilter, foremanFilter, foremanIdsByProject, foremanOptionsById, foremanList]);

    const resolveForemanIdForProject = (projectId, currentForemanId = '') => {
        const allowed = foremanOptionsForProject(projectId);
        const isAllowed = allowed.some((option) => String(option.id) === String(currentForemanId));
        if (isAllowed) {
            return String(currentForemanId || '');
        }
        return allowed[0]?.id ? String(allowed[0].id) : '';
    };

    const defaultProjectId = projectList[0]?.id ? String(projectList[0].id) : '';
    const defaultForemanId = foremanOptionsForProject(defaultProjectId)[0]?.id
        ? String(foremanOptionsForProject(defaultProjectId)[0].id)
        : '';

    const createForm = useForm({
        foreman_id: defaultForemanId,
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
        foreman_id: '',
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
        const currentProjectId = String(createForm.data.project_id || '');
        if (!projectList.some((option) => String(option.id) === currentProjectId)) {
            createForm.setData('project_id', defaultProjectId);
            return;
        }

        const allowedForemen = foremanOptionsForProject(currentProjectId);
        const currentForemanId = String(createForm.data.foreman_id || '');
        const isAllowed = allowedForemen.some((option) => String(option.id) === currentForemanId);
        if (!isAllowed) {
            const nextForemanId = allowedForemen[0]?.id ? String(allowedForemen[0].id) : '';
            createForm.setData('foreman_id', nextForemanId);
        }
    }, [
        foremanList,
        projectList,
        defaultProjectId,
        createForm.data.project_id,
        createForm.data.foreman_id,
        foremanIdsByProject,
        foremanOptionsById,
    ]);

    useEffect(() => {
        if (!editTarget) return;

        const currentProjectId = String(editForm.data.project_id || '');
        const allowedForemen = foremanOptionsForProject(currentProjectId);
        const currentForemanId = String(editForm.data.foreman_id || '');
        const isAllowed = allowedForemen.some((option) => String(option.id) === currentForemanId);
        if (!isAllowed) {
            const nextForemanId = allowedForemen[0]?.id ? String(allowedForemen[0].id) : '';
            editForm.setData('foreman_id', nextForemanId);
        }
    }, [
        editTarget,
        editForm.data.project_id,
        editForm.data.foreman_id,
        foremanIdsByProject,
        foremanOptionsById,
        foremanList,
    ]);

    const queryParams = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
            foreman_id: overrides.foreman_id !== undefined ? overrides.foreman_id : foremanFilter,
            project_id: overrides.project_id !== undefined ? overrides.project_id : projectFilter,
        };
        if (!params.search) delete params.search;
        if (!params.foreman_id) delete params.foreman_id;
        if (!params.project_id) delete params.project_id;
        return params;
    };

    const navigateTable = (overrides = {}) => {
        router.get('/hr/workers', queryParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitCreate = (e) => {
        e.preventDefault();
        createForm.post('/hr/workers', {
            preserveScroll: true,
            onSuccess: () => {
                createForm.setData({
                    foreman_id: createForm.data.foreman_id || defaultForemanId,
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
                toast.success(toastMessages.workers.addSuccess);
                setShowCreateModal(false);
            },
            onError: () => toast.error(toastMessages.workers.addError),
        });
    };

    const startEdit = (worker) => {
        setEditTarget(worker);
        if (editForm.clearErrors) editForm.clearErrors();
        editForm.setData({
            foreman_id: worker.foreman_id ? String(worker.foreman_id) : '',
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
        editForm.patch(`/hr/workers/${editTarget.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditTarget(null);
                toast.success(toastMessages.workers.updateSuccess);
            },
            onError: () => toast.error(toastMessages.workers.updateError),
        });
    };

    const deleteWorker = (workerId) => {
        setDeleting(true);
        router.delete(`/hr/workers/${workerId}`, {
            preserveScroll: true,
            onError: () => toast.error(toastMessages.workers.deleteError),
            onSuccess: () => toast.success(toastMessages.workers.deleteSuccess),
            onFinish: () => {
                setDeleting(false);
                setDeleteTarget(null);
            },
        });
    };

    const columns = [
        {
            key: 'name',
            label: 'Worker Name',
            width: 200,
            render: (row) => <div style={{ fontWeight: 700 }}>{row.name}</div>,
            searchAccessor: (row) => row.name,
        },
        {
            key: 'foreman_name',
            label: 'Foreman',
            width: 180,
            render: (row) => row.foreman_name || '-',
            searchAccessor: (row) => row.foreman_name,
        },
        {
            key: 'project_name',
            label: 'Project',
            width: 220,
            render: (row) => row.project_name || '-',
            searchAccessor: (row) => row.project_name,
        },
        {
            key: 'job_type',
            label: 'Job Type',
            width: 150,
            render: (row) => row.job_type || 'Worker',
            searchAccessor: (row) => row.job_type,
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

    const filterBar = (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr) auto',
                gap: 8,
                alignItems: 'center',
                flex: '1 1 520px',
                minWidth: 320,
            }}
        >
            <SearchableDropdown
                options={projectList}
                value={projectFilter}
                onChange={(value) => {
                    const nextValue = value || '';
                    setProjectFilter(nextValue);
                    let nextForemanValue = foremanFilter;
                    if (nextValue) {
                        const allowed = foremanOptionsForProject(nextValue);
                        const isAllowed = allowed.some((foreman) => String(foreman.id) === String(foremanFilter));
                        if (!isAllowed) {
                            nextForemanValue = '';
                            setForemanFilter('');
                        }
                    }
                    navigateTable({ project_id: nextValue, foreman_id: nextForemanValue, page: 1 });
                }}
                getOptionLabel={(option) => option.label || option.name}
                getOptionValue={(option) => option.id}
                placeholder="Filter project"
                searchPlaceholder="Search projects..."
                emptyMessage="No projects found"
                clearable
                style={{ ...filterControlStyle, minHeight: 36, minWidth: 180 }}
                dropdownWidth={320}
            />
            <SearchableDropdown
                options={foremanOptionsForProject(projectFilter)}
                value={foremanFilter}
                onChange={(value) => {
                    const nextValue = value || '';
                    setForemanFilter(nextValue);
                    navigateTable({ foreman_id: nextValue, page: 1 });
                }}
                getOptionLabel={(option) => option.name}
                getOptionValue={(option) => option.id}
                placeholder="Filter foreman"
                searchPlaceholder="Search foremen..."
                emptyMessage="No foremen found"
                clearable
                style={{ ...filterControlStyle, minHeight: 36, minWidth: 180 }}
                dropdownWidth={280}
            />
            <ActionButton
                type="button"
                variant="neutral"
                onClick={() => {
                    setForemanFilter('');
                    setProjectFilter('');
                    navigateTable({ foreman_id: '', project_id: '', page: 1 });
                }}
                style={{ ...filterControlStyle, padding: '8px 12px' }}
            >
                Clear Filters
            </ActionButton>
        </div>
    );

    const createForemanOptions = foremanOptionsForProject(createForm.data.project_id);
    const editForemanOptions = foremanOptionsForProject(editForm.data.project_id);

    return (
        <>
            <Head title="Workers" />
            <Layout title="Workers">
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                            <ActionButton
                                type="button"
                                variant="success"
                                onClick={() => setShowCreateModal(true)}
                                disabled={projectList.length === 0 || createForemanOptions.length === 0}
                                style={{ padding: '8px 12px', fontSize: 12 }}
                            >
                                Add Worker
                            </ActionButton>
                        </div>
                        <DataTable
                            columns={columns}
                            rows={workers}
                            rowKey="id"
                            searchPlaceholder="Search workers..."
                            emptyMessage="No workers yet."
                            serverSide
                            serverSearchValue={table.search}
                            serverPage={table.page}
                            serverPerPage={table.perPage}
                            serverTotalItems={table.total}
                            serverTotalPages={table.lastPage}
                            serverFrom={table.from}
                            serverTo={table.to}
                            searchInputStyle={{ flex: '0 1 260px', width: 'auto', maxWidth: 320 }}
                            topLeftExtra={filterBar}
                            onServerSearchChange={(value) => navigateTable({ search: value, page: 1 })}
                            onServerPerPageChange={(value) => navigateTable({ per_page: value, page: 1 })}
                            onServerPageChange={(value) => navigateTable({ page: value })}
                        />
                    </div>
                </div>
                <Modal
                    open={showCreateModal}
                    onClose={() => (createForm.processing ? null : setShowCreateModal(false))}
                    title="Add Worker"
                    maxWidth={860}
                >
                    <form onSubmit={submitCreate} style={{ display: 'grid', gap: 14 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            HR assigns workers to foremen and projects so they appear in attendance and submissions.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Project</div>
                                <SearchableDropdown
                                    options={projectList}
                                    value={createForm.data.project_id}
                                    onChange={(value) => {
                                        const nextProjectId = value || '';
                                        const nextForemanId = resolveForemanIdForProject(nextProjectId, createForm.data.foreman_id);
                                        createForm.setData('project_id', nextProjectId);
                                        if (nextForemanId !== String(createForm.data.foreman_id || '')) {
                                            createForm.setData('foreman_id', nextForemanId);
                                        }
                                    }}
                                    getOptionLabel={(option) => option.label || option.name}
                                    getOptionValue={(option) => option.id}
                                    placeholder={projectList.length ? 'Select project' : 'No projects found'}
                                    searchPlaceholder="Search projects..."
                                    emptyMessage="No projects found"
                                    disabled={projectList.length === 0}
                                    clearable={false}
                                    style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                    dropdownWidth={360}
                                />
                                {createForm.errors.project_id && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.project_id}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Foreman</div>
                                <SearchableDropdown
                                    options={createForemanOptions}
                                    value={createForm.data.foreman_id}
                                    onChange={(value) => createForm.setData('foreman_id', value || '')}
                                    getOptionLabel={(option) => option.name}
                                    getOptionValue={(option) => option.id}
                                    placeholder={createForemanOptions.length ? 'Select foreman' : 'No foremen found'}
                                    searchPlaceholder="Search foremen..."
                                    emptyMessage="No foremen found"
                                    disabled={createForemanOptions.length === 0}
                                    clearable={false}
                                    style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                    dropdownWidth={320}
                                />
                                {createForm.errors.foreman_id && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.foreman_id}</div>}
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

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <ActionButton type="button" variant="neutral" onClick={() => setShowCreateModal(false)} disabled={createForm.processing}>
                                Cancel
                            </ActionButton>
                            <ActionButton
                                type="submit"
                                variant="success"
                                disabled={createForm.processing || projectList.length === 0 || createForemanOptions.length === 0}
                                style={{ padding: '10px 14px', fontSize: 13 }}
                            >
                                {createForm.processing ? 'Saving...' : 'Add Worker'}
                            </ActionButton>
                        </div>
                    </form>
                </Modal>
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
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Project</div>
                            <SearchableDropdown
                                options={projectList}
                                value={editForm.data.project_id}
                                onChange={(value) => {
                                    const nextProjectId = value || '';
                                    const nextForemanId = resolveForemanIdForProject(nextProjectId, editForm.data.foreman_id);
                                    editForm.setData('project_id', nextProjectId);
                                    if (nextForemanId !== String(editForm.data.foreman_id || '')) {
                                        editForm.setData('foreman_id', nextForemanId);
                                    }
                                }}
                                getOptionLabel={(option) => option.label || option.name}
                                getOptionValue={(option) => option.id}
                                placeholder={projectList.length ? 'Select project' : 'No projects found'}
                                searchPlaceholder="Search projects..."
                                emptyMessage="No projects found"
                                disabled={projectList.length === 0}
                                clearable={false}
                                style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                dropdownWidth={360}
                            />
                            {editForm.errors.project_id && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editForm.errors.project_id}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Foreman</div>
                            <SearchableDropdown
                                options={editForemanOptions}
                                value={editForm.data.foreman_id}
                                onChange={(value) => editForm.setData('foreman_id', value || '')}
                                getOptionLabel={(option) => option.name}
                                getOptionValue={(option) => option.id}
                                placeholder={editForemanOptions.length ? 'Select foreman' : 'No foremen found'}
                                searchPlaceholder="Search foremen..."
                                emptyMessage="No foremen found"
                                disabled={editForemanOptions.length === 0}
                                clearable={false}
                                style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                dropdownWidth={320}
                            />
                            {editForm.errors.foreman_id && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editForm.errors.foreman_id}</div>}
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
                    message={deleteTarget ? `Delete "${deleteTarget.name}"?` : 'Delete this worker?'}
                    confirmLabel={deleting ? 'Deleting...' : 'Delete'}
                    processing={deleting}
                    danger
                />
            </Layout>
        </>
    );
}
