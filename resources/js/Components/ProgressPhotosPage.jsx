import Layout from './Layout';
import Modal from './Modal';
import ProjectAccordionTable from './ProjectAccordionTable';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

export default function ProgressPhotosPage({ photos = [], photoTable = {}, statusFilters = [] }) {
    const [previewPhoto, setPreviewPhoto] = useState(null);

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
        },
        {
            key: 'project_name',
            label: 'Project',
            render: (photo) => photo.project_name || '-',
        },
        {
            key: 'caption',
            label: 'Caption',
            render: (photo) => photo.caption || '-',
        },
        {
            key: 'created_at',
            label: 'Uploaded At',
            render: (photo) => photo.created_at || '-',
        },
    ];

    return (
        <>
            <Head title="Progress Photos" />
            <Layout title="Progress Photos">
                <div style={cardStyle}>
                    <ProjectAccordionTable
                        columns={columns}
                        rows={photos}
                        rowKey="id"
                    searchPlaceholder="Search foreman, project, or caption..."
                    emptyMessage="No foreman proof photos yet."
                    routePath="/progress-photos"
                    table={photoTable}
                    statusOptions={statusFilters}
                    groupPageSize={10}
                    expandAllGroups
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
