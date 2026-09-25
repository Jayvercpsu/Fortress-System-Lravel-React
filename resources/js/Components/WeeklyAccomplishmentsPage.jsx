import { useEffect, useMemo, useState } from 'react';
import { useLayoutTitle } from './Layout';
import Modal from './Modal';
import ProjectAccordionTable from './ProjectAccordionTable';
import SearchableDropdown from './SearchableDropdown';
import SelectInput from './SelectInput';
import SubmissionComments from './SubmissionComments';
import DatePickerInput from './DatePickerInput';
import TextInput from './TextInput';
import ActionButton from './ActionButton';
import { Head, router } from '@inertiajs/react';
import { ChevronDown, ChevronsLeft, ChevronsRight, Info } from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import { formatYmdHmAmPm } from '../Utils/dateTimeFormat';

import {
    ProgressBar,
    accompMobileCss,
    cardStyle,
    initialsOf,
    innerCardStyle,
    innerTabStyle,
    isForemanRole,
    isPmRole,
    mockupTableCellStyle,
    mockupTableHeadStyle,
    photosForScopeWeek,
    pillStyle,
    sameProject,
    statIconStyle,
    statusForVariance,
    statusStyle,
    tabStyle,
    useIsMobile,
    varianceStyle,
} from './AccomplishmentWidgets';

// Deep-linkable tabs: #overview, #pm-submissions, #foreman-submissions,
// #comparison. The hash persists across refresh and back/forward navigation;
// it never triggers a server visit (client state only).
const TAB_HASHES = {
    overview: '#overview',
    pm: '#pm-submissions',
    foreman: '#foreman-submissions',
    comparison: '#comparison',
};

const tabFromHash = () => {
    if (typeof window === 'undefined') return 'overview';
    const hash = String(window.location.hash || '').toLowerCase();
    const found = Object.entries(TAB_HASHES).find(([, value]) => value === hash);
    return found ? found[0] : 'overview';
};

// Temporary flag: hides the bottom week-bucket submissions list
// (filter bar + ProjectAccordionTable) on the Overview and Comparison tabs.
// The list shows on the PM and Foreman tabs only (role-filtered). Set back
// to true to restore it everywhere.
const SHOW_SUBMISSIONS_LIST = false;

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

