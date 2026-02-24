import Layout from '../../../Components/Layout';
import DataTable from '../../../Components/DataTable';
import DatePickerInput from '../../../Components/DatePickerInput';
import ActionButton from '../../../Components/ActionButton';
import SearchableDropdown from '../../../Components/SearchableDropdown';
import { Head, router, useForm, usePage } from '@inertiajs/react';
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
    const { flash } = usePage().props;
    const [editingId, setEditingId] = useState(null);
    const projectOptions = useMemo(
        () => (Array.isArray(assignedProjects) ? assignedProjects.map((project) => ({ id: String(project.id), name: project.name })) : []),
        [assignedProjects]
    );
    const defaultProjectId = projectOptions[0]?.id ?? '';

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

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

    const submitCreate = (e) => {
        e.preventDefault();
        createForm.post(`/foreman/workers${queryString({ page: 1 })}`, {
            preserveScroll: true,
            onSuccess: () =>
                createForm.setData({
                    project_id: createForm.data.project_id || defaultProjectId,
                    name: '',
                    birth_date: '',
                    place_of_birth: '',
                    sex: '',
                    civil_status: '',
                    phone: '',
                    address: '',
                }),
            onError: () => toast.error('Unable to add worker. Check the form fields.'),
        });
    };

    const startEdit = (worker) => {
        setEditingId(worker.id);
        editForm.setData({
            project_id: worker.project_id ? String(worker.project_id) : '',
            name: worker.name ?? '',
            birth_date: worker.birth_date ?? '',
            place_of_birth: worker.place_of_birth ?? '',
            sex: worker.sex ?? '',
            civil_status: worker.civil_status ?? '',
            phone: worker.phone ?? '',
            address: worker.address ?? '',
        });
    };

    const submitEdit = (workerId) => {
        editForm.patch(`/foreman/workers/${workerId}${queryString()}`, {
            preserveScroll: true,
            onSuccess: () => setEditingId(null),
            onError: () => toast.error('Unable to update worker.'),
        });
    };

    const deleteWorker = (workerId) => {
        router.delete(`/foreman/workers/${workerId}${queryString()}`, {
            preserveScroll: true,
            onError: () => toast.error('Unable to delete worker.'),
        });
    };

    const columns = [
        {
            key: 'project_name',
            label: 'Project',
            width: 220,
            render: (row) =>
                editingId === row.id ? (
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
                        style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                        dropdownWidth={300}
                    />
                ) : (
                    row.project_name || '-'
                ),
            searchAccessor: (row) => row.project_name,
        },
        {
            key: 'name',
            label: 'Worker Name',
            render: (row) =>
                editingId === row.id ? (
                    <input value={editForm.data.name} onChange={(e) => editForm.setData('name', e.target.value)} style={inputStyle} />
                ) : (
                    <div style={{ fontWeight: 700 }}>{row.name}</div>
                ),
            searchAccessor: (row) => row.name,
        },
        {
            key: 'birth_date',
            label: 'Birth Date',
            width: 140,
            render: (row) =>
                editingId === row.id ? (
                    <DatePickerInput value={editForm.data.birth_date} onChange={(value) => editForm.setData('birth_date', value)} style={inputStyle} maxDate={new Date()} />
                ) : (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.birth_date || '-'}</span>
                ),
            searchAccessor: (row) => row.birth_date,
        },
        {
            key: 'place_of_birth',
            label: 'Place of Birth',
            render: (row) =>
                editingId === row.id ? (
                    <input value={editForm.data.place_of_birth} onChange={(e) => editForm.setData('place_of_birth', e.target.value)} style={inputStyle} />
                ) : (
                    row.place_of_birth || '-'
                ),
            searchAccessor: (row) => row.place_of_birth,
        },
        {
            key: 'sex',
            label: 'Sex',
            width: 110,
            render: (row) =>
                editingId === row.id ? (
                    <select value={editForm.data.sex} onChange={(e) => editForm.setData('sex', e.target.value)} style={inputStyle}>
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </select>
                ) : (
                    row.sex || '-'
                ),
            searchAccessor: (row) => row.sex,
        },
        {
            key: 'phone',
            label: 'Phone',
            width: 140,
            render: (row) =>
                editingId === row.id ? (
                    <input value={editForm.data.phone} onChange={(e) => editForm.setData('phone', e.target.value)} style={inputStyle} />
                ) : (
                    row.phone || '-'
                ),
            searchAccessor: (row) => row.phone,
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            width: 200,
            render: (row) =>
                editingId === row.id ? (
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                        <ActionButton type="button" variant="neutral" onClick={() => setEditingId(null)}>
                            Cancel
                        </ActionButton>
                        <ActionButton type="button" variant="success" onClick={() => submitEdit(row.id)} disabled={editForm.processing}>
                            Save
                        </ActionButton>
                    </div>
                ) : (
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                        <ActionButton type="button" variant="edit" onClick={() => startEdit(row)}>
                            Edit
                        </ActionButton>
                        <ActionButton type="button" variant="danger" onClick={() => deleteWorker(row.id)}>
                            Delete
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
                                <input value={createForm.data.name} onChange={(e) => createForm.setData('name', e.target.value)} style={inputStyle} />
                                {createForm.errors.name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.name}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Birth Date (optional)</div>
                                <DatePickerInput value={createForm.data.birth_date} onChange={(value) => createForm.setData('birth_date', value)} style={inputStyle} maxDate={new Date()} />
                                {createForm.errors.birth_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createForm.errors.birth_date}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Place of Birth (optional)</div>
                                <input value={createForm.data.place_of_birth} onChange={(e) => createForm.setData('place_of_birth', e.target.value)} style={inputStyle} />
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Sex (optional)</div>
                                <select value={createForm.data.sex} onChange={(e) => createForm.setData('sex', e.target.value)} style={inputStyle}>
                                    <option value="">Select sex</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Civil Status (optional)</div>
                                <select value={createForm.data.civil_status} onChange={(e) => createForm.setData('civil_status', e.target.value)} style={inputStyle}>
                                    <option value="">Select civil status</option>
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                    <option value="Widowed">Widowed</option>
                                    <option value="Separated">Separated</option>
                                    <option value="Divorced">Divorced</option>
                                </select>
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Phone (optional)</div>
                                <input value={createForm.data.phone} onChange={(e) => createForm.setData('phone', e.target.value)} style={inputStyle} />
                            </label>

                            <label style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Address (optional)</div>
                                <textarea value={createForm.data.address} onChange={(e) => createForm.setData('address', e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
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
            </Layout>
        </>
    );
}
