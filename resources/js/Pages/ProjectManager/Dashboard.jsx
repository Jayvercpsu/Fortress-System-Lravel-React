import { useLayoutTitle } from '../../Components/Layout';
import ActionButton from '../../Components/ActionButton';
import { Head, Link } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const mono = { fontFamily: "'DM Mono', monospace" };

const toStatTestId = (label) =>
    String(label || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

function StatCard({ label, value, color = 'var(--text-main)', subtext }) {
    const statId = toStatTestId(label);

    return (
        <div data-testid={`pm-stat-card-${statId}`} style={cardStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                {label}
            </div>
            <div
                data-testid={`pm-stat-value-${statId}`}
                style={{ fontSize: 24, fontWeight: 700, color, ...mono }}
            >
                {value}
            </div>
            {subtext ? <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{subtext}</div> : null}
        </div>
    );
}

const phaseColor = {
    Design: '#60a5fa',
    Construction: '#fbbf24',
    Completed: '#4ade80',
};

const dateOnly = (value) => (value ? String(value).slice(0, 10) : '-');

export default function ProjectManagerDashboard({
    projects = [],
    stats = {},
    recentSubmissions = [],
    lowProgressProjects = [],
}) {
    useLayoutTitle('Project Manager Dashboard');

    return (
        <>
            <Head title="Project Manager Dashboard" />

            <div style={{ display: 'grid', gap: 16 }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Total Projects" value={stats.total_projects ?? 0} color="#60a5fa" />
                    <StatCard label="Construction Projects" value={stats.construction_projects ?? 0} color="#fbbf24" />
                    <StatCard label="Total Foremen" value={stats.total_foremen ?? 0} color="#4ade80" />
                    <StatCard
                        label="Accomplishment Rows"
                        value={stats.pending_accomplishments ?? 0}
                        color="#f87171"
                        subtext={`${stats.total_attendance_records ?? 0} attendance records · ${stats.total_attendance_hours ?? 0}h logged`}
                    />
                </div>

                {recentSubmissions.length > 0 && (
                    <div style={cardStyle}>
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                marginBottom: 10,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <span>Recent Foreman Submissions — counter-check</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>Last 10</span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '8px 10px' }}>Week</th>
                                        <th style={{ padding: '8px 10px' }}>Project</th>
                                        <th style={{ padding: '8px 10px' }}>Foreman</th>
                                        <th style={{ padding: '8px 10px' }}>Scope of Work</th>
                                        <th style={{ padding: '8px 10px' }}>% Done</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentSubmissions.map((row) => (
                                        <tr key={row.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '8px 10px', ...mono }}>{dateOnly(row.week_start)}</td>
                                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                                                <Link
                                                    href={`/project-manager/projects/${row.project_id}`}
                                                    style={{ color: 'var(--text-main)', textDecoration: 'none' }}
                                                >
                                                    {row.project_name || '—'}
                                                </Link>
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>{row.foreman_name || '—'}</td>
                                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{row.scope_of_work}</td>
                                            <td style={{ padding: '8px 10px', ...mono, fontWeight: 700 }}>
                                                {Number(row.percent_completed || 0).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {lowProgressProjects.length > 0 && (
                    <div style={{ ...cardStyle, borderLeft: '3px solid #f87171' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#f87171' }}>
                            Low Progress Projects — review needed
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                            These projects report progress below 30%. Counter-check if foreman submissions match actual site status.
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '8px 10px' }}>Project</th>
                                        <th style={{ padding: '8px 10px' }}>Client</th>
                                        <th style={{ padding: '8px 10px' }}>Phase</th>
                                        <th style={{ padding: '8px 10px' }}>Progress</th>
                                        <th style={{ padding: '8px 10px' }}>Assigned To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lowProgressProjects.map((project) => (
                                        <tr key={project.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                                                <ActionButton
                                                    href={`/project-manager/projects/${project.id}`}
                                                    style={{ padding: '3px 10px', fontSize: 12 }}
                                                >
                                                    {project.name}
                                                </ActionButton>
                                            </td>
                                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{project.client}</td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        padding: '3px 10px',
                                                        borderRadius: 20,
                                                        background: `${phaseColor[project.phase] || 'var(--text-muted)'}22`,
                                                        color: phaseColor[project.phase] || 'var(--text-muted)',
                                                        border: `1px solid ${(phaseColor[project.phase] || 'var(--text-muted)')}44`,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {String(project.phase || '—').toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 10px', ...mono, fontWeight: 700, color: '#f87171' }}>
                                                {project.overall_progress}%
                                            </td>
                                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{project.assigned || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div style={cardStyle}>
                    <div
                        style={{
                            fontSize: 13,
                            color: 'var(--text-muted)',
                            marginBottom: 10,
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                        }}
                    >
                        <span>Foreman Jotform Submissions — counter-check per project</span>
                        <span style={{ fontStyle: 'italic' }}>View only</span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '8px 10px' }}>Project</th>
                                    <th style={{ padding: '8px 10px' }}>Client</th>
                                    <th style={{ padding: '8px 10px' }}>Phase</th>
                                    <th style={{ padding: '8px 10px' }}>Status</th>
                                    <th style={{ padding: '8px 10px' }}>Progress</th>
                                    <th style={{ padding: '8px 10px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '16px 10px', color: 'var(--text-muted)' }}>
                                            No projects yet.
                                        </td>
                                    </tr>
                                ) : (
                                    projects.map((project) => (
                                        <tr key={project.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{project.name}</td>
                                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{project.client}</td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        padding: '3px 10px',
                                                        borderRadius: 20,
                                                        background: `${phaseColor[project.phase] || 'var(--text-muted)'}22`,
                                                        color: phaseColor[project.phase] || 'var(--text-muted)',
                                                        border: `1px solid ${(phaseColor[project.phase] || 'var(--text-muted)')}44`,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {String(project.phase || '—').toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{project.status}</td>
                                            <td style={{ padding: '8px 10px', ...mono }}>
                                                {project.overall_progress}%
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <ActionButton
                                                    href={`/project-manager/projects/${project.id}`}
                                                    style={{ padding: '5px 12px' }}
                                                >
                                                    Review
                                                </ActionButton>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
