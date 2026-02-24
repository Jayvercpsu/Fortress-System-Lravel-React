import Layout from '../../../Components/Layout';
import ActionButton from '../../../Components/ActionButton';
import DataTable from '../../../Components/DataTable';
import Modal from '../../../Components/Modal';
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

export default function HeadAdminProjectsShow({
    project,
    assignedTeam = [],
    teamOptions = {},
    files = [],
    fileTable = {},
    updates = [],
    updateTable = {},
}) {
    const { flash, errors: pageErrors } = usePage().props;
    const [tab, setTab] = useState(() => {
        const active = new URLSearchParams(window.location.search).get('tab');
        return ['overview', 'files', 'updates'].includes(active) ? active : 'overview';
    });
    const [previewFile, setPreviewFile] = useState(null);

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

    const {
        data: teamData,
        setData: setTeamData,
        post: postTeam,
        processing: savingTeam,
        errors: teamErrors,
        reset: resetTeam,
    } = useForm({
        user_id: '',
        worker_name: '',
        rate: '',
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.replaceState({}, '', url.toString());
    }, [tab]);

    const fileTableState = {
        search: fileTable?.search ?? '',
        perPage: Number(fileTable?.per_page ?? 5),
        page: Number(fileTable?.current_page ?? 1),
        lastPage: Number(fileTable?.last_page ?? 1),
        total: Number(fileTable?.total ?? files.length ?? 0),
        from: fileTable?.from ?? null,
        to: fileTable?.to ?? null,
    };

    const updateTableState = {
        search: updateTable?.search ?? '',
        perPage: Number(updateTable?.per_page ?? 5),
        page: Number(updateTable?.current_page ?? 1),
        lastPage: Number(updateTable?.last_page ?? 1),
        total: Number(updateTable?.total ?? updates.length ?? 0),
        from: updateTable?.from ?? null,
        to: updateTable?.to ?? null,
    };

    const projectShowQueryParams = (overrides = {}) => {
        const params = {
            tab: overrides.tab !== undefined ? overrides.tab : tab,
            files_search: overrides.files_search !== undefined ? overrides.files_search : fileTableState.search,
            files_per_page: overrides.files_per_page !== undefined ? overrides.files_per_page : fileTableState.perPage,
            files_page: overrides.files_page !== undefined ? overrides.files_page : fileTableState.page,
            updates_search: overrides.updates_search !== undefined ? overrides.updates_search : updateTableState.search,
            updates_per_page: overrides.updates_per_page !== undefined ? overrides.updates_per_page : updateTableState.perPage,
            updates_page: overrides.updates_page !== undefined ? overrides.updates_page : updateTableState.page,
        };

        Object.keys(params).forEach((key) => {
            if (params[key] === '' || params[key] === null || params[key] === undefined) delete params[key];
        });

        return params;
    };

    const projectShowQueryString = (overrides = {}) => {
        const params = new URLSearchParams(projectShowQueryParams(overrides));
        const queryString = params.toString();
        return queryString ? `?${queryString}` : '';
    };

    const navigateProjectTable = (overrides = {}) => {
        router.get(`/projects/${project.id}`, projectShowQueryParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const uploadFile = (e) => {
        e.preventDefault();
        postFile(`/projects/${project.id}/files${projectShowQueryString({ tab: 'files', files_page: 1 })}`, {
            forceFormData: true,
            onError: () => toast.error('Upload failed.'),
        });
    };

    const addUpdate = (e) => {
        e.preventDefault();
        postUpdate(`/projects/${project.id}/updates${projectShowQueryString({ tab: 'updates', updates_page: 1 })}`, {
            onSuccess: () => {
                resetUpdate('note');
            },
            onError: () => toast.error('Unable to add update.'),
        });
    };

    const deleteFile = (id) => {
        router.delete(`/project-files/${id}${projectShowQueryString({ tab: 'files' })}`, {
            onError: () => toast.error('Unable to delete file.'),
        });
    };

    const userTeamOptions = Array.isArray(teamOptions?.users) ? teamOptions.users : [];
    const workerTeamOptions = Array.isArray(teamOptions?.workers) ? teamOptions.workers : [];

    const addTeamMember = (e) => {
        e.preventDefault();
        postTeam(`/projects/${project.id}/team${projectShowQueryString({ tab: 'overview' })}`, {
            preserveScroll: true,
            onSuccess: () => {
                resetTeam('user_id', 'worker_name', 'rate');
            },
            onError: () => toast.error('Unable to add team member.'),
        });
    };

    const removeTeamMember = (teamMemberId) => {
        router.delete(`/project-team/${teamMemberId}${projectShowQueryString({ tab: 'overview' })}`, {
            preserveScroll: true,
            onError: () => toast.error('Unable to remove team member.'),
        });
    };

    const previewUrl = previewFile ? `/storage/${previewFile.file_path}` : '';
    const previewExt = (previewFile?.original_name || '').split('.').pop()?.toLowerCase() || '';
    const isImagePreview = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(previewExt);
    const isPdfPreview = previewExt === 'pdf';

    const fileColumns = [
        {
            key: 'original_name',
            label: 'File Name',
            render: (file) => <div style={{ fontWeight: 600 }}>{file.original_name}</div>,
            searchAccessor: (file) => file.original_name,
        },
        {
            key: 'uploaded_by_name',
            label: 'Uploaded By',
            render: (file) => <div>{file.uploaded_by_name || 'Unknown'}</div>,
            searchAccessor: (file) => file.uploaded_by_name,
        },
        {
            key: 'created_at',
            label: 'Uploaded At',
            render: (file) => <div style={{ fontSize: 13 }}>{file.created_at || '-'}</div>,
            searchAccessor: (file) => file.created_at,
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (file) => (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <ActionButton type="button" variant="view" onClick={() => setPreviewFile(file)}>
                        Open
                    </ActionButton>
                    <ActionButton type="button" variant="danger" onClick={() => deleteFile(file.id)}>
                        Delete
                    </ActionButton>
                </div>
            ),
        },
    ];

    const updateColumns = [
        {
            key: 'note',
            label: 'Remark / Update',
            render: (update) => <div style={{ fontSize: 13 }}>{update.note}</div>,
            searchAccessor: (update) => update.note,
        },
        {
            key: 'created_by_name',
            label: 'Posted By',
            render: (update) => <div>{update.created_by_name || 'Unknown'}</div>,
            searchAccessor: (update) => update.created_by_name,
        },
        {
            key: 'created_at',
            label: 'Created At',
            render: (update) => <div style={{ fontSize: 13 }}>{update.created_at || '-'}</div>,
            searchAccessor: (update) => update.created_at,
        },
    ];

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
                        href={`/projects/${project.id}/expenses`}
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
                    <Link
                        href={`/projects/${project.id}/payments`}
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
                        Open Payments
                    </Link>
                    <Link
                        href={`/projects/${project.id}/monitoring`}
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
                        Open Monitoring Board
                    </Link>
                    <Link
                        href={`/projects/${project.id}/edit`}
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
                        Edit Project
                    </Link>
                </div>

                {tab === 'overview' && (
                    <div style={{ display: 'grid', gap: 14 }}>
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
                                ['Last Paid Date', project.last_paid_date || '-'],
                                ['Remaining Balance', money(project.remaining_balance)],
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
                                    <div style={{ fontWeight: 600 }}>{value}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                            <div style={{ fontWeight: 700 }}>Assigned Team</div>

                            <form onSubmit={addTeamMember} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                                <div style={{ display: 'grid', gap: 6 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Registered User (optional)</label>
                                    <select
                                        value={teamData.user_id}
                                        onChange={(e) => {
                                            const nextUserId = e.target.value;
                                            const selected = userTeamOptions.find((user) => String(user.id) === String(nextUserId));
                                            setTeamData((data) => ({
                                                ...data,
                                                user_id: nextUserId,
                                                worker_name: nextUserId ? '' : data.worker_name,
                                                rate: nextUserId && selected?.default_rate_per_hour != null
                                                    ? String(selected.default_rate_per_hour)
                                                    : data.rate,
                                            }));
                                        }}
                                        style={inputStyle}
                                    >
                                        <option value="">Select user</option>
                                        {userTeamOptions.map((user) => (
                                            <option key={user.id} value={user.id}>
                                                {user.fullname} ({user.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gap: 6 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Worker Template (optional)</label>
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            const selected = workerTeamOptions.find((worker) => String(worker.id) === String(e.target.value));
                                            if (!selected) return;
                                            setTeamData((data) => ({
                                                ...data,
                                                user_id: '',
                                                worker_name: selected.name || '',
                                                rate: selected.default_rate_per_hour != null ? String(selected.default_rate_per_hour) : data.rate,
                                            }));
                                            e.target.value = '';
                                        }}
                                        style={inputStyle}
                                    >
                                        <option value="">Pick saved worker</option>
                                        {workerTeamOptions.map((worker) => (
                                            <option key={worker.id} value={worker.id}>
                                                {worker.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
                                    <div style={{ display: 'grid', gap: 6 }}>
                                        <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Worker Name (manual)</label>
                                        <input
                                            value={teamData.worker_name}
                                            onChange={(e) =>
                                                setTeamData((data) => ({ ...data, user_id: '', worker_name: e.target.value }))
                                            }
                                            placeholder="Manual worker name"
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gap: 6 }}>
                                        <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rate</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={teamData.rate}
                                            onChange={(e) => setTeamData('rate', e.target.value)}
                                            placeholder="0.00"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={savingTeam}
                                    style={{
                                        background: 'var(--success)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 8,
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontSize: 12,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {savingTeam ? 'Saving...' : 'Add / Update'}
                                </button>
                            </form>

                            {(teamErrors.team_member || pageErrors?.team_member) && (
                                <div style={{ color: '#f87171', fontSize: 12 }}>
                                    {teamErrors.team_member || pageErrors?.team_member}
                                </div>
                            )}

                            {teamErrors.user_id && <div style={{ color: '#f87171', fontSize: 12 }}>{teamErrors.user_id}</div>}
                            {teamErrors.worker_name && <div style={{ color: '#f87171', fontSize: 12 }}>{teamErrors.worker_name}</div>}
                            {teamErrors.rate && <div style={{ color: '#f87171', fontSize: 12 }}>{teamErrors.rate}</div>}

                            <div style={{ display: 'grid', gap: 8 }}>
                                {assignedTeam.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No team members assigned yet.</div>
                                ) : (
                                    assignedTeam.map((member) => (
                                        <div
                                            key={member.id}
                                            style={{
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 8,
                                                background: 'var(--surface-2)',
                                                padding: 10,
                                                display: 'grid',
                                                gridTemplateColumns: '1fr auto auto auto',
                                                gap: 8,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{member.display_name || '-'}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                    {member.source === 'user'
                                                        ? `Registered user${member.user_role ? ` (${member.user_role})` : ''}`
                                                        : 'Manual worker'}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                                                {money(member.rate)}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {member.user_id ? `User #${member.user_id}` : 'Manual'}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeTeamMember(member.id)}
                                                style={{
                                                    background: 'rgba(248,81,73,0.12)',
                                                    color: '#f87171',
                                                    border: '1px solid rgba(248,81,73,0.25)',
                                                    borderRadius: 8,
                                                    padding: '6px 10px',
                                                    cursor: 'pointer',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
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

                        <div style={{ ...cardStyle }}>
                            <DataTable
                                columns={fileColumns}
                                rows={files}
                                rowKey="id"
                                searchPlaceholder="Search files..."
                                emptyMessage="No files uploaded yet."
                                serverSide
                                serverSearchValue={fileTableState.search}
                                serverPage={fileTableState.page}
                                serverPerPage={fileTableState.perPage}
                                serverTotalItems={fileTableState.total}
                                serverTotalPages={fileTableState.lastPage}
                                serverFrom={fileTableState.from}
                                serverTo={fileTableState.to}
                                onServerSearchChange={(value) => navigateProjectTable({ tab: 'files', files_search: value, files_page: 1 })}
                                onServerPerPageChange={(value) => navigateProjectTable({ tab: 'files', files_per_page: value, files_page: 1 })}
                                onServerPageChange={(value) => navigateProjectTable({ tab: 'files', files_page: value })}
                            />
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

                        <div style={{ ...cardStyle }}>
                            <DataTable
                                columns={updateColumns}
                                rows={updates}
                                rowKey="id"
                                searchPlaceholder="Search updates..."
                                emptyMessage="No updates yet."
                                serverSide
                                serverSearchValue={updateTableState.search}
                                serverPage={updateTableState.page}
                                serverPerPage={updateTableState.perPage}
                                serverTotalItems={updateTableState.total}
                                serverTotalPages={updateTableState.lastPage}
                                serverFrom={updateTableState.from}
                                serverTo={updateTableState.to}
                                onServerSearchChange={(value) => navigateProjectTable({ tab: 'updates', updates_search: value, updates_page: 1 })}
                                onServerPerPageChange={(value) => navigateProjectTable({ tab: 'updates', updates_per_page: value, updates_page: 1 })}
                                onServerPageChange={(value) => navigateProjectTable({ tab: 'updates', updates_page: value })}
                            />
                        </div>
                    </div>
                )}

                <Modal open={!!previewFile} onClose={() => setPreviewFile(null)} title={previewFile?.original_name || 'File Preview'}>
                    {previewFile && (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {isImagePreview && (
                                <img
                                    src={previewUrl}
                                    alt={previewFile.original_name}
                                    style={{
                                        width: '100%',
                                        maxHeight: '70vh',
                                        objectFit: 'contain',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        background: 'var(--surface-2)',
                                    }}
                                />
                            )}

                            {isPdfPreview && (
                                <iframe
                                    src={previewUrl}
                                    title={previewFile.original_name}
                                    style={{
                                        width: '100%',
                                        height: '70vh',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        background: 'var(--surface-2)',
                                    }}
                                />
                            )}

                            {!isImagePreview && !isPdfPreview && (
                                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                    Preview is not available for this file type.
                                </div>
                            )}
                        </div>
                    )}
                </Modal>
            </Layout>
        </>
    );
}
