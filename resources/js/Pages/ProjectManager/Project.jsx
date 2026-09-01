import { useLayoutTitle } from '../../Components/Layout';
import DataTable from '../../Components/DataTable';
import ActionButton from '../../Components/ActionButton';
import { Head, router } from '@inertiajs/react';
import { useMemo } from 'react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const mono = { fontFamily: "'DM Mono', monospace" };

const dateOnly = (value) => (value ? String(value).slice(0, 10) : '-');

const dateTime = (value) => value ? new Date(value).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
}) : '-';

export default function ProjectManagerProject({
    project = {},
    accomplishments = [],
    attendanceSummary = [],
    projectStats = {},
    accomplishmentsTable = {},
    attendanceSummaryTable = {},
}) {
    useLayoutTitle(`Project - ${project.name}`);

    const accTable = useMemo(
        () => ({
            perPage: Number(accomplishmentsTable?.per_page ?? 50),
            page: Number(accomplishmentsTable?.current_page ?? 1),
            lastPage: Number(accomplishmentsTable?.last_page ?? 1),
            total: Number(accomplishmentsTable?.total ?? accomplishments.length ?? 0),
            from: accomplishmentsTable?.from ?? null,
            to: accomplishmentsTable?.to ?? null,
        }),
        [accomplishmentsTable, accomplishments.length]
    );

    const attTable = useMemo(
        () => ({
            perPage: Number(attendanceSummaryTable?.per_page ?? 50),
            page: Number(attendanceSummaryTable?.current_page ?? 1),
            lastPage: Number(attendanceSummaryTable?.last_page ?? 1),
            total: Number(attendanceSummaryTable?.total ?? attendanceSummary.length ?? 0),
            from: attendanceSummaryTable?.from ?? null,
            to: attendanceSummaryTable?.to ?? null,
        }),
        [attendanceSummaryTable, attendanceSummary.length]
    );

    const navigateAccTable = (overrides = {}) => {
        const params = { acc_page: overrides.page ?? accTable.page };
        // Preserve current att_page so navigating one table doesn't reset the other.
        if (attTable.page > 1) params.att_page = attTable.page;
        router.get(`/project-manager/projects/${project.id}`, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const navigateAttTable = (overrides = {}) => {
        const params = { att_page: overrides.page ?? attTable.page };
        // Preserve current acc_page so navigating one table doesn't reset the other.
        if (accTable.page > 1) params.acc_page = accTable.page;
        router.get(`/project-manager/projects/${project.id}`, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const accColumns = [
        {
            key: 'week_start',
            label: 'Week Start',
            render: (row) => <span style={{ ...mono }}>{dateOnly(row.week_start)}</span>,
        },
        {
            key: 'foreman_name',
            label: 'Foreman',
            render: (row) => row.foreman_name || '—',
        },
        {
            key: 'scope_of_work',
            label: 'Scope of Work',
            render: (row) => row.scope_of_work,
        },
        {
            key: 'percent_completed',
            label: 'Percent Completed',
            render: (row) => <span style={{ ...mono, fontWeight: 700 }}>{Number(row.percent_completed || 0).toFixed(2)}%</span>,
        },
        {
            key: 'submitted_at',
            label: 'Submitted',
            render: (row) => <span style={{ ...mono, fontSize: 11, color: 'var(--text-muted)' }}>{dateTime(row.submitted_at)}</span>,
        },
    ];

    const attColumns = [
        {
            key: 'worker_name',
            label: 'Worker',
            render: (row) => <span style={{ fontWeight: 600 }}>{row.worker_name}</span>,
        },
        {
            key: 'worker_role',
            label: 'Role',
            render: (row) => row.worker_role,
        },
        {
            key: 'days_logged',
            label: 'Days Logged',
            render: (row) => <span style={{ ...mono }}>{row.days_logged}</span>,
        },
        {
            key: 'total_hours',
            label: 'Total Hours',
            render: (row) => <span style={{ ...mono }}>{row.total_hours.toFixed(1)}</span>,
        },
        {
            key: 'latest_submit',
            label: 'Latest Submit',
            render: (row) => <span style={{ ...mono, fontSize: 11, color: 'var(--text-muted)' }}>{dateTime(row.latest_submit)}</span>,
        },
    ];

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
                <DataTable
                    columns={accColumns}
                    rows={accomplishments}
                    rowKey="id"
                    emptyMessage="No accomplishments submitted for this project yet."
                    serverSide
                    serverPage={accTable.page}
                    serverPerPage={accTable.perPage}
                    serverTotalItems={accTable.total}
                    serverTotalPages={accTable.lastPage}
                    serverFrom={accTable.from}
                    serverTo={accTable.to}
                    onServerPageChange={(value) => navigateAccTable({ page: value })}
                    hideSearch
                    hidePerPage
                />
            </div>

            <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                    Attendance Summary (View Only)
                </div>
                <DataTable
                    columns={attColumns}
                    rows={attendanceSummary}
                    rowKey={(row) => `${row.worker_name}-${row.worker_role}`}
                    emptyMessage="No attendance records for this project yet."
                    serverSide
                    serverPage={attTable.page}
                    serverPerPage={attTable.perPage}
                    serverTotalItems={attTable.total}
                    serverTotalPages={attTable.lastPage}
                    serverFrom={attTable.from}
                    serverTo={attTable.to}
                    onServerPageChange={(value) => navigateAttTable({ page: value })}
                    hideSearch
                    hidePerPage
                />
            </div>
        </>
    );
}
