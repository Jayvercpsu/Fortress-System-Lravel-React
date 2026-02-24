import Layout from '../../Components/Layout';
import DatePickerInput from '../../Components/DatePickerInput';
import SearchableDropdown from '../../Components/SearchableDropdown';
import ActionButton from '../../Components/ActionButton';
import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const SCOPES = [
    'Mobilization and Hauling',
    'Foundation Preparation',
    'Column Footing',
    'Column',
    'Wall Footing/Tie Beam',
    'Second Floor Beam, Slab, Stairs',
    'Slab on Fill',
    'CHB Laying with Plastering',
    'Garage Flooring',
    'Roofbeam',
    'Roofing and Tinsmithry',
];

const mono = { fontFamily: "'DM Mono', monospace" };

const sectionStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
};

const headerStyle = {
    background: 'var(--surface-2)',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
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

const btnStyle = {
    background: 'var(--success)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
};

const PH_TIMEZONE = 'Asia/Manila';

function getPhNowParts(nowValue = Date.now()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: PH_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
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

export default function ForemanDashboard({
    user,
    accomplishments,
    materialRequests,
    issueReports,
    deliveries,
    projects = [],
    assignedProjects = [],
    projectScopes = [],
    foremanAttendanceToday = null,
    progressPhotos = [],
}) {
    const { flash } = usePage().props;
    const [open, setOpen] = useState('accomplishment');
    const [submitting, setSubmitting] = useState(false);
    const [foremanProjectId, setForemanProjectId] = useState(foremanAttendanceToday?.project_id ? String(foremanAttendanceToday.project_id) : '');
    const [clockTick, setClockTick] = useState(Date.now());

    const [weekStart, setWeekStart] = useState('');
    const [scopes, setScopes] = useState(SCOPES.map((s) => ({ scope_of_work: s, percent_completed: '' })));

    const [matItems, setMatItems] = useState([
        { material_name: '', quantity: '', unit: '', remarks: '' },
    ]);

    const [issue, setIssue] = useState({
        issue_title: '',
        description: '',
        severity: 'medium',
    });

    const [delivery, setDelivery] = useState({
        item_delivered: '',
        quantity: '',
        delivery_date: '',
        supplier: '',
        status: 'received',
    });
    const [proofProjectId, setProofProjectId] = useState('');
    const [proofScopeId, setProofScopeId] = useState('');
    const [proofCaption, setProofCaption] = useState('');
    const [proofPhoto, setProofPhoto] = useState(null);
    const [proofPhotoInputKey, setProofPhotoInputKey] = useState(0);
    const [uploadingProof, setUploadingProof] = useState(false);

    const projectOptions = useMemo(
        () => (Array.isArray(projects) ? projects.map((project) => ({ id: project.id, name: project.name })) : []),
        [projects]
    );
    const scopeOptions = useMemo(() => {
        if (!Array.isArray(projectScopes)) return [];
        const selectedProjectId = String(proofProjectId || foremanProjectId || '');

        return projectScopes
            .filter((scope) => selectedProjectId === '' || String(scope.project_id) === selectedProjectId)
            .map((scope) => ({ id: scope.id, name: scope.scope_name, project_id: scope.project_id }));
    }, [projectScopes, proofProjectId, foremanProjectId]);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        setForemanProjectId(foremanAttendanceToday?.project_id ? String(foremanAttendanceToday.project_id) : '');
    }, [foremanAttendanceToday?.project_id]);

    useEffect(() => {
        if (!proofScopeId) return;
        const exists = scopeOptions.some((scope) => String(scope.id) === String(proofScopeId));
        if (!exists) setProofScopeId('');
    }, [proofScopeId, scopeOptions]);

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

    const toggle = (key) => setOpen(open === key ? null : key);

    const addMatRow = () =>
        setMatItems([...matItems, { material_name: '', quantity: '', unit: '', remarks: '' }]);

    const handleSubmitAll = () => {
        setSubmitting(true);

        router.post(
            '/foreman/submit-all',
            {
                week_start: weekStart,
                scopes,
                material_items: matItems,
                issue_title: issue.issue_title,
                description: issue.description,
                severity: issue.severity,
                item_delivered: delivery.item_delivered,
                quantity: delivery.quantity,
                delivery_date: delivery.delivery_date,
                supplier: delivery.supplier,
                status: delivery.status,
            },
            {
                onFinish: () => setSubmitting(false),
            }
        );
    };

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

    const uploadProgressProof = () => {
        if (!proofPhoto) {
            toast.error('Select an image proof first.');
            return;
        }

        setUploadingProof(true);
        router.post(
            '/foreman/progress-photo',
            {
                project_id: proofProjectId || foremanProjectId || null,
                scope_id: proofScopeId || null,
                caption: proofCaption,
                photo: proofPhoto,
            },
            {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => {
                    setProofProjectId('');
                    setProofScopeId('');
                    setProofCaption('');
                    setProofPhoto(null);
                    setProofPhotoInputKey((value) => value + 1);
                },
                onFinish: () => setUploadingProof(false),
            }
        );
    };

    return (
        <>
            <Head title="Foreman Dashboard" />
            <Layout title={`Foreman — ${user.fullname}`}>
                <div style={sectionStyle}>
                    <div style={{ ...headerStyle, cursor: 'default' }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>Assigned Projects</div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {assignedProjects.length} project{assignedProjects.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    <div style={{ padding: 20 }}>
                        {assignedProjects.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                No project assignments found yet. Contact admin/head admin to assign you to a project.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 10 }}>
                                {assignedProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 10,
                                            padding: 12,
                                            background: 'var(--surface-2)',
                                            display: 'grid',
                                            gridTemplateColumns: 'minmax(180px, 1.3fr) repeat(3, minmax(90px, auto)) auto',
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

                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Progress</div>
                                            <div style={{ ...mono, fontWeight: 700 }}>{Number(project.overall_progress || 0)}%</div>
                                        </div>

                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phase</div>
                                            <div style={{ fontSize: 12, fontWeight: 600 }}>{project.phase || '-'}</div>
                                        </div>

                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
                                            <div style={{ fontSize: 12, fontWeight: 600 }}>{project.status || '-'}</div>
                                        </div>

                                        <a
                                            href={project.public_submit_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                textDecoration: 'none',
                                                background: 'var(--success)',
                                                color: '#fff',
                                                borderRadius: 8,
                                                padding: '8px 12px',
                                                fontSize: 12,
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            Submit Progress
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ ...sectionStyle, overflow: 'visible', position: 'relative', zIndex: 2 }}>
                    <div style={{ ...headerStyle, cursor: 'default' }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>Foreman Attendance</div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Self Time In / Time Out</span>
                    </div>

                    <div style={{ padding: 20 }}>
                        <div
                            style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: 10,
                                padding: 12,
                                background: 'var(--surface-2)',
                                display: 'grid',
                                gridTemplateColumns: 'minmax(180px, 1.2fr) minmax(240px, 1.4fr) repeat(3, minmax(110px, auto)) auto auto',
                                gap: 8,
                                alignItems: 'center',
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Foreman</div>
                                <div style={{ fontWeight: 700 }}>{user.fullname}</div>
                            </div>

                            <div style={{ minWidth: 240 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Project</div>
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
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Time In</div>
                                <div style={mono}>{timeLabel12(foremanAttendanceToday?.time_in)}</div>
                            </div>

                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Time Out</div>
                                <div style={mono}>{timeLabel12(foremanAttendanceToday?.time_out)}</div>
                            </div>

                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Hours</div>
                                <div style={{ ...mono, fontWeight: 700 }}>{Number(foremanLiveHours.decimal ?? 0).toFixed(1)}</div>
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
                            Foreman self-attendance is handled here. Worker attendance entries stay in the Attendance page.
                        </div>
                    </div>
                </div>

                {/* DAILY ATTENDANCE (moved to /foreman/attendance) */}
                {false && <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('attendance')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>
                            <i className="fi fi-rr-clipboard-user" style={{ marginRight: 8 }} />
                            Daily Attendance
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {open === 'attendance' ? '▲' : '▼'}
                        </span>
                    </div>

                    {open === 'attendance' && (
                        <div style={{ padding: 20 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                                <thead>
                                    <tr>
                                        {['Worker Name', 'Role', 'Project', 'Date', 'Time In', 'Time Out', 'Hours', ''].map((h, i) => (
                                            <th
                                                key={i}
                                                style={{
                                                    fontSize: 11,
                                                    color: 'var(--text-muted-2)',
                                                    textAlign: 'left',
                                                    padding: '8px 8px',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {attEntries.map((entry, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                                            <td style={{ padding: '6px 8px' }}>
                                                <input
                                                    value={entry.worker_name}
                                                    onChange={(e) => updateAttEntry(idx, 'worker_name', e.target.value)}
                                                    style={inputStyle}
                                                    placeholder="Name"
                                                />
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                <select
                                                    value={entry.worker_role}
                                                    onChange={(e) => updateAttEntry(idx, 'worker_role', e.target.value)}
                                                    style={{ ...inputStyle, width: 'auto' }}
                                                >
                                                    {['Foreman', 'Skilled', 'Labor'].map((r) => (
                                                        <option key={r}>{r}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                <select
                                                    value={entry.project_id ?? ''}
                                                    onChange={(e) => updateAttEntry(idx, 'project_id', e.target.value)}
                                                    style={inputStyle}
                                                >
                                                    <option value="">Select project (optional)</option>
                                                    {projects.map((project) => (
                                                        <option key={project.id} value={project.id}>
                                                            {project.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                <DatePickerInput
                                                    value={entry.date}
                                                    onChange={(value) => updateAttEntry(idx, 'date', value)}
                                                    style={inputStyle}
                                                />
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                <input
                                                    type="time"
                                                    value={entry.time_in ?? ''}
                                                    onChange={(e) => updateAttEntry(idx, 'time_in', e.target.value)}
                                                    style={{ ...inputStyle, minWidth: 110 }}
                                                />
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                <input
                                                    type="time"
                                                    value={entry.time_out ?? ''}
                                                    onChange={(e) => updateAttEntry(idx, 'time_out', e.target.value)}
                                                    style={{ ...inputStyle, minWidth: 110 }}
                                                />
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    value={entry.hours}
                                                    onChange={(e) => updateAttEntry(idx, 'hours', e.target.value)}
                                                    style={{ ...inputStyle, width: 80 }}
                                                    title={entry.time_in && entry.time_out ? 'Auto-calculated from time in/out' : 'Manual hours'}
                                                />
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                {attEntries.length > 1 && (
                                                    <button
                                                        onClick={() => setAttEntries(attEntries.filter((_, i) => i !== idx))}
                                                        style={{
                                                            background: 'rgba(248,81,73,0.12)',
                                                            color: '#f87171',
                                                            border: 'none',
                                                            borderRadius: 6,
                                                            padding: '4px 8px',
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <button
                                onClick={addAttRow}
                                style={{
                                    ...btnStyle,
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-color)',
                                }}
                            >
                                + Add Row
                            </button>
                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                                Hours are auto-calculated when both Time In and Time Out are provided.
                            </div>
                        </div>
                    )}
                </div>}

                {/* WEEKLY ACCOMPLISHMENT */}
                <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('accomplishment')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>
                            <i className="fi fi-rr-chart-line-up" style={{ marginRight: 8 }} />
                            Weekly Accomplishment
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {open === 'accomplishment' ? '▲' : '▼'}
                        </span>
                    </div>

                    {open === 'accomplishment' && (
                        <div style={{ padding: 20 }}>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                                    Week Start Date
                                </label>
                                <DatePickerInput
                                    value={weekStart}
                                    onChange={(value) => setWeekStart(value)}
                                    style={{ ...inputStyle, width: 200 }}
                                />
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                                <thead>
                                    <tr>
                                        <th
                                            style={{
                                                fontSize: 11,
                                                color: 'var(--text-muted-2)',
                                                textAlign: 'left',
                                                padding: '8px',
                                                borderBottom: '1px solid var(--border-color)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Scope of Work
                                        </th>
                                        <th
                                            style={{
                                                fontSize: 11,
                                                color: 'var(--text-muted-2)',
                                                textAlign: 'center',
                                                padding: '8px',
                                                borderBottom: '1px solid var(--border-color)',
                                                textTransform: 'uppercase',
                                                width: 140,
                                            }}
                                        >
                                            % Completed
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {scopes.map((scope, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                                            <td style={{ padding: '8px', color: 'var(--text-main)', fontSize: 13 }}>
                                                {scope.scope_of_work}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={scope.percent_completed}
                                                    onChange={(e) => {
                                                        const arr = [...scopes];
                                                        arr[idx].percent_completed = e.target.value;
                                                        setScopes(arr);
                                                    }}
                                                    style={{ ...inputStyle, width: 80, textAlign: 'center' }}
                                                    placeholder="0"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* MATERIAL REQUEST */}
                <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('material')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>
                            <i className="fi fi-rr-shopping-cart" style={{ marginRight: 8 }} />
                            Material Request
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {open === 'material' ? '▲' : '▼'}
                        </span>
                    </div>

                    {open === 'material' && (
                        <div style={{ padding: 20 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                                <thead>
                                    <tr>
                                        {['Material', 'Quantity', 'Unit', 'Remarks', ''].map((h, i) => (
                                            <th
                                                key={i}
                                                style={{
                                                    fontSize: 11,
                                                    color: 'var(--text-muted-2)',
                                                    textAlign: 'left',
                                                    padding: '8px',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {matItems.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                                            <td style={{ padding: '6px 8px 6px 0' }}>
                                                <input
                                                    value={item.material_name}
                                                    onChange={(e) => {
                                                        const arr = [...matItems];
                                                        arr[idx].material_name = e.target.value;
                                                        setMatItems(arr);
                                                    }}
                                                    style={inputStyle}
                                                    placeholder="e.g. CHB 4 inch"
                                                />
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                <input
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const arr = [...matItems];
                                                        arr[idx].quantity = e.target.value;
                                                        setMatItems(arr);
                                                    }}
                                                    style={inputStyle}
                                                    placeholder="e.g. 500"
                                                />
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                <input
                                                    value={item.unit}
                                                    onChange={(e) => {
                                                        const arr = [...matItems];
                                                        arr[idx].unit = e.target.value;
                                                        setMatItems(arr);
                                                    }}
                                                    style={inputStyle}
                                                    placeholder="pcs / bags"
                                                />
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                <input
                                                    value={item.remarks}
                                                    onChange={(e) => {
                                                        const arr = [...matItems];
                                                        arr[idx].remarks = e.target.value;
                                                        setMatItems(arr);
                                                    }}
                                                    style={inputStyle}
                                                    placeholder="Optional"
                                                />
                                            </td>

                                            <td style={{ padding: '6px 8px' }}>
                                                {matItems.length > 1 && (
                                                    <button
                                                        onClick={() => setMatItems(matItems.filter((_, i) => i !== idx))}
                                                        style={{
                                                            background: 'rgba(248,81,73,0.12)',
                                                            color: '#f87171',
                                                            border: 'none',
                                                            borderRadius: 6,
                                                            padding: '4px 8px',
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <button
                                onClick={addMatRow}
                                style={{
                                    ...btnStyle,
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-color)',
                                }}
                            >
                                + Add Item
                            </button>
                        </div>
                    )}
                </div>

                {/* ISSUE REPORT */}
                <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('issue')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>
                            <i className="fi fi-rr-exclamation" style={{ marginRight: 8 }} />
                            Issue Report
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {open === 'issue' ? '▲' : '▼'}
                        </span>
                    </div>

                    {open === 'issue' && (
                        <div style={{ padding: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                                        Issue Title
                                    </label>
                                    <input
                                        value={issue.issue_title}
                                        onChange={(e) => setIssue({ ...issue, issue_title: e.target.value })}
                                        style={inputStyle}
                                        placeholder="Brief title of issue"
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                                        Severity
                                    </label>
                                    <select
                                        value={issue.severity}
                                        onChange={(e) => setIssue({ ...issue, severity: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                                    Description
                                </label>
                                <textarea
                                    value={issue.description}
                                    onChange={(e) => setIssue({ ...issue, description: e.target.value })}
                                    rows={4}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                    placeholder="Describe the issue in detail..."
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* DELIVERY CONFIRMATION */}
                <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('delivery')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>
                            <i className="fi fi-rr-truck-side" style={{ marginRight: 8 }} />
                            Delivery Confirmation
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {open === 'delivery' ? '▲' : '▼'}
                        </span>
                    </div>

                    {open === 'delivery' && (
                        <div style={{ padding: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                                {[
                                    ['Item Delivered', 'item_delivered', 'text', 'e.g. Cement Bags'],
                                    ['Quantity', 'quantity', 'text', 'e.g. 50 bags'],
                                    ['Delivery Date', 'delivery_date', 'date', ''],
                                    ['Supplier', 'supplier', 'text', 'Optional'],
                                ].map(([label, key, type, placeholder]) => (
                                    <div key={key}>
                                        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                                            {label}
                                        </label>
                                        {type === 'date' ? (
                                            <DatePickerInput
                                                value={delivery[key]}
                                                onChange={(value) => setDelivery({ ...delivery, [key]: value })}
                                                style={inputStyle}
                                                placeholder="YYYY-MM-DD"
                                            />
                                        ) : (
                                            <input
                                                type={type}
                                                value={delivery[key]}
                                                onChange={(e) => setDelivery({ ...delivery, [key]: e.target.value })}
                                                style={inputStyle}
                                                placeholder={placeholder}
                                            />
                                        )}
                                    </div>
                                ))}

                                <div>
                                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                                        Status
                                    </label>
                                    <select
                                        value={delivery.status}
                                        onChange={(e) => setDelivery({ ...delivery, status: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="received">Received</option>
                                        <option value="incomplete">Incomplete</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div style={sectionStyle}>
                    <div style={headerStyle} onClick={() => toggle('proof')}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>
                            <i className="fi fi-rr-camera" style={{ marginRight: 8 }} />
                            Progress Proof Photo (Optional)
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {open === 'proof' ? '▲' : '▼'}
                        </span>
                    </div>

                    {open === 'proof' && (
                        <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                                        Project (optional)
                                    </label>
                                    <SearchableDropdown
                                        options={projectOptions}
                                        value={proofProjectId}
                                        onChange={(value) => setProofProjectId(value || '')}
                                        getOptionLabel={(option) => option.name}
                                        getOptionValue={(option) => option.id}
                                        placeholder="Select project"
                                        searchPlaceholder="Search projects..."
                                        emptyMessage="No projects found"
                                        style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                        dropdownWidth={320}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                                        Scope (optional)
                                    </label>
                                    <SearchableDropdown
                                        options={scopeOptions}
                                        value={proofScopeId}
                                        onChange={(value) => setProofScopeId(value || '')}
                                        getOptionLabel={(option) => option.name}
                                        getOptionValue={(option) => option.id}
                                        placeholder="Select scope"
                                        searchPlaceholder="Search scope..."
                                        emptyMessage="No scopes found"
                                        style={{ ...inputStyle, minHeight: 38, padding: '7px 9px' }}
                                        dropdownWidth={320}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                                        Proof Image
                                    </label>
                                    <input
                                        key={proofPhotoInputKey}
                                        type="file"
                                        accept="image/*"
                                        onChange={(event) => setProofPhoto(event.target.files?.[0] ?? null)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                                    Caption (optional)
                                </label>
                                <textarea
                                    value={proofCaption}
                                    onChange={(event) => setProofCaption(event.target.value)}
                                    rows={3}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                    placeholder="Add context for admins/head admin"
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={uploadProgressProof}
                                    disabled={uploadingProof}
                                    style={{
                                        ...btnStyle,
                                        opacity: uploadingProof ? 0.7 : 1,
                                    }}
                                >
                                    {uploadingProof ? 'Uploading...' : 'Upload Proof Photo'}
                                </button>
                            </div>

                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                    Recent Uploaded Proofs
                                </div>
                                {progressPhotos.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No uploaded proof photos yet.</div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                                        {progressPhotos.map((photo) => (
                                            <a
                                                key={photo.id}
                                                href={`/storage/${photo.photo_path}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 8,
                                                    background: 'var(--surface-2)',
                                                    padding: 8,
                                                    textDecoration: 'none',
                                                    color: 'inherit',
                                                }}
                                            >
                                                <img
                                                    src={`/storage/${photo.photo_path}`}
                                                    alt={photo.caption || 'Progress proof'}
                                                    style={{
                                                        width: '100%',
                                                        height: 110,
                                                        objectFit: 'cover',
                                                        borderRadius: 6,
                                                        marginBottom: 6,
                                                    }}
                                                />
                                                <div style={{ fontSize: 12, fontWeight: 600 }}>{photo.project_name || 'Unassigned'}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {photo.caption || 'No caption'}
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* SUBMIT ALL */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, marginBottom: 32 }}>
                    <button
                        onClick={handleSubmitAll}
                        disabled={submitting}
                        style={{
                            ...btnStyle,
                            padding: '12px 36px',
                            fontSize: 15,
                            borderRadius: 10,
                            opacity: submitting ? 0.7 : 1,
                        }}
                    >
                        {submitting ? 'Submitting...' : '✔ Submit All'}
                    </button>
                </div>
            </Layout>
        </>
    );
}
