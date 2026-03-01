import Layout from '../../../Components/Layout';
import ActionButton from '../../../Components/ActionButton';
import DataTable from '../../../Components/DataTable';
import Modal from '../../../Components/Modal';
import ProjectComputationsPanel from '../../../Components/ProjectComputationsPanel';
import SearchableDropdown from '../../../Components/SearchableDropdown';
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

const shortcutPanelStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 12,
};

const shortcutSectionStyle = {
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: 10,
    display: 'grid',
    gap: 8,
    alignContent: 'start',
    background: 'var(--surface-2)',
};

const shortcutLinkStyle = {
    border: '1px solid var(--border-color)',
    background: 'var(--button-bg)',
    color: 'var(--text-main)',
    borderRadius: 8,
    padding: '8px 12px',
    textDecoration: 'none',
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const mono = { fontFamily: "'DM Mono', monospace" };

const parseAssignedForemen = (value) =>
    String(value || '')
        .split(/[,;]+/)
        .map((name) => name.trim())
        .filter(Boolean);

const normalizeAssignedForemen = (names) => {
    const seen = new Set();

    return names
        .map((name) => String(name || '').trim())
        .filter((name) => {
            if (!name) return false;
            const key = name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const parseProjectDisplayList = (value) =>
    String(value || '')
        .split(/[,;]+/)
        .map((item) => item.trim())
        .filter(Boolean);

export default function AdminProjectsShow({
    project,
    foremen = [],
    assignedTeam = [],
    assignedTeamTable = {},
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
    const [teamInfoMember, setTeamInfoMember] = useState(null);
    const [pendingAssignedForeman, setPendingAssignedForeman] = useState('');
    const [assignedForemenDraft, setAssignedForemenDraft] = useState(() => parseAssignedForemen(project?.assigned ?? ''));
    const [savingAssignedForemen, setSavingAssignedForemen] = useState(false);

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

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.replaceState({}, '', url.toString());
    }, [tab]);

    useEffect(() => {
        setAssignedForemenDraft(parseAssignedForemen(project?.assigned ?? ''));
    }, [project?.assigned]);

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

    const teamTableState = {
        search: assignedTeamTable?.search ?? '',
        perPage: Number(assignedTeamTable?.per_page ?? 5),
        page: Number(assignedTeamTable?.current_page ?? 1),
        lastPage: Number(assignedTeamTable?.last_page ?? 1),
        total: Number(assignedTeamTable?.total ?? assignedTeam.length ?? 0),
        from: assignedTeamTable?.from ?? null,
        to: assignedTeamTable?.to ?? null,
    };

    const projectShowQueryParams = (overrides = {}) => {
        const params = {
            tab: overrides.tab !== undefined ? overrides.tab : tab,
            team_search: overrides.team_search !== undefined ? overrides.team_search : teamTableState.search,
            team_per_page: overrides.team_per_page !== undefined ? overrides.team_per_page : teamTableState.perPage,
            team_page: overrides.team_page !== undefined ? overrides.team_page : teamTableState.page,
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

    const foremanOptions = Array.isArray(foremen) ? foremen : [];

    const syncAssignedForemenDraft = (nextNames) => {
        setAssignedForemenDraft(normalizeAssignedForemen(nextNames));
    };

    const addAssignedForeman = () => {
        if (!pendingAssignedForeman) return;
        syncAssignedForemenDraft([...assignedForemenDraft, pendingAssignedForeman]);
        setPendingAssignedForeman('');
    };

    const removeAssignedForeman = (nameToRemove) => {
        syncAssignedForemenDraft(assignedForemenDraft.filter((name) => name !== nameToRemove));
    };

    const resetAssignedForemenDraft = () => {
        setPendingAssignedForeman('');
        setAssignedForemenDraft(parseAssignedForemen(project?.assigned ?? ''));
    };

    const saveAssignedForemen = () => {
        setSavingAssignedForemen(true);
        router.patch(
            `/projects/${project.id}/assigned-foremen${projectShowQueryString({ tab: 'overview' })}`,
            { foreman_names: assignedForemenDraft },
            {
                preserveScroll: true,
                onError: () => toast.error('Unable to update assigned foremen.'),
                onFinish: () => setSavingAssignedForemen(false),
            }
        );
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

    const teamColumns = [
        {
            key: 'display_name',
            label: 'Name',
            render: (member) => <div style={{ fontWeight: 600 }}>{member.display_name || '-'}</div>,
            searchAccessor: (member) => member.display_name,
        },
        {
            key: 'source',
            label: 'Type',
            width: 220,
            render: (member) => (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {member.source === 'user'
                        ? `Registered user${member.user_role ? ` (${member.user_role})` : ''}`
                        : 'Labor record (Foreman-managed)'}
                </div>
            ),
            searchAccessor: (member) => [member.source, member.user_role].filter(Boolean).join(' '),
        },
        {
            key: 'rate',
            label: 'Rate',
            width: 150,
            render: (member) => <div style={{ fontSize: 12, ...mono }}>{money(member.rate)}</div>,
            searchAccessor: (member) => member.rate,
        },
        {
            key: 'reference',
            label: 'Reference',
            width: 160,
            render: (member) => (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {member.user_id ? `User #${member.user_id}` : 'Recorded labor'}
                </div>
            ),
            searchAccessor: (member) => (member.user_id ? `User #${member.user_id}` : 'Recorded labor'),
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            width: 120,
            render: (member) => (
                <ActionButton type="button" variant="view" onClick={() => setTeamInfoMember(member)}>
                    View Info
                </ActionButton>
            ),
        },
    ];

    return (
        <>
            <Head title={`Project #${project.id}`} />
            <Layout title={`Project - ${project.name}`}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
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

                <div style={{ ...shortcutPanelStyle, marginBottom: 14, display: 'grid', gap: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Project shortcuts grouped by department
                    </div>
                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                        <div style={shortcutSectionStyle}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                Design
                            </div>
                            <Link href={`/projects/${project.id}/design`} style={shortcutLinkStyle}>
                                Open Design Tracker
                            </Link>
                        </div>

                        <div style={shortcutSectionStyle}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                Build
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                <Link href={`/projects/${project.id}/build`} style={shortcutLinkStyle}>
                                    Open Build Tracker
                                </Link>
                                <Link href={`/projects/${project.id}/monitoring`} style={shortcutLinkStyle}>
                                    Open Monitoring Board
                                </Link>
                                <a
                                    href={`/projects/${project.id}/client-receipt`}
                                    style={shortcutLinkStyle}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    data-inertia="false"
                                >
                                    View Client Receipt
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {tab === 'overview' && (
                    <div style={{ display: 'grid', gap: 14 }}>
                        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                            {[
                                { label: 'Name', value: project.name },
                                { label: 'Client', value: project.client },
                                { label: 'Type', value: project.type },
                                { label: 'Location', value: project.location },
                                { label: 'Assigned', value: project.assigned_role, asList: true },
                                { label: 'Assigned Foremen', value: project.assigned, asList: true },
                                { label: 'Target', value: project.target || '-' },
                                { label: 'Phase', value: project.phase },
                                { label: 'Status', value: project.status },
                                { label: 'Overall Progress', value: `${project.overall_progress}%` },
                            ].map(({ label, value, asList = false }) => (
                                <div key={label}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
                                    {asList ? (
                                        (() => {
                                            const items = parseProjectDisplayList(value);
                                            if (items.length === 0) {
                                                return <div style={{ fontWeight: 400 }}>-</div>;
                                            }

                                            return (
                                                <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontWeight: 400, display: 'grid', gap: 2 }}>
                                                    {items.map((item, index) => (
                                                        <li key={`${label}-${index}`}>{item}</li>
                                                    ))}
                                                </ul>
                                            );
                                        })()
                                    ) : (
                                        <div style={{ fontWeight: 600 }}>{value}</div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <ProjectComputationsPanel project={project} />

                        <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                            <div style={{ fontWeight: 700 }}>Assigned Foremen (Quick Update)</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                One project can have multiple foremen. This updates the project assignment list used by foreman access and submissions.
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
                                <SearchableDropdown
                                    options={foremanOptions}
                                    value={pendingAssignedForeman}
                                    onChange={(value) => setPendingAssignedForeman(value || '')}
                                    getOptionLabel={(option) => option.fullname}
                                    getOptionValue={(option) => option.fullname}
                                    placeholder={foremanOptions.length === 0 ? 'No foreman users available' : 'Select foreman'}
                                    searchPlaceholder="Search foremen..."
                                    emptyMessage="No foremen found"
                                    disabled={foremanOptions.length === 0}
                                    clearable
                                    style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                    dropdownWidth={340}
                                />
                                <button
                                    type="button"
                                    onClick={addAssignedForeman}
                                    disabled={!pendingAssignedForeman}
                                    style={{
                                        background: 'var(--button-bg)',
                                        color: 'var(--text-main)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        padding: '10px 12px',
                                        cursor: !pendingAssignedForeman ? 'not-allowed' : 'pointer',
                                        opacity: !pendingAssignedForeman ? 0.65 : 1,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    Add Foreman
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {assignedForemenDraft.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No foremen assigned yet.</div>
                                ) : (
                                    assignedForemenDraft.map((name) => (
                                        <div
                                            key={name}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '6px 10px',
                                                borderRadius: 999,
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--surface-2)',
                                                fontSize: 12,
                                            }}
                                        >
                                            <span>{name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeAssignedForeman(name)}
                                                style={{
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    fontSize: 12,
                                                    padding: 0,
                                                }}
                                                aria-label={`Remove ${name}`}
                                            >
                                                x
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {(pageErrors?.foreman_names || pageErrors?.['foreman_names.0']) && (
                                <div style={{ color: '#f87171', fontSize: 12 }}>
                                    {pageErrors?.foreman_names || pageErrors?.['foreman_names.0']}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button
                                    type="button"
                                    onClick={resetAssignedForemenDraft}
                                    style={{
                                        background: 'var(--button-bg)',
                                        color: 'var(--text-main)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        fontWeight: 700,
                                    }}
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={saveAssignedForemen}
                                    disabled={savingAssignedForemen}
                                    style={{
                                        background: 'var(--success)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 8,
                                        padding: '8px 12px',
                                        cursor: savingAssignedForemen ? 'not-allowed' : 'pointer',
                                        opacity: savingAssignedForemen ? 0.8 : 1,
                                        fontSize: 12,
                                        fontWeight: 700,
                                    }}
                                >
                                    {savingAssignedForemen ? 'Saving...' : 'Save Assigned Foremen'}
                                </button>
                            </div>
                        </div>

                        <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                            <div style={{ fontWeight: 700 }}>Project Workers (Read-only)</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Laborers are managed by the foreman in `Foreman &gt; Workers`. This section is record-view only. Foreman assignment is managed in project setup by Head Admin.
                            </div>
                            <DataTable
                                columns={teamColumns}
                                rows={assignedTeam}
                                rowKey={(row) => String(row.id)}
                                searchPlaceholder="Search project workers..."
                                emptyMessage="No project workers yet."
                                serverSide
                                serverSearchValue={teamTableState.search}
                                serverPage={teamTableState.page}
                                serverPerPage={teamTableState.perPage}
                                serverTotalItems={teamTableState.total}
                                serverTotalPages={teamTableState.lastPage}
                                serverFrom={teamTableState.from}
                                serverTo={teamTableState.to}
                                onServerSearchChange={(value) => navigateProjectTable({ tab: 'overview', team_search: value, team_page: 1 })}
                                onServerPerPageChange={(value) => navigateProjectTable({ tab: 'overview', team_per_page: value, team_page: 1 })}
                                onServerPageChange={(value) => navigateProjectTable({ tab: 'overview', team_page: value })}
                            />
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

                <Modal open={!!teamInfoMember} onClose={() => setTeamInfoMember(null)} title="Project Worker Info">
                    {teamInfoMember && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            {[
                                ['Project', project?.name || '-'],
                                ['Display Name', teamInfoMember.display_name || '-'],
                                [
                                    'Type',
                                    teamInfoMember.source === 'user'
                                        ? `Registered user${teamInfoMember.user_role ? ` (${teamInfoMember.user_role})` : ''}`
                                        : 'Labor record (Foreman-managed)',
                                ],
                                ['Rate', money(teamInfoMember.rate)],
                                ['Reference', teamInfoMember.user_id ? `User #${teamInfoMember.user_id}` : 'Recorded labor'],
                                ['Worker Name (raw)', teamInfoMember.worker_name || '-'],
                                ['Birth Date', teamInfoMember.birth_date || '-'],
                                ['Place of Birth', teamInfoMember.place_of_birth || '-'],
                                ['Sex', teamInfoMember.sex || '-'],
                                ['Civil Status', teamInfoMember.civil_status || '-'],
                                ['Phone', teamInfoMember.phone || '-'],
                                ['Address', teamInfoMember.address || '-'],
                                ['Managed By Foreman', teamInfoMember.managed_by_foreman_name || '-'],
                                ['Project ID', String(teamInfoMember.project_id ?? project?.id ?? '-')],
                            ].map(([label, value]) => (
                                <div
                                    key={label}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '160px 1fr',
                                        gap: 8,
                                        alignItems: 'start',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        background: 'var(--surface-2)',
                                        padding: '8px 10px',
                                    }}
                                >
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
                                    <div style={{ fontSize: 13 }}>{value}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal>
            </Layout>
        </>
    );
}
