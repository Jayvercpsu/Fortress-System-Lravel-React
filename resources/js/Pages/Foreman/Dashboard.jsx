import Layout from '../../Components/Layout';
import InlinePagination from '../../Components/InlinePagination';
import SearchableDropdown from '../../Components/SearchableDropdown';
import ActionButton from '../../Components/ActionButton';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
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
    projects = [],
    assignedProjects = [],
    foremanAttendanceToday = null,
    progressPhotos = [],
}) {
    const { flash } = usePage().props;
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
                </div>
            </Layout>
        </>
    );
}
