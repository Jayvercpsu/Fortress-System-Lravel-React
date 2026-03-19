import ActionButton from './ActionButton';
import Modal from './Modal';
import { router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { toastMessages } from '../constants/toastMessages';

const phaseAccent = {
    Design: '#60a5fa',
    Construction: '#22c55e',
    Completed: '#10b981',
};

const panel = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
};

const input = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 13,
    boxSizing: 'border-box',
};

const KANBAN_CARD_HEIGHT = 365;
const KANBAN_BOARD_HEIGHT = 'calc(100dvh - 190px)';

const singleLineClampStyle = {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const money = (value) => `P ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pct = (value) => `${Math.max(0, Math.min(100, Number(value || 0)))}%`;
const approvalStatusTone = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'approved') return '#22c55e';
    if (normalized === 'rejected') return '#f87171';
    return 'var(--text-main)';
};

const statusTone = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'completed') {
        return { color: '#16a34a', border: '1px solid rgba(16,163,84,0.25)', background: 'rgba(16,163,84,0.08)' };
    }
    if (normalized === 'active' || normalized === 'design') {
        return { color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.25)', background: 'rgba(14,165,233,0.08)' };
    }
    if (normalized === 'on_hold' || normalized === 'hold') {
        return { color: '#f97316', border: '1px solid rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.08)' };
    }
    if (normalized === 'cancelled') {
        return { color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.08)' };
    }
    return { color: 'var(--text-muted)', border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(148,163,184,0.12)' };
};

export default function ProjectsKanbanPage({
    projectBoard = {},
    canCreate = false,
    canDelete = false,
}) {
    const columns = Array.isArray(projectBoard.columns) ? projectBoard.columns : [];

    const [search, setSearch] = useState(projectBoard.search ?? '');
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [deletingProject, setDeletingProject] = useState(false);
    const [transferringId, setTransferringId] = useState(null);
    const [creatingProject, setCreatingProject] = useState(false);
    const createTimeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (createTimeoutRef.current) {
                clearTimeout(createTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setSearch(projectBoard.search ?? '');
    }, [projectBoard.search]);

    const pageParams = useMemo(() => {
        const params = {};
        columns.forEach((column) => {
            if (column?.page_param) params[column.page_param] = Math.max(1, Number(column.current_page || 1));
        });
        return params;
    }, [columns]);

    const buildParams = (overrides = {}) => {
        const params = { search: projectBoard.search ?? '', ...pageParams, ...overrides };
        return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));
    };

    const buildQueryString = (overrides = {}) => {
        const qs = new URLSearchParams(buildParams(overrides)).toString();
        return qs ? `?${qs}` : '';
    };

    const resetPages = () => Object.fromEntries(columns.map((column) => [column.page_param, 1]));

    const reloadBoard = (overrides = {}) => {
        router.get('/projects', buildParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const onSearchSubmit = (e) => {
        e.preventDefault();
        reloadBoard({ search: String(search || '').trim(), ...resetPages() });
    };

    const clearSearch = () => {
        setSearch('');
        reloadBoard({ search: '', ...resetPages() });
    };

    const deleteProject = () => {
        if (!projectToDelete) return;
        setDeletingProject(true);
        router.delete(`/projects/${projectToDelete.id}${buildQueryString()}`, {
            preserveScroll: true,
            onSuccess: () => toast.success(toastMessages.projectsKanban.deleteSuccess),
            onError: () => toast.error(toastMessages.projectsKanban.deleteError),
            onFinish: () => {
                setDeletingProject(false);
                setProjectToDelete(null);
            },
        });
    };

    const transferProject = (project, target) => {
        if (!project) return;

        const endpoint = target === 'completed'
            ? `/projects/${project.id}/transfer-to-completed`
            : `/projects/${project.id}/transfer-to-construction`;
        const targetLabel = target === 'completed' ? 'Completed' : 'Construction';

        setTransferringId(project.id);
        router.patch(`${endpoint}${buildQueryString()}`, {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onSuccess: () => toast.success(toastMessages.projectsKanban.transferSuccess(targetLabel)),
            onError: (errors) => toast.error(errors.transfer || toastMessages.projectsKanban.transferError(targetLabel)),
            onFinish: () => setTransferringId(null),
        });
    };

    return (
        <div style={{ display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', gap: 14, height: '100%', minHeight: 0 }}>
                <div style={{ ...panel, padding: 14, display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <form onSubmit={onSearchSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flex: '1 1 640px' }}>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search projects..."
                            style={{ ...input, minWidth: 320, flex: '1 1 100%', maxWidth: 640 }}
                        />
                        <ActionButton type="submit" variant="success" style={{ padding: '9px 14px', fontSize: 13 }}>
                            Search
                        </ActionButton>
                        <ActionButton type="button" onClick={clearSearch} style={{ padding: '9px 14px', fontSize: 13 }}>
                            Clear
                        </ActionButton>
                </form>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {canCreate && (
                        <ActionButton
                            type="button"
                            variant="success"
                            loading={creatingProject}
                            disabled={creatingProject}
                            onClick={() => {
                                if (creatingProject) return;
                                setCreatingProject(true);
                                createTimeoutRef.current = setTimeout(() => {
                                    router.get('/monitoring-board?create=1');
                                }, 2000);
                            }}
                            style={{ padding: '9px 14px', fontSize: 13 }}
                        >
                            + Create Project
                        </ActionButton>
                    )}
                </div>
            </div>

            <div
                style={{
                    ...panel,
                    padding: 12,
                    height: KANBAN_BOARD_HEIGHT,
                    overflow: 'auto',
                }}
            >
                <div
                    style={{
                        display: 'grid',
                        gap: 12,
                        gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(300px, 1fr))`,
                        minWidth: Math.max(columns.length, 1) * 300,
                        height: '100%',
                        minHeight: 0,
                        alignItems: 'stretch',
                    }}
                >
                    {columns.map((column) => {
                        const accent = phaseAccent[column.value] || '#94a3b8';

                        return (
                            <div
                                key={column.key}
                                data-testid={`kanban-column-${column.key}`}
                                style={{
                                    ...panel,
                                    display: 'grid',
                                    gridTemplateRows: 'auto 1fr auto',
                                    height: '100%',
                                    minHeight: 0,
                                }}
                            >
                                <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                                            <span style={{ width: 10, height: 10, borderRadius: 999, background: accent, boxShadow: `0 0 0 4px ${accent}22` }} />
                                            <span>{column.label}</span>
                                        </div>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 999, padding: '2px 8px' }}>
                                            {column.total}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)' }}>Showing {column.shown} of {column.total}</div>
                                </div>

                                <div style={{ padding: 12, display: 'grid', gap: 10, alignContent: 'start', minHeight: 0, overflowY: 'auto' }}>
                                    {Array.isArray(column.projects) && column.projects.length > 0 ? column.projects.map((project) => (
                                        <div
                                            key={project.id}
                                            className="kanban-project-card"
                                            data-testid="kanban-card"
                                            data-project-id={project.id}
                                            style={{
                                                background: 'var(--surface-2)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 12,
                                                padding: 12,
                                                display: 'grid',
                                                gap: 10,
                                                minHeight: KANBAN_CARD_HEIGHT,
                                                gridTemplateRows: 'auto auto auto auto minmax(0, 1fr) auto',
                                                overflow: 'hidden',
                                                position: 'relative',
                                            }}
                                        >
                                            {project.is_new_today ? (
                                                <span
                                                    style={{
                                                        position: 'absolute',
                                                        top: 10,
                                                        right: 10,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        borderRadius: 999,
                                                        padding: '2px 8px',
                                                        fontSize: 10,
                                                        fontWeight: 800,
                                                        letterSpacing: 0.3,
                                                        textTransform: 'uppercase',
                                                        color: '#166534',
                                                        background: 'rgba(34,197,94,0.16)',
                                                        border: '1px solid rgba(34,197,94,0.32)',
                                                    }}
                                                >
                                                    New
                                                </span>
                                            ) : null}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start', minWidth: 0 }}>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, width: '100%' }}>
                                                        <div
                                                            title={project.name}
                                                            style={{
                                                                fontWeight: 700,
                                                                fontSize: 14,
                                                                flex: 1,
                                                                minWidth: 0,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {project.name}
                                                        </div>
                                                        {null}
                                                    </div>
                                                    <div
                                                        title={project.client || 'No client'}
                                                        style={{
                                                            fontSize: 12,
                                                            color: 'var(--text-muted)',
                                                            ...singleLineClampStyle,
                                                        }}
                                                    >
                                                        {project.client || 'No client'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gap: 4 }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Phase</div>
                                                <div style={{ ...input, padding: '7px 10px', fontSize: 12 }}>{project.phase || '-'}</div>
                                            </div>

                                            <div style={{ display: 'grid', gap: 5 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                                                    <span>{project.phase === 'Design' ? 'Design Progress' : 'Progress'}</span>
                                                    <span>{pct(project.overall_progress)}</span>
                                                </div>
                                                <div style={{ height: 7, background: 'rgba(148,163,184,0.2)', borderRadius: 999, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: pct(project.overall_progress), background: accent, borderRadius: 999 }} />
                                                </div>
                                            </div>

                                            {project.target ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target: {project.target}</span>
                                                </div>
                                            ) : null}

                                            <div style={{ display: 'grid', gap: 4, fontSize: 11, minHeight: 0, alignContent: 'start' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Location</span>
                                                    <span title={project.location || '-'} style={{ textAlign: 'right', ...singleLineClampStyle }}>{project.location || '-'}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Assigned</span>
                                                    <span title={project.assigned_role || '-'} style={{ textAlign: 'right', ...singleLineClampStyle }}>{project.assigned_role || '-'}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Foremen</span>
                                                    <span title={project.assigned || '-'} style={{ textAlign: 'right', ...singleLineClampStyle }}>{project.assigned || '-'}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Client Approval</span>
                                                    <span
                                                        title={project.design_approval_status || 'Pending'}
                                                        style={{
                                                            textAlign: 'right',
                                                            color: approvalStatusTone(project.design_approval_status),
                                                            ...singleLineClampStyle,
                                                        }}
                                                    >
                                                        {project.design_approval_status || 'Pending'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Contract</span>
                                                    <span title={money(project.contract_amount)} style={{ textAlign: 'right', ...singleLineClampStyle }}>{money(project.contract_amount)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Paid</span>
                                                    <span title={money(project.total_client_payment)} style={{ color: '#4ade80', textAlign: 'right', ...singleLineClampStyle }}>{money(project.total_client_payment)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Status</span>
                                                    <span
                                                        style={{
                                                            textTransform: 'capitalize',
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            textAlign: 'right',
                                                            maxWidth: 160,
                                                            overflow: 'hidden',
                                                            whiteSpace: 'nowrap',
                                                            textOverflow: 'ellipsis',
                                                            color: statusTone(project.status)?.color || 'var(--text-main)',
                                                        }}
                                                    >
                                                        {project.status || 'Unknown'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                                                <ActionButton href={`/projects/${project.id}`} variant="view" style={{ padding: '6px 10px', minHeight: 30 }}>Manage</ActionButton>
                                                {canDelete && (
                                                    <ActionButton
                                                        type="button"
                                                        variant="danger"
                                                        onClick={() => setProjectToDelete({ id: project.id, name: project.name })}
                                                        disabled={deletingProject}
                                                        loading={deletingProject && projectToDelete?.id === project.id}
                                                        style={{ padding: '6px 10px', minHeight: 30 }}
                                                    >
                                                        {deletingProject && projectToDelete?.id === project.id ? 'Deleting...' : 'Delete'}
                                                    </ActionButton>
                                                )}
                                                {project.phase === 'Design' && (
                                                    <ActionButton
                                                        type="button"
                                                        variant={project.transfer_to_construction_used ? 'neutral' : 'success'}
                                                        onClick={() => transferProject(project, 'construction')}
                                                        disabled={
                                                            transferringId === project.id
                                                            || project.transfer_to_construction_used
                                                            || !project.can_transfer_to_construction
                                                        }
                                                        loading={transferringId === project.id}
                                                        style={{ padding: '6px 10px', minHeight: 30, marginLeft: 'auto' }}
                                                        title={
                                                            project.transfer_to_construction_used
                                                                ? 'Already transferred to construction.'
                                                                : (project.can_transfer_to_construction
                                                                    ? 'Transfer this design project to construction.'
                                                                    : 'Requires Completed status and not yet transferred.')
                                                        }
                                                    >
                                                        {project.transfer_to_construction_used ? 'Transferred' : 'Transfer to Construction'}
                                                    </ActionButton>
                                                )}
                                                {project.phase === 'Construction' && (
                                                    <ActionButton
                                                        type="button"
                                                        variant="success"
                                                        onClick={() => transferProject(project, 'completed')}
                                                        disabled={
                                                            transferringId === project.id ||
                                                            !project.can_transfer_to_completed ||
                                                            String(project.status || '').trim().toLowerCase() !== 'completed'
                                                        }
                                                        loading={transferringId === project.id}
                                                        style={{ padding: '6px 10px', minHeight: 30, marginLeft: 'auto' }}
                                                    >
                                                        Transfer to Completed
                                                    </ActionButton>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{ border: '1px dashed var(--border-color)', borderRadius: 10, padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                            No projects in {column.label}.
                                        </div>
                                    )}
                                </div>

                                <div
                                    style={{
                                        padding: 12,
                                        borderTop: '1px solid var(--border-color)',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        background: 'var(--surface-1)',
                                        marginTop: 'auto',
                                    }}
                                >
                                    {column.has_more ? (
                                        <ActionButton
                                            type="button"
                                            onClick={() => reloadBoard({ [column.page_param]: Number(column.current_page || 1) + 1 })}
                                            style={{ width: '100%', padding: '9px 12px' }}
                                        >
                                            Load more projects ({column.remaining} left)
                                        </ActionButton>
                                    ) : (
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{column.total > 0 ? 'All projects loaded' : 'No records'}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {canDelete && (
                <Modal open={Boolean(projectToDelete)} onClose={() => (deletingProject ? null : setProjectToDelete(null))} title="Delete Project" maxWidth={520}>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ fontSize: 13 }}>Delete project <strong>{projectToDelete?.name}</strong>?</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            This also removes related design/build trackers, expenses, files, and updates.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <ActionButton type="button" onClick={() => setProjectToDelete(null)} disabled={deletingProject} style={{ padding: '8px 12px' }}>
                                Cancel
                            </ActionButton>
                            <ActionButton type="button" variant="danger" onClick={deleteProject} disabled={deletingProject} loading={deletingProject} style={{ padding: '8px 12px' }}>
                                {deletingProject ? 'Deleting...' : 'Delete Project'}
                            </ActionButton>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
