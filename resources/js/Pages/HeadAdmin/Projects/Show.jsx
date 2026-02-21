import Layout from '../../../Components/Layout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
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

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function HeadAdminProjectsShow({ project, files = [], updates = [] }) {
    const { flash } = usePage().props;
    const [tab, setTab] = useState('overview');

    const {
        data: fileData,
        setData: setFileData,
        post: postFile,
        processing: uploading,
        errors: fileErrors,
    } = useForm({ file: null });

    const {
        data: updateData,
        setData: setUpdateData,
        post: postUpdate,
        processing: postingUpdate,
        errors: updateErrors,
        reset: resetUpdate,
    } = useForm({ note: '' });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    const uploadFile = (e) => {
        e.preventDefault();
        postFile(`/projects/${project.id}/files`, {
            forceFormData: true,
            onSuccess: () => toast.success('File uploaded.'),
            onError: () => toast.error('Upload failed.'),
        });
    };

    const addUpdate = (e) => {
        e.preventDefault();
        postUpdate(`/projects/${project.id}/updates`, {
            onSuccess: () => {
                resetUpdate('note');
                toast.success('Update added.');
            },
            onError: () => toast.error('Unable to add update.'),
        });
    };

    const deleteFile = (id) => {
        router.delete(`/project-files/${id}`, {
            onSuccess: () => toast.success('File deleted.'),
            onError: () => toast.error('Unable to delete file.'),
        });
    };

    return (
        <>
            <Head title={`Project #${project.id}`} />
            <Layout title={`Project - ${project.name}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {['overview', 'files', 'updates'].map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                style={{
                                    border: '1px solid var(--border-color)',
                                    background: tab === t ? 'var(--active-bg)' : 'var(--button-bg)',
                                    color: tab === t ? 'var(--active-text)' : 'var(--text-main)',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                }}
                            >
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Link href={`/projects/${project.id}/design`} style={{ color: 'var(--active-text)', textDecoration: 'none', fontSize: 13 }}>
                            Design
                        </Link>
                        <Link href={`/projects/${project.id}/build`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 13 }}>
                            Build
                        </Link>
                        <Link href={`/projects/${project.id}/build?tab=expenses`} style={{ color: '#f59e0b', textDecoration: 'none', fontSize: 13 }}>
                            Expenses
                        </Link>
                        <Link href={`/projects/${project.id}/edit`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 13 }}>
                            Edit Project
                        </Link>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <Link
                        href={`/projects/${project.id}/design`}
                        style={{
                            border: '1px solid var(--border-color)',
                            background: 'var(--button-bg)',
                            color: 'var(--text-main)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            textDecoration: 'none',
                            fontSize: 13,
                        }}
                    >
                        Open Design Tracker
                    </Link>
                    <Link
                        href={`/projects/${project.id}/build`}
                        style={{
                            border: '1px solid var(--border-color)',
                            background: 'var(--button-bg)',
                            color: 'var(--text-main)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            textDecoration: 'none',
                            fontSize: 13,
                        }}
                    >
                        Open Build Tracker
                    </Link>
                    <Link
                        href={`/projects/${project.id}/build?tab=expenses`}
                        style={{
                            border: '1px solid var(--border-color)',
                            background: 'var(--button-bg)',
                            color: 'var(--text-main)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            textDecoration: 'none',
                            fontSize: 13,
                        }}
                    >
                        Open Expenses
                    </Link>
                </div>

                {tab === 'overview' && (
                    <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        {[
                            ['Name', project.name],
                            ['Client', project.client],
                            ['Type', project.type],
                            ['Location', project.location],
                            ['Assigned', project.assigned || '-'],
                            ['Target', project.target || '-'],
                            ['Phase', project.phase],
                            ['Status', project.status],
                            ['Overall Progress', `${project.overall_progress}%`],
                            ['Contract Amount', money(project.contract_amount)],
                            ['Design Fee', money(project.design_fee)],
                            ['Construction Cost', money(project.construction_cost)],
                            ['Total Client Payment', money(project.total_client_payment)],
                            ['Remaining Balance', money(project.remaining_balance)],
                        ].map(([label, value]) => (
                            <div key={label}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
                                <div style={{ fontWeight: 600 }}>{value}</div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'files' && (
                    <div style={{ display: 'grid', gap: 14 }}>
                        <form onSubmit={uploadFile} style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                            <div style={{ fontWeight: 700 }}>Upload Plan/File</div>
                            <input type="file" onChange={(e) => setFileData('file', e.target.files?.[0] ?? null)} />
                            {fileErrors.file && <div style={{ color: '#f87171', fontSize: 12 }}>{fileErrors.file}</div>}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" disabled={uploading} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px' }}>
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </form>

                        <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                            {files.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No files uploaded yet.</div>}
                            {files.map((file) => (
                                <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, border: '1px solid var(--border-color)', borderRadius: 10, padding: 10 }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{file.original_name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            Uploaded by: {file.uploaded_by_name || 'Unknown'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <a href={`/storage/${file.file_path}`} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 13 }}>
                                            Open
                                        </a>
                                        <button type="button" onClick={() => deleteFile(file.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === 'updates' && (
                    <div style={{ display: 'grid', gap: 14 }}>
                        <form onSubmit={addUpdate} style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                            <div style={{ fontWeight: 700 }}>Add Remark/Update</div>
                            <textarea value={updateData.note} onChange={(e) => setUpdateData('note', e.target.value)} style={{ ...inputStyle, minHeight: 90 }} />
                            {updateErrors.note && <div style={{ color: '#f87171', fontSize: 12 }}>{updateErrors.note}</div>}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" disabled={postingUpdate} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px' }}>
                                    {postingUpdate ? 'Posting...' : 'Post Update'}
                                </button>
                            </div>
                        </form>

                        <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                            {updates.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No updates yet.</div>}
                            {updates.map((update) => (
                                <div key={update.id} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10 }}>
                                    <div style={{ fontSize: 13 }}>{update.note}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                        {update.created_by_name || 'Unknown'} | {update.created_at}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Layout>
        </>
    );
}
