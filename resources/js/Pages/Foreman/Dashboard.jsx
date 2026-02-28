import Layout from '../../Components/Layout';
import InlinePagination from '../../Components/InlinePagination';
import SearchableDropdown from '../../Components/SearchableDropdown';
import DatePickerInput from '../../Components/DatePickerInput';
import ActionButton from '../../Components/ActionButton';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text-main)',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
};

const mono = { fontFamily: "'DM Mono', monospace" };
const PH_TIMEZONE = 'Asia/Manila';

function getPhNowParts(nowValue = Date.now()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: PH_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(new Date(nowValue));

    const read = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);

    return {
        hour: read('hour'),
        minute: read('minute'),
    };
}

function timeLabel12(time) {
    if (!time) return '-';
    const raw = String(time).slice(0, 5);
    const [hour, minute] = raw.split(':').map(Number);
    if ([hour, minute].some((n) => Number.isNaN(n))) return raw;
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

function StatCard({ label, value, color = 'var(--text-main)', subtext }) {
    return (
        <div style={cardStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                {label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color, ...mono }}>{value}</div>
            {subtext ? <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{subtext}</div> : null}
        </div>
    );
}

export default function ForemanDashboard({
    user,
    attendances = [],
    accomplishments = [],
    materialRequests = [],
    issueReports = [],
    deliveries = [],
    assignedProjectsPager = null,
    materialRequestsPager = null,
    issueReportsPager = null,
    deliveriesPager = null,
    weeklyAccomplishmentsByProjectPager = null,
    projects = [],
    assignedProjects = [],
    foremanAttendanceToday = null,
    progressPhotos = [],
    weeklyAccomplishmentsByProjectFilters = null,
}) {
    const page = usePage();
    const { flash } = page.props;
    const [foremanProjectId, setForemanProjectId] = useState(
        foremanAttendanceToday?.project_id ? String(foremanAttendanceToday.project_id) : ''
    );
    const [clockTick, setClockTick] = useState(Date.now());

    const projectOptions = useMemo(
        () => (Array.isArray(projects) ? projects.map((project) => ({ id: project.id, name: project.name })) : []),
        [projects]
    );
    const assignedProjectRows = assignedProjectsPager?.data || assignedProjects;
    const materialRequestRows = materialRequestsPager?.data || materialRequests.slice(0, 5);
    const issueReportRows = issueReportsPager?.data || issueReports.slice(0, 5);
    const deliveryRows = deliveriesPager?.data || deliveries.slice(0, 5);
    const weeklyAccomplishmentProjectRows = weeklyAccomplishmentsByProjectPager?.data || [];
    const [expandedWeeklyProjectKey, setExpandedWeeklyProjectKey] = useState('');
    const weeklyProjectRowKey = (row, index) => `${row?.project_id ?? 'unassigned'}-${index}`;
    const [weeklyProjectId, setWeeklyProjectId] = useState(
        String(weeklyAccomplishmentsByProjectFilters?.project_id || '')
    );
    const [weeklyProjectWeek, setWeeklyProjectWeek] = useState(
        String(weeklyAccomplishmentsByProjectFilters?.latest_week_start || '')
    );

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        setForemanProjectId(foremanAttendanceToday?.project_id ? String(foremanAttendanceToday.project_id) : '');
    }, [foremanAttendanceToday?.project_id]);

    useEffect(() => {
        if (!foremanAttendanceToday?.time_in || foremanAttendanceToday?.time_out) return;
        const timer = window.setInterval(() => setClockTick(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [foremanAttendanceToday?.time_in, foremanAttendanceToday?.time_out]);

    useEffect(() => {
        setWeeklyProjectId(String(weeklyAccomplishmentsByProjectFilters?.project_id || ''));
        setWeeklyProjectWeek(String(weeklyAccomplishmentsByProjectFilters?.latest_week_start || ''));
    }, [weeklyAccomplishmentsByProjectFilters?.project_id, weeklyAccomplishmentsByProjectFilters?.latest_week_start]);

    useEffect(() => {
        setExpandedWeeklyProjectKey((currentKey) => {
            if (!currentKey) return currentKey;
            const stillExists = weeklyAccomplishmentProjectRows.some((row, index) => weeklyProjectRowKey(row, index) === currentKey);
            return stillExists ? currentKey : '';
        });
    }, [weeklyAccomplishmentProjectRows]);

    const applyWeeklyProjectFilters = () => {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        params.delete('foreman_weekly_project_search');

        if (weeklyProjectId) params.set('foreman_weekly_project_id', weeklyProjectId);
        else params.delete('foreman_weekly_project_id');

        if (weeklyProjectWeek) params.set('foreman_weekly_project_week', weeklyProjectWeek);
        else params.delete('foreman_weekly_project_week');

        params.delete('foreman_dashboard_weekly_projects_page');

        router.get('/foreman', Object.fromEntries(params.entries()), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetWeeklyProjectFilters = () => {
        setWeeklyProjectId('');
        setWeeklyProjectWeek('');

        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        params.delete('foreman_weekly_project_search');
        params.delete('foreman_weekly_project_id');
        params.delete('foreman_weekly_project_week');
        params.delete('foreman_dashboard_weekly_projects_page');

        router.get('/foreman', Object.fromEntries(params.entries()), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const foremanLiveHours = useMemo(() => {
        const timeIn = foremanAttendanceToday?.time_in;
        if (!timeIn) {
            return { decimal: Number(foremanAttendanceToday?.hours ?? 0), label: '-', isLive: false };
        }

        const [inHour, inMinute] = String(timeIn).slice(0, 5).split(':').map(Number);
        if ([inHour, inMinute].some((n) => Number.isNaN(n))) {
            return { decimal: Number(foremanAttendanceToday?.hours ?? 0), label: '-', isLive: false };
        }

        const startTotalMinutes = inHour * 60 + inMinute;
        let endTotalMinutes = (() => {
            const phNow = getPhNowParts(clockTick);
            return phNow.hour * 60 + phNow.minute;
        })();

        if (foremanAttendanceToday?.time_out) {
            const [outHour, outMinute] = String(foremanAttendanceToday.time_out).slice(0, 5).split(':').map(Number);
            if (![outHour, outMinute].some((n) => Number.isNaN(n))) {
                endTotalMinutes = outHour * 60 + outMinute;
            }
        }

        const totalMinutes = Math.max(0, endTotalMinutes - startTotalMinutes);
        const decimal = Math.round((totalMinutes / 60) * 10) / 10;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        return {
            decimal,
            label: hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`,
            isLive: !foremanAttendanceToday?.time_out,
        };
    }, [foremanAttendanceToday?.time_in, foremanAttendanceToday?.time_out, foremanAttendanceToday?.hours, clockTick]);

    const submitForemanTimeIn = () => {
        if (!foremanProjectId) {
            toast.error('Select a project before time in.');
            return;
        }
        router.post('/foreman/attendance/time-in', { project_id: foremanProjectId }, { preserveScroll: true });
    };

    const submitForemanTimeOut = () => {
        router.post('/foreman/attendance/time-out', {}, { preserveScroll: true });
    };

    const pendingMaterials = materialRequests.filter((item) => String(item.status).toLowerCase() === 'pending').length;
    const openIssues = issueReports.filter((item) => String(item.status).toLowerCase() === 'open').length;

    return (
        <>
            <Head title="Foreman Dashboard" />
            <Layout title={`Foreman - ${user?.fullname || 'Dashboard'}`}>
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                        <StatCard label="Assigned Projects" value={assignedProjects.length} color="#60a5fa" />
                        <StatCard
                            label="My Attendance"
                            value={foremanAttendanceToday ? (foremanAttendanceToday.time_out ? 'Timed Out' : 'Timed In') : 'Not Started'}
                            color={foremanAttendanceToday ? (foremanAttendanceToday.time_out ? '#4ade80' : '#fbbf24') : '#f87171'}
                            subtext={foremanAttendanceToday ? `Hours: ${Number(foremanLiveHours.decimal || 0).toFixed(1)}` : 'Record your time-in'}
                        />
                        <StatCard label="Pending Materials (recent)" value={pendingMaterials} color="#fbbf24" />
                        <StatCard label="Open Issues (recent)" value={openIssues} color="#f87171" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
                        <div style={cardStyle}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>Foreman Attendance</div>
                            <div
                                style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 10,
                                    padding: 12,
                                    background: 'var(--surface-2)',
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(160px, 1fr) minmax(220px, 1.4fr) repeat(3, minmax(90px, auto)) auto auto',
                                    gap: 8,
                                    alignItems: 'center',
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Foreman</div>
                                    <div style={{ fontWeight: 700 }}>{user?.fullname || '-'}</div>
                                </div>

                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Project</div>
                                    {foremanAttendanceToday ? (
                                        <div style={{ fontWeight: 600 }}>{foremanAttendanceToday.project_name || '-'}</div>
                                    ) : (
                                        <SearchableDropdown
                                            options={projectOptions}
                                            value={foremanProjectId}
                                            onChange={(value) => setForemanProjectId(value || '')}
                                            getOptionLabel={(option) => option.name}
                                            getOptionValue={(option) => option.id}
                                            placeholder="Select project"
                                            searchPlaceholder="Search projects..."
                                            emptyMessage="No projects found"
                                            style={{ ...inputStyle, minHeight: 36, padding: '6px 8px' }}
                                            dropdownWidth={320}
                                        />
                                    )}
                                </div>

                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time In</div>
                                    <div style={mono}>{timeLabel12(foremanAttendanceToday?.time_in)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time Out</div>
                                    <div style={mono}>{timeLabel12(foremanAttendanceToday?.time_out)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hours</div>
                                    <div style={{ ...mono, fontWeight: 700 }}>{Number(foremanLiveHours.decimal || 0).toFixed(1)}</div>
                                    <div style={{ fontSize: 11, color: foremanLiveHours.isLive ? '#4ade80' : 'var(--text-muted)' }}>
                                        {foremanLiveHours.label}{foremanLiveHours.isLive ? ' (live)' : ''}
                                    </div>
                                </div>

                                <ActionButton
                                    type="button"
                                    variant="neutral"
                                    onClick={submitForemanTimeIn}
                                    disabled={!!foremanAttendanceToday || !foremanProjectId}
                                    style={{ padding: '8px 12px', fontSize: 13 }}
                                >
                                    Time In
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    variant="success"
                                    onClick={submitForemanTimeOut}
                                    disabled={!foremanAttendanceToday || !!foremanAttendanceToday?.time_out}
                                    style={{ padding: '8px 12px', fontSize: 13 }}
                                >
                                    Time Out
                                </ActionButton>
                            </div>
                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                                Worker attendance is handled in the Attendance page. Dashboard only tracks your self attendance.
                            </div>
                        </div>

                        <div style={{ ...cardStyle, display: 'grid', gap: 10, alignContent: 'start' }}>
                            <div style={{ fontWeight: 700 }}>Quick Actions</div>
                            <Link
                                href="/foreman/submissions"
                                style={{
                                    textDecoration: 'none',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    background: 'var(--surface-2)',
                                    color: 'var(--text-main)',
                                }}
                            >
                                <div style={{ fontWeight: 700 }}>Open Submissions</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Weekly accomplishment, materials, issues, delivery, proof photos
                                </div>
                            </Link>
                            <Link
                                href="/foreman/attendance"
                                style={{
                                    textDecoration: 'none',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    background: 'var(--surface-2)',
                                    color: 'var(--text-main)',
                                }}
                            >
                                <div style={{ fontWeight: 700 }}>Open Worker Attendance</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Record workers&apos; time in/out for payroll computation
                                </div>
                            </Link>
                            <Link
                                href="/foreman/workers"
                                style={{
                                    textDecoration: 'none',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    background: 'var(--surface-2)',
                                    color: 'var(--text-main)',
                                }}
                            >
                                <div style={{ fontWeight: 700 }}>Manage Workers</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Add/update your worker list used in attendance
                                </div>
                            </Link>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12 }}>
                        <div style={cardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ fontWeight: 700 }}>Assigned Projects</div>
                                <Link href="/foreman/submissions" style={{ fontSize: 12, color: 'var(--active-text)', textDecoration: 'none' }}>
                                    Go to Submissions
                                </Link>
                            </div>

                            {assignedProjects.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    No project assignments yet. Ask admin/head admin to assign you to a project.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {assignedProjectRows.map((project) => (
                                        <div
                                            key={project.id}
                                            style={{
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 10,
                                                padding: 12,
                                                background: 'var(--surface-2)',
                                                display: 'grid',
                                                gridTemplateColumns: '1.5fr auto auto auto',
                                                gap: 8,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{project.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                    {project.client || 'No client'} • {project.phase || '-'} • {project.status || '-'}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 12, ...mono }}>{project.overall_progress}%</div>
                                            <Link
                                                href={`/foreman/attendance`}
                                                style={{
                                                    textDecoration: 'none',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 8,
                                                    padding: '6px 10px',
                                                    background: 'var(--button-bg)',
                                                    color: 'var(--text-main)',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Attendance
                                            </Link>
                                            <a
                                                href={project.public_submit_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    textDecoration: 'none',
                                                    background: 'var(--success)',
                                                    color: '#fff',
                                                    borderRadius: 8,
                                                    padding: '6px 10px',
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    textAlign: 'center',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                Open Jotform
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <InlinePagination pager={assignedProjectsPager} />
                        </div>

                        <div style={{ ...cardStyle, overflow: 'hidden' }}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Activity Snapshot</div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {[
                                    ['Attendance rows', attendances.length],
                                    ['Weekly accomplishments', accomplishments.length],
                                    ['Material requests', materialRequests.length],
                                    ['Issue reports', issueReports.length],
                                    ['Deliveries', deliveries.length],
                                    ['Proof photos', progressPhotos.length],
                                ].map(([label, count]) => (
                                    <div
                                        key={label}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 8,
                                            padding: '8px 10px',
                                            background: 'var(--surface-2)',
                                        }}
                                    >
                                        <span style={{ fontSize: 13 }}>{label}</span>
                                        <strong style={mono}>{count}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <div style={cardStyle}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Materials</div>
                            {materialRequestRows.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No material requests yet.</div>
                            ) : (
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {materialRequestRows.map((item) => (
                                        <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, background: 'var(--surface-2)' }}>
                                            {item.photo_path ? (
                                                <a href={`/storage/${item.photo_path}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 6 }}>
                                                    <img
                                                        src={`/storage/${item.photo_path}`}
                                                        alt={item.material_name || 'Material photo'}
                                                        style={{ width: 88, height: 62, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                                                    />
                                                </a>
                                            ) : null}
                                            <div style={{ fontWeight: 700 }}>{item.material_name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {item.quantity} {item.unit}
                                            </div>
                                            <div style={{ fontSize: 12, textTransform: 'capitalize', marginTop: 2 }}>{item.status || 'pending'}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <InlinePagination pager={materialRequestsPager} />
                        </div>

                        <div style={cardStyle}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Issues</div>
                            {issueReportRows.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No issue reports yet.</div>
                            ) : (
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {issueReportRows.map((item) => (
                                        <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, background: 'var(--surface-2)' }}>
                                            {item.photo_path ? (
                                                <a href={`/storage/${item.photo_path}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 6 }}>
                                                    <img
                                                        src={`/storage/${item.photo_path}`}
                                                        alt={item.issue_title || 'Issue photo'}
                                                        style={{ width: 88, height: 62, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                                                    />
                                                </a>
                                            ) : null}
                                            <div style={{ fontWeight: 700 }}>{item.issue_title}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {item.severity || '-'} • {item.status || 'open'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <InlinePagination pager={issueReportsPager} />
                        </div>

                        <div style={cardStyle}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Deliveries</div>
                            {deliveryRows.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No delivery confirmations yet.</div>
                            ) : (
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {deliveryRows.map((item) => (
                                        <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, background: 'var(--surface-2)' }}>
                                            {item.photo_path ? (
                                                <a href={`/storage/${item.photo_path}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 6 }}>
                                                    <img
                                                        src={`/storage/${item.photo_path}`}
                                                        alt={item.item_delivered || 'Delivery photo'}
                                                        style={{ width: 88, height: 62, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                                                    />
                                                </a>
                                            ) : null}
                                            <div style={{ fontWeight: 700 }}>{item.item_delivered}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                Project: {item.project_name || 'Unassigned'} (ID: {item.project_id ?? '-'})
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {item.quantity || '-'} • {item.delivery_date || '-'}
                                            </div>
                                            <div style={{ fontSize: 12, textTransform: 'capitalize', marginTop: 2 }}>{item.status || '-'}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <InlinePagination pager={deliveriesPager} />
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700 }}>Weekly Progress Accomplishments by Project</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Grouped project summary of your weekly progress submissions
                            </div>
                        </div>
                        <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 280px) minmax(180px, 240px)', gap: 8 }}>
                                <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                                    Project
                                    <SearchableDropdown
                                        options={projectOptions}
                                        value={weeklyProjectId}
                                        onChange={(value) => setWeeklyProjectId(value || '')}
                                        getOptionLabel={(option) => option.name}
                                        getOptionValue={(option) => option.id}
                                        placeholder="All assigned projects"
                                        searchPlaceholder="Search assigned projects..."
                                        emptyMessage="No assigned projects"
                                        style={{ ...inputStyle, minHeight: 32, padding: '4px 8px', fontSize: 12 }}
                                        dropdownWidth={280}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                                    Latest Week
                                    <DatePickerInput
                                        value={weeklyProjectWeek}
                                        onChange={(value) => setWeeklyProjectWeek(value || '')}
                                        style={inputStyle}
                                    />
                                </label>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={applyWeeklyProjectFilters}
                                    style={{
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        padding: '7px 12px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        background: 'var(--button-bg)',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Apply Filter
                                </button>
                                <button
                                    type="button"
                                    onClick={resetWeeklyProjectFilters}
                                    style={{
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        padding: '7px 12px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        background: 'transparent',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        {weeklyAccomplishmentProjectRows.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                No weekly accomplishment submissions yet.
                            </div>
                        ) : (
                            <div style={{ width: '100%', overflowX: 'auto' }}>
                                <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: '1px solid var(--border-color)', background: 'var(--surface-2)', padding: '8px 10px', textAlign: 'left', fontSize: 12 }}>Project</th>
                                            <th style={{ border: '1px solid var(--border-color)', background: 'var(--surface-2)', padding: '8px 10px', textAlign: 'right', fontSize: 12 }}>Weeks Submitted</th>
                                            <th style={{ border: '1px solid var(--border-color)', background: 'var(--surface-2)', padding: '8px 10px', textAlign: 'right', fontSize: 12 }}>Scope Entries</th>
                                            <th style={{ border: '1px solid var(--border-color)', background: 'var(--surface-2)', padding: '8px 10px', textAlign: 'right', fontSize: 12 }}>Avg % Complete</th>
                                            <th style={{ border: '1px solid var(--border-color)', background: 'var(--surface-2)', padding: '8px 10px', textAlign: 'center', fontSize: 12 }}>Latest Week</th>
                                            <th style={{ border: '1px solid var(--border-color)', background: 'var(--surface-2)', padding: '8px 10px', textAlign: 'center', fontSize: 12 }}>Last Submitted (PH)</th>
                                            <th style={{ border: '1px solid var(--border-color)', background: 'var(--surface-2)', padding: '8px 10px', textAlign: 'center', fontSize: 12 }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weeklyAccomplishmentProjectRows.map((row, index) => {
                                            const rowKey = weeklyProjectRowKey(row, index);
                                            const isExpanded = expandedWeeklyProjectKey === rowKey;
                                            const latestScopeEntries = Array.isArray(row.latest_scope_entries) ? row.latest_scope_entries : [];

                                            return (
                                                <Fragment key={rowKey}>
                                                    <tr>
                                                        <td style={{ border: '1px solid var(--border-color)', padding: '8px 10px', fontSize: 13 }}>
                                                            <div style={{ fontWeight: 700 }}>{row.project_name || 'Unassigned'}</div>
                                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {row.project_id ?? '-'}</div>
                                                        </td>
                                                        <td style={{ border: '1px solid var(--border-color)', padding: '8px 10px', fontSize: 13, textAlign: 'right', ...mono }}>{row.submitted_weeks ?? 0}</td>
                                                        <td style={{ border: '1px solid var(--border-color)', padding: '8px 10px', fontSize: 13, textAlign: 'right', ...mono }}>{row.scope_entries ?? 0}</td>
                                                        <td style={{ border: '1px solid var(--border-color)', padding: '8px 10px', fontSize: 13, textAlign: 'right', ...mono }}>
                                                            {Number(row.avg_percent_completed ?? 0).toFixed(1)}%
                                                        </td>
                                                        <td style={{ border: '1px solid var(--border-color)', padding: '8px 10px', fontSize: 13, textAlign: 'center', ...mono }}>{row.latest_week_start || '-'}</td>
                                                        <td style={{ border: '1px solid var(--border-color)', padding: '8px 10px', fontSize: 12, textAlign: 'center' }}>{row.last_submitted_at || '-'}</td>
                                                        <td style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center' }}>
                                                            <button
                                                                type="button"
                                                                style={{
                                                                    border: '1px solid var(--border-color)',
                                                                    borderRadius: 8,
                                                                    padding: '6px 10px',
                                                                    fontSize: 12,
                                                                    fontWeight: 700,
                                                                    background: 'var(--button-bg)',
                                                                    color: 'var(--text-main)',
                                                                    cursor: 'pointer',
                                                                }}
                                                                onClick={() => setExpandedWeeklyProjectKey((prev) => prev === rowKey ? '' : rowKey)}
                                                            >
                                                                {isExpanded ? 'Hide details' : 'View details'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded ? (
                                                        <tr>
                                                            <td colSpan={7} style={{ border: '1px solid var(--border-color)', padding: 10, background: 'var(--surface-2)' }}>
                                                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                                                                    Latest Week Scope Entries {row.latest_week_start ? `(${row.latest_week_start})` : ''}
                                                                </div>
                                                                {latestScopeEntries.length === 0 ? (
                                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                                        No scope entries found for the latest week.
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}>
                                                                        {latestScopeEntries.map((entry, entryIndex) => (
                                                                            <Fragment key={`${rowKey}-entry-${entryIndex}`}>
                                                                                <div style={{ fontSize: 12 }}>{entry.scope_of_work || '-'}</div>
                                                                                <div style={{ fontSize: 12, textAlign: 'right', ...mono }}>
                                                                                    {Number(entry.percent_completed ?? 0).toFixed(1)}%
                                                                                </div>
                                                                                <div style={{ fontSize: 11, textAlign: 'right', color: 'var(--text-muted)' }}>
                                                                                    Photos: {Number(entry.scope_photo_count ?? 0)}
                                                                                </div>
                                                                            </Fragment>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <InlinePagination pager={weeklyAccomplishmentsByProjectPager} />
                    </div>
                </div>
            </Layout>
        </>
    );
}
