import Layout from './Layout';
import ActionButton from './ActionButton';
import DataTable from './DataTable';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
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
};

export default function MaterialsManagerPage({ materials = [], materialTable = {} }) {
    const [editingId, setEditingId] = useState(null);

    const table = {
        search: materialTable?.search ?? '',
        perPage: Number(materialTable?.per_page ?? 10),
        page: Number(materialTable?.current_page ?? 1),
        lastPage: Number(materialTable?.last_page ?? 1),
        total: Number(materialTable?.total ?? materials.length ?? 0),
        from: materialTable?.from ?? null,
        to: materialTable?.to ?? null,
    };

    const {
        data: createData,
        setData: setCreateData,
        post,
        processing: creating,
        errors: createErrors,
        reset: resetCreate,
    } = useForm({
        name: '',
        description: '',
    });

    const {
        data: editData,
        setData: setEditData,
        patch,
        processing: updating,
        errors: editErrors,
    } = useForm({
        name: '',
        description: '',
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

    const queryString = (overrides = {}) => {
        const params = new URLSearchParams(queryParams(overrides));
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    };

    const navigateTable = (overrides = {}) => {
        router.get('/materials', queryParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitCreate = (e) => {
        e.preventDefault();
        post(`/materials${queryString({ page: 1 })}`, {
            preserveScroll: true,
            onSuccess: () => {
                resetCreate();
                toast.success('Material added.');
            },
            onError: () => toast.error('Unable to add material.'),
        });
    };

    const startEdit = (material) => {
        setEditingId(material.id);
        setEditData({
            name: material.name ?? '',
            description: material.description ?? '',
        });
    };

    const submitEdit = (e, materialId) => {
        e.preventDefault();
        patch(`/materials/${materialId}${queryString()}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingId(null);
                toast.success('Material updated.');
            },
            onError: () => toast.error('Unable to update material.'),
        });
    };

    const deleteMaterial = (materialId) => {
        router.delete(`/materials/${materialId}${queryString()}`, {
            preserveScroll: true,
            onSuccess: () => toast.success('Material deleted.'),
            onError: () => toast.error('Unable to delete material.'),
        });
    };

    const columns = [
        {
            key: 'name',
            label: 'Material',
            render: (row) =>
                editingId === row.id ? (
                    <input value={editData.name} onChange={(e) => setEditData('name', e.target.value)} style={inputStyle} />
                ) : (
                    <div style={{ fontWeight: 600 }}>{row.name}</div>
                ),
            searchAccessor: (row) => row.name,
        },
        {
            key: 'description',
            label: 'Description',
            render: (row) =>
                editingId === row.id ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                        <input value={editData.description} onChange={(e) => setEditData('description', e.target.value)} style={inputStyle} />
                        {(editErrors.name || editErrors.description) && (
                            <div style={{ color: '#f87171', fontSize: 12 }}>
                                {editErrors.name || editErrors.description}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ color: row.description ? 'var(--text-main)' : 'var(--text-muted)' }}>{row.description || '-'}</div>
                ),
            searchAccessor: (row) => row.description,
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (row) =>
                editingId === row.id ? (
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                        <ActionButton type="button" variant="neutral" onClick={() => setEditingId(null)}>
                            Cancel
                        </ActionButton>
                        <ActionButton
                            type="button"
                            variant="success"
                            onClick={(e) => submitEdit(e, row.id)}
                            disabled={updating}
                        >
                            Save
                        </ActionButton>
                    </div>
                ) : (
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                        <ActionButton type="button" variant="edit" onClick={() => startEdit(row)}>
                            Edit
                        </ActionButton>
                        <ActionButton type="button" variant="danger" onClick={() => deleteMaterial(row.id)}>
                            Delete
                        </ActionButton>
                    </div>
                ),
        },
    ];

    return (
        <>
            <Head title="Materials" />
            <Layout title="Materials">
                <div style={{ display: 'grid', gap: 16 }}>
                    <form onSubmit={submitCreate} style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Material Name</div>
                            <input value={createData.name} onChange={(e) => setCreateData('name', e.target.value)} style={inputStyle} placeholder="e.g. Cement" />
                            {createErrors.name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Description (optional)</div>
                            <input value={createData.description} onChange={(e) => setCreateData('description', e.target.value)} style={inputStyle} placeholder="Category / notes" />
                            {createErrors.description && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.description}</div>}
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
                                {creating ? 'Saving...' : 'Add Material'}
                            </button>
                        </div>
                    </form>

                    <div style={cardStyle}>
                        <DataTable
                            columns={columns}
                            rows={materials}
                            rowKey="id"
                            searchPlaceholder="Search materials..."
                            emptyMessage="No materials yet."
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
