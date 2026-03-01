import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import DatePickerInput from '../../Components/DatePickerInput';
import Modal from '../../Components/Modal';

const DAYS = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
    { key: 'sun', label: 'Sun' },
];

const STATUS = ['', 'P', 'A', 'H', 'R', 'F'];
const POINTS = { P: 1, A: 0, H: 0.5, R: 0, F: 0 };
const ATTENDANCE_LEGEND = [
    'P = Present',
    'A = Absent',
    'H = Half Day',
    'R = Rest Day',
    'F = Field Work',
];

const SCOPES = [
    'Mobilization and Hauling',
    'Foundation Preparation',
    'Column Footing',
    'Column',
    'Wall Footing',
    'Second-Floor Beam, Slab and Stairs',
    'Slab on Fill',
    'CHB Laying with Plastering',
    'Garage Flooring',
    'Roof Facade and Garage Partition',
    'Roofing and Tinsmithry (garage included)',
    'Roof Beam',
    'Ceiling Works',
    'Doors and Jambs',
    'Aluminum Doors and Windows',
    'Second-Floor Level Floor Tile',
    'Lower Level Floor Tile',
    'Kitchen Counter Cabinet',
    'Canopy',
];

const CATEGORIES = ['Slab Work', 'Plumbing Rough-in', 'Electrical', 'Masonry', 'Finishing', 'Safety', 'General Progress'];

const SECTIONS = [
    { key: 'attendance', label: 'Daily Attendance' },
    { key: 'delivery', label: 'Delivery Confirmation' },
    { key: 'materials', label: 'Material Request' },
    { key: 'weekly', label: 'Weekly Progress (Accomplishment %)' },
    { key: 'photos', label: 'Photos' },
    { key: 'issues', label: 'Issue Reports' },
];

