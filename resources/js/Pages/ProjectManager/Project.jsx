import { useLayoutTitle } from '../../Components/Layout';
import ActionButton from '../../Components/ActionButton';
import { Head } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const mono = { fontFamily: "'DM Mono', monospace" };

const dateOnly = (value) => (value ? String(value).slice(0, 10) : '-');

export default function ProjectManagerProject({
    project = {},
    accomplishments = [],
    attendanceSummary = [],
    projectStats = {},
}) {
    useLayoutTitle(`Project - ${project.name}`);

    return (
        <>
            <Head title={`Project - ${project.name}`} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10 }}>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{project.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {project.client} · {project.location || '—'} · {String(project.phase || '—').toUpperCase()}
                        {project.assigned ? ` · Assigned: ${project.assigned}` : ''}
                    </div>
                </div>
                <ActionButton href="/project-manager" variant="neutral" style={{ padding: '8px 14px' }}>
                    Back to Dashboard
                </ActionButton>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 16 }}>
                <div style={cardStyle}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                        Project Progress
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#60a5fa', ...mono }}>
                        {project.overall_progress ?? 0}%
                    </div>
                </div>
                <div style={cardStyle}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                        Accomplishment Rows
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#fbbf24', ...mono }}>
                        {projectStats.total_accomplishments ?? 0}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                        {projectStats.unique_foremen ?? 0} foreman(s) submitted
                    </div>
                </div>
                <div style={cardStyle}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                        Attendance Hours
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80', ...mono }}>
                        {projectStats.total_attendance_hours ?? 0}h
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                        {projectStats.total_attendance_days ?? 0} day(s) logged
                    </div>
                </div>
                <div style={cardStyle}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                        Target Date
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)', ...mono }}>
                        {dateOnly(project.target)}
                    </div>
                </div>
            </div>

            <div style={{ ...cardStyle, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                    Foreman Accomplishments (Jotform Submissions) — counter-check
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '8px 10px' }}>Week Start</th>
                                <th style={{ padding: '8px 10px' }}>Foreman</th>
                                <th style={{ padding: '8px 10px' }}>Scope of Work</th>
                                <th style={{ padding: '8px 10px' }}>Percent Completed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accomplishments.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '16px 10px', color: 'var(--text-muted)' }}>
                                        No accomplishments submitted for this project yet.
                                    </td>
                                </tr>
                            ) : (
                                accomplishments.map((row) => (
                                    <tr key={row.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '8px 10px', ...mono }}>{dateOnly(row.week_start)}</td>
                                        <td style={{ padding: '8px 10px' }}>{row.foreman_name || '—'}</td>
                                        <td style={{ padding: '8px 10px' }}>{row.scope_of_work}</td>
                                        <td style={{ padding: '8px 10px', ...mono, fontWeight: 700 }}>
                                            {Number(row.percent_completed || 0).toFixed(2)}%
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                    Attendance Summary (View Only)
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '8px 10px' }}>Worker</th>
                                <th style={{ padding: '8px 10px' }}>Role</th>
                                <th style={{ padding: '8px 10px' }}>Days Logged</th>
                                <th style={{ padding: '8px 10px' }}>Total Hours</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendanceSummary.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '16px 10px', color: 'var(--text-muted)' }}>
                                        No attendance records for this project yet.
                                    </td>
                                </tr>
                            ) : (
                                attendanceSummary.map((row, index) => (
                                    <tr key={`${row.worker_name}-${row.worker_role}-${index}`} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.worker_name}</td>
                                        <td style={{ padding: '8px 10px' }}>{row.worker_role}</td>
                                        <td style={{ padding: '8px 10px', ...mono }}>{row.days_logged}</td>
                                        <td style={{ padding: '8px 10px', ...mono }}>{row.total_hours.toFixed(1)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
