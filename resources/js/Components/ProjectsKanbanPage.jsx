import Modal from './Modal';
import { Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const PHASES = ['Design', 'ForBuild', 'Construction', 'Turnover', 'Completed'];

const phaseAccent = {
    Design: '#60a5fa',
    ForBuild: '#f59e0b',
    Construction: '#22c55e',
    Turnover: '#a78bfa',
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

const actionPillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.2,
};

const money = (value) => `P ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pct = (value) => `${Math.max(0, Math.min(100, Number(value || 0)))}%`;

const statusPillStyle = (status) => {
    const key = String(status || '').toLowerCase();
    const color = key === 'completed' ? '#22c55e' : key === 'planning' ? '#94a3b8' : '#60a5fa';
    return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        color,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        textTransform: 'uppercase',
    };
};

export default function ProjectsKanbanPage({
    projectBoard = {},
    canCreate = false,
    canEdit = false,
    canDelete = false,
}) {
    const columns = Array.isArray(projectBoard.columns) ? projectBoard.columns : [];
    const phaseOptions = Array.isArray(projectBoard.phase_order) && projectBoard.phase_order.length
        ? projectBoard.phase_order
        : PHASES;

    const [search, setSearch] = useState(projectBoard.search ?? '');
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [draggingProject, setDraggingProject] = useState(null);
    const [dropKey, setDropKey] = useState('');
    const [updatingId, setUpdatingId] = useState(null);

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

    const updatePhase = (project, nextPhase) => {
        if (!project || !nextPhase || String(project.phase) === String(nextPhase)) return;

        setUpdatingId(project.id);
        router.patch(`/projects/${project.id}/phase${buildQueryString()}`, { phase: nextPhase }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onSuccess: () => toast.success(`Moved "${project.name}" to ${nextPhase}.`),
            onError: () => toast.error('Unable to update project phase.'),
            onFinish: () => {
                setUpdatingId(null);
                setDraggingProject(null);
                setDropKey('');
            },
        });
    };

    const deleteProject = () => {
        if (!projectToDelete) return;
        router.delete(`/projects/${projectToDelete.id}${buildQueryString()}`, {
            preserveScroll: true,
            onSuccess: () => toast.success('Project deleted.'),
            onError: () => toast.error('Unable to delete project.'),
            onFinish: () => setProjectToDelete(null),
        });
    };

    const totalMatching = Number(projectBoard.total ?? columns.reduce((sum, c) => sum + Number(c.total || 0), 0));
    const loadedCount = columns.reduce((sum, c) => sum + Number(c.shown || 0), 0);

    return (
        <div style={{ display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', gap: 14, height: '100%', minHeight: 0 }}>
            <div style={{ ...panel, padding: 14, display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <form onSubmit={onSearchSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flex: '1 1 520px' }}>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." style={{ ...input, minWidth: 260, flex: '1 1 360px' }} />
                    <button type="submit" style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Search</button>
                    <button type="button" onClick={clearSearch} style={{ background: 'var(--button-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Clear</button>
                </form>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {loadedCount} loaded / {totalMatching} matching • 5 per phase per load
                    </div>
                    {canCreate && (
                        <Link href="/projects/create" style={{ background: 'var(--success)', color: '#fff', borderRadius: 8, padding: '9px 14px', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                            + Create Project
                        </Link>
                    )}
                </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Drag a card to move phases, or change the phase from the dropdown in each project card.
            </div>

            <div
                style={{
                    ...panel,
                    padding: 12,
                    height: '100%',
                    minHeight: 0,
                    overflow: 'auto',
                }}
            >
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(300px, 1fr))`, minWidth: Math.max(columns.length, 1) * 300, alignItems: 'start' }}>
                    {columns.map((column) => {
                        const accent = phaseAccent[column.value] || '#94a3b8';
                        const isDropTarget = dropKey === column.key && !!draggingProject;

                        return (
                            <div
                                key={column.key}
                                onDragOver={(e) => {
                                    if (!draggingProject) return;
                                    e.preventDefault();
                                    setDropKey(column.key);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (!draggingProject) return;
                                    updatePhase(draggingProject, column.value);
                                }}
                                onDragLeave={() => setDropKey((prev) => (prev === column.key ? '' : prev))}
                                style={{
                                    ...panel,
                                    display: 'grid',
                                    gridTemplateRows: 'auto 1fr auto',
                                    minHeight: 240,
                                    borderColor: isDropTarget ? `${accent}88` : 'var(--border-color)',
                                    boxShadow: isDropTarget ? `0 0 0 2px ${accent}33 inset` : 'none',
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

                                <div style={{ padding: 12, display: 'grid', gap: 10, alignContent: 'start' }}>
                                    {Array.isArray(column.projects) && column.projects.length > 0 ? column.projects.map((project) => (
                                        <div key={project.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
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
                                                        {project.is_new_today ? (
                                                            <span
                                                                style={{
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
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                New
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-word' }}>{project.client || 'No client'}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    draggable
                                                    onDragStart={(e) => {
                                                        setDraggingProject({ id: project.id, name: project.name, phase: project.phase });
                                                        e.dataTransfer.effectAllowed = 'move';
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggingProject(null);
                                                        setDropKey('');
                                                    }}
                                                    title="Drag to another phase"
                                                    style={{ border: '1px solid var(--border-color)', background: 'var(--button-bg)', color: 'var(--text-muted)', borderRadius: 8, padding: '6px 8px', fontSize: 11, cursor: 'grab' }}
                                                >
                                                    Drag
                                                </button>
                                            </div>

                                            <label style={{ display: 'grid', gap: 4 }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Phase</div>
                                                <select
                                                    value={project.phase}
                                                    onChange={(e) => updatePhase(project, e.target.value)}
                                                    disabled={updatingId === project.id}
                                                    style={{ ...input, padding: '7px 10px', fontSize: 12 }}
                                                >
                                                    {phaseOptions.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
                                                </select>
                                            </label>

                                            <div style={{ display: 'grid', gap: 5 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                                                    <span>Progress</span>
                                                    <span>{pct(project.overall_progress)}</span>
                                                </div>
                                                <div style={{ height: 7, background: 'rgba(148,163,184,0.2)', borderRadius: 999, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: pct(project.overall_progress), background: accent, borderRadius: 999 }} />
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <span style={statusPillStyle(project.status)}>{project.status || 'N/A'}</span>
                                                {project.target && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target: {project.target}</span>}
                                            </div>

                                            <div style={{ display: 'grid', gap: 4, fontSize: 11 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text-muted)' }}>Location</span><span style={{ textAlign: 'right' }}>{project.location || '-'}</span></div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text-muted)' }}>Assigned</span><span style={{ textAlign: 'right' }}>{project.assigned_role || '-'}</span></div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text-muted)' }}>Foremen</span><span style={{ textAlign: 'right' }}>{project.assigned || '-'}</span></div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text-muted)' }}>Contract</span><span>{money(project.contract_amount)}</span></div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text-muted)' }}>Paid</span><span style={{ color: '#4ade80' }}>{money(project.total_client_payment)}</span></div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                <Link href={`/projects/${project.id}`} style={{ ...actionPillStyle, color: 'var(--active-text)', border: '1px solid color-mix(in srgb, var(--active-text) 25%, var(--border-color))', background: 'color-mix(in srgb, var(--active-bg) 55%, transparent)' }}>View</Link>
                                                {canEdit && <Link href={`/projects/${project.id}/edit`} style={{ ...actionPillStyle, color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)', background: 'rgba(96,165,250,0.08)' }}>Edit</Link>}
                                                {canDelete && (
                                                    <button type="button" onClick={() => setProjectToDelete({ id: project.id, name: project.name })} style={{ ...actionPillStyle, border: '1px solid rgba(248,81,73,0.25)', background: 'rgba(248,81,73,0.12)', color: '#f87171', cursor: 'pointer' }}>
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{ border: '1px dashed var(--border-color)', borderRadius: 10, padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                            No projects in {column.label}.
                                        </div>
                                    )}
                                </div>

                                <div style={{ padding: 12, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                                    {column.has_more ? (
                                        <button
                                            type="button"
                                            onClick={() => reloadBoard({ [column.page_param]: Number(column.current_page || 1) + 1 })}
                                            style={{ width: '100%', background: 'var(--button-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                                        >
                                            Load more projects ({column.remaining} left)
                                        </button>
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
                <Modal open={Boolean(projectToDelete)} onClose={() => setProjectToDelete(null)} title="Delete Project" maxWidth={520}>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ fontSize: 13 }}>Delete project <strong>{projectToDelete?.name}</strong>?</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            This also removes related design/build trackers, expenses, files, and updates.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button type="button" onClick={() => setProjectToDelete(null)} style={{ background: 'var(--button-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                            <button type="button" onClick={deleteProject} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Delete Project</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