const today = () => new Date().toISOString().slice(0, 10);
const monday = () => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
};
const isMondayDate = (value) => {
    if (!value) return false;
    const parts = String(value).split('-').map((v) => Number(v));
    if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) return false;
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return d.getUTCDay() === 1;
};
const normalizeToMonday = (value) => {
    if (!value) return '';
    const parts = String(value).split('-').map((v) => Number(v));
    if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) return String(value);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const mondayOffset = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - mondayOffset);
    return d.toISOString().slice(0, 10);
};
const blankDays = () => DAYS.reduce((a, d) => ({ ...a, [d.key]: '' }), {});
const workerIdentity = (name, role) => {
    const normalizedName = String(name || '').trim().toLowerCase();
    if (!normalizedName) return '';
    const normalizedRole = String(role || 'Worker').trim().toLowerCase() || 'worker';
    return `${normalizedName}|${normalizedRole}`;
};
const sharedAttendanceRowKey = (name, role) => {
    const key = workerIdentity(name, role).replace(/[^a-z0-9|]/g, '-').replace(/\|/g, '-');
    return key ? `attendance-shared-${key}` : nextAttendanceRowKey();
};
let attendanceRowSeed = 0;
const nextAttendanceRowKey = () => {
    attendanceRowSeed += 1;
    return `attendance-row-${attendanceRowSeed}`;
};
const blankRow = () => ({ row_key: nextAttendanceRowKey(), worker_name: '', worker_role: 'Worker', days: blankDays() });
const cloneAttendanceRows = (rows = []) => rows.map((row) => ({
    row_key: row?.row_key || nextAttendanceRowKey(),
    worker_name: String(row?.worker_name || ''),
    worker_role: String(row?.worker_role || 'Worker'),
    days: { ...blankDays(), ...(row?.days || {}) },
}));
const buildAttendanceRows = (workerRows = []) => (
    workerRows.length
        ? workerRows.slice(0, 10).map((worker) => ({
            row_key: nextAttendanceRowKey(),
            worker_name: worker?.name || '',
            worker_role: worker?.role || 'Worker',
            days: blankDays(),
        }))
        : [blankRow()]
);
let weeklyRowSeed = 0;
const nextWeeklyRowKey = () => {
    weeklyRowSeed += 1;
    return `weekly-row-${weeklyRowSeed}`;
};
const buildWeeklyRows = (scopeRows = []) => scopeRows.map((scope) => ({
    row_key: nextWeeklyRowKey(),
    scope_of_work: scope,
    percent_completed: '',
    is_manual: false,
    weekly_photos: [],
    weekly_photo_caption: '',
}));
const cloneWeeklyRows = (rows = []) => rows.map((row) => ({
    row_key: row?.row_key || nextWeeklyRowKey(),
    scope_of_work: String(row?.scope_of_work || ''),
    percent_completed: String(row?.percent_completed || ''),
    is_manual: !!row?.is_manual,
    weekly_photos: [],
    weekly_photo_caption: String(row?.weekly_photo_caption || ''),
}));
const mergeWeeklyRowsWithScopeList = (rows = [], scopeRows = []) => {
    const scopeMap = new Map();
    (scopeRows || []).forEach((scope) => {
        const scopeName = String(scope || '').trim();
        if (scopeName === '') return;
        scopeMap.set(scopeName.toLowerCase(), scopeName);
    });

    const existingRows = cloneWeeklyRows(rows);
    const existingScopeKeys = new Set();
    const mergedRows = existingRows.map((row) => {
        const scopeName = String(row?.scope_of_work || '').trim();
        const scopeKey = scopeName.toLowerCase();
        if (scopeName !== '') {
            existingScopeKeys.add(scopeKey);
        }

        if (scopeMap.has(scopeKey)) {
            return {
                ...row,
                scope_of_work: scopeMap.get(scopeKey),
                is_manual: false,
            };
        }

        return row;
    });

    scopeMap.forEach((scopeName, scopeKey) => {
        if (existingScopeKeys.has(scopeKey)) return;
        mergedRows.push({
            row_key: nextWeeklyRowKey(),
            scope_of_work: scopeName,
            percent_completed: '',
            is_manual: false,
            weekly_photos: [],
            weekly_photo_caption: '',
        });
    });

    return mergedRows;
};
const jfDateInputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #cfd3db',
    borderRadius: 8,
    background: '#fff',
    padding: '9px 10px',
    fontSize: 14,
    color: '#1f2937',
};
const humanize = (value) => {
    const text = String(value || '').trim();
    if (!text) return '-';
    return text
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

export default function ProgressSubmit({ submitToken }) {
    const { flash, errors = {} } = usePage().props;
    const base = typeof window === 'undefined' ? `/progress-submit/${submitToken?.token || ''}` : window.location.pathname.replace(/\/$/, '');
    const workers = Array.isArray(submitToken?.workers) ? submitToken.workers : [];
    const scopes = Array.isArray(submitToken?.weekly_scope_of_works) && submitToken.weekly_scope_of_works.length ? submitToken.weekly_scope_of_works : SCOPES;
    const weeklyScopePhotoMap = submitToken?.weekly_scope_photo_map && typeof submitToken.weekly_scope_photo_map === 'object'
        ? submitToken.weekly_scope_photo_map
        : {};
    const categories = Array.isArray(submitToken?.photo_categories) && submitToken.photo_categories.length ? submitToken.photo_categories : CATEGORIES;
    const photos = Array.isArray(submitToken?.recent_photos) ? submitToken.recent_photos : [];
    const recentDeliveries = Array.isArray(submitToken?.recent_deliveries) ? submitToken.recent_deliveries : [];
    const recentMaterialRequests = Array.isArray(submitToken?.recent_material_requests) ? submitToken.recent_material_requests : [];
    const recentIssueReports = Array.isArray(submitToken?.recent_issue_reports) ? submitToken.recent_issue_reports : [];
    const initialAttendanceDrafts = useMemo(() => {
        const source = submitToken?.attendance_saved_by_week && typeof submitToken.attendance_saved_by_week === 'object'
            ? submitToken.attendance_saved_by_week
            : {};
        return Object.entries(source).reduce((acc, [weekKey, rows]) => {
            acc[weekKey] = cloneAttendanceRows(Array.isArray(rows) ? rows : []);
            return acc;
        }, {});
    }, [submitToken?.attendance_saved_by_week]);
    const attendanceSavedByWeek = useMemo(() => {
        const source = submitToken?.attendance_saved_by_week && typeof submitToken.attendance_saved_by_week === 'object'
            ? submitToken.attendance_saved_by_week
            : {};
        return source;
    }, [submitToken?.attendance_saved_by_week]);
    const initialWeeklyDrafts = useMemo(() => {
        const source = submitToken?.weekly_saved_by_week && typeof submitToken.weekly_saved_by_week === 'object'
            ? submitToken.weekly_saved_by_week
            : {};
        return Object.entries(source).reduce((acc, [weekKey, rows]) => {
            acc[weekKey] = mergeWeeklyRowsWithScopeList(Array.isArray(rows) ? rows : [], scopes);
            return acc;
        }, {});
    }, [submitToken?.weekly_saved_by_week, scopes]);
    const weeklySavedByWeek = useMemo(() => {
        const source = submitToken?.weekly_saved_by_week && typeof submitToken.weekly_saved_by_week === 'object'
            ? submitToken.weekly_saved_by_week
            : {};
        return source;
    }, [submitToken?.weekly_saved_by_week]);
    const [expanded, setExpanded] = useState({ attendance: false, delivery: false, materials: false, weekly: false, photos: false, issues: false });
    const [attendanceWeek, setAttendanceWeek] = useState(monday);
    const [attendanceWeekDrafts, setAttendanceWeekDrafts] = useState(initialAttendanceDrafts);
    const [delivery, setDelivery] = useState({ delivery_date: today(), status: 'complete', item_delivered: '', quantity: '', supplier: '', note: '', photo: null });
    const [material, setMaterial] = useState({ material_name: '', quantity: '', unit: '', remarks: '', photo: null });
    const [weekStart, setWeekStart] = useState(monday);
    const [weeklyWeekDrafts, setWeeklyWeekDrafts] = useState(initialWeeklyDrafts);
    const [weeklyRemovedScopesByWeek, setWeeklyRemovedScopesByWeek] = useState({});
    const [photoForm, setPhotoForm] = useState({ category: '', description: '', photo: null });
    const [issue, setIssue] = useState({ issue_title: '', description: '', urgency: 'normal', photo: null });
    const [previewPhoto, setPreviewPhoto] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [removedAttendanceWorkerIds, setRemovedAttendanceWorkerIds] = useState([]);
    const attendanceWorkerPool = useMemo(() => {
        const pool = new Map();
        workers.forEach((worker) => {
            const name = String(worker?.name || '').trim();
            const role = String(worker?.role || 'Worker').trim() || 'Worker';
            const id = workerIdentity(name, role);
            if (!id) return;
            if (!pool.has(id)) pool.set(id, { name, role });
        });
        Object.values(initialAttendanceDrafts).forEach((rows) => {
            (rows || []).forEach((row) => {
                const name = String(row?.worker_name || '').trim();
                const role = String(row?.worker_role || 'Worker').trim() || 'Worker';
                const id = workerIdentity(name, role);
                if (!id) return;
                if (!pool.has(id)) pool.set(id, { name, role });
            });
        });
        Object.values(attendanceWeekDrafts || {}).forEach((rows) => {
            (rows || []).forEach((row) => {
                const name = String(row?.worker_name || '').trim();
                const role = String(row?.worker_role || 'Worker').trim() || 'Worker';
                const id = workerIdentity(name, role);
                if (!id) return;
                if (!pool.has(id)) pool.set(id, { name, role });
            });
        });
        return Array.from(pool.entries())
            .filter(([id]) => !removedAttendanceWorkerIds.includes(id))
            .map(([, value]) => value);
    }, [workers, initialAttendanceDrafts, attendanceWeekDrafts, removedAttendanceWorkerIds]);
    const defaultAttendanceRows = useMemo(() => buildAttendanceRows(attendanceWorkerPool), [attendanceWorkerPool]);
    const defaultWeeklyRows = useMemo(() => buildWeeklyRows(scopes), [scopes]);

    const [deliveryKey, setDeliveryKey] = useState(0);
    const [materialKey, setMaterialKey] = useState(0);
    const [photoKey, setPhotoKey] = useState(0);
    const [issueKey, setIssueKey] = useState(0);
    const photoInputRef = useRef(null);
    const attendanceWeekKey = normalizeToMonday(attendanceWeek) || '__attendance_empty__';
    const weeklyWeekKey = normalizeToMonday(weekStart) || '__weekly_empty__';
    const currentWeekStart = monday();
    const attendanceWeekHasSavedData = Array.isArray(attendanceSavedByWeek[attendanceWeekKey]) && attendanceSavedByWeek[attendanceWeekKey].length > 0;
    const weeklyWeekHasSavedData = Array.isArray(weeklySavedByWeek[weeklyWeekKey]) && weeklySavedByWeek[weeklyWeekKey].length > 0;
    const attendanceLocked = attendanceWeekKey < currentWeekStart && attendanceWeekHasSavedData;
    const weeklyLocked = weeklyWeekKey < currentWeekStart && weeklyWeekHasSavedData;
    const attendanceRows = useMemo(() => {
        const currentRows = cloneAttendanceRows(attendanceWeekDrafts[attendanceWeekKey] ?? defaultAttendanceRows);
        const existing = new Set(
            currentRows
                .map((row) => workerIdentity(row.worker_name, row.worker_role))
                .filter((id) => id !== '')
        );
        const missingWorkers = attendanceWorkerPool
            .filter((worker) => !existing.has(workerIdentity(worker.name, worker.role)))
            .map((worker) => ({
                row_key: sharedAttendanceRowKey(worker.name, worker.role),
                worker_name: worker.name,
                worker_role: worker.role,
                days: blankDays(),
            }));
        return [...currentRows, ...missingWorkers];
    }, [attendanceWeekDrafts, attendanceWeekKey, defaultAttendanceRows, attendanceWorkerPool]);
    const weeklyRows = weeklyWeekDrafts[weeklyWeekKey] ?? defaultWeeklyRows;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    const firstError = useMemo(() => {
        const values = Object.values(errors || {});
        return values.find((v) => typeof v === 'string' && v.trim() !== '') || '';
    }, [errors]);

    useEffect(() => {
        if (firstError) toast.error(firstError);
    }, [firstError]);

    const rowTotal = (row) => DAYS.reduce((sum, d) => sum + (POINTS[row?.days?.[d.key] || ''] || 0), 0);
    const dayTotal = (key) => attendanceRows.reduce((sum, row) => sum + (POINTS[row?.days?.[key] || ''] || 0), 0);

    const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    const openPhotoPreview = (photoPath, title = 'Photo Preview', meta = '') => {
        const normalizedPath = String(photoPath || '').trim();
        if (normalizedPath === '') return;
        setPreviewPhoto({
            src: `/storage/${normalizedPath}`,
            title,
            meta: String(meta || '').trim(),
        });
    };
    const unhideAttendanceWorker = (name, role) => {
        const id = workerIdentity(name, role);
        if (!id) return;
        setRemovedAttendanceWorkerIds((prev) => prev.filter((value) => value !== id));
    };
    const removeAttendanceWorker = (row, rowIndex) => {
        const workerId = workerIdentity(row?.worker_name, row?.worker_role);
        if (workerId) {
            setRemovedAttendanceWorkerIds((prev) => (prev.includes(workerId) ? prev : [...prev, workerId]));
            setAttendanceWeekDrafts((prev) => {
                const next = {};
                Object.entries(prev || {}).forEach(([weekKey, rows]) => {
                    const filteredRows = cloneAttendanceRows(rows).filter((entry) => workerIdentity(entry.worker_name, entry.worker_role) !== workerId);
                    next[weekKey] = filteredRows;
                });
                return next;
            });
            return;
        }

        setCurrentAttendanceRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
    };
    const setCurrentAttendanceRows = (updater) => {
        setAttendanceWeekDrafts((prev) => {
            const currentRows = cloneAttendanceRows(prev[attendanceWeekKey] ?? defaultAttendanceRows);
            const nextRows = typeof updater === 'function' ? updater(currentRows) : updater;
            return { ...prev, [attendanceWeekKey]: cloneAttendanceRows(nextRows) };
        });
    };
    const setCurrentWeeklyRows = (updater) => {
        setWeeklyWeekDrafts((prev) => {
            const currentRows = (prev[weeklyWeekKey] ?? defaultWeeklyRows).map((row) => ({ ...row }));
            const nextRows = typeof updater === 'function' ? updater(currentRows) : updater;
            return { ...prev, [weeklyWeekKey]: (nextRows || []).map((row) => ({ ...row })) };
        });
    };

    const submitAll = () => {
        const attendanceEntries = attendanceRows
            .map((row) => ({
                worker_name: String(row.worker_name || '').trim(),
                worker_role: String(row.worker_role || '').trim(),
                days: DAYS.reduce((acc, d) => ({ ...acc, [d.key]: String(row?.days?.[d.key] || '').trim().toUpperCase() }), {}),
            }))
            .filter((row) => row.worker_name !== '' && DAYS.some((d) => row.days[d.key] !== ''));
        const safeAttendanceEntries = attendanceLocked ? [] : attendanceEntries;

        const weeklyScopes = weeklyRows
            .map((r) => ({
                scope_of_work: String(r.scope_of_work || '').trim(),
                percent_completed: String(r.percent_completed || '').trim(),
                photo_caption: String(r.weekly_photo_caption || '').trim(),
                photos: Array.isArray(r.weekly_photos) ? r.weekly_photos.filter(Boolean) : [],
            }))
            .filter((r) => r.scope_of_work !== '' && (r.percent_completed !== '' || r.photos.length > 0));
        const safeWeeklyScopes = weeklyLocked ? [] : weeklyScopes;
        const removedWeeklyScopes = weeklyLocked
            ? []
            : (weeklyRemovedScopesByWeek[weeklyWeekKey] || [])
                .filter((scope) => {
                    const scopeKey = String(scope || '').trim().toLowerCase();
                    if (!scopeKey) return false;
                    return !safeWeeklyScopes.some((row) => String(row.scope_of_work || '').trim().toLowerCase() === scopeKey);
                });

        const payload = {
            attendance_week_start: normalizeToMonday(attendanceWeek),
            attendance_entries: safeAttendanceEntries,

            delivery_date: delivery.delivery_date,
            delivery_status: delivery.status,
            delivery_item_delivered: delivery.item_delivered,
            delivery_quantity: delivery.quantity,
            delivery_supplier: delivery.supplier,
            delivery_note: delivery.note,
            delivery_photo: delivery.photo,

            material_name: material.material_name,
            material_quantity: material.quantity,
            material_unit: material.unit,
            material_remarks: material.remarks,
            material_photo: material.photo,

            weekly_week_start: normalizeToMonday(weekStart),
            weekly_scopes: safeWeeklyScopes,
            weekly_removed_scopes: removedWeeklyScopes,

            photo_file: photoForm.photo,
            photo_category: photoForm.category,
            photo_description: photoForm.description,

            issue_title: issue.issue_title,
            issue_description: issue.description,
            issue_urgency: issue.urgency,
            issue_photo: issue.photo,
        };

        setSubmitting(true);
        router.post(`${base}/submit-all`, payload, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setDelivery({ delivery_date: today(), status: 'complete', item_delivered: '', quantity: '', supplier: '', note: '', photo: null });
                setMaterial({ material_name: '', quantity: '', unit: '', remarks: '', photo: null });
                setPhotoForm({ category: '', description: '', photo: null });
                setIssue({ issue_title: '', description: '', urgency: 'normal', photo: null });
                setWeeklyRemovedScopesByWeek((prev) => ({ ...prev, [weeklyWeekKey]: [] }));
                setDeliveryKey((k) => k + 1);
                setMaterialKey((k) => k + 1);
                setPhotoKey((k) => k + 1);
                setIssueKey((k) => k + 1);
            },
            onFinish: () => setSubmitting(false),
        });
    };

    const attendanceContent = (
        <>
            <label className="jf-label">
                Week Start
                <DatePickerInput
                    value={attendanceWeek}
                    onChange={(value) => {
                        const next = value || '';
                        if (!next) {
                            setAttendanceWeek('');
                            return;
                        }
                        if (!isMondayDate(next)) {
                            toast.error('Please select a Monday only.');
                            return;
                        }
                        setAttendanceWeek(next);
                    }}
                    style={jfDateInputStyle}
                />
            </label>
            {attendanceLocked ? <div className="jf-note" style={{ marginBottom: 8, fontWeight: 700 }}>Past submitted week is locked and cannot be edited.</div> : null}
            <div className="jf-note" style={{ marginBottom: 8, lineHeight: 1.45 }}>
                <strong>Attendance Codes:</strong> {ATTENDANCE_LEGEND.join(' | ')}
            </div>
            <div className="jf-table-wrap">
                <table className="jf-table">
                    <thead>
                        <tr>
                            <th>Full Name</th>
                            <th>Job</th>
                            {DAYS.map((d) => <th key={d.key}>{d.label}</th>)}
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attendanceRows.map((row, i) => (
                            <tr key={row.row_key || i}>
                                <td><input disabled className="jf-input" value={row.worker_name} readOnly /></td>
                                <td><input disabled className="jf-input" value={row.worker_role} readOnly /></td>
                                {DAYS.map((d) => (
                                    <td key={d.key}>
                                        <select disabled={attendanceLocked} className="jf-input" value={row.days[d.key] || ''} onChange={(e) => setCurrentAttendanceRows((prev) => prev.map((r, idx) => idx === i ? { ...r, days: { ...r.days, [d.key]: e.target.value } } : r))}>
                                            {STATUS.map((s) => <option key={s || 'x'} value={s}>{s || '-'}</option>)}
                                        </select>
                                    </td>
                                ))}
                                <td style={{ fontWeight: 700, textAlign: 'center' }}>{rowTotal(row).toFixed(1)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={2} style={{ fontWeight: 700 }}>Totals</td>
                            {DAYS.map((d) => <td key={d.key} style={{ textAlign: 'center', fontWeight: 700 }}>{dayTotal(d.key).toFixed(1)}</td>)}
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{DAYS.reduce((sum, d) => sum + dayTotal(d.key), 0).toFixed(1)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div className="jf-actions">
                <button type="button" className="jf-btn jf-btn-light" disabled={attendanceLocked} onClick={() => setCurrentAttendanceRows((prev) => [...prev, blankRow()])}><Plus size={15} /> Add Worker</button>
            </div>
        </>
    );

    const deliveryContent = (
        <>
            <label className="jf-label">
                Delivery Date
                <DatePickerInput
                    value={delivery.delivery_date}
                    onChange={(value) => setDelivery((p) => ({ ...p, delivery_date: value || '' }))}
                    style={jfDateInputStyle}
                />
            </label>
            <label className="jf-file-btn"><Camera size={20} /> Take Photo<input key={deliveryKey} type="file" accept="image/*" capture="environment" onChange={(e) => setDelivery((p) => ({ ...p, photo: e.target.files?.[0] || null }))} /></label>
            <div className="jf-note">{delivery.photo?.name || 'No photo selected'}</div>
            <div className="jf-row">
                <button type="button" className={`jf-toggle ${delivery.status === 'complete' ? 'on' : ''}`} onClick={() => setDelivery((p) => ({ ...p, status: 'complete' }))}>Complete</button>
                <button type="button" className={`jf-toggle ${delivery.status === 'incomplete' ? 'on' : ''}`} onClick={() => setDelivery((p) => ({ ...p, status: 'incomplete' }))}>Incomplete</button>
            </div>
            <div className="jf-grid2">
                <input className="jf-input" placeholder="Item delivered (optional)" value={delivery.item_delivered} onChange={(e) => setDelivery((p) => ({ ...p, item_delivered: e.target.value }))} />
                <input className="jf-input" placeholder="Quantity (optional)" value={delivery.quantity} onChange={(e) => setDelivery((p) => ({ ...p, quantity: e.target.value }))} />
            </div>
            <input className="jf-input" placeholder="Supplier (optional)" value={delivery.supplier} onChange={(e) => setDelivery((p) => ({ ...p, supplier: e.target.value }))} />
            <textarea className="jf-input" rows={3} placeholder="Note (optional)" value={delivery.note} onChange={(e) => setDelivery((p) => ({ ...p, note: e.target.value }))} />
            <div style={{ marginTop: 10 }}>
                <div className="jf-small-title" style={{ fontSize: 16, marginBottom: 6 }}>Recent Delivery Confirmations</div>
                <div className="jf-recent-list jf-recent-list-two">
                    {recentDeliveries.length === 0 ? (
                        <div className="jf-note">No recent delivery confirmations yet.</div>
                    ) : recentDeliveries.map((row) => (
                        <div key={row.id} className="jf-recent-card">
                            {row.photo_path ? (
                                <button
                                    type="button"
                                    onClick={() => openPhotoPreview(
                                        row.photo_path,
                                        row.item_delivered || 'Delivery Photo',
                                        `Delivery Date: ${row.delivery_date || '-'}${row.supplier ? ` | Supplier: ${row.supplier}` : ''}`
                                    )}
                                    style={{ display: 'block', marginBottom: 6, border: 'none', background: 'transparent', padding: 0, width: '100%', cursor: 'pointer' }}
                                >
                                    <img
                                        src={`/storage/${row.photo_path}`}
                                        alt={row.item_delivered || 'Delivery photo'}
                                        style={{ width: '100%', maxHeight: 130, objectFit: 'cover', borderRadius: 6, border: '1px solid #d4cec0' }}
                                    />
                                </button>
                            ) : null}
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                <div style={{ fontWeight: 700 }}>{row.item_delivered || 'Item not specified'}</div>
                                <span className="jf-recent-chip">{humanize(row.status)}</span>
                            </div>
                            <div className="jf-note">Qty: {row.quantity || '-'}</div>
                            <div className="jf-note">Delivery Date: {row.delivery_date || '-'}</div>
                            <div className="jf-note">Supplier: {row.supplier || '-'}</div>
                            <div className="jf-note">Submitted: {row.created_at || '-'}</div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );

    const materialContent = (
        <>
            <label className="jf-label">Material Name<input className="jf-input" value={material.material_name} onChange={(e) => setMaterial((p) => ({ ...p, material_name: e.target.value }))} /></label>
            <div className="jf-grid2">
                <label className="jf-label">Quantity<input className="jf-input" value={material.quantity} onChange={(e) => setMaterial((p) => ({ ...p, quantity: e.target.value }))} /></label>
                <label className="jf-label">Unit<input className="jf-input" value={material.unit} onChange={(e) => setMaterial((p) => ({ ...p, unit: e.target.value }))} /></label>
            </div>
            <label className="jf-label">Remarks<textarea className="jf-input" rows={3} value={material.remarks} onChange={(e) => setMaterial((p) => ({ ...p, remarks: e.target.value }))} /></label>
            <label className="jf-file-btn"><Camera size={20} /> Take Photo<input key={materialKey} type="file" accept="image/*" capture="environment" onChange={(e) => setMaterial((p) => ({ ...p, photo: e.target.files?.[0] || null }))} /></label>
            <div className="jf-note">{material.photo?.name || 'No photo selected'}</div>
            <div style={{ marginTop: 10 }}>
                <div className="jf-small-title" style={{ fontSize: 16, marginBottom: 6 }}>Recent Material Requests</div>
                <div className="jf-recent-list jf-recent-list-two">
                    {recentMaterialRequests.length === 0 ? (
                        <div className="jf-note">No recent material requests yet.</div>
                    ) : recentMaterialRequests.map((row) => (
                        <div key={row.id} className="jf-recent-card">
                            {row.photo_path ? (
                                <button
                                    type="button"
                                    onClick={() => openPhotoPreview(
                                        row.photo_path,
                                        row.material_name || 'Material Photo',
                                        `Qty: ${row.quantity || '-'} ${row.unit || ''}`.trim()
                                    )}
                                    style={{ display: 'block', marginBottom: 6, border: 'none', background: 'transparent', padding: 0, width: '100%', cursor: 'pointer' }}
                                >
                                    <img
                                        src={`/storage/${row.photo_path}`}
                                        alt={row.material_name || 'Material photo'}
                                        style={{ width: '100%', maxHeight: 130, objectFit: 'cover', borderRadius: 6, border: '1px solid #d4cec0' }}
                                    />
                                </button>
                            ) : null}
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                <div style={{ fontWeight: 700 }}>{row.material_name || 'Material not specified'}</div>
                                <span className="jf-recent-chip">{humanize(row.status)}</span>
                            </div>
                            <div className="jf-note">Qty: {row.quantity || '-'} {row.unit || ''}</div>
                            <div className="jf-note">Remarks: {row.remarks || '-'}</div>
                            <div className="jf-note">Submitted: {row.created_at || '-'}</div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );

    const weeklyContent = (
        <>
            <label className="jf-label" style={{ maxWidth: 260 }}>
                Week Start
                <DatePickerInput
                    value={weekStart}
                    onChange={(value) => {
                        const next = value || '';
                        if (!next) {
                            setWeekStart('');
                            return;
                        }
                        if (!isMondayDate(next)) {
                            toast.error('Please select a Monday only.');
                            return;
                        }
                        setWeekStart(next);
                    }}
                    style={jfDateInputStyle}
                />
            </label>
            {weeklyLocked ? <div className="jf-note" style={{ marginBottom: 8, fontWeight: 700 }}>Past submitted week is locked and cannot be edited.</div> : null}
            <div className="jf-table-wrap" style={{ marginTop: 10 }}>
                <table className="jf-table" style={{ minWidth: 980 }}>
                    <thead><tr><th>SCOPE OF WORKS</th><th>% COMPLETE</th><th>SCOPE PHOTOS</th><th>ACTION</th></tr></thead>
                    <tbody>
                        {weeklyRows.map((row, i) => (
                            <tr key={row.row_key || `${row.scope_of_work || 'scope'}-${i}`}>
                                <td>
                                    {row.is_manual ? (
                                        <input
                                            disabled={weeklyLocked}
                                            className="jf-input"
                                            placeholder="Enter other scope of work"
                                            value={row.scope_of_work}
                                            onChange={(e) => setCurrentWeeklyRows((prev) => prev.map((r, idx) => idx === i ? { ...r, scope_of_work: e.target.value } : r))}
                                        />
                                    ) : row.scope_of_work}
                                </td>
                                <td><input disabled={weeklyLocked} className="jf-input" type="number" min="0" max="100" value={row.percent_completed} onChange={(e) => setCurrentWeeklyRows((prev) => prev.map((r, idx) => idx === i ? { ...r, percent_completed: e.target.value } : r))} /></td>
                                <td>
                                    <div style={{ display: 'grid', gap: 6, minWidth: 240 }}>
                                        {(() => {
                                            const scopeKey = String(row.scope_of_work || '').trim().toLowerCase();
                                            const existingScopePhotos = scopeKey !== '' && Array.isArray(weeklyScopePhotoMap[scopeKey])
                                                ? weeklyScopePhotoMap[scopeKey]
                                                : [];
                                            const selectedWeeklyPhotos = Array.isArray(row.weekly_photos) ? row.weekly_photos : [];

                                            return (
                                                <>
                                                    {existingScopePhotos.length === 0 ? (
                                                        <div className="jf-note">No existing scope photos.</div>
                                                    ) : (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6 }}>
                                                            {existingScopePhotos.map((photo) => (
                                                                <button
                                                                    key={photo.id}
                                                                    type="button"
                                                                    onClick={() => openPhotoPreview(
                                                                        photo.photo_path,
                                                                        row.scope_of_work || photo.caption || 'Scope Photo',
                                                                        photo.created_at || ''
                                                                    )}
                                                                    style={{ display: 'block', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                                                                >
                                                                    <img
                                                                        src={`/storage/${photo.photo_path}`}
                                                                        alt={photo.caption || 'Scope photo'}
                                                                        style={{ width: '100%', height: 58, objectFit: 'cover', borderRadius: 6, border: '1px solid #d4cec0' }}
                                                                    />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {weeklyLocked ? null : (
                                                        <>
                                                            <input
                                                                className="jf-input"
                                                                type="file"
                                                                accept="image/*"
                                                                multiple
                                                                onChange={(e) => {
                                                                    const files = Array.from(e.target.files || []);
                                                                    setCurrentWeeklyRows((prev) => prev.map((r, idx) => idx === i ? { ...r, weekly_photos: files } : r));
                                                                }}
                                                            />
                                                            <input
                                                                className="jf-input"
                                                                placeholder="Caption for new photos (optional)"
                                                                value={row.weekly_photo_caption || ''}
                                                                onChange={(e) => setCurrentWeeklyRows((prev) => prev.map((r, idx) => idx === i ? { ...r, weekly_photo_caption: e.target.value } : r))}
                                                            />
                                                            {selectedWeeklyPhotos.length > 0 ? (
                                                                <div className="jf-note">{selectedWeeklyPhotos.length} new photo(s) selected</div>
                                                            ) : null}
                                                        </>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    {row.is_manual ? (
                                        <button
                                            type="button"
                                            className="jf-btn jf-btn-light"
                                            style={{ padding: '6px 10px', fontSize: 12 }}
                                            disabled={weeklyLocked}
                                            onClick={() => {
                                                const removedScope = String(row.scope_of_work || '').trim();
                                                setCurrentWeeklyRows((prev) => prev.filter((_, idx) => idx !== i));
                                                if (removedScope !== '') {
                                                    setWeeklyRemovedScopesByWeek((prev) => {
                                                        const existing = Array.isArray(prev[weeklyWeekKey]) ? prev[weeklyWeekKey] : [];
                                                        const existingKeys = new Set(existing.map((scope) => String(scope || '').trim().toLowerCase()));
                                                        const removedKey = removedScope.toLowerCase();
                                                        if (existingKeys.has(removedKey)) {
                                                            return prev;
                                                        }
                                                        return {
                                                            ...prev,
                                                            [weeklyWeekKey]: [...existing, removedScope],
                                                        };
                                                    });
                                                }
                                            }}
                                        >
                                            Remove
                                        </button>
                                    ) : <span className="jf-note">Default</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="jf-actions">
                <button
                    type="button"
                    className="jf-btn jf-btn-light"
                    disabled={weeklyLocked}
                    onClick={() => setCurrentWeeklyRows((prev) => [...prev, { row_key: nextWeeklyRowKey(), scope_of_work: '', percent_completed: '', is_manual: true, weekly_photos: [], weekly_photo_caption: '' }])}
                >
                    <Plus size={15} /> Add Other Scope
                </button>
            </div>
        </>
    );

    const photosContent = (
        <div className="jf-photo-layout">
            <div>
                <label className="jf-file-btn jf-file-blue"><Camera size={20} /> TAKE PHOTO<input ref={photoInputRef} key={photoKey} type="file" accept="image/*" capture="environment" onChange={(e) => setPhotoForm((p) => ({ ...p, photo: e.target.files?.[0] || null }))} /></label>
                <div className="jf-note">{photoForm.photo?.name || 'No photo selected'}</div>
                <label className="jf-label" style={{ marginTop: 10 }}>CHOOSE CATEGORY
                    <select className="jf-input" value={photoForm.category} onChange={(e) => setPhotoForm((p) => ({ ...p, category: e.target.value }))}>
                        <option value="">Select category</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </label>
                <label className="jf-label" style={{ marginTop: 10 }}>ADD DESCRIPTION
                    <input className="jf-input" placeholder="Enter description (optional)" value={photoForm.description} onChange={(e) => setPhotoForm((p) => ({ ...p, description: e.target.value }))} />
                </label>
            </div>
            <div>
                <div className="jf-small-title">Recent Photos</div>
                <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                    {photos.length === 0 ? <div className="jf-note">No uploaded photos yet.</div> : photos.map((photo) => (
                        <div key={photo.id} className="jf-photo-item">
                            <button
                                type="button"
                                onClick={() => openPhotoPreview(photo.photo_path, photo.caption || 'Photo', photo.created_at || '')}
                                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', width: 90, justifySelf: 'start' }}
                            >
                                <img src={`/storage/${photo.photo_path}`} alt={photo.caption || 'Photo'} />
                            </button>
                            <div>
                                <div style={{ fontWeight: 700 }}>{photo.caption || 'No description'}</div>
                                <div className="jf-note">{photo.created_at || '-'}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <button type="button" className="jf-btn jf-btn-blue" onClick={() => photoInputRef.current?.click()}>ADD PHOTO</button>
            </div>
        </div>
    );

    const issueContent = (
        <>
            <label className="jf-label">Issue Title<input className="jf-input" value={issue.issue_title} onChange={(e) => setIssue((p) => ({ ...p, issue_title: e.target.value }))} /></label>
            <label className="jf-label">Description<textarea className="jf-input" rows={4} value={issue.description} onChange={(e) => setIssue((p) => ({ ...p, description: e.target.value }))} /></label>
            <label className="jf-file-btn"><Camera size={20} /> Take Photo<input key={issueKey} type="file" accept="image/*" capture="environment" onChange={(e) => setIssue((p) => ({ ...p, photo: e.target.files?.[0] || null }))} /></label>
            <div className="jf-note">{issue.photo?.name || 'No photo selected'}</div>
            <div className="jf-radio-row">
                {['low', 'normal', 'high'].map((v) => (
                    <label key={v}><input type="radio" name="urgency" value={v} checked={issue.urgency === v} onChange={(e) => setIssue((p) => ({ ...p, urgency: e.target.value }))} /> {v[0].toUpperCase() + v.slice(1)}</label>
                ))}
            </div>
            <div style={{ marginTop: 10 }}>
                <div className="jf-small-title" style={{ fontSize: 16, marginBottom: 6 }}>Recent Issue Reports</div>
                <div className="jf-recent-list jf-recent-list-two">
                    {recentIssueReports.length === 0 ? (
                        <div className="jf-note">No recent issue reports yet.</div>
                    ) : recentIssueReports.map((row) => (
                        <div key={row.id} className="jf-recent-card">
                            {row.photo_path ? (
                                <button
                                    type="button"
                                    onClick={() => openPhotoPreview(
                                        row.photo_path,
                                        row.issue_title || 'Issue Photo',
                                        `Severity: ${humanize(row.severity)}`
                                    )}
                                    style={{ display: 'block', marginBottom: 6, border: 'none', background: 'transparent', padding: 0, width: '100%', cursor: 'pointer' }}
                                >
                                    <img
                                        src={`/storage/${row.photo_path}`}
                                        alt={row.issue_title || 'Issue photo'}
                                        style={{ width: '100%', maxHeight: 130, objectFit: 'cover', borderRadius: 6, border: '1px solid #d4cec0' }}
                                    />
                                </button>
                            ) : null}
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                <div style={{ fontWeight: 700 }}>{row.issue_title || 'Issue not specified'}</div>
                                <span className="jf-recent-chip">{humanize(row.status)}</span>
                            </div>
                            <div className="jf-note">Severity: {humanize(row.severity)}</div>
                            <div className="jf-note" style={{ whiteSpace: 'pre-wrap' }}>{row.description || '-'}</div>
                            <div className="jf-note">Submitted: {row.created_at || '-'}</div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );

    const contentByKey = {
        attendance: attendanceContent,
        delivery: deliveryContent,
        materials: materialContent,
        weekly: weeklyContent,
        photos: photosContent,
        issues: issueContent,
    };

    return (
        <>
            <Head title="Foreman Jotform" />
            <div className="jf-page">
                <style>{`
                    .jf-page{min-height:100vh;background:#e8e3d6;color:#1f2937;font-family:'DM Sans',sans-serif}
                    .jf-top{height:24px;background:#373850}
                    .jf-wrap{max-width:1080px;margin:0 auto;padding:16px 14px 28px}
                    .jf-meta{border:1px solid #c9c2b2;background:#f2eee6;border-radius:12px;padding:12px 14px;display:grid;gap:4px;font-size:13px}
                    .jf-acc{width:100%;margin:12px 0 0;border:2px solid #bcb4a2;border-radius:14px;background:#ece7db;overflow:hidden}
                    .jf-acc-head{width:100%;border:none;background:#ece7db;min-height:78px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;cursor:pointer}
                    .jf-acc-title{font-size:24px;font-weight:700;display:flex;align-items:center;gap:10px}
                    .jf-arrow{transition:transform .2s ease}
                    .jf-arrow.open{transform:rotate(180deg)}
                    .jf-acc-body{display:grid;grid-template-rows:0fr;overflow:hidden;transition:grid-template-rows .12s linear,padding .12s linear;background:#f5f3ed;padding:0 14px}
                    .jf-acc-body.open{grid-template-rows:1fr;padding:14px}
                    .jf-acc-body-inner{overflow:hidden}
                    .jf-input{width:100%;box-sizing:border-box;border:1px solid #cfd3db;border-radius:8px;background:#fff;padding:9px 10px;font-size:14px;color:#1f2937}
                    .jf-label{display:grid;gap:6px;font-size:14px;font-weight:700}
                    .jf-table-wrap{width:100%;overflow:auto;border:1px solid #d4cec0;border-radius:10px;background:#fff}
                    .jf-table{width:100%;border-collapse:collapse;min-width:920px}
                    .jf-table th,.jf-table td{border:1px solid #e4ddcf;padding:6px;font-size:13px}
                    .jf-table th{background:#efebe3;font-weight:800;text-align:center}
                    .jf-actions{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
                    .jf-btn{border:none;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px}
                    .jf-btn:disabled{opacity:.7;cursor:not-allowed}
                    .jf-btn-blue{background:#3678d7;color:#fff}
                    .jf-btn-light{background:#ece7db;color:#1f2937;border:1px solid #c7bfae}
                    .jf-file-btn{border:1px solid #2f4154;background:#3c4f62;color:#fff;border-radius:8px;min-height:48px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;cursor:pointer;font-size:16px;font-weight:800;text-transform:uppercase}
                    .jf-file-btn input{display:none}
                    .jf-file-blue{background:#3378dd;border-color:#2e69c4}
                    .jf-note{font-size:12px;color:#586172}
                    .jf-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
                    .jf-toggle{flex:1;border:1px solid #b9c0cc;border-radius:8px;background:#fff;min-height:42px;font-size:16px;font-weight:700;cursor:pointer}
                    .jf-toggle.on{background:#3d3e45;color:#fff;border-color:#3d3e45}
                    .jf-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
                    .jf-photo-layout{display:grid;grid-template-columns:minmax(260px,360px) minmax(320px,1fr);gap:12px}
                    .jf-photo-item{display:grid;grid-template-columns:90px 1fr;gap:10px;align-items:center}
                    .jf-photo-item img{width:90px;height:70px;object-fit:cover;border-radius:8px;border:1px solid #d3ccbd}
                    .jf-small-title{font-size:18px;font-weight:700;margin-bottom:8px}
                    .jf-recent-list{display:grid;gap:8px;max-height:220px;overflow:auto;padding-right:2px}
                    .jf-recent-list-two{grid-template-columns:repeat(2,minmax(0,1fr))}
                    .jf-recent-card{border:1px solid #d9d2c2;background:#fff;border-radius:8px;padding:8px;display:grid;gap:2px}
                    .jf-recent-chip{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;background:#ece7db;border:1px solid #d1c7b4;color:#2f3a4a;text-transform:uppercase;white-space:nowrap}
                    .jf-radio-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;border:1px solid #cfd3db;border-radius:8px;background:#fff;padding:10px 8px}
                    .jf-radio-row label{display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:16px}
                    .jf-submit-wrap{max-width:760px;margin:14px auto 0;display:flex;justify-content:center}
                    .jf-submit-btn{width:100%;max-width:420px;border:none;border-radius:10px;min-height:50px;background:#2f70d4;color:#fff;font-size:18px;font-weight:800;cursor:pointer}
                    .jf-submit-btn:disabled{opacity:.7;cursor:not-allowed}
                    @media (max-width:980px){.jf-photo-layout{grid-template-columns:1fr}}
                    @media (max-width:760px){.jf-grid2{grid-template-columns:1fr}.jf-recent-list-two{grid-template-columns:1fr}.jf-acc-title{font-size:20px}.jf-acc-head{min-height:68px}.jf-submit-btn{font-size:16px;min-height:46px}}
                `}</style>
                <div className="jf-top" />
                <div className="jf-wrap">
                    <div className="jf-meta">
                        <div>Project: <strong>{submitToken.project_name}</strong></div>
                        <div>Foreman: <strong>{submitToken.foreman_name}</strong></div>
                        {submitToken.expires_at ? <div>Link expires at: {submitToken.expires_at}</div> : null}
                    </div>

                    {SECTIONS.map((section) => (
                        <div key={section.key} className="jf-acc">
                            <button type="button" className="jf-acc-head" onClick={() => toggle(section.key)}>
                                <span className="jf-acc-title"><Check size={24} /> {section.label}</span>
                                <ChevronDown className={`jf-arrow ${expanded[section.key] ? 'open' : ''}`} size={24} />
                            </button>
                            <div className={`jf-acc-body ${expanded[section.key] ? 'open' : ''}`}>
                                <div className="jf-acc-body-inner">{contentByKey[section.key]}</div>
                            </div>
                        </div>
                    ))}

                    <div className="jf-submit-wrap">
                        <button type="button" className="jf-submit-btn" disabled={submitting} onClick={submitAll}>{submitting ? 'Submitting...' : 'Submit All'}</button>
                    </div>
                </div>
            </div>
            <Modal
                open={!!previewPhoto}
                onClose={() => setPreviewPhoto(null)}
                title={previewPhoto?.title || 'Photo Preview'}
                maxWidth={980}
            >
                {previewPhoto ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <img
                            src={previewPhoto.src}
                            alt={previewPhoto.title || 'Photo preview'}
                            style={{
                                width: '100%',
                                maxHeight: '72vh',
                                objectFit: 'contain',
                                borderRadius: 10,
                                border: '1px solid #d4cec0',
                                background: '#fff',
                            }}
                        />
                        {previewPhoto.meta ? (
                            <div className="jf-note" style={{ fontSize: 13 }}>{previewPhoto.meta}</div>
                        ) : null}
                        <a
                            href={previewPhoto.src}
                            target="_blank"
                            rel="noreferrer"
                            className="jf-btn jf-btn-light"
                            style={{ width: 'fit-content', textDecoration: 'none' }}
                        >
                            Open in new tab
                        </a>
                    </div>
                ) : null}
            </Modal>
        </>
    );
}
