import { useEffect, useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import { ChevronsLeft, ChevronsRight, Info } from 'lucide-react';
import { useLayoutTitle } from '../../../Components/Layout';
import ActionButton from '../../../Components/ActionButton';
import Modal from '../../../Components/Modal';
import SubmissionComments from '../../../Components/SubmissionComments';
import OptimizedImage from '../../../Components/OptimizedImage';
import {
    ProgressBar,
    cardStyle,
    initialsOf,
    innerCardStyle,
    innerTabStyle,
    isPmRole,
    mockupTableCellStyle,
    mockupTableHeadStyle,
    photosForScopeWeek,
    pillStyle,
    sameProject,
    statusStyle,
    varianceStyle,
} from '../../../Components/AccomplishmentWidgets';
import { formatYmdHmAmPm } from '../../../Utils/dateTimeFormat';

const navButtonStyle = (enabled) => ({
    border: '1px solid var(--border-color)',
    background: 'var(--button-bg)',
    color: 'var(--text-main)',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 12,
    opacity: enabled ? 1 : 0.55,
});

const DETAIL_VIEW_HASHES = {
    Overview: '#overview',
    'Work Items': '#work-items',
    'PM Submissions': '#pm-submissions',
    'Foreman Submissions': '#foreman-submissions',
    'Progress Photos': '#progress-photos',
    Reports: '#reports',
};

const detailViewFromHash = () => {
    if (typeof window === 'undefined') return 'Overview';
    const hash = String(window.location.hash || '').toLowerCase();
    const found = Object.entries(DETAIL_VIEW_HASHES).find(([, value]) => value === hash);
    return found ? found[0] : 'Overview';
};

const detailViews = Object.keys(DETAIL_VIEW_HASHES);

export default function HeadAdminWeeklyAccomplishmentShow({
    project = {},
    comparison = null,
    scopeBreakdown = [],
    recentPmSubmission = null,
    recentForemanSubmission = null,
    rows = [],
    weeklyScopePhotoMap = {},
    workInfoMap = {},
}) {
    useLayoutTitle('Accomplishments');

    const [detailView, setDetailView] = useState(() => detailViewFromHash());

    const switchDetailView = (view) => {
        setDetailView(view);
        if (typeof window !== 'undefined' && DETAIL_VIEW_HASHES[view]) {
            window.history.replaceState(null, '', DETAIL_VIEW_HASHES[view]);
        }
    };

    useEffect(() => {
        const onHashChange = () => setDetailView(detailViewFromHash());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
    const [detailTab, setDetailTab] = useState('Details');
    const [showAllPhotos, setShowAllPhotos] = useState(false);
    const [sidebarMaximized, setSidebarMaximized] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => {
        setMapLoaded(false);
    }, [selectedSubmissionId]);
    const [photoPreview, setPhotoPreview] = useState(null);

    const safeRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
    const safeBreakdown = useMemo(() => (Array.isArray(scopeBreakdown) ? scopeBreakdown : []), [scopeBreakdown]);

    const pmRows = useMemo(() => safeRows.filter((row) => isPmRole(row?.submitted_by_role)), [safeRows]);
    const foremanRows = useMemo(() => safeRows.filter((row) => !isPmRole(row?.submitted_by_role)), [safeRows]);

    const allPhotos = useMemo(
        () => Object.values(weeklyScopePhotoMap ?? {}).flat().filter(Boolean),
        [weeklyScopePhotoMap],
    );

    const selectedSubmission = useMemo(() => {
        if (selectedSubmissionId === null || selectedSubmissionId === undefined) return null;
        return safeRows.find((row) => String(row?.id) === String(selectedSubmissionId)) ?? null;
    }, [safeRows, selectedSubmissionId]);

    const workInfoFor = (projectId, weekStart) => {
        const direct = workInfoMap?.[`${projectId}|${weekStart}`];
        if (direct) return direct;
        const fallback = Object.values(workInfoMap ?? {}).find(
            (entry) => Number(entry?.project_id) === Number(projectId),
        );
        return fallback ?? null;
    };

    const submissionWorkInfo = useMemo(() => {
        if (!selectedSubmission) return null;
        return workInfoFor(project?.id, selectedSubmission.week_start);
    }, [selectedSubmission]); // eslint-disable-line react-hooks/exhaustive-deps

    const submissionPhotos = useMemo(() => {
        if (!selectedSubmission) return [];
        return photosForScopeWeek(weeklyScopePhotoMap, selectedSubmission?.scope_of_work, selectedSubmission?.week_start, project?.id ?? null);
    }, [selectedSubmission, weeklyScopePhotoMap, project]);

    const detailWorkInfo = useMemo(
        () => workInfoFor(project?.id, comparison?.week_start),
        [project, comparison], // eslint-disable-line react-hooks/exhaustive-deps
    );

    const openSubmission = (row) => {
        setDetailTab('Details');
        setShowAllPhotos(false);
        setSidebarMaximized(false);
        setSelectedSubmissionId(row?.id ?? null);
    };

    // Instant close (no exit animation): unmounts the sidebar immediately.
    const closeSidebar = () => {
        setSelectedSubmissionId(null);
    };

    // Display name of a photo's scope: caption tag first (proper casing),
    // then the breakdown list, then the raw map key as a last resort.
    const photoScopeName = (photo) => {
        const fromCaption = String(photo?.caption || '').match(/scope:\s*([^|]+)/i)?.[1]?.trim();
        if (fromCaption) return fromCaption;
        const key = Object.keys(weeklyScopePhotoMap ?? {}).find((mapKey) =>
            (weeklyScopePhotoMap[mapKey] || []).some((item) => String(item?.id) === String(photo?.id)),
        );
        if (!key) return '';
        const breakdownMatch = safeBreakdown.find((item) => String(item?.scope ?? '').toLowerCase() === key);
        return breakdownMatch?.scope || key;
    };

    const openPhotoPreview = (photo) => {
        const scopeKey = String(selectedSubmission?.scope_of_work ?? '').trim().toLowerCase();
        const projectId = project?.id ?? null;
        const list = scopeKey && Array.isArray(weeklyScopePhotoMap[scopeKey])
            ? weeklyScopePhotoMap[scopeKey]
            : [];
        const clickedIndex = list.findIndex((item) => String(item?.id) === String(photo?.id));
        setPhotoPreview({
            scopeKey,
            scopeLabel: selectedSubmission?.scope_of_work || '',
            projectId,
            index: clickedIndex >= 0 ? clickedIndex : 0,
        });
    };

    const previewScopeKey = String(photoPreview?.scopeKey ?? '');
    const previewPhotos = useMemo(() => {
        if (!previewScopeKey) return [];
        const list = weeklyScopePhotoMap?.[previewScopeKey];
        if (!Array.isArray(list)) return [];
        return list.filter((photo) => sameProject(photo, photoPreview?.projectId ?? project?.id ?? null));
    }, [previewScopeKey, weeklyScopePhotoMap, photoPreview, project]);
    const previewIndex = Math.min(
        Math.max(0, Number(photoPreview?.index ?? 0) || 0),
        Math.max(0, previewPhotos.length - 1),
    );
    const previewPhoto = previewPhotos[previewIndex] || null;

    useEffect(() => {
        if (!selectedSubmission) return;

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (previewPhoto) return;
                e.preventDefault();
                closeSidebar();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedSubmission, previewPhoto]);

    const donutPercent = Math.min(100, Math.max(0, Number(comparison?.overall_progress ?? comparison?.pm_progress ?? project?.overall_progress ?? 0)));
    const donutRadius = 44;
    const donutCircumference = 2 * Math.PI * donutRadius;

    // Entrance animation on first visit: one eased driver counts the donut
    // arc, donut number, and both comparison bars from 0 to their targets
    // over ~1s (jumps straight to final values for reduced motion).
    const [progressAnimated, setProgressAnimated] = useState({ overall: 0, pm: null, foreman: null });

    useEffect(() => {
        const pmTarget = comparison?.pm_progress ?? null;
        const foremanTarget = comparison?.foreman_progress ?? null;
        if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setProgressAnimated({ overall: donutPercent, pm: pmTarget, foreman: foremanTarget });
            return;
        }
        const round2 = (value) => Math.round(Number(value) * 100) / 100;
        let raf = 0;
        const start = performance.now();
        const duration = 1000;
        const tick = (now) => {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            setProgressAnimated({
                overall: round2(eased * donutPercent),
                pm: pmTarget === null || pmTarget === undefined ? null : round2(eased * pmTarget),
                foreman: foremanTarget === null || foremanTarget === undefined ? null : round2(eased * foremanTarget),
            });
            if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [donutPercent, comparison?.pm_progress, comparison?.foreman_progress]);

    // Work Items breakdown bars fill from zero the first time that tab opens.
    const [breakdownBarsLive, setBreakdownBarsLive] = useState(false);

    useEffect(() => {
        if (detailView !== 'Work Items') return;
        if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setBreakdownBarsLive(true);
            return;
        }
        const frame = requestAnimationFrame(() => requestAnimationFrame(() => setBreakdownBarsLive(true)));
        return () => cancelAnimationFrame(frame);
    }, [detailView]);

    const animatedBreakdownBar = (value) => (value === null || value === undefined ? null : (breakdownBarsLive ? value : 0));

    const viewRows = detailView === 'PM Submissions' ? pmRows : detailView === 'Foreman Submissions' ? foremanRows : [];

    // Shared by the visible breakdown (Overview/Work Items tabs) and the
    // always-rendered print copy, so Export Report never prints empty
    // regardless of which tab is active.
    const renderBreakdownTable = () => (
        <>
            <div data-testid="breakdown-title" style={{ fontWeight: 800, color: 'var(--ac-text, #0f172a)', marginBottom: 8, fontSize: 13 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Work Item Breakdown
                    <span style={{ display: 'inline-flex', color: 'var(--ac-faint, #94a3b8)' }}>
                        <Info size={12} strokeWidth={2.5} />
                    </span>
                </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table className="accomp-hover-table" style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['#', 'Scope of Work', 'PM Progress', 'Foreman Progress', 'Variance', 'Status'].map((header) => (
                                <th key={header} style={mockupTableHeadStyle}>
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {safeBreakdown.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--ac-muted, #64748b)' }}>
                                    No scope breakdown for this project yet.
                                </td>
                            </tr>
                        ) : safeBreakdown.map((item, index) => (
                            <tr key={item.scope} style={{ borderBottom: '1px solid var(--ac-border-soft, #f1f5f9)' }}>
                                <td style={{ ...mockupTableCellStyle, color: 'var(--ac-muted, #64748b)' }}>{index + 1}</td>
                                <td style={{ ...mockupTableCellStyle, fontWeight: 500, color: 'var(--ac-text, #0f172a)' }}>{item.scope}</td>
                                                <td style={{ ...mockupTableCellStyle, minWidth: 140 }}>
                                                    <ProgressBar value={animatedBreakdownBar(item.pm)} color="#2563eb" />
                                                </td>
                                                <td style={{ ...mockupTableCellStyle, minWidth: 140 }}>
                                                    <ProgressBar value={animatedBreakdownBar(item.foreman)} color="#16a34a" />
                                                </td>
                                <td style={mockupTableCellStyle}>
                                    {item.variance === null || item.variance === undefined ? (
                                        <span style={{ ...pillStyle, background: 'var(--ac-border-soft, #f1f5f9)', color: 'var(--ac-muted, #64748b)' }}>—</span>
                                    ) : (
                                        <span style={{ ...pillStyle, ...varianceStyle(item.variance) }}>{item.variance}%</span>
                                    )}
                                </td>
                                <td style={mockupTableCellStyle}>
                                    <span className="accomplishment-status-pill" style={{ ...pillStyle, ...statusStyle(item.status) }}>{item.status}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );

    return (
        <>
            <Head title={`${project?.name || 'Project'} — Accomplishments`} />
            <style>{`
                @keyframes accomp-slide-in-right {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                @keyframes accomp-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                :root {
                    --ac-bg: #ffffff;
                    --ac-bg-soft: #f8fafc;
                    --ac-page: #f4f6fb;
                    --ac-text: #0f172a;
                    --ac-text-2: #334155;
                    --ac-muted: #64748b;
                    --ac-border: #e8edf3;
                    --ac-border-soft: #f1f5f9;
                    --ac-track: #e2e8f0;
                    --ac-rowhover: #f1f5f9;
                }
                html[data-theme="dark"] {
                    --ac-bg: var(--surface-1, #161b22);
                    --ac-bg-soft: var(--surface-2, #1c2128);
                    --ac-page: var(--bg-page, #0d1117);
                    --ac-text: var(--text-main, #e6edf3);
                    --ac-text-2: var(--text-main, #e6edf3);
                    --ac-muted: var(--text-muted, #8b949e);
                    --ac-border: var(--border-color, #30363d);
                    --ac-border-soft: var(--row-divider, #21262d);
                    --ac-track: var(--border-color, #30363d);
                    --ac-rowhover: var(--surface-2, #1c2128);
                }
                @keyframes accomp-skeleton-pulse {
                    0% { background-position: 100% 0; }
                    100% { background-position: -100% 0; }
                }
                .accomp-photo-label { background: linear-gradient(transparent, rgba(15,23,42,0.75)); }
                html[data-theme="dark"] .accomp-photo-label { background: #000; }
                .accomp-hover-table tbody tr { transition: background-color 0.15s ease; }
                .accomp-hover-table tbody tr:hover { background-color: var(--ac-rowhover, #f1f5f9); }
                .accomplishment-print-only { display: none; }
                @media print {
                    body * { visibility: hidden; }
                    #accomplishment-report-area, #accomplishment-report-area * { visibility: visible; }
                    #accomplishment-report-area { position: absolute; left: 0; top: 0; width: 100%; }
                    #accomplishment-report-area {
                        --ac-bg: #ffffff;
                        --ac-bg-soft: #f8fafc;
                        --ac-text: #0f172a;
                        --ac-text-2: #334155;
                        --ac-muted: #475569;
                        --ac-border: #e8edf3;
                        --ac-border-soft: #f1f5f9;
                        --ac-track: #e2e8f0;
                    }
                    .accomplishment-print-only { display: block; }
                    .accomplishment-status-pill { background: none !important; border: none !important; color: #000 !important; padding-left: 0 !important; padding-right: 0 !important; }
                }
            `}</style>
            <div style={{ display: 'grid', gap: 16, background: 'var(--ac-page, #f4f6fb)', margin: -16, padding: 16 }}>
                <div style={cardStyle} data-testid="project-detail">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 999, background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ac-text, #0f172a)' }}>Project Detail View</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ac-muted, #64748b)', marginBottom: 10 }}>
                        <ActionButton href="/weekly-accomplishments" variant="neutral" style={{ padding: '2px 8px', fontSize: 12 }}>
                            ← Accomplishments
                        </ActionButton>
                        <span style={{ margin: '0 6px' }}>›</span> {project?.name || '-'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span style={{ width: 44, height: 44, borderRadius: 10, background: '#e0e7ff', color: '#3730a3', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                                {initialsOf(project?.name)}
                            </span>
                            <span>
                                <span style={{ display: 'block', fontSize: 17, fontWeight: 800, color: 'var(--ac-text, #0f172a)' }}>{project?.name || '-'}</span>
                                {project?.location ? (
                                    <span style={{ display: 'block', fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>⌖ {project.location}</span>
                                ) : null}
                            </span>
                        </div>
                        <ActionButton type="button" variant="view" onClick={() => window.print()}>
                            ⤓ Export Report
                        </ActionButton>
                    </div>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--ac-border, #e8edf3)', marginBottom: 12, overflowX: 'auto' }}>
                        {detailViews.map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => switchDetailView(tab)}
                                style={innerTabStyle(detailView === tab)}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {(detailView === 'Overview') && (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" style={{ marginBottom: 12 }}>
                                    <div style={{ ...innerCardStyle, textAlign: 'center' }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ac-text, #0f172a)', marginBottom: 8, textAlign: 'left' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                Overall Progress
                                                <span style={{ display: 'inline-flex', color: 'var(--ac-faint, #94a3b8)' }}>
                                                    <Info size={12} strokeWidth={2.5} />
                                                </span>
                                            </span>
                                        </div>
                                        <svg width="132" height="132" viewBox="0 0 120 120" role="img" aria-label={`Overall progress ${donutPercent}%`}>
                                            <circle cx="60" cy="60" r={donutRadius} fill="none" stroke="var(--ac-track, #e2e8f0)" strokeWidth="12" />
                                            <circle
                                                cx="60"
                                                cy="60"
                                                r={donutRadius}
                                                fill="none"
                                                stroke="#2563eb"
                                                strokeWidth="12"
                                                strokeLinecap="round"
                                                strokeDasharray={donutCircumference}
                                                strokeDashoffset={donutCircumference - (donutCircumference * progressAnimated.overall) / 100}
                                                transform="rotate(-90 60 60)"
                                            />
                                            <text x="60" y="67" textAnchor="middle" style={{ fontSize: 21, fontWeight: 800, fill: 'var(--ac-text, #0f172a)' }}>
                                                {progressAnimated.overall}%
                                            </text>
                                        </svg>
                                        {project?.target ? (
                                            <div style={{ fontSize: 12, color: 'var(--ac-muted, #64748b)', marginTop: 6 }}>
                                                Target Completion<br />{project.target}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div style={innerCardStyle}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ac-text, #0f172a)', marginBottom: 10 }}>Progress Comparison</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 10px', alignItems: 'center', fontSize: 12, color: 'var(--ac-text-2, #334155)' }}>
                                            <span>Project Manager</span>
                                            {progressAnimated.pm === null || progressAnimated.pm === undefined ? (
                                                <span style={{ color: '#94a3b8' }}>No PM submission yet.</span>
                                            ) : (
                                                <ProgressBar value={progressAnimated.pm} color="#2563eb" />
                                            )}
                                            <span>Foreman</span>
                                            {progressAnimated.foreman === null || progressAnimated.foreman === undefined ? (
                                                <span style={{ color: '#94a3b8' }}>No foreman submission yet.</span>
                                            ) : (
                                                <ProgressBar value={progressAnimated.foreman} color="#16a34a" />
                                            )}
                                        </div>
                                        {comparison?.variance !== null && comparison?.variance !== undefined && (
                                            <div style={{ marginTop: 12, fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 10, color: '#92400e' }}>
                                                <div style={{ fontWeight: 700 }}>⚠ {Number(comparison.variance ?? 0)}% variance - {comparison.status}</div>
                                                <div style={{ marginTop: 2 }}>PM progress is higher than Foreman progress by {Number(comparison.variance ?? 0)}%. Please review recent submissions.</div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={innerCardStyle}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ac-text, #0f172a)', marginBottom: 10 }}>Recent Submissions</div>
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            <div style={{ border: '1px solid var(--ac-border, #e8edf3)', borderRadius: 8, padding: 10 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ac-text, #0f172a)' }}>▦ Latest PM Submission</div>
                                                <div style={{ fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>
                                                    {recentPmSubmission ? formatYmdHmAmPm(recentPmSubmission.submitted_at || recentPmSubmission.created_at) : 'No PM submission yet'}
                                                </div>
                                                {recentPmSubmission && (
                                                    <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
                                                        ✓ {recentPmSubmission.scope_of_work || '-'} - {recentPmSubmission.percent_completed ?? '-'}%
                                                    </div>
                                                )}
                                                {detailWorkInfo && (
                                                    <div style={{ fontSize: 12, color: 'var(--ac-muted, #475569)' }}>✓ {detailWorkInfo.manpower} workers</div>
                                                )}
                                                {recentPmSubmission ? (
                                                    <button type="button" onClick={() => openSubmission(recentPmSubmission)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
                                                        View Details →
                                                    </button>
                                                ) : null}
                                            </div>
                                            <div style={{ border: '1px solid var(--ac-border, #e8edf3)', borderRadius: 8, padding: 10 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ac-text, #0f172a)' }}>▦ Latest Foreman Submission</div>
                                                <div style={{ fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>
                                                    {recentForemanSubmission ? formatYmdHmAmPm(recentForemanSubmission.submitted_at || recentForemanSubmission.created_at) : 'No foreman submission yet'}
                                                </div>
                                                {recentForemanSubmission && (
                                                    <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
                                                        ✓ {recentForemanSubmission.scope_of_work || '-'} - {recentForemanSubmission.percent_completed ?? '-'}%
                                                    </div>
                                                )}
                                                {recentForemanSubmission ? (
                                                    <button type="button" onClick={() => openSubmission(recentForemanSubmission)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
                                                        View Details →
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                        </>
                    )}

                    {detailView === 'Work Items' && renderBreakdownTable()}

                    {(detailView === 'PM Submissions' || detailView === 'Foreman Submissions') && (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="accomp-hover-table" style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Submitted', 'Submitted By', 'Scope of Work', '%', 'Actions'].map((header) => (
                                            <th key={header} style={mockupTableHeadStyle}>{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--ac-muted, #64748b)' }}>
                                                No {detailView === 'PM Submissions' ? 'PM' : 'foreman'} submissions yet.
                                            </td>
                                        </tr>
                                    ) : viewRows.map((row) => (
                                        <tr key={row.id} style={{ borderBottom: '1px solid var(--ac-border-soft, #f1f5f9)' }}>
                                            <td style={{ ...mockupTableCellStyle, fontSize: 12, color: 'var(--ac-text-2, #334155)', whiteSpace: 'nowrap' }}>
                                                {formatYmdHmAmPm(row.submitted_at || row.created_at)}
                                            </td>
                                            <td style={mockupTableCellStyle}>
                                                <div style={{ fontWeight: 600, color: 'var(--ac-text, #0f172a)' }}>{row.submitted_by_name || '-'}</div>
                                                <div style={{ fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>{row.submitted_by_role || '-'}</div>
                                            </td>
                                            <td style={{ ...mockupTableCellStyle, fontWeight: 500 }}>{row.scope_of_work || '-'}</td>
                                            <td style={{ ...mockupTableCellStyle, fontWeight: 700 }}>{row.percent_completed ?? '-'}%</td>
                                            <td style={mockupTableCellStyle}>
                                                <ActionButton type="button" variant="neutral" onClick={() => openSubmission(row)} aria-label={`View ${row.scope_of_work || 'submission'} details`}>
                                                    •••
                                                </ActionButton>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {detailView === 'Progress Photos' && (
                        allPhotos.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--ac-muted, #64748b)' }}>No progress photos for this project yet.</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                                {allPhotos.slice(0, 24).map((photo) => {
                                    const scopeLabel = photoScopeName(photo);
                                    return (
                                    <button
                                        key={photo.id || photo.photo_path}
                                        type="button"
                                        onClick={() => {
                                            const scopeKey = String(photo.caption || '').match(/scope:\s*(.+)/i)?.[1]?.trim().toLowerCase()
                                                || Object.keys(weeklyScopePhotoMap).find((key) => (weeklyScopePhotoMap[key] || []).some((item) => String(item?.id) === String(photo?.id)))
                                                || '';
                                            setPhotoPreview({ scopeKey, scopeLabel: photo.caption || '', projectId: project?.id ?? null, index: 0 });
                                        }}
                                        style={{ position: 'relative', overflow: 'hidden', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', borderRadius: 8 }}
                                    >
                                        <OptimizedImage
                                            src={`/files/${photo.photo_path}`}
                                            alt={photo.caption || 'Progress photo'}
                                            style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--ac-border, #e8edf3)', display: 'block' }}
                                        />
                                        {scopeLabel ? (
                                            <span className="accomp-photo-label" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'left', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {scopeLabel}
                                            </span>
                                        ) : null}
                                    </button>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {detailView === 'Reports' && (
                        <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--ac-text-2, #334155)' }}>
                            <div><strong>{project?.name}</strong> — PM {comparison?.pm_progress ?? '-'}% vs Foreman {comparison?.foreman_progress ?? '-'}% (variance {comparison?.variance ?? '-'}%, {comparison?.status ?? '-'})</div>
                            <div>{safeBreakdown.length} work items tracked · {safeRows.length} submissions in scope.</div>
                            <div>
                                <ActionButton type="button" variant="view" onClick={() => window.print()}>
                                    ⤓ Export Report
                                </ActionButton>
                            </div>
                        </div>
                    )}

                    <div id="accomplishment-report-area" className="accomplishment-print-only">
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ac-text, #0f172a)' }}>{project?.name || 'Project'} — Accomplishment Report</div>
                            <div style={{ fontSize: 12, color: 'var(--ac-muted, #475569)' }}>
                                Overall {donutPercent}% · PM {comparison?.pm_progress ?? '—'}{comparison?.pm_progress !== null && comparison?.pm_progress !== undefined ? '%' : ''} · Foreman {comparison?.foreman_progress ?? '—'}{comparison?.foreman_progress !== null && comparison?.foreman_progress !== undefined ? '%' : ''} · Variance {comparison?.variance ?? '—'}{comparison?.variance !== null && comparison?.variance !== undefined ? '%' : ''} · {comparison?.status ?? ''} · Generated {new Date().toLocaleString()}
                            </div>
                        </div>
                        {renderBreakdownTable()}
                    </div>
                </div>
            </div>

            {selectedSubmission && (
                    <>
                        <div
                            onClick={() => closeSidebar()}
                            aria-hidden="true"
                            style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(15,23,42,0.45)',
                                zIndex: 1090,
                                animation: 'accomp-fade-in 0.18s ease-out',
                            }}
                        />
                        <aside
                            role="dialog"
                            aria-label="Submission details"
                            data-testid="submission-sidebar"
                            style={{
                                position: 'fixed',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                width: sidebarMaximized ? 'min(960px, 96vw)' : 'min(480px, 94vw)',
                                background: 'var(--ac-bg, #ffffff)',
                                zIndex: 1095,
                                boxShadow: '-12px 0 32px rgba(15,23,42,0.18)',
                                display: 'flex',
                                flexDirection: 'column',
                                animation: 'accomp-slide-in-right 0.25s ease-out',
                                transition: 'width 0.25s ease-out',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setSidebarMaximized((maximized) => !maximized)}
                                aria-label={sidebarMaximized ? 'Restore submission details size' : 'Maximize submission details'}
                                aria-expanded={sidebarMaximized}
                                title={sidebarMaximized ? 'Restore size' : 'Maximize'}
                                style={{
                                    position: 'absolute',
                                    left: -14,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 28,
                                    height: 64,
                                    borderRadius: '14px 0 0 14px',
                                    border: '1px solid var(--ac-border, #e8edf3)',
                                    borderRight: 'none',
                                    background: 'var(--ac-bg, #ffffff)',
                                    color: 'var(--ac-muted, #64748b)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '-6px 0 16px rgba(15,23,42,0.12)',
                                }}
                            >
                                {sidebarMaximized ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
                            </button>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 12px 0' }}>
                                <ActionButton type="button" onClick={() => closeSidebar()} aria-label="Close submission details">
                                    ✕
                                </ActionButton>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '2px 16px 16px' }}>
                {selectedSubmission && (
                    <div data-testid="submission-drawer" style={{ display: 'grid', gap: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ width: 22, height: 22, borderRadius: 999, background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>4</span>
                            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ac-text, #0f172a)' }}>Submission Details ({isPmRole(selectedSubmission.submitted_by_role) ? 'PM' : 'Foreman'})</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ac-text, #0f172a)' }}>Weekly Accomplishment</div>
                            <span style={{ ...pillStyle, background: isPmRole(selectedSubmission.submitted_by_role) ? '#dbeafe' : '#dcfce7', color: isPmRole(selectedSubmission.submitted_by_role) ? '#1d4ed8' : '#15803d' }}>
                                {isPmRole(selectedSubmission.submitted_by_role) ? 'PM Submission' : 'Foreman Submission'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{ width: 38, height: 38, borderRadius: 999, background: '#2563eb', color: '#fff', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                                    {initialsOf(selectedSubmission.submitted_by_name || selectedSubmission.foreman_name)}
                                </span>
                                <span>
                                    <span style={{ display: 'block', fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>Submitted by</span>
                                    <span style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--ac-text, #0f172a)' }}>
                                        {selectedSubmission.submitted_by_name || selectedSubmission.foreman_name || '-'}
                                    </span>
                                    <span style={{ display: 'block', fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>
                                        {selectedSubmission.submitted_by_role || 'Foreman'}
                                    </span>
                                </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>Date Submitted</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ac-text, #0f172a)' }}>
                                    🗓 {formatYmdHmAmPm(selectedSubmission.submitted_at || selectedSubmission.created_at)}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--ac-border, #e8edf3)', marginBottom: 12 }}>
                            {['Details', 'Photos', 'Location', 'Comments'].map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setDetailTab(tab)}
                                    style={innerTabStyle(detailTab === tab)}
                                >
                                    {tab === 'Photos' ? `Photos (${submissionPhotos.length})` : tab}
                                </button>
                            ))}
                        </div>
                        {detailTab === 'Details' && (
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--ac-text, #0f172a)', marginBottom: 8 }}>Work Information</div>
                                <div style={{ border: '1px solid var(--ac-border, #eef2f7)', borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px 12px', fontSize: 13 }}>
                                    <span style={{ color: 'var(--ac-muted, #64748b)' }}>Scope of Work</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{selectedSubmission.scope_of_work || '-'}</span>
                                    <span style={{ color: 'var(--ac-muted, #64748b)' }}>Accomplishment</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{selectedSubmission.percent_completed ?? '-'}%</span>
                                    <span style={{ color: 'var(--ac-muted, #64748b)' }}>Manpower</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{submissionWorkInfo ? `${submissionWorkInfo.manpower} workers` : '-'}</span>
                                    <span style={{ color: 'var(--ac-muted, #64748b)' }}>Equipment</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{submissionWorkInfo?.equipment?.slice(0, 3).join(', ') || '-'}</span>
                                    <span style={{ color: 'var(--ac-muted, #64748b)' }}>Materials Used</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{submissionWorkInfo?.materials_used || '-'}</span>
                                    <span style={{ color: 'var(--ac-muted, #64748b)' }}>Remarks</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{submissionWorkInfo?.remarks || '-'}</span>
                                </div>
                            </div>
                        )}
                        {detailTab === 'Photos' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--ac-text, #0f172a)' }}>Uploaded Photos</div>
                                    {submissionPhotos.length > 4 && (
                                        <button type="button" onClick={() => setShowAllPhotos((value) => !value)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                                            {showAllPhotos ? 'Show Less' : 'View All'}
                                        </button>
                                    )}
                                </div>
                                {submissionPhotos.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--ac-muted, #64748b)' }}>No photos uploaded yet.</div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                                        {(showAllPhotos ? submissionPhotos : submissionPhotos.slice(0, 4)).map((photo) => (
                                            <OptimizedImage
                                                key={photo.id || photo.photo_path}
                                                src={`/files/${photo.photo_path}`}
                                                alt={photo.caption || selectedSubmission.scope_of_work || 'Scope photo'}
                                                style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--ac-border, #e8edf3)' }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {detailTab === 'Location' && (
                            <div style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ac-text, #0f172a)' }}>Location:</div>
                                <div style={{ fontSize: 13, color: 'var(--ac-text, #0f172a)' }}>{project?.location || 'No location recorded for this project.'}</div>
                                {project?.location ? (
                                    <div style={{ position: 'relative' }}>
                                        {!mapLoaded && (
                                            <div style={{ position: 'absolute', inset: 0, borderRadius: 8, border: '1px solid var(--ac-border, #e8edf3)', background: 'linear-gradient(90deg, var(--ac-border-soft, #f1f5f9) 25%, var(--ac-track, #e2e8f0) 37%, var(--ac-border-soft, #f1f5f9) 63%)', backgroundSize: '300% 100%', animation: 'accomp-skeleton-pulse 1.3s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>
                                                Loading map…
                                            </div>
                                        )}
                                        <iframe
                                            title={`Map of ${project.location}`}
                                            src={`https://maps.google.com/maps?q=${encodeURIComponent(project.location)}&output=embed`}
                                            onLoad={() => setMapLoaded(true)}
                                            style={{ width: '100%', height: 260, border: '1px solid var(--ac-border, #e8edf3)', borderRadius: 8, opacity: mapLoaded ? 1 : 0 }}
                                            loading="lazy"
                                        />
                                    </div>
                                ) : null}
                            </div>
                        )}
                        {detailTab === 'Comments' && (
                            <SubmissionComments submissionId={selectedSubmission.id} />
                        )}
                            </div>
                    )}
                            </div>
                        </aside>
                    </>
                )}

            <Modal
                open={!!previewPhoto}
                onClose={() => setPhotoPreview(null)}
                title={previewPhoto?.caption || photoPreview?.scopeLabel || 'Scope Photo'}
                maxHeight="94vh"
                maxWidth={900}
            >
                {previewPhoto && (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <OptimizedImage
                            key={previewPhoto.id || previewPhoto.photo_path}
                            src={`/files/${previewPhoto.photo_path}`}
                            alt={previewPhoto.caption || 'Scope photo'}
                            style={{
                                width: '100%',
                                maxHeight: '70vh',
                                objectFit: 'contain',
                                border: '1px solid var(--ac-border, #e8edf3)',
                                borderRadius: 8,
                                background: 'var(--ac-bg-soft, #f8fafc)',
                            }}
                        />
                        <div style={{ fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>
                            {formatYmdHmAmPm(previewPhoto.created_at)}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