export default function WeeklyAccomplishmentsPage({    weeklyAccomplishments = [],
    weeklyAccomplishmentTable = {},
    weeklyScopePhotoMap = {},
    statusFilters = [],
    projects = [],
    filterProjects = [],
    filterSubmitters = [],
    groupEmptyMessage = 'No accomplishments for this project.',
    comparisonRows = [],
    overviewStats = {},
    workInfoMap = {},
}) {
    const routePath = '/weekly-accomplishments';

    const prettifyRole = (role) => String(role ?? '')
        .split('_')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Foreman';

    // ---- Comparison (Panels 1, 2, 4) state — local only, no new routes ----
    const [activeTab, setActiveTab] = useState(() => tabFromHash());
    const isMobile = useIsMobile();

    const switchTab = (key) => {
        setActiveTab(key);
        if (typeof window !== 'undefined' && TAB_HASHES[key]) {
            window.history.replaceState(null, '', TAB_HASHES[key]);
        }
    };

    useEffect(() => {
        const onHashChange = () => setActiveTab(tabFromHash());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);
    const [comparisonSearch, setComparisonSearch] = useState('');
    const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
    const [detailTab, setDetailTab] = useState('Details');
    const [showAllPhotos, setShowAllPhotos] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => {
        setMapLoaded(false);
    }, [selectedSubmissionId]);

    const safeComparisonRows = useMemo(
        () => (Array.isArray(comparisonRows) ? comparisonRows : []),
        [comparisonRows],
    );

    const visibleComparisonRows = useMemo(() => {
        const query = comparisonSearch.trim().toLowerCase();
        if (!query) return safeComparisonRows;
        return safeComparisonRows.filter((row) => String(row?.project_name ?? '').toLowerCase().includes(query));
    }, [safeComparisonRows, comparisonSearch]);

    const stats = useMemo(() => {
        const total = Number(overviewStats?.total_projects ?? safeComparisonRows.length ?? 0);
        if (overviewStats && typeof overviewStats.total_projects !== 'undefined') {
            return {
                total,
                onTrack: Number(overviewStats.on_track ?? 0),
                needsReview: Number(overviewStats.needs_review ?? 0),
                withDiscrepancy: Number(overviewStats.with_discrepancy ?? 0),
                onTrackPercent: Number(overviewStats.on_track_percent ?? 0),
                needsReviewPercent: Number(overviewStats.needs_review_percent ?? 0),
                withDiscrepancyPercent: Number(overviewStats.with_discrepancy_percent ?? 0),
            };
        }
        const onTrack = safeComparisonRows.filter((row) => row?.status === 'On Track').length;
        const needsReview = safeComparisonRows.filter((row) => row?.status === 'Needs Review').length;
        const withDiscrepancy = safeComparisonRows.filter((row) => row?.status === 'Investigate').length;
        return {
            total: safeComparisonRows.length,
            onTrack,
            needsReview,
            withDiscrepancy,
            onTrackPercent: total > 0 ? Math.round((onTrack / total) * 100) : 0,
            needsReviewPercent: total > 0 ? Math.round((needsReview / total) * 100) : 0,
            withDiscrepancyPercent: total > 0 ? Math.round((withDiscrepancy / total) * 100) : 0,
        };
    }, [overviewStats, safeComparisonRows]);

    // Entrance animations: stat numbers count up and bars fill from zero on
    // first visit (ProgressBar transitions width via CSS). Comparison-tab
    // bars animate separately when that tab is first opened.
    const [statAnimated, setStatAnimated] = useState({ total: 0, onTrack: 0, needsReview: 0, withDiscrepancy: 0 });
    const [overviewBarsLive, setOverviewBarsLive] = useState(false);
    const [comparisonBarsLive, setComparisonBarsLive] = useState(false);

    const prefersReducedMotion = () => typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const animatedBar = (live, value) => (value === null || value === undefined ? null : (live ? value : 0));

    useEffect(() => {
        const targets = { total: stats.total, onTrack: stats.onTrack, needsReview: stats.needsReview, withDiscrepancy: stats.withDiscrepancy };
        if (prefersReducedMotion()) {
            setStatAnimated(targets);
            setOverviewBarsLive(true);
            return;
        }
        let raf = 0;
        const start = performance.now();
        const duration = 900;
        const tick = (now) => {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            setStatAnimated({
                total: Math.round(eased * targets.total),
                onTrack: Math.round(eased * targets.onTrack),
                needsReview: Math.round(eased * targets.needsReview),
                withDiscrepancy: Math.round(eased * targets.withDiscrepancy),
            });
            if (progress < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                setOverviewBarsLive(true);
            }
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [stats.total, stats.onTrack, stats.needsReview, stats.withDiscrepancy]);

    useEffect(() => {
        if (activeTab !== 'comparison') return;
        if (prefersReducedMotion()) {
            setComparisonBarsLive(true);
            return;
        }
        const frame = requestAnimationFrame(() => requestAnimationFrame(() => setComparisonBarsLive(true)));
        return () => cancelAnimationFrame(frame);
    }, [activeTab]);

    const workInfoFor = (projectId, weekStart) => {
        const direct = workInfoMap?.[`${projectId}|${weekStart}`];
        if (direct) return direct;
        const fallback = Object.values(workInfoMap ?? {}).find(
            (entry) => Number(entry?.project_id) === Number(projectId),
        );
        return fallback ?? null;
    };

    const selectedSubmission = useMemo(() => {
        if (selectedSubmissionId === null || selectedSubmissionId === undefined) return null;
        return (Array.isArray(weeklyAccomplishments) ? weeklyAccomplishments : []).find(
            (row) => String(row?.id) === String(selectedSubmissionId),
        ) ?? null;
    }, [weeklyAccomplishments, selectedSubmissionId]);

    const submissionComparison = useMemo(() => {
        if (!selectedSubmission) return null;
        return safeComparisonRows.find(
            (row) => String(row?.project_name ?? '') === String(selectedSubmission?.project_name ?? ''),
        ) ?? null;
    }, [safeComparisonRows, selectedSubmission]);

    const submissionWorkInfo = useMemo(() => {
        if (!selectedSubmission || !submissionComparison) return null;
        return workInfoFor(submissionComparison.project_id, selectedSubmission.week_start);
    }, [selectedSubmission, submissionComparison]); // eslint-disable-line react-hooks/exhaustive-deps

    const submissionPhotos = useMemo(() => {
        if (!selectedSubmission) return [];
        return photosForScopeWeek(
            weeklyScopePhotoMap,
            selectedSubmission?.scope_of_work,
            selectedSubmission?.week_start,
            selectedSubmission?.project_id_real ?? selectedSubmission?.project_id,
        );
    }, [selectedSubmission, weeklyScopePhotoMap]);

    const tabbedRows = useMemo(() => {
        const rows = Array.isArray(weeklyAccomplishments) ? weeklyAccomplishments : [];
        if (activeTab === 'pm') return rows.filter((row) => isPmRole(row?.submitted_by_role));
        if (activeTab === 'foreman') return rows.filter((row) => isForemanRole(row?.submitted_by_role));
        return rows;
    }, [weeklyAccomplishments, activeTab]);

    // Submitted By options follow the active tab: PM tab lists PMs only,
    // Foreman tab lists foremen only (the tabs already filter rows by side).
    const submitterOptions = useMemo(() => {
        const list = Array.isArray(filterSubmitters) ? filterSubmitters : [];
        const wantedRole = activeTab === 'pm' ? 'project_manager' : activeTab === 'foreman' ? 'foreman' : '';
        return list
            .filter((submitter) => wantedRole === '' || String(submitter?.role ?? '') === wantedRole)
            .map((submitter) => ({ id: submitter.id, name: `${submitter.fullname} (${prettifyRole(submitter.role)})` }));
    }, [filterSubmitters, activeTab]);

    const tableFilters = {
        project_id: String(weeklyAccomplishmentTable?.project_id ?? ''),
        submitted_by: String(weeklyAccomplishmentTable?.submitted_by ?? ''),
        week_from: String(weeklyAccomplishmentTable?.week_from ?? ''),
        week_to: String(weeklyAccomplishmentTable?.week_to ?? ''),
        date_from: String(weeklyAccomplishmentTable?.date_from ?? ''),
        date_to: String(weeklyAccomplishmentTable?.date_to ?? ''),
    };

    const hasActiveFilters = Object.values(tableFilters).some((value) => value !== '');

    const filterControlStyle = {
        background: 'var(--surface-2)',
        color: 'var(--text-main)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
        minWidth: 150,
    };

    const applyFilter = (key, value) => {
        const next = { ...tableFilters, [key]: String(value ?? '') };
        router.get(routePath, {
            search: weeklyAccomplishmentTable?.search ?? '',
            per_page: weeklyAccomplishmentTable?.per_page ?? 10,
            page: 1,
            ...next,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearFilters = () => {
        router.get(routePath, {
            search: weeklyAccomplishmentTable?.search ?? '',
            per_page: weeklyAccomplishmentTable?.per_page ?? 10,
            page: 1,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Tab-level search (debounced like the table's own search box).
    const [tabSearchDraft, setTabSearchDraft] = useState(String(weeklyAccomplishmentTable?.search ?? ''));

    useEffect(() => {
        setTabSearchDraft(String(weeklyAccomplishmentTable?.search ?? ''));
    }, [weeklyAccomplishmentTable?.search]);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            if (String(weeklyAccomplishmentTable?.search ?? '') === String(tabSearchDraft ?? '')) {
                return;
            }

            router.get(routePath, {
                search: tabSearchDraft,
                per_page: weeklyAccomplishmentTable?.per_page ?? 10,
                page: 1,
                project_id: tableFilters.project_id || undefined,
                submitted_by: tableFilters.submitted_by || undefined,
                week_from: tableFilters.week_from || undefined,
                week_to: tableFilters.week_to || undefined,
            }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(handle);
    }, [tabSearchDraft]); // eslint-disable-line react-hooks/exhaustive-deps

    // Single-week filter: any date within a week matches that whole
    // Monday–Sunday week (the backend expands both bounds). It replaces the
    // four separate week/submitted range pickers.
    const applyWeekFilter = (value) => {
        router.get(routePath, {
            search: weeklyAccomplishmentTable?.search ?? '',
            per_page: weeklyAccomplishmentTable?.per_page ?? 10,
            page: 1,
            project_id: tableFilters.project_id || undefined,
            submitted_by: tableFilters.submitted_by || undefined,
            week_from: String(value ?? ''),
            week_to: String(value ?? ''),
            date_from: '',
            date_to: '',
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };
    // Photo preview modal state: identify which scope list we are browsing + current index.
    const [photoPreview, setPhotoPreview] = useState(null);

    const previewScopeKey = String(photoPreview?.scopeKey ?? '');
    const previewPhotos = useMemo(() => {
        if (!previewScopeKey) return [];
        const list = weeklyScopePhotoMap?.[previewScopeKey];
        if (!Array.isArray(list)) return [];
        return list.filter((photo) => sameProject(photo, photoPreview?.projectId ?? null));
    }, [previewScopeKey, weeklyScopePhotoMap, photoPreview]);

    const previewIndex = useMemo(() => {
        if (!photoPreview) return 0;
        const raw = Number(photoPreview.index ?? 0);
        const safe = Number.isFinite(raw) ? raw : 0;
        return Math.min(Math.max(0, safe), Math.max(0, previewPhotos.length - 1));
    }, [photoPreview, previewPhotos.length]);

    const previewPhoto = previewPhotos[previewIndex] || null;
    const canPrev = !!previewPhoto && previewIndex > 0;
    const canNext = !!previewPhoto && previewIndex < previewPhotos.length - 1;

    const closePreview = () => setPhotoPreview(null);
    const goPrev = () => setPhotoPreview((prev) => (
        prev ? { ...prev, index: Math.max(0, Number(prev.index ?? 0) - 1) } : prev
    ));
    const goNext = () => setPhotoPreview((prev) => (
        prev ? { ...prev, index: Number(prev.index ?? 0) + 1 } : prev
    ));

    useEffect(() => {
        if (!previewPhoto) return;

        const onKeyDown = (e) => {
            if (e.key === 'ArrowLeft') {
                if (canPrev) {
                    e.preventDefault();
                    goPrev();
                }
            }
            if (e.key === 'ArrowRight') {
                if (canNext) {
                    e.preventDefault();
                    goNext();
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [previewPhoto, canPrev, canNext]);

    useEffect(() => {
        if (!selectedSubmission) return;

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                // Let the reusable photo preview modal (rendered above the
                // sidebar) handle Escape first when it is open.
                if (previewPhoto) return;
                e.preventDefault();
                closeSidebar();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedSubmission, previewPhoto]);

    const [sidebarMaximized, setSidebarMaximized] = useState(false);

    const openSubmission = (row) => {
        setDetailTab('Details');
        setShowAllPhotos(false);
        setSidebarMaximized(false);
        setSelectedSubmissionId(row?.id ?? null);
    };

    // Instant close (no exit animation): unmounts the sidebar immediately for
    // both the PM and Foreman tabs.
    const closeSidebar = () => {
        setSelectedSubmissionId(null);
    };

    // Opens a sidebar photo in the reusable photo preview modal (same modal
    // the submissions table uses), positioned at the clicked photo so
    // Prev/Next browse that project's scope list.
    const openPhotoPreview = (photo) => {
        const scopeKey = String(selectedSubmission?.scope_of_work ?? '').trim().toLowerCase();
        const projectId = selectedSubmission?.project_id_real ?? selectedSubmission?.project_id ?? null;
        const list = scopeKey && Array.isArray(weeklyScopePhotoMap[scopeKey])
            ? weeklyScopePhotoMap[scopeKey].filter((item) => sameProject(item, projectId))
            : [];
        const clickedIndex = list.findIndex((item) => String(item?.id) === String(photo?.id));
        setPhotoPreview({
            scopeKey,
            scopeLabel: selectedSubmission?.scope_of_work || '',
            projectId,
            index: clickedIndex >= 0 ? clickedIndex : 0,
        });
    };

    const toggleSubmission = (row) => {
        if (selectedSubmissionId !== null && selectedSubmissionId !== undefined
            && String(selectedSubmissionId) === String(row?.id)) {
            closeSidebar();
            return;
        }
        openSubmission(row);
    };

    const filterBar = (
        <div className="flex flex-wrap items-end gap-3 accomp-filter-bar" style={{ marginBottom: 12 }}>
            <label style={{ minWidth: 220, maxWidth: 360, flex: '1 1 240px' }}>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Search</div>
                <TextInput
                    value={tabSearchDraft}
                    onChange={(e) => setTabSearchDraft(e.target.value)}
                    placeholder="Search weekly accomplishments..."
                    aria-label="Search weekly accomplishments"
                    style={{ ...filterControlStyle, width: '100%', minWidth: 0, background: 'var(--ac-bg, #fff)' }}
                />
            </label>
            <label style={{ minWidth: 200, maxWidth: 300 }} data-testid="filter-submitted-by">
                <div style={{ fontSize: 12, marginBottom: 6 }}>Submitted By</div>
                <SearchableDropdown
                    options={submitterOptions}
                    value={tableFilters.submitted_by}
                    onChange={(value) => applyFilter('submitted_by', value)}
                    placeholder="All submitters"
                    searchPlaceholder="Search submitters..."
                    emptyMessage="No submitters found"
                    clearable
                    style={{ ...filterControlStyle, minWidth: 0 }}
                />
            </label>
            <label>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Week</div>
                <DatePickerInput
                    value={tableFilters.week_from}
                    onChange={(value) => applyWeekFilter(value)}
                    style={filterControlStyle}
                />
            </label>
            {hasActiveFilters ? (
                <ActionButton
                    type="button"
                    onClick={clearFilters}
                    style={{ ...filterControlStyle, cursor: 'pointer' }}
                >
                    Clear filters
                </ActionButton>
            ) : null}
        </div>
    );

    const columns = [
        {
            key: 'submitted_at',
            label: 'Submitted',
            width: 170,
            render: (row) => (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                    {formatYmdHmAmPm(row.submitted_at || row.created_at)}
                </span>
            ),
        },
        {
            key: 'submitted_by_name',
            label: 'Submitted By',
            width: 190,
            render: (row) => (
                <div style={{ lineHeight: 1.35 }}>
                    <div>{row.submitted_by_name || row.foreman_name || '-'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {row.submitted_by_role || 'Foreman'}
                    </div>
                </div>
            ),
        },
        {
            key: 'project_name',
            label: 'Project',
            width: 180,
            render: (row) => row.project_name || '-',
        },
        {
            key: 'scope_of_work',
            label: 'Scope of Work',
            render: (row) => row.empty_week
                ? (
                    <div style={{ fontWeight: 600, whiteSpace: 'normal', color: 'var(--text-muted)' }}>
                        No accomplishments created this week.
                    </div>
                )
                : <div style={{ fontWeight: 600, whiteSpace: 'normal' }}>{row.scope_of_work || '-'}</div>,
        },
        {
            key: 'percent_completed',
            label: '% Completed',
            width: 120,
            render: (row) => (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                    {row.percent_completed ?? '-'}{row.percent_completed !== null && row.percent_completed !== undefined ? '%' : ''}
                </span>
            ),
        },
        {
            key: 'scope_photos',
            label: 'Uploaded Photos',
            width: 220,
            render: (row) => {
                if (row.empty_week) {
                    return '-';
                }

                const photos = photosForScopeWeek(
                    weeklyScopePhotoMap,
                    row.scope_of_work,
                    row.week_start,
                    row.project_id_real ?? row.project_id,
                );

                if (photos.length === 0) {
                    return <div className="jf-note" style={{ fontSize: 12 }}>No photos uploaded yet.</div>;
                }

                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 60px)', gap: 6 }}>
                        {photos.slice(0, 4).map((photo) => (
                            <button
                                key={`scope-photo-${photo.id}`}
                                type="button"
                                onClick={() => {
                                    const scopeKey = String(row.scope_of_work || '').trim().toLowerCase();
                                    const projectId = row.project_id_real ?? row.project_id ?? null;
                                    const fullList = scopeKey && Array.isArray(weeklyScopePhotoMap[scopeKey])
                                        ? weeklyScopePhotoMap[scopeKey].filter((item) => sameProject(item, projectId))
                                        : [];
                                    const clickedIndex = fullList.findIndex((item) => String(item?.id) === String(photo?.id));
                                    setPhotoPreview({
                                        scopeKey,
                                        scopeLabel: row.scope_of_work,
                                        projectId,
                                        index: clickedIndex >= 0 ? clickedIndex : 0,
                                    });
                                }}
                                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                            >
                                <OptimizedImage
                                    src={`/files/${photo.photo_path}`}
                                    alt={photo.caption || row.scope_of_work || 'Scope photo'}
                                    style={{ width: '100%', height: 58, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                                />
                            </button>
                        ))}
                    </div>
                );
            },
        },
        {
            key: 'actions',
            label: 'Actions',
            width: 110,
            render: (row) => {
                if (row.empty_week) return '-';
                const isOpen = selectedSubmissionId !== null && selectedSubmissionId !== undefined
                    && String(selectedSubmissionId) === String(row?.id);
                return (
                    <ActionButton
                        type="button"
                        variant="neutral"
                        onClick={() => toggleSubmission(row)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? 'Hide submission details' : 'View submission details'}
                    >
                        •••
                    </ActionButton>
                );
            },
        },
    ];

    useLayoutTitle('Weekly Accomplishments');

    const statCards = [
        { testId: 'total-projects', label: 'Total Projects', value: statAnimated.total, tint: '#eff6ff', iconBg: '#dbeafe', iconColor: '#2563eb', icon: '▦', badge: '' },
        { testId: 'on-track', label: 'On Track', value: statAnimated.onTrack, tint: '#f0fdf4', iconBg: '#dcfce7', iconColor: '#16a34a', icon: '✓', badge: `${stats.onTrackPercent}%` },
        { testId: 'needs-review', label: 'Needs Review', value: statAnimated.needsReview, tint: '#fffbeb', iconBg: '#fef3c7', iconColor: '#d97706', icon: '◷', badge: `${stats.needsReviewPercent}%` },
        { testId: 'with-discrepancy', label: 'With Discrepancy', value: statAnimated.withDiscrepancy, tint: '#fef2f2', iconBg: '#fee2e2', iconColor: '#dc2626', icon: '⚠', badge: `${stats.withDiscrepancyPercent}%` },
    ];

    // ---- Comparison analytics (Comparison tab only, client-side) ----
    const [comparisonProjectId, setComparisonProjectId] = useState(null);

    const analyticsProject = useMemo(() => {
        if (safeComparisonRows.length === 0) return null;
        return safeComparisonRows.find((row) => String(row?.project_id) === String(comparisonProjectId))
            ?? safeComparisonRows[0];
    }, [safeComparisonRows, comparisonProjectId]);

    const latestRowByScope = (rows) => {
        const byScope = new Map();
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const scope = String(row?.scope_of_work ?? '').trim();
            if (!scope || row?.empty_week) return;
            const key = scope.toLowerCase();
            const prev = byScope.get(key);
            if (!prev || Number(row?.id ?? 0) > Number(prev?.id ?? 0)) {
                byScope.set(key, row);
            }
        });
        return byScope;
    };

    const analyticsMatrix = useMemo(() => {
        if (!analyticsProject) return [];
        const name = String(analyticsProject.project_name ?? '');
        const projectRows = (Array.isArray(weeklyAccomplishments) ? weeklyAccomplishments : [])
            .filter((row) => String(row?.project_name ?? '') === name && !row?.empty_week);
        const pmByScope = new Map();
        const foremanByScope = new Map();
        projectRows.forEach((row) => {
            const scope = String(row?.scope_of_work ?? '').trim();
            if (!scope) return;
            const key = scope.toLowerCase();
            const bucket = isPmRole(row?.submitted_by_role) ? pmByScope : foremanByScope;
            const prev = bucket.get(key);
            if (!prev || Number(row?.id ?? 0) > Number(prev?.id ?? 0)) {
                bucket.set(key, { scope, percent: Number(row?.percent_completed ?? 0), row });
            }
        });
        const keys = Array.from(new Set([...pmByScope.keys(), ...foremanByScope.keys()])).sort();
        return keys.map((key) => {
            const pm = pmByScope.get(key)?.percent ?? null;
            const foreman = foremanByScope.get(key)?.percent ?? null;
            const variance = (pm !== null && foreman !== null) ? Math.round(Math.abs(pm - foreman) * 100) / 100 : null;
            return {
                scope: pmByScope.get(key)?.scope ?? foremanByScope.get(key)?.scope ?? key,
                pm,
                foreman,
                variance,
                status: variance === null ? 'Pending' : statusForVariance(variance),
                row: pmByScope.get(key)?.row ?? foremanByScope.get(key)?.row,
            };
        });
    }, [analyticsProject, weeklyAccomplishments]);

    const analyticsTrend = useMemo(() => {
        const rows = Array.isArray(weeklyAccomplishments) ? weeklyAccomplishments : [];
        const weeks = Array.from(new Set(rows.map((row) => String(row?.week_start ?? '').trim()).filter(Boolean))).sort();
        return weeks.map((week) => {
            const weekRows = rows.filter((r) => String(r?.week_start ?? '').trim() === week && !r?.empty_week);
            const averageLatest = (sideRows) => {
                const vals = Array.from(latestRowByScope(sideRows).values()).map((r) => Number(r?.percent_completed ?? 0));
                return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
            };
            return {
                week,
                pm: averageLatest(weekRows.filter((r) => isPmRole(r?.submitted_by_role))),
                foreman: averageLatest(weekRows.filter((r) => !isPmRole(r?.submitted_by_role))),
            };
        });
    }, [weeklyAccomplishments]);

    const daysSince = (stamp) => {
        if (!stamp) return null;
        const diff = Date.now() - new Date(String(stamp)).getTime();
        if (!Number.isFinite(diff) || diff < 0) return 0;
        return Math.floor(diff / 86400000);
    };

    const analyticsDistribution = useMemo(() => {
        const buckets = [
            { key: 'On Track', label: '0 – 5% · On Track', color: '#16a34a' },
            { key: 'Needs Review', label: '5 – 10% · Needs Review', color: '#eab308' },
            { key: 'Investigate', label: '> 10% · Investigate', color: '#ef4444' },
            { key: 'Pending', label: 'Pending review', color: 'var(--ac-muted, #64748b)' },
        ];
        return buckets.map((bucket) => ({
            ...bucket,
            projects: safeComparisonRows.filter((row) => String(row?.status ?? '') === bucket.key),
        }));
    }, [safeComparisonRows]);

    const tabs = [
        { key: 'overview', label: 'Overview' },
        { key: 'pm', label: 'PM Submissions' },
        { key: 'foreman', label: 'Foreman Submissions' },
        { key: 'comparison', label: 'Comparison' },
    ];

    const openProjectDetail = (projectId) => {
        router.get(`/weekly-accomplishments/${projectId}`);
    };

    return (
        <>
            <Head title="Weekly Accomplishments" />
            <style>{`
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
                @keyframes accomp-slide-in-right {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                @keyframes accomp-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes accomp-skeleton-pulse {
                    0% { background-position: 100% 0; }
                    100% { background-position: -100% 0; }
                }
                .accomp-hover-table tbody tr { transition: background-color 0.15s ease; }
                .accomp-hover-table tbody tr:hover { background-color: var(--ac-rowhover, #f1f5f9); }
                html[data-theme="dark"] .accomp-stat-card { background: var(--surface-1, #161b22) !important; border-color: var(--border-color, #30363d) !important; }
                ${accompMobileCss}
            `}</style>
                <div className="accomp-page-root" style={{ display: 'grid', gap: 16, background: 'var(--ac-page, #f4f6fb)', margin: -16, padding: 16 }}>
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ac-text, #0f172a)' }}>Accomplishments</div>
                                <div style={{ fontSize: 13, color: 'var(--ac-muted, #64748b)', marginTop: 2 }}>
                                    Track and compare submissions from Project Managers and Foremen
                                </div>
                            </div>
                            <div className="accomp-filter-bar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ minWidth: 170, maxWidth: 240 }}>
                                    <SearchableDropdown
                                        options={filterProjects}
                                        value={tableFilters.project_id}
                                        onChange={(value) => applyFilter('project_id', value)}
                                        placeholder="All projects"
                                        searchPlaceholder="Search projects..."
                                        emptyMessage="No projects found"
                                        clearable
                                        style={{ ...filterControlStyle, background: 'var(--ac-bg, #fff)', minWidth: 0, minHeight: 36 }}
                                    />
                                </div>
                                <DatePickerInput
                                    value={tableFilters.week_from}
                                    onChange={(value) => applyFilter('week_from', value)}
                                    style={{ ...filterControlStyle, background: 'var(--ac-bg, #fff)', minWidth: 150 }}
                                />
                            </div>
                        </div>
                        <div className="accomp-tabs-scroll" style={{ display: 'flex', borderBottom: '1px solid var(--ac-border, #e8edf3)', marginTop: 8 }}>
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => switchTab(tab.key)}
                                    style={tabStyle(activeTab === tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginTop: 14 }}>
                            {statCards.map((card) => (
                                <div key={card.testId} data-testid={`stat-card-${card.testId}`} className="accomp-stat-card" style={{ ...cardStyle, margin: 0, background: card.tint, borderColor: 'transparent', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <span style={statIconStyle(card.iconBg, card.iconColor)}>{card.icon}</span>
                                    <span style={{ flex: 1 }}>
                                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ac-muted, #475569)' }}>
                                            {card.label}
                                        </span>
                                        <span data-testid={`stat-value-${card.testId}`} style={{ display: 'block', fontSize: 28, fontWeight: 800, color: 'var(--ac-text, #0f172a)', lineHeight: 1.1 }}>
                                            {card.value}
                                        </span>
                                    </span>
                                    {card.badge ? (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: card.iconColor, background: 'var(--ac-bg, #ffffff)', borderRadius: 999, padding: '2px 8px' }}>{card.badge}</span>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>

                    {(activeTab === 'overview') && (
                        <div style={cardStyle} data-testid="comparison-table">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ width: 22, height: 22, borderRadius: 999, background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ac-text, #0f172a)' }}>Project Progress (PM vs Foreman)</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                                <div style={{ minWidth: 220, maxWidth: 320, flex: '1 1 220px' }}>
                                    <TextInput
                                        value={comparisonSearch}
                                        onChange={(e) => setComparisonSearch(e.target.value)}
                                        placeholder="Search projects..."
                                        aria-label="Search projects"
                                        style={{ ...filterControlStyle, width: '100%', minWidth: 0, background: 'var(--ac-bg, #fff)' }}
                                    />
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>
                                    Per page
                                    <SelectInput
                                        value={String(weeklyAccomplishmentTable?.per_page ?? 50)}
                                        onChange={(e) => router.get(routePath, { search: weeklyAccomplishmentTable?.search ?? '', per_page: e.target.value, page: 1, ...tableFilters }, { preserveState: true, preserveScroll: true, replace: true })}
                                        style={{ ...filterControlStyle, minWidth: 0, background: 'var(--ac-bg, #fff)' }}
                                        aria-label="Per page"
                                    >
                                        <option value="5">5</option>
                                        <option value="10">10</option>
                                        <option value="25">25</option>
                                        <option value="50">50</option>
                                    </SelectInput>
                                </label>
                            </div>
                            {isMobile ? (
                                <div style={{ display: 'grid', gap: 10 }}>
                                    {visibleComparisonRows.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No project comparison data yet.
                                        </div>
                                    ) : visibleComparisonRows.map((row, index) => (
                                        <div key={row.project_id} style={{ ...innerCardStyle, margin: 0, display: 'grid', gap: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => openProjectDetail(row.project_id)}
                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: 'var(--ac-text, #0f172a)', textAlign: 'left' }}
                                                >
                                                    {index + 1}. {row.project_name}
                                                </button>
                                                <span style={{ ...pillStyle, ...statusStyle(row.status) }}>{row.status}</span>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ac-muted, #64748b)', marginBottom: 4 }}>PM PROGRESS</div>
                                                <ProgressBar value={animatedBar(overviewBarsLive, row.pm_progress)} color="#2563eb" />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ac-muted, #64748b)', marginBottom: 4 }}>FOREMAN PROGRESS</div>
                                                <ProgressBar value={animatedBar(overviewBarsLive, row.foreman_progress)} color="#16a34a" />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                                                {row.variance === null || row.variance === undefined ? (
                                                    <span style={{ ...pillStyle, background: 'var(--ac-border-soft, #f1f5f9)', color: 'var(--ac-muted, #64748b)' }}>Variance —</span>
                                                ) : (
                                                    <span style={{ ...pillStyle, ...varianceStyle(row.variance) }}>Variance {Number(row.variance)}%</span>
                                                )}
                                                <ActionButton type="button" variant="neutral" onClick={() => openProjectDetail(row.project_id)} aria-label={`View ${row.project_name} details`}>
                                                    •••
                                                </ActionButton>
                                            </div>
                                            <div style={{ display: 'grid', gap: 2, fontSize: 12, color: 'var(--ac-text-2, #334155)' }}>
                                                <span>PM: {row.last_pm_submission ? formatYmdHmAmPm(row.last_pm_submission) : '-'}</span>
                                                <span>Foreman: {row.last_foreman_submission ? formatYmdHmAmPm(row.last_foreman_submission) : '-'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="accomp-hover-table" style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            {[
                                                { label: '#' },
                                                { label: 'Project', icon: 'sort', title: 'Click a project to view its detailed breakdown' },
                                                { label: 'PM Progress', icon: 'info', title: 'Latest Project Manager submission per scope, averaged' },
                                                { label: 'Foreman Progress', icon: 'info', title: 'Latest Foreman submission per scope, averaged' },
                                                { label: 'Variance', icon: 'info', title: 'Absolute difference on scopes both sides submitted' },
                                                { label: 'Status' },
                                                { label: 'Last PM Submission' },
                                                { label: 'Last Foreman Submission' },
                                                { label: 'Actions' },
                                            ].map((header) => (
                                                <th key={header.label} style={mockupTableHeadStyle}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        {header.label}
                                                        {header.icon === 'sort' && <ChevronDown size={12} strokeWidth={2.5} />}
                                                        {header.icon === 'info' && (
                                                            <span title={header.title} style={{ display: 'inline-flex', cursor: 'help', color: '#94a3b8' }}>
                                                                <Info size={12} strokeWidth={2.5} />
                                                            </span>
                                                        )}
                                                    </span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleComparisonRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    No project comparison data yet.
                                                </td>
                                            </tr>
                                        ) : visibleComparisonRows.map((row, index) => (
                                            <tr key={row.project_id} style={{ borderBottom: '1px solid var(--ac-border-soft, #f1f5f9)' }}>
                                                <td style={{ ...mockupTableCellStyle, color: 'var(--ac-muted, #64748b)' }}>{index + 1}</td>
                                                <td style={mockupTableCellStyle}>
                                                    <button
                                                        type="button"
                                                        onClick={() => openProjectDetail(row.project_id)}
                                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, color: 'var(--ac-text, #0f172a)', textAlign: 'left', fontSize: 13 }}
                                                    >
                                                        {row.project_name}
                                                    </button>
                                                </td>
                                                <td style={{ ...mockupTableCellStyle, minWidth: 150 }}>
                                                    <ProgressBar value={animatedBar(overviewBarsLive, row.pm_progress)} color="#2563eb" />
                                                </td>
                                                <td style={{ ...mockupTableCellStyle, minWidth: 150 }}>
                                                    <ProgressBar value={animatedBar(overviewBarsLive, row.foreman_progress)} color="#16a34a" />
                                                </td>
                                                <td style={mockupTableCellStyle}>
                                                    {row.variance === null || row.variance === undefined ? (
                                                        <span style={{ ...pillStyle, background: 'var(--ac-border-soft, #f1f5f9)', color: 'var(--ac-muted, #64748b)' }}>—</span>
                                                    ) : (
                                                        <span style={{ ...pillStyle, ...varianceStyle(row.variance) }}>{Number(row.variance)}%</span>
                                                    )}
                                                </td>
                                                <td style={mockupTableCellStyle}>
                                                    <span style={{ ...pillStyle, ...statusStyle(row.status) }}>{row.status}</span>
                                                </td>
                                                <td style={{ ...mockupTableCellStyle, fontSize: 12, color: 'var(--ac-text-2, #334155)', whiteSpace: 'nowrap' }}>
                                                    {row.last_pm_submission ? formatYmdHmAmPm(row.last_pm_submission) : '-'}
                                                </td>
                                                <td style={{ ...mockupTableCellStyle, fontSize: 12, color: 'var(--ac-text-2, #334155)', whiteSpace: 'nowrap' }}>
                                                    {row.last_foreman_submission ? formatYmdHmAmPm(row.last_foreman_submission) : '-'}
                                                </td>
                                                <td style={mockupTableCellStyle}>
                                                    <ActionButton type="button" variant="neutral" onClick={() => openProjectDetail(row.project_id)} aria-label={`View ${row.project_name} details`}>
                                                        •••
                                                    </ActionButton>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            )}
                            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--ac-border-soft, #f1f5f9)', fontSize: 12, color: 'var(--ac-text-2, #334155)' }}>
                                <span style={{ fontWeight: 800, color: 'var(--ac-text, #0f172a)' }}>Variance Legend</span>
                                <span><span style={{ color: '#16a34a' }}>●</span> 0 – 5% &nbsp; On Track</span>
                                <span><span style={{ color: '#eab308' }}>●</span> 5 – 10% &nbsp; Needs Review</span>
                                <span><span style={{ color: '#ef4444' }}>●</span> &gt; 10% &nbsp; Investigate</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'comparison' && (
                        <div style={{ display: 'grid', gap: 16 }} data-testid="comparison-analytics">
                            <div style={cardStyle} data-testid="analytics-matrix">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ac-text, #0f172a)' }}>Scope Showdown — PM vs Foreman</div>
                                    <div style={{ minWidth: 200, maxWidth: 300, flex: '1 1 200px' }}>
                                        <SearchableDropdown
                                            options={safeComparisonRows.map((row) => ({ id: row.project_id, name: row.project_name }))}
                                            value={String(analyticsProject?.project_id ?? '')}
                                            onChange={(value) => setComparisonProjectId(value)}
                                            placeholder="Select project"
                                            searchPlaceholder="Search projects..."
                                            emptyMessage="No projects found"
                                            style={{ ...filterControlStyle, background: 'var(--ac-bg, #fff)', minWidth: 0 }}
                                        />
                                    </div>
                                </div>
                                {analyticsMatrix.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--ac-muted, #64748b)' }}>No scope comparison for this project yet.</div>
                                ) : isMobile ? (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {analyticsMatrix.map((item) => (
                                            <div key={item.scope} style={{ ...innerCardStyle, margin: 0, display: 'grid', gap: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ac-text, #0f172a)' }}>{item.scope}</span>
                                                    <span style={{ ...pillStyle, ...statusStyle(item.status) }}>{item.status}</span>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ac-muted, #64748b)', marginBottom: 4 }}>PM PROGRESS</div>
                                                    {item.pm === null ? <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span> : <ProgressBar value={animatedBar(comparisonBarsLive, item.pm)} color="#2563eb" />}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ac-muted, #64748b)', marginBottom: 4 }}>FOREMAN PROGRESS</div>
                                                    {item.foreman === null ? <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span> : <ProgressBar value={animatedBar(comparisonBarsLive, item.foreman)} color="#16a34a" />}
                                                </div>
                                                <div>
                                                    {item.variance === null || item.variance === undefined ? (
                                                        <span style={{ ...pillStyle, background: 'var(--ac-border-soft, #f1f5f9)', color: 'var(--ac-muted, #64748b)' }}>Variance —</span>
                                                    ) : (
                                                        <span style={{ ...pillStyle, ...varianceStyle(item.variance) }}>Variance {item.variance}%</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="accomp-hover-table" style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    {['Scope of Work', 'PM Progress', 'Foreman Progress', 'Variance', 'Status'].map((header) => (
                                                        <th key={header} style={mockupTableHeadStyle}>{header}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analyticsMatrix.map((item) => (
                                                    <tr key={item.scope} style={{ borderBottom: '1px solid var(--ac-border-soft, #f1f5f9)' }}>
                                                        <td style={{ ...mockupTableCellStyle, fontWeight: 500, color: 'var(--ac-text, #0f172a)' }}>{item.scope}</td>
                                                        <td style={{ ...mockupTableCellStyle, minWidth: 140 }}>
                                                            {item.pm === null ? <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span> : <ProgressBar value={animatedBar(comparisonBarsLive, item.pm)} color="#2563eb" />}
                                                        </td>
                                                        <td style={{ ...mockupTableCellStyle, minWidth: 140 }}>
                                                            {item.foreman === null ? <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span> : <ProgressBar value={animatedBar(comparisonBarsLive, item.foreman)} color="#16a34a" />}
                                                        </td>
                                                        <td style={mockupTableCellStyle}>
                                                            {item.variance === null || item.variance === undefined ? (
                                                                <span style={{ ...pillStyle, background: 'var(--ac-border-soft, #f1f5f9)', color: 'var(--ac-muted, #64748b)' }}>—</span>
                                                            ) : (
                                                                <span style={{ ...pillStyle, ...varianceStyle(item.variance) }}>{item.variance}%</span>
                                                            )}
                                                        </td>
                                                        <td style={mockupTableCellStyle}>
                                                            <span style={{ ...pillStyle, ...statusStyle(item.status) }}>{item.status}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                <div style={{ ...cardStyle, margin: 0 }} data-testid="analytics-trend">
                                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ac-text, #0f172a)', marginBottom: 10 }}>Weekly Momentum Trend</div>
                                    {analyticsTrend.length === 0 ? (
                                        <div style={{ fontSize: 13, color: 'var(--ac-muted, #64748b)' }}>No weekly trend yet.</div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: 10 }}>
                                            {analyticsTrend.map((point) => (
                                                <div key={point.week}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ac-text, #0f172a)', marginBottom: 4 }}>Week of {point.week}</div>
                                                    <div className="accomp-trend-grid" style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px 10px', alignItems: 'center', fontSize: 12, color: 'var(--ac-text-2, #334155)' }}>
                                                        <span>Project Manager</span>
                                                        {point.pm === null ? <span style={{ color: '#94a3b8' }}>—</span> : <ProgressBar value={animatedBar(comparisonBarsLive, point.pm)} color="#2563eb" />}
                                                        <span>Foreman</span>
                                                        {point.foreman === null ? <span style={{ color: '#94a3b8' }}>—</span> : <ProgressBar value={animatedBar(comparisonBarsLive, point.foreman)} color="#16a34a" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div style={{ ...cardStyle, margin: 0 }} data-testid="analytics-distribution">
                                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ac-text, #0f172a)', marginBottom: 10 }}>Variance Distribution</div>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {analyticsDistribution.map((bucket) => (
                                            <div key={bucket.key} style={{ border: '1px solid var(--ac-border, #e8edf3)', borderRadius: 8, padding: 10 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                    <span style={{ color: bucket.color }}>●</span>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ac-text, #0f172a)' }}>{bucket.label}</span>
                                                    <span style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 800, color: 'var(--ac-text, #0f172a)' }}>{bucket.projects.length}</span>
                                                </div>
                                                {bucket.projects.length > 0 ? (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {bucket.projects.map((row) => (
                                                            <span key={row.project_id} style={{ ...pillStyle, background: 'var(--ac-border-soft, #f1f5f9)', color: 'var(--ac-text-2, #334155)' }}>{row.project_name}</span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={cardStyle} data-testid="analytics-freshness">
                                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ac-text, #0f172a)', marginBottom: 10 }}>Submission Freshness Board</div>
                                {safeComparisonRows.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--ac-muted, #64748b)' }}>No projects to track yet.</div>
                                ) : isMobile ? (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {safeComparisonRows.map((row) => {
                                            const pmSilent = daysSince(row.last_pm_submission);
                                            const foremanSilent = daysSince(row.last_foreman_submission);
                                            return (
                                                <div key={row.project_id} style={{ ...innerCardStyle, margin: 0, display: 'grid', gap: 8 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ac-text, #0f172a)' }}>{row.project_name}</div>
                                                    <div style={{ display: 'grid', gap: 2, fontSize: 12, color: 'var(--ac-text-2, #334155)' }}>
                                                        <span>Last PM: {row.last_pm_submission ? formatYmdHmAmPm(row.last_pm_submission) : '-'}</span>
                                                        <span>
                                                            PM silent: {pmSilent === null ? '—' : `${pmSilent}d`}
                                                            {pmSilent !== null && pmSilent > 7 ? <span style={{ ...pillStyle, background: '#fee2e2', color: '#b91c1c', marginLeft: 6 }}>stale</span> : null}
                                                        </span>
                                                        <span>Last Foreman: {row.last_foreman_submission ? formatYmdHmAmPm(row.last_foreman_submission) : '-'}</span>
                                                        <span>
                                                            Foreman silent: {foremanSilent === null ? '—' : `${foremanSilent}d`}
                                                            {foremanSilent !== null && foremanSilent > 7 ? <span style={{ ...pillStyle, background: '#fee2e2', color: '#b91c1c', marginLeft: 6 }}>stale</span> : null}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="accomp-hover-table" style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    {['Project', 'Last PM Submission', 'PM Silent', 'Last Foreman Submission', 'Foreman Silent'].map((header) => (
                                                        <th key={header} style={mockupTableHeadStyle}>{header}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {safeComparisonRows.map((row) => {
                                                    const pmSilent = daysSince(row.last_pm_submission);
                                                    const foremanSilent = daysSince(row.last_foreman_submission);
                                                    return (
                                                        <tr key={row.project_id} style={{ borderBottom: '1px solid var(--ac-border-soft, #f1f5f9)' }}>
                                                            <td style={{ ...mockupTableCellStyle, fontWeight: 600, color: 'var(--ac-text, #0f172a)' }}>{row.project_name}</td>
                                                            <td style={{ ...mockupTableCellStyle, fontSize: 12, color: 'var(--ac-text-2, #334155)', whiteSpace: 'nowrap' }}>
                                                                {row.last_pm_submission ? formatYmdHmAmPm(row.last_pm_submission) : '-'}
                                                            </td>
                                                            <td style={mockupTableCellStyle}>
                                                                {pmSilent === null ? '—' : (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                                                                        {pmSilent}d
                                                                        {pmSilent > 7 ? <span style={{ ...pillStyle, background: '#fee2e2', color: '#b91c1c' }}>stale</span> : null}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ ...mockupTableCellStyle, fontSize: 12, color: 'var(--ac-text-2, #334155)', whiteSpace: 'nowrap' }}>
                                                                {row.last_foreman_submission ? formatYmdHmAmPm(row.last_foreman_submission) : '-'}
                                                            </td>
                                                            <td style={mockupTableCellStyle}>
                                                                {foremanSilent === null ? '—' : (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                                                                        {foremanSilent}d
                                                                        {foremanSilent > 7 ? <span style={{ ...pillStyle, background: '#fee2e2', color: '#b91c1c' }}>stale</span> : null}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div style={cardStyle} data-testid="analytics-headtohead">
                                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ac-text, #0f172a)', marginBottom: 10 }}>Head-to-Head Projects</div>
                                {safeComparisonRows.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--ac-muted, #64748b)' }}>No projects to compare yet.</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {safeComparisonRows.map((row) => {
                                            const delta = (row.pm_progress !== null && row.pm_progress !== undefined
                                                && row.foreman_progress !== null && row.foreman_progress !== undefined)
                                                ? Math.round(Math.abs(Number(row.pm_progress) - Number(row.foreman_progress)) * 100) / 100
                                                : null;
                                            return (
                                                <div key={row.project_id} style={{ ...innerCardStyle, margin: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ac-text, #0f172a)' }}>{row.project_name}</span>
                                                        {delta === null ? (
                                                            <span style={{ ...pillStyle, background: 'var(--ac-border-soft, #f1f5f9)', color: 'var(--ac-muted, #64748b)' }}>Δ —</span>
                                                        ) : (
                                                            <span style={{ ...pillStyle, ...varianceStyle(delta) }}>Δ {delta}%</span>
                                                        )}
                                                    </div>
                                                    <div className="accomp-trend-grid" style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px 10px', alignItems: 'center', fontSize: 12, color: 'var(--ac-text-2, #334155)' }}>
                                                        <span>Project Manager</span>
                                                        <ProgressBar value={animatedBar(comparisonBarsLive, row.pm_progress)} color="#2563eb" />
                                                        <span>Foreman</span>
                                                        <ProgressBar value={animatedBar(comparisonBarsLive, row.foreman_progress)} color="#16a34a" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Project Detail View lives on its own page: /weekly-accomplishments/{project} */}

                    {(SHOW_SUBMISSIONS_LIST || activeTab === 'pm' || activeTab === 'foreman') && (
                    <div style={cardStyle} data-testid="submissions-list">
                    {filterBar}
                    <ProjectAccordionTable
                        columns={columns}
                        rows={tabbedRows}
                        projects={projects}
                        rowKey="id"
                        searchPlaceholder="Search weekly accomplishments..."
                        hideSearch
                        emptyMessage="No weekly accomplishments yet."
                        groupEmptyMessage={groupEmptyMessage}
                        routePath={routePath}
                        table={weeklyAccomplishmentTable}
                        groupPageSize={10}
                        collapseAllByDefault
                        singleOpen
                        countNoun={{ singular: 'submission', plural: 'submissions' }}
                        statusOptions={statusFilters}
                        showGroupId={false}
                        filters={tableFilters}
                    />
                    </div>
                    )}
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
                                width: isMobile ? '100vw' : (sidebarMaximized ? 'min(960px, 96vw)' : 'min(480px, 94vw)'),
                                maxWidth: '100vw',
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
                                    display: isMobile ? 'none' : 'inline-flex',
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
                            <div style={{ fontSize: 12, color: 'var(--ac-muted, #64748b)', marginBottom: 10 }}>
                                Projects <span style={{ margin: '0 4px' }}>›</span> {selectedSubmission.project_name || submissionComparison?.project_name || '-'} <span style={{ margin: '0 4px' }}>›</span> Submission Details
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
                            <div className="accomp-tabs-scroll" style={{ display: 'flex', borderBottom: '1px solid var(--ac-border, #e8edf3)', marginBottom: 12 }}>
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
                                    <div className="accomp-details-grid" style={{ border: '1px solid var(--ac-border, #eef2f7)', borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px 12px', fontSize: 13 }}>
                                        <span style={{ color: 'var(--ac-muted, #64748b)' }}>Scope of Work</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{selectedSubmission.scope_of_work || '-'}</span>
                                        <span style={{ color: 'var(--ac-muted, #64748b)' }}>Accomplishment</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{selectedSubmission.percent_completed ?? '-'}%</span>
                                        <span style={{ color: 'var(--ac-muted, #64748b)' }}>Manpower</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{submissionWorkInfo ? `${submissionWorkInfo.manpower} workers` : '-'}</span>
                                        <span style={{ color: 'var(--ac-muted, #64748b)' }}>Equipment</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{submissionWorkInfo?.equipment?.slice(0, 3).join(', ') || '-'}</span>
                                        <span style={{ color: 'var(--ac-muted, #64748b)' }}>Materials Used</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{submissionWorkInfo?.materials_used || '-'}</span>
                                        <span style={{ color: 'var(--ac-muted, #64748b)' }}>Remarks</span><span style={{ color: 'var(--ac-text, #0f172a)', fontWeight: 500 }}>{submissionWorkInfo?.remarks || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px' }}>
                                        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--ac-text, #0f172a)' }}>Uploaded Photos</div>
                                        {submissionPhotos.length > 4 && (
                                            <button type="button" onClick={() => { setDetailTab('Photos'); setShowAllPhotos(true); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                                                View All
                                            </button>
                                        )}
                                    </div>
                                    {submissionPhotos.length === 0 ? (
                                        <div style={{ fontSize: 13, color: 'var(--ac-muted, #64748b)' }}>No photos uploaded yet.</div>
                                    ) : (
                                        <div className="accomp-sidebar-photos" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                            {submissionPhotos.slice(0, 3).map((photo) => (
                                                <button
                                                    key={photo.id || photo.photo_path}
                                                    type="button"
                                                    onClick={() => openPhotoPreview(photo)}
                                                    aria-label={`View photo ${photo.caption || selectedSubmission.scope_of_work || ''}`}
                                                    style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'zoom-in' }}
                                                >
                                                    <OptimizedImage
                                                        src={`/files/${photo.photo_path}`}
                                                        alt={photo.caption || selectedSubmission.scope_of_work || 'Scope photo'}
                                                        style={{ width: '100%', height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--ac-border, #e8edf3)', display: 'block' }}
                                                    />
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => { setDetailTab('Photos'); setShowAllPhotos(true); }}
                                                style={{ height: 84, borderRadius: 8, border: '1px solid var(--ac-border, #e8edf3)', background: 'var(--ac-bg-soft, #f8fafc)', color: 'var(--ac-text, #0f172a)', fontWeight: 800, cursor: 'pointer' }}
                                            >
                                                +{Math.max(0, submissionPhotos.length - 3)}
                                            </button>
                                        </div>
                                    )}
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
                                                <button
                                                    key={photo.id || photo.photo_path}
                                                    type="button"
                                                    onClick={() => openPhotoPreview(photo)}
                                                    aria-label={`View photo ${photo.caption || selectedSubmission.scope_of_work || ''}`}
                                                    style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'zoom-in' }}
                                                >
                                                    <OptimizedImage
                                                        src={`/files/${photo.photo_path}`}
                                                        alt={photo.caption || selectedSubmission.scope_of_work || 'Scope photo'}
                                                        style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--ac-border, #e8edf3)', display: 'block' }}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {detailTab === 'Location' && (
                                <div style={{ display: 'grid', gap: 6 }}>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ac-text, #0f172a)' }}>Location:</div>
                                    <div style={{ fontSize: 13, color: 'var(--ac-text, #0f172a)' }}>{submissionComparison?.location || 'No location recorded for this project.'}</div>
                                    {submissionComparison?.location ? (
                                        <div style={{ position: 'relative' }}>
                                            {!mapLoaded && (
                                                <div style={{ position: 'absolute', inset: 0, borderRadius: 8, border: '1px solid var(--ac-border, #e8edf3)', background: 'linear-gradient(90deg, var(--ac-border-soft, #f1f5f9) 25%, var(--ac-track, #e2e8f0) 37%, var(--ac-border-soft, #f1f5f9) 63%)', backgroundSize: '300% 100%', animation: 'accomp-skeleton-pulse 1.3s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--ac-muted, #64748b)' }}>
                                                    Loading map…
                                                </div>
                                            )}
                                            <iframe
                                                title={`Map of ${submissionComparison.location}`}
                                                src={`https://maps.google.com/maps?q=${encodeURIComponent(submissionComparison.location)}&output=embed`}
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
                    onClose={closePreview}
                    title={previewPhoto?.caption || photoPreview?.scopeLabel || 'Scope Photo'}
                    maxHeight="94vh"
                    headerContent={previewPhoto ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {photoPreview?.scopeLabel ? `Scope: ${photoPreview.scopeLabel}` : null}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text-muted)' }}>
                                    {`${previewIndex + 1} / ${previewPhotos.length}`}
                                </span>
                                <button type="button" onClick={goPrev} disabled={!canPrev} style={navButtonStyle(canPrev)}>
                                    Prev
                                </button>
                                <button type="button" onClick={goNext} disabled={!canNext} style={navButtonStyle(canNext)}>
                                    Next
                                </button>
                            </div>
                        </div>
                    ) : null}
                    maxWidth={900}
                >
                    {previewPhoto && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            <OptimizedImage
                                key={previewPhoto.id || previewPhoto.photo_path}
                                src={`/files/${previewPhoto.photo_path}`}
                                alt={previewPhoto.caption || photoPreview?.scopeLabel || 'Scope photo'}
                                style={{
                                    width: '100%',
                                    maxHeight: '70vh',
                                    objectFit: 'contain',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    background: 'var(--surface-2)',
                                }}
                            />
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {photoPreview?.scopeLabel ? `Scope: ${photoPreview.scopeLabel}` : null}
                                {photoPreview?.scopeLabel && previewPhoto.created_at ? ' | ' : ''}
                                {formatYmdHmAmPm(previewPhoto.created_at)}
                            </div>
                        </div>
                    )}
                </Modal>
        </>
    );
}
