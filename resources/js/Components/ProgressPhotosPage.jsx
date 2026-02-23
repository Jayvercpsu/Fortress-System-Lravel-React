import Layout from './Layout';
import DataTable from './DataTable';
import Modal from './Modal';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

export default function ProgressPhotosPage({ photos = [], photoTable = {} }) {
    const [previewPhoto, setPreviewPhoto] = useState(null);

    const tableState = {
        search: photoTable?.search ?? '',
        perPage: Number(photoTable?.per_page ?? 10),
        page: Number(photoTable?.current_page ?? 1),
        lastPage: Number(photoTable?.last_page ?? 1),
        total: Number(photoTable?.total ?? photos.length ?? 0),
        from: photoTable?.from ?? null,
        to: photoTable?.to ?? null,
    };

    const navigateTable = (overrides = {}) => {
        router.get('/progress-photos', {
            search: overrides.search !== undefined ? overrides.search : tableState.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : tableState.perPage,
            page: overrides.page !== undefined ? overrides.page : tableState.page,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const columns = [
        {
            key: 'photo',
            label: 'Photo',
            width: 150,
            render: (photo) => (
                <button
                    type="button"
                    onClick={() => setPreviewPhoto(photo)}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        overflow: 'hidden',
                        padding: 0,
                        background: 'var(--surface-2)',
                        cursor: 'pointer',
                    }}
                >
                    <img
                        src={`/storage/${photo.photo_path}`}
                        alt={photo.caption || 'Progress proof'}
                        style={{ width: 120, height: 72, objectFit: 'cover', display: 'block' }}
                    />
                </button>
            ),
        },
        {
            key: 'foreman_name',
            label: 'Foreman',
            render: (photo) => photo.foreman_name || '-',
            searchAccessor: (photo) => photo.foreman_name,
        },
        {
            key: 'project_name',
            label: 'Project',
            render: (photo) => photo.project_name || '-',
            searchAccessor: (photo) => photo.project_name,
        },
        {
            key: 'caption',
            label: 'Caption',
            render: (photo) => photo.caption || '-',
            searchAccessor: (photo) => photo.caption,
        },
        {
            key: 'created_at',
            label: 'Uploaded At',
            render: (photo) => photo.created_at || '-',
            searchAccessor: (photo) => photo.created_at,
        },
    ];

    return (
        <>
            <Head title="Progress Photos" />
            <Layout title="Progress Photos">
                <div style={cardStyle}>
                    <DataTable
                        columns={columns}
                        rows={photos}
                        rowKey="id"
                        searchPlaceholder="Search foreman, project, or caption..."
                        emptyMessage="No foreman proof photos yet."
                        serverSide
                        serverSearchValue={tableState.search}
                        serverPage={tableState.page}
                        serverPerPage={tableState.perPage}
                        serverTotalItems={tableState.total}
                        serverTotalPages={tableState.lastPage}
                        serverFrom={tableState.from}
                        serverTo={tableState.to}
                        onServerSearchChange={(value) => navigateTable({ search: value, page: 1 })}
                        onServerPerPageChange={(value) => navigateTable({ per_page: value, page: 1 })}
                        onServerPageChange={(value) => navigateTable({ page: value })}
                    />
                </div>

                <Modal
                    open={!!previewPhoto}
                    onClose={() => setPreviewPhoto(null)}
                    title={previewPhoto?.caption || 'Progress Photo Preview'}
                    maxWidth={900}
                >
                    {previewPhoto && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            <img
                                src={`/storage/${previewPhoto.photo_path}`}
                                alt={previewPhoto.caption || 'Progress proof'}
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
                                Uploaded by: {previewPhoto.foreman_name || '-'} | Project: {previewPhoto.project_name || '-'} | {previewPhoto.created_at || '-'}
                            </div>
                        </div>
                    )}
                </Modal>
            </Layout>
        </>
    );
}
