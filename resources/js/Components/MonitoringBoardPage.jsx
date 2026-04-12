import Layout from './Layout';
import ActionButton from './ActionButton';
import Modal from './Modal';
import EditModal from './EditModal';
import ConfirmationModal from './ConfirmationModal';
import SearchableDropdown from './SearchableDropdown';
import DatePickerInput from './DatePickerInput';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import TextareaInput from './TextareaInput';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, GripVertical, Trash2 } from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import { toastMessages } from '../constants/toastMessages';
import { formatYmdHmAmPm } from '../Utils/dateTimeFormat';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
};

const STATUS_OPTIONS = ['NOT_STARTED', 'IN_PROGRESS', 'HOLD', 'COMPLETED'];
const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const clampPercent = (value) => Math.min(100, Math.max(0, Number(value) || 0));
const weightedScopePercent = (weightPercent, progressPercent, computedPercent) => {
    const parsedComputed = Number(computedPercent);
    if (Number.isFinite(parsedComputed)) return parsedComputed;
    return ((Number(weightPercent) || 0) * clampPercent(progressPercent)) / 100;
};
const formatPercent = (value, maxDecimals = 2) => `${Number(value || 0).toFixed(maxDecimals)}%`;
const normalizeScopeKey = (value) => String(value || '').trim().toLowerCase();
const normalizeToMonday = (value) => {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
    const [year, month, day] = text.split('-').map((part) => Number(part));
    if ([year, month, day].some((part) => Number.isNaN(part))) return '';
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return '';
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);
    const normalizedYear = date.getFullYear();
    const normalizedMonth = String(date.getMonth() + 1).padStart(2, '0');
    const normalizedDay = String(date.getDate()).padStart(2, '0');
    return `${normalizedYear}-${normalizedMonth}-${normalizedDay}`;
};
const formatWeekLabel = (value) => {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '-';
    const [year, month, day] = text.split('-').map((part) => Number(part));
    if ([year, month, day].some((part) => Number.isNaN(part))) return text;
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const formatSignedPercent = (value) => {
    const numeric = Number(value || 0);
    const prefix = numeric > 0 ? '+' : '';
    return `${prefix}${numeric.toFixed(2)}%`;
};
const formatSignedMoney = (value) => {
    const numeric = Number(value || 0);
    const prefix = numeric > 0 ? '+' : '';
    return `${prefix}${money(numeric)}`;
};
const currentMonday = () => {
    const date = new Date();
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);
    const normalizedYear = date.getFullYear();
    const normalizedMonth = String(date.getMonth() + 1).padStart(2, '0');
    const normalizedDay = String(date.getDate()).padStart(2, '0');
    return `${normalizedYear}-${normalizedMonth}-${normalizedDay}`;
};

export default function MonitoringBoardPage({
    project,
    scopes = [],
    foreman_options: foremanOptions = [],
    weekly_history: weeklyHistory = {},
    embedded = false,
    readOnly = false,
}) {
    const [orderedScopes, setOrderedScopes] = useState(scopes);
    const [reordering, setReordering] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const [sortDraftScopes, setSortDraftScopes] = useState([]);
    const [sortDraggingId, setSortDraggingId] = useState(null);
    const [sortDropTargetId, setSortDropTargetId] = useState(null);
    const [editScope, setEditScope] = useState(null);
    const [scopeToDelete, setScopeToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [photoToDelete, setPhotoToDelete] = useState(null);
    const [deletingPhoto, setDeletingPhoto] = useState(false);
    const [uploadScopeId, setUploadScopeId] = useState(null);
    const [photoInputKey, setPhotoInputKey] = useState(0);
    // Scope photo preview state (per-row). Stores the scope id and which photo index is active.
    const [scopePreview, setScopePreview] = useState(null);
    const previewScope = useMemo(() => {
        const scopeId = scopePreview?.scopeId;
        if (!scopeId) return null;
        return orderedScopes.find((scope) => String(scope?.id) === String(scopeId)) || null;
    }, [orderedScopes, scopePreview?.scopeId]);
    const previewPhotos = useMemo(() => (
        Array.isArray(previewScope?.photos) ? previewScope.photos : []
    ), [previewScope]);
    const previewIndex = useMemo(() => {
        const raw = Number(scopePreview?.index ?? 0);
        const safe = Number.isFinite(raw) ? raw : 0;
        return Math.min(Math.max(0, safe), Math.max(0, previewPhotos.length - 1));
    }, [previewPhotos.length, scopePreview?.index]);
    const previewPhoto = previewPhotos[previewIndex] || null;
    const canPrevPhoto = !!previewPhoto && previewIndex > 0;
    const canNextPhoto = !!previewPhoto && previewIndex < previewPhotos.length - 1;

    const closeScopePreview = () => setScopePreview(null);
    const goPrevScopePhoto = () => setScopePreview((prev) => (
        prev ? { ...prev, index: Math.max(0, Number(prev.index ?? 0) - 1) } : prev
    ));
    const goNextScopePhoto = () => setScopePreview((prev) => (
        prev ? { ...prev, index: Number(prev.index ?? 0) + 1 } : prev
    ));

    useEffect(() => {
        if (!scopePreview) return;
        if (previewPhotos.length > 0) return;
        closeScopePreview();
    }, [scopePreview, previewPhotos.length]);

    useEffect(() => {
        if (!previewPhoto) return;

        const onKeyDown = (event) => {
            if (event.key === 'ArrowLeft') {
                if (canPrevPhoto) {
                    event.preventDefault();
                    goPrevScopePhoto();
                }
            }
            if (event.key === 'ArrowRight') {
                if (canNextPhoto) {
                    event.preventDefault();
                    goNextScopePhoto();
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [previewPhoto, canPrevPhoto, canNextPhoto]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [scopeSearch, setScopeSearch] = useState('');
    const [scopePage, setScopePage] = useState(1);
    const [scopePerPage, setScopePerPage] = useState(10);
    const [scopeTableLoading, setScopeTableLoading] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyWeekStart, setHistoryWeekStart] = useState('');
    const showBackButton = !embedded;
    useEffect(() => {
        setOrderedScopes(Array.isArray(scopes) ? scopes : []);
    }, [scopes]);
    const assignedPersonnelOptions = useMemo(() => {
        const rows = Array.isArray(foremanOptions) ? foremanOptions : [];

        return rows
            .map((row) => {
                const fullname = String(row?.fullname || '').trim();
                if (fullname === '') return null;
                return {
                    value: fullname,
                    label: fullname,
                };
            })
            .filter(Boolean);
    }, [foremanOptions]);

    const historyProgressByWeek = useMemo(() => {
        const source = weeklyHistory?.scope_progress_by_week && typeof weeklyHistory.scope_progress_by_week === 'object'
            ? weeklyHistory.scope_progress_by_week
            : {};

        return Object.entries(source).reduce((acc, [weekKey, scopesByWeek]) => {
            const normalizedWeek = normalizeToMonday(weekKey);
            if (!normalizedWeek || !scopesByWeek || typeof scopesByWeek !== 'object') return acc;

            const normalizedScopes = Object.entries(scopesByWeek).reduce((scopeAcc, [scopeKey, percent]) => {
                const normalizedKey = normalizeScopeKey(scopeKey);
                if (!normalizedKey) return scopeAcc;
                scopeAcc[normalizedKey] = Number(percent || 0);
                return scopeAcc;
            }, {});

            acc[normalizedWeek] = normalizedScopes;
            return acc;
        }, {});
    }, [weeklyHistory?.scope_progress_by_week]);

    const historyWeekStarts = useMemo(() => {
        const weekStartsFromPayload = Array.isArray(weeklyHistory?.week_starts)
            ? weeklyHistory.week_starts
            : [];

        return Array.from(new Set([
            ...weekStartsFromPayload.map((week) => normalizeToMonday(week)).filter(Boolean),
            ...Object.keys(historyProgressByWeek).map((week) => normalizeToMonday(week)).filter(Boolean),
        ])).sort();
    }, [weeklyHistory?.week_starts, historyProgressByWeek]);

    const effectiveHistoryWeekStarts = useMemo(() => (
        historyWeekStarts.length > 0 ? historyWeekStarts : [currentMonday()]
    ), [historyWeekStarts]);

    const historyScopeNameByKey = useMemo(() => {
        const fromPayload = weeklyHistory?.scope_name_by_key && typeof weeklyHistory.scope_name_by_key === 'object'
            ? weeklyHistory.scope_name_by_key
            : {};

        return Object.entries(fromPayload).reduce((acc, [scopeKey, scopeName]) => {
            const normalizedKey = normalizeScopeKey(scopeKey);
            const normalizedName = String(scopeName || '').trim();
            if (!normalizedKey || normalizedName === '') return acc;
            acc[normalizedKey] = normalizedName;
            return acc;
        }, {});
    }, [weeklyHistory?.scope_name_by_key]);

    const historyScopeWeightByKey = useMemo(() => (
        orderedScopes.reduce((acc, scope) => {
            const key = normalizeScopeKey(scope?.scope_name);
            if (!key) return acc;
            acc[key] = Number(scope?.weight_percent || 0);
            return acc;
        }, {})
    ), [orderedScopes]);

    const historyScopeContractByKey = useMemo(() => (
        orderedScopes.reduce((acc, scope) => {
            const key = normalizeScopeKey(scope?.scope_name);
            if (!key) return acc;
            acc[key] = Number(scope?.contract_amount || 0);
            return acc;
        }, {})
    ), [orderedScopes]);

    const historyScopeKeysInOrder = useMemo(() => {
        const payloadKeys = Array.isArray(weeklyHistory?.scope_keys_in_order)
            ? weeklyHistory.scope_keys_in_order
            : [];

        const orderedScopeKeys = orderedScopes
            .map((scope) => normalizeScopeKey(scope?.scope_name))
            .filter(Boolean);

        return Array.from(new Set([
            ...orderedScopeKeys,
            ...payloadKeys.map((scopeKey) => normalizeScopeKey(scopeKey)).filter(Boolean),
            ...Object.values(historyProgressByWeek).flatMap((weekMap) => Object.keys(weekMap || {})),
        ]));
    }, [weeklyHistory?.scope_keys_in_order, orderedScopes, historyProgressByWeek]);

    useEffect(() => {
        const preferredWeekStart = normalizeToMonday(weeklyHistory?.latest_week_start)
            || effectiveHistoryWeekStarts[effectiveHistoryWeekStarts.length - 1];

        setHistoryWeekStart((previous) => (
            effectiveHistoryWeekStarts.includes(previous) ? previous : preferredWeekStart
        ));
    }, [effectiveHistoryWeekStarts, weeklyHistory?.latest_week_start]);

    const activeHistoryWeekStart = effectiveHistoryWeekStarts.includes(historyWeekStart)
        ? historyWeekStart
        : (effectiveHistoryWeekStarts[effectiveHistoryWeekStarts.length - 1] || '');

    const activeHistoryWeekIndex = effectiveHistoryWeekStarts.findIndex((week) => week === activeHistoryWeekStart);
    const previousHistoryWeekStart = activeHistoryWeekIndex > 0 ? effectiveHistoryWeekStarts[activeHistoryWeekIndex - 1] : '';
    const nextHistoryWeekStart = activeHistoryWeekIndex >= 0 && activeHistoryWeekIndex < effectiveHistoryWeekStarts.length - 1
        ? effectiveHistoryWeekStarts[activeHistoryWeekIndex + 1]
        : '';

    const activeHistoryWeekMap = historyProgressByWeek[activeHistoryWeekStart] || {};
    const previousHistoryWeekMap = previousHistoryWeekStart ? (historyProgressByWeek[previousHistoryWeekStart] || {}) : {};

    const historyRows = useMemo(() => (
        historyScopeKeysInOrder.map((scopeKey) => {
            const displayName = historyScopeNameByKey[scopeKey]
                || orderedScopes.find((scope) => normalizeScopeKey(scope?.scope_name) === scopeKey)?.scope_name
                || scopeKey;
            const weightPercent = Number(historyScopeWeightByKey[scopeKey] || 0);
            const contractAmount = Number(historyScopeContractByKey[scopeKey] || 0);
            const currentProgress = Number(activeHistoryWeekMap[scopeKey] || 0);
            const previousProgress = Number(previousHistoryWeekMap[scopeKey] || 0);
            const currentWeighted = Number(((weightPercent * currentProgress) / 100).toFixed(2));
            const previousWeighted = Number(((weightPercent * previousProgress) / 100).toFixed(2));
            const currentAmount = Number(((contractAmount * currentProgress) / 100).toFixed(2));
            const previousAmount = Number(((contractAmount * previousProgress) / 100).toFixed(2));

            return {
                scope_key: scopeKey,
                scope_name: displayName,
                weight_percent: weightPercent,
                contract_amount: contractAmount,
                current_progress: currentProgress,
                previous_progress: previousProgress,
                delta_progress: Number((currentProgress - previousProgress).toFixed(2)),
                current_weighted: currentWeighted,
                previous_weighted: previousWeighted,
                delta_weighted: Number((currentWeighted - previousWeighted).toFixed(2)),
                current_amount: currentAmount,
                previous_amount: previousAmount,
                delta_amount: Number((currentAmount - previousAmount).toFixed(2)),
            };
        })
    ), [
        historyScopeKeysInOrder,
        historyScopeNameByKey,
        orderedScopes,
        historyScopeWeightByKey,
        historyScopeContractByKey,
        activeHistoryWeekMap,
        previousHistoryWeekMap,
    ]);

    const historySummary = useMemo(() => {
        const totals = historyRows.reduce((acc, row) => ({
            currentWeighted: acc.currentWeighted + row.current_weighted,
            previousWeighted: acc.previousWeighted + row.previous_weighted,
            currentAmount: acc.currentAmount + row.current_amount,
            previousAmount: acc.previousAmount + row.previous_amount,
        }), {
            currentWeighted: 0,
            previousWeighted: 0,
            currentAmount: 0,
            previousAmount: 0,
        });

        return {
            currentWeighted: Number(totals.currentWeighted.toFixed(2)),
            previousWeighted: Number(totals.previousWeighted.toFixed(2)),
            deltaWeighted: Number((totals.currentWeighted - totals.previousWeighted).toFixed(2)),
            currentAmount: Number(totals.currentAmount.toFixed(2)),
            previousAmount: Number(totals.previousAmount.toFixed(2)),
            deltaAmount: Number((totals.currentAmount - totals.previousAmount).toFixed(2)),
        };
    }, [historyRows]);

    const {
        data: createData,
        setData: setCreateData,
        post,
        processing: creating,
        errors: createErrors,
        reset: resetCreateData,
    } = useForm({
    scope_name: '',
    assigned_personnel: '',
    progress_percent: 0,
    status: STATUS_OPTIONS[0],
    remarks: '',
    contract_amount: '',
    weight_percent: '',
    start_date: '',
    target_completion: '',
    });

    const {
        data: editData,
        setData: setEditData,
        patch,
        processing: updating,
        errors: editErrors,
        clearErrors: clearEditErrors,
    } = useForm({
    scope_name: '',
    assigned_personnel: '',
    progress_percent: 0,
    status: STATUS_OPTIONS[0],
    remarks: '',
    contract_amount: '',
    weight_percent: '',
    start_date: '',
    target_completion: '',
    });

    const {
        data: photoData,
        setData: setPhotoData,
        post: postPhoto,
        processing: uploadingPhoto,
        errors: photoErrors,
        reset: resetPhotoData,
    } = useForm({
        photo: null,
        caption: '',
    });

    const submitCreate = (event) => {
        event.preventDefault();
        if (readOnly) return;
        post(`/projects/${project.id}/scopes`, {
            preserveScroll: true,
            onSuccess: () => {
                resetCreateData();
                setCreateData('progress_percent', 0);
                setCreateData('status', STATUS_OPTIONS[0]);
                setCreateData('contract_amount', '');
                setCreateData('weight_percent', '');
                setCreateData('start_date', '');
                setCreateData('target_completion', '');
                setShowCreateModal(false);
                toast.success(toastMessages.monitoringScopes.addSuccess);
            },
            onError: () => toast.error(toastMessages.monitoringScopes.addError),
        });
    };

    const startEdit = (scope) => {
        if (readOnly) return;
        setEditScope(scope);
        if (clearEditErrors) clearEditErrors();
        setEditData({
            scope_name: scope.scope_name ?? '',
            assigned_personnel: scope.assigned_personnel ?? '',
            progress_percent: Number(scope.progress_percent ?? 0),
            status: scope.status ?? STATUS_OPTIONS[0],
            remarks: scope.remarks ?? '',
            contract_amount: scope.contract_amount ?? '',
            weight_percent: scope.weight_percent ?? '',
            start_date: scope.start_date ?? '',
            target_completion: scope.target_completion ?? '',
        });
    };

    const closeEdit = () => {
        if (updating) return;
        setEditScope(null);
        if (clearEditErrors) clearEditErrors();
    };

    const saveEdit = (event) => {
        event.preventDefault();
        if (!editScope) return;
        if (readOnly) return;
        patch(`/scopes/${editScope.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditScope(null);
                toast.success(toastMessages.monitoringScopes.updateSuccess);
            },
            onError: () => toast.error(toastMessages.monitoringScopes.updateError),
        });
    };

    const requestDeleteScope = (scope) => {
        if (readOnly) return;
        setScopeToDelete(scope);
    };

    const closeDeleteModal = () => {
        if (deleting) return;
        setScopeToDelete(null);
    };

    const confirmDeleteScope = () => {
        if (!scopeToDelete) return;
        if (readOnly) return;

        setDeleting(true);
        router.delete(`/scopes/${scopeToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setScopeToDelete(null);
                toast.success(toastMessages.monitoringScopes.deleteSuccess);
            },
            onError: () => toast.error(toastMessages.monitoringScopes.deleteError),
            onFinish: () => setDeleting(false),
        });
    };

    const requestDeletePhoto = (photo, scope) => {
        if (readOnly) return;
        setPhotoToDelete({
            ...photo,
            scope_name: scope?.scope_name || '',
        });
    };

    const closeDeletePhoto = () => {
        if (deletingPhoto) return;
        setPhotoToDelete(null);
    };

    const confirmDeletePhoto = () => {
        if (!photoToDelete) return;
        if (readOnly) return;

        setDeletingPhoto(true);
        router.delete(`/scope-photos/${photoToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setPhotoToDelete(null);
                toast.success(toastMessages.monitoringScopes.photoDeleteSuccess);
            },
            onError: () => toast.error(toastMessages.monitoringScopes.photoDeleteError),
            onFinish: () => setDeletingPhoto(false),
        });
    };

    const openPhotoUploader = (scopeId) => {
        if (readOnly) return;
        if (uploadingPhoto) return;
        setUploadScopeId(scopeId);
        resetPhotoData();
        setPhotoInputKey((value) => value + 1);
    };

    const cancelPhotoUpload = () => {
        if (uploadingPhoto) return;
        setUploadScopeId(null);
        resetPhotoData();
        setPhotoInputKey((value) => value + 1);
    };

    const submitPhoto = (event, scopeId) => {
        event.preventDefault();

        postPhoto(`/scopes/${scopeId}/photos`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setUploadScopeId(null);
                resetPhotoData();
                setPhotoInputKey((value) => value + 1);
                toast.success(toastMessages.monitoringScopes.photoUploadSuccess);
            },
            onError: () => toast.error(toastMessages.monitoringScopes.photoUploadError),
        });
    };

    const filteredScopes = useMemo(() => {
        const term = scopeSearch.trim().toLowerCase();
        if (!term) return orderedScopes;

        return orderedScopes.filter((scope) => {
            const fields = [
                scope.scope_name,
                scope.assigned_personnel,
                scope.status,
                scope.remarks,
            ]
                .map((value) => String(value || '').toLowerCase())
                .filter(Boolean);

            return fields.some((value) => value.includes(term));
        });
    }, [scopeSearch, orderedScopes]);

    const totalScopePages = Math.max(1, Math.ceil(filteredScopes.length / scopePerPage));
    const clampedScopePage = Math.min(scopePage, totalScopePages);
    const scopeStartIndex = (clampedScopePage - 1) * scopePerPage;
    const visibleScopes = filteredScopes.slice(scopeStartIndex, scopeStartIndex + scopePerPage);

    useEffect(() => {
        setScopePage(1);
    }, [scopeSearch, scopePerPage]);

    useEffect(() => {
        if (scopePage > totalScopePages) {
            setScopePage(totalScopePages);
        }
    }, [scopePage, totalScopePages]);

    useEffect(() => {
        setScopeTableLoading(true);
        const timer = window.setTimeout(() => setScopeTableLoading(false), 350);
        return () => window.clearTimeout(timer);
    }, [scopeSearch, scopePage, scopePerPage, orderedScopes.length]);

    const openSortModal = () => {
        setSortDraftScopes(orderedScopes);
        setShowSortModal(true);
    };

    const closeSortModal = () => {
        if (reordering) return;
        setShowSortModal(false);
        setSortDraggingId(null);
        setSortDropTargetId(null);
    };

    const handleSortDragStart = (scopeId) => (event) => {
        if (readOnly || reordering) return;
        setSortDraggingId(scopeId);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(scopeId));
    };

    const handleSortDragOver = (scopeId) => (event) => {
        if (readOnly || reordering) return;
        event.preventDefault();
        setSortDropTargetId(scopeId);
        event.dataTransfer.dropEffect = 'move';
    };

    const handleSortDragEnd = () => {
        setSortDraggingId(null);
        setSortDropTargetId(null);
    };

    const handleSortDrop = (scopeId) => (event) => {
        if (readOnly || reordering) return;
        event.preventDefault();
        const draggedId = sortDraggingId ? Number(sortDraggingId) : Number(event.dataTransfer.getData('text/plain'));
        if (!draggedId || draggedId === scopeId) {
            setSortDropTargetId(null);
            return;
        }

        const fromIndex = sortDraftScopes.findIndex((scope) => scope.id === draggedId);
        const toIndex = sortDraftScopes.findIndex((scope) => scope.id === scopeId);
        if (fromIndex < 0 || toIndex < 0) {
            setSortDropTargetId(null);
            return;
        }

        const nextScopes = [...sortDraftScopes];
        const [moved] = nextScopes.splice(fromIndex, 1);
        nextScopes.splice(toIndex, 0, moved);
        setSortDraftScopes(nextScopes);
    };

    const saveSortOrder = () => {
        if (readOnly || reordering) return;
        if (sortDraftScopes.length === 0) {
            closeSortModal();
            return;
        }
        setReordering(true);
        router.put(
            `/projects/${project.id}/scopes/reorder`,
            { scope_ids: sortDraftScopes.map((scope) => scope.id) },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setOrderedScopes(sortDraftScopes);
                    setShowSortModal(false);
                    toast.success(toastMessages.monitoringScopes.reorderSuccess);
                },
                onError: () => {
                    toast.error(toastMessages.monitoringScopes.reorderError);
                },
                onFinish: () => setReordering(false),
            }
        );
    };

    const openHistoryModal = () => {
        setShowHistoryModal(true);
    };

    const closeHistoryModal = () => {
        setShowHistoryModal(false);
    };

    const goToPreviousHistoryWeek = () => {
        if (!previousHistoryWeekStart) return;
        setHistoryWeekStart(previousHistoryWeekStart);
    };

    const goToNextHistoryWeek = () => {
        if (!nextHistoryWeekStart) return;
        setHistoryWeekStart(nextHistoryWeekStart);
    };

    const content = (
        <>
            {showBackButton && (
                <div style={{ marginBottom: 12 }}>
                    <ActionButton
                        href={`/projects/${project.id}`}
                        style={{ padding: '8px 12px', fontSize: 13 }}
                    >
                        <ArrowLeft size={16} />
                        Back to Project
                    </ActionButton>
                </div>
            )}
            <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Project</div>
                        <div style={{ fontWeight: 700 }}>{project.name}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Overall Progress</div>
                        <div style={{ fontWeight: 700 }}>{formatPercent(project.overall_progress)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                        <div style={{ fontWeight: 700 }}>{project.status}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                        <ActionButton
                            type="button"
                            onClick={openHistoryModal}
                            style={{ padding: '8px 12px', fontSize: 12 }}
                        >
                            Show History
                        </ActionButton>
                        <ActionButton
                            type="button"
                            onClick={openSortModal}
                            disabled={readOnly || orderedScopes.length === 0}
                            style={{ padding: '8px 12px', fontSize: 12 }}
                        >
                            Manage Sorting
                        </ActionButton>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <TextInput
                        value={scopeSearch}
                        onChange={(event) => setScopeSearch(event.target.value)}
                        placeholder="Search scopes..."
                        disabled={readOnly}
                        style={{ ...inputStyle, maxWidth: 320, width: '100%' }}
                    />
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Per page</span>
                            <SelectInput
                                value={scopePerPage}
                                onChange={(event) => setScopePerPage(Number(event.target.value))}
                                style={{ ...inputStyle, minWidth: 90, padding: '8px 10px' }}
                            >
                                {[5, 10, 25, 50].map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </SelectInput>
                        </div>
                        <ActionButton
                            type="button"
                            variant="success"
                            onClick={() => setShowCreateModal(true)}
                            disabled={readOnly}
                            style={{ padding: '10px 16px', fontSize: 13 }}
                        >
                            Add Scope
                        </ActionButton>
                    </div>
                </div>

                <div style={{ ...cardStyle, overflowX: 'auto' }}>
                    <style>{'@keyframes scopeTableShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}'}</style>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr>
                        {['Scope', 'Contract', 'Weight', 'WT %', 'Accomp Amount', 'Assigned', 'Progress', 'Status', 'Remarks', 'Photos', 'Updated', 'Actions'].map((label) => (
                            <th
                                key={label}
                                style={{
                                            textAlign: 'left',
                                            borderBottom: '1px solid var(--border-color)',
                                            color: 'var(--text-muted)',
                                            fontWeight: 600,
                                            padding: '10px 8px',
                                            whiteSpace: ['Contract', 'Weight', 'WT %', 'Accomp Amount'].includes(label) ? 'nowrap' : 'normal',
                                        }}
                                    >
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {scopeTableLoading && Array.from({ length: Math.min(scopePerPage, 10) }).map((_, rowIndex) => (
                                <tr key={`scope-skeleton-${rowIndex}`}>
                                    {['Scope', 'Contract', 'Weight', 'WT %', 'Accomp Amount', 'Assigned', 'Progress', 'Status', 'Remarks', 'Photos', 'Updated', 'Actions'].map((label, colIndex) => (
                                        <td
                                            key={`scope-skeleton-${rowIndex}-${colIndex}`}
                                            style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}
                                        >
                                            <div
                                                style={{
                                                    height: 12,
                                                    width: colIndex % 3 === 0 ? '70%' : '90%',
                                                    borderRadius: 6,
                                                    background: 'linear-gradient(90deg, var(--surface-2, #f1f5f9) 25%, var(--border-color, #e2e8f0) 37%, var(--surface-2, #f1f5f9) 63%)',
                                                    backgroundSize: '300% 100%',
                                                    animation: 'scopeTableShimmer 1.35s ease-in-out infinite',
                                                }}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {!scopeTableLoading && visibleScopes.length === 0 && (
                                <tr>
                                    <td colSpan={12} style={{ padding: '14px 8px', color: 'var(--text-muted)' }}>
                                        No scope rows yet.
                                    </td>
                                </tr>
                            )}
                            {!scopeTableLoading && visibleScopes.map((scope) => (
                                <tr key={scope.id}>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                        {scope.scope_name}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                        {scope.contract_amount ? money(scope.contract_amount) : '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                    {scope.weight_percent ? formatPercent(scope.weight_percent) : '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                    {scope.weight_percent
                                        ? formatPercent(weightedScopePercent(scope.weight_percent, scope.progress_percent, scope.computed_percent))
                                        : '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                    {scope.contract_amount
                                        ? money((Number(scope.contract_amount) || 0) * (Number(scope.progress_percent) || 0) / 100)
                                        : '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                        {scope.assigned_personnel || '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                        {`${scope.progress_percent}%`}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                        {scope.status}
                                    </td>
                                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                        {scope.remarks || '-'}
                                    </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'grid', gap: 8, minWidth: 280 }}>
                                                {scope.photos?.length > 0 ? (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                        {scope.photos.map((photo) => (
                                                            <div
                                                                key={photo.id}
                                                                style={{
                                                                    width: 110,
                                                                    position: 'relative',
                                                                }}
                                                                className="bb-photo-tile"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const photos = Array.isArray(scope?.photos) ? scope.photos : [];
                                                                        const clickedIndex = photos.findIndex((item) => String(item?.id) === String(photo?.id));
                                                                        setScopePreview({
                                                                            scopeId: scope.id,
                                                                            index: clickedIndex >= 0 ? clickedIndex : 0,
                                                                        });
                                                                    }}
                                                                    style={{
                                                                        border: 'none',
                                                                        background: 'transparent',
                                                                        padding: 0,
                                                                        cursor: 'pointer',
                                                                        textAlign: 'left',
                                                                        width: '100%',
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            border: '1px solid var(--border-color)',
                                                                            borderRadius: 8,
                                                                            padding: 6,
                                                                            background: 'var(--surface-2)',
                                                                        }}
                                                                    >
                                                                        <OptimizedImage
                                                                            src={`/files/${photo.photo_path}`}
                                                                            alt={photo.caption || 'Scope photo'}
                                                                            style={{
                                                                                width: '100%',
                                                                                height: 68,
                                                                                objectFit: 'cover',
                                                                                borderRadius: 6,
                                                                                marginBottom: 4,
                                                                            }}
                                                                        />
                                                                        <div style={{ fontSize: 11, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                            {photo.caption || 'No caption'}
                                                                        </div>
                                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                            {formatYmdHmAmPm(photo.created_at)}
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            <button
                                                                type="button"
                                                                aria-label="Delete photo"
                                                                disabled={deletingPhoto || readOnly}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    requestDeletePhoto(photo, scope);
                                                                }}
                                                                style={{
                                                                        position: 'absolute',
                                                                        top: 6,
                                                                        right: 6,
                                                                        width: 26,
                                                                        height: 26,
                                                                        borderRadius: 999,
                                                                        border: '1px solid #b91c1c',
                                                                        background: '#ef4444',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        color: '#fff',
                                                                        cursor: deletingPhoto ? 'not-allowed' : 'pointer',
                                                                        opacity: deletingPhoto ? 0.6 : 1,
                                                                        boxShadow: '0 6px 12px rgba(239, 68, 68, 0.35)',
                                                                    }}
                                                                    className="bb-photo-delete"
                                                                >
                                                                    <Trash2 size={14} strokeWidth={2.2} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No photos yet.</div>
                                                )}

                                                {uploadScopeId === scope.id ? (
                                                    <form
                                                        onSubmit={(event) => submitPhoto(event, scope.id)}
                                                        style={{
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: 8,
                                                            padding: 8,
                                                            display: 'grid',
                                                            gap: 8,
                                                            background: 'var(--surface-2)',
                                                        }}
                                                    >
                                                        <TextInput
                                                            key={`photo-input-${scope.id}-${photoInputKey}`}
                                                            type="file"
                                                            accept="image/*"
                                                            disabled={readOnly || uploadingPhoto}
                                                            onChange={(event) => setPhotoData('photo', event.target.files?.[0] ?? null)}
                                                        />
                                                        <TextInput
                                                            value={photoData.caption}
                                                            onChange={(event) => setPhotoData('caption', event.target.value)}
                                                            placeholder="Caption (optional)"
                                                            disabled={readOnly || uploadingPhoto}
                                                            style={inputStyle}
                                                        />
                                                        {(photoErrors.photo || photoErrors.caption) && (
                                                            <div style={{ color: '#f87171', fontSize: 12 }}>
                                                                {photoErrors.photo || photoErrors.caption}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'inline-flex', gap: 8 }}>
                                                            <ActionButton type="button" onClick={cancelPhotoUpload} disabled={uploadingPhoto} style={{ padding: '8px 10px' }}>Cancel</ActionButton>
                                                            <ActionButton type="submit" variant="success" disabled={uploadingPhoto || readOnly} style={{ padding: '8px 10px' }}>
                                                                {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                                                            </ActionButton>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <ActionButton
                                                        type="button"
                                                        onClick={() => openPhotoUploader(scope.id)}
                                                        disabled={readOnly}
                                                        style={{ padding: '8px 10px', width: 'fit-content' }}
                                                    >
                                                        Add Photo
                                                    </ActionButton>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                            {formatYmdHmAmPm(scope.updated_at)}
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'inline-flex', gap: 8 }}>
                                                <ActionButton type="button" variant="edit" onClick={() => startEdit(scope)} disabled={readOnly} style={{ padding: '8px 10px' }}>Edit</ActionButton>
                                                <ActionButton
                                                    type="button"
                                                    variant="danger"
                                                    onClick={() => requestDeleteScope(scope)}
                                                    disabled={deleting || readOnly}
                                                    loading={deleting && scopeToDelete?.id === scope.id}
                                                    style={{ padding: '8px 10px' }}
                                                >
                                                    {deleting && scopeToDelete?.id === scope.id ? 'Deleting...' : 'Delete'}
                                                </ActionButton>
                                            </div>
                                        </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {filteredScopes.length === 0
                            ? 'Showing 0'
                            : `Showing ${scopeStartIndex + 1}-${Math.min(scopeStartIndex + scopePerPage, filteredScopes.length)} of ${filteredScopes.length}`}
                    </div>
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                        <ActionButton
                            type="button"
                            onClick={() => setScopePage((prev) => Math.max(1, prev - 1))}
                            disabled={clampedScopePage <= 1}
                            style={{ padding: '8px 12px', fontSize: 12 }}
                        >
                            Prev
                        </ActionButton>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 6px' }}>
                            Page {clampedScopePage} of {totalScopePages}
                        </div>
                        <ActionButton
                            type="button"
                            onClick={() => setScopePage((prev) => Math.min(totalScopePages, prev + 1))}
                            disabled={clampedScopePage >= totalScopePages}
                            style={{ padding: '8px 12px', fontSize: 12 }}
                        >
                            Next
                        </ActionButton>
                    </div>
                </div>

                <EditModal
                    open={!!editScope}
                    onClose={closeEdit}
                    onSubmit={saveEdit}
                    title={editScope ? `Edit Scope - ${editScope.scope_name}` : 'Edit Scope'}
                    submitLabel="Save Changes"
                    processing={updating}
                    maxWidth={860}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Scope Name</div>
                            <TextInput
                                value={editData.scope_name}
                                onChange={(event) => setEditData('scope_name', event.target.value)}
                                disabled={readOnly || updating}
                                style={inputStyle}
                            />
                            {editErrors.scope_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.scope_name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned Personnel</div>
                            {assignedPersonnelOptions.length > 0 ? (
                                <SearchableDropdown
                                    options={assignedPersonnelOptions}
                                    value={editData.assigned_personnel}
                                    onChange={(value) => setEditData('assigned_personnel', value || '')}
                                    disabled={readOnly || updating}
                                    placeholder="Select foreman"
                                    searchPlaceholder="Search foreman..."
                                    emptyMessage="No foreman found"
                                    getOptionValue={(option) => option.value}
                                    getOptionLabel={(option) => option.label}
                                    style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                />
                            ) : (
                                <TextInput
                                    value={editData.assigned_personnel}
                                    onChange={(event) => setEditData('assigned_personnel', event.target.value)}
                                    disabled={readOnly || updating}
                                    style={inputStyle}
                                />
                            )}
                            {editErrors.assigned_personnel && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.assigned_personnel}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Progress (%)</div>
                            <TextInput
                                type="number"
                                min="0"
                                max="100"
                                value={editData.progress_percent}
                                onChange={(event) => setEditData('progress_percent', event.target.value)}
                                disabled={readOnly || updating}
                                style={inputStyle}
                            />
                            {editErrors.progress_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.progress_percent}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                            <SelectInput
                                value={editData.status}
                                onChange={(event) => setEditData('status', event.target.value)}
                                disabled={readOnly || updating}
                                style={inputStyle}
                            >
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </SelectInput>
                            {editErrors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.status}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Contract Amount</div>
                            <TextInput
                                type="number"
                                min="0"
                                step="0.01"
                                value={editData.contract_amount}
                                onChange={(event) => setEditData('contract_amount', event.target.value)}
                                disabled={readOnly || updating}
                                style={inputStyle}
                            />
                            {editErrors.contract_amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.contract_amount}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Weight %</div>
                            <TextInput
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={editData.weight_percent}
                                onChange={(event) => setEditData('weight_percent', event.target.value)}
                                disabled={readOnly || updating}
                                style={inputStyle}
                            />
                            {editErrors.weight_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.weight_percent}</div>}
                        </label>

                        {/* Start Date and Target Completion hidden for now */}
                        {/*
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Start Date</div>
                            <DatePickerInput
                                value={editData.start_date}
                                onChange={(value) => setEditData('start_date', value)}
                                style={inputStyle}
                                disabled={readOnly || updating}
                            />
                            {editErrors.start_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.start_date}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Target Completion</div>
                            <DatePickerInput
                                value={editData.target_completion}
                                onChange={(value) => setEditData('target_completion', value)}
                                style={inputStyle}
                                disabled={readOnly || updating}
                            />
                            {editErrors.target_completion && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.target_completion}</div>}
                        </label>
                        */}

                        <label style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Remarks</div>
                            <TextareaInput
                                value={editData.remarks}
                                onChange={(event) => setEditData('remarks', event.target.value)}
                                disabled={readOnly || updating}
                                style={{ ...inputStyle, minHeight: 90 }}
                            />
                            {editErrors.remarks && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.remarks}</div>}
                        </label>
                    </div>
                </EditModal>
                <Modal
                    open={showCreateModal}
                    onClose={() => (!creating ? setShowCreateModal(false) : null)}
                    title="Add Scope"
                    maxWidth={860}
                >
                    <form onSubmit={submitCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Scope Name</div>
                            <TextInput
                                value={createData.scope_name}
                                onChange={(event) => setCreateData('scope_name', event.target.value)}
                                disabled={readOnly || creating}
                                style={inputStyle}
                            />
                            {createErrors.scope_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.scope_name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned Personnel</div>
                            {assignedPersonnelOptions.length > 0 ? (
                                <SearchableDropdown
                                    options={assignedPersonnelOptions}
                                    value={createData.assigned_personnel}
                                    onChange={(value) => setCreateData('assigned_personnel', value || '')}
                                    disabled={readOnly || creating}
                                    placeholder="Select foreman"
                                    searchPlaceholder="Search foreman..."
                                    emptyMessage="No foreman found"
                                    getOptionValue={(option) => option.value}
                                    getOptionLabel={(option) => option.label}
                                    style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                />
                            ) : (
                                <TextInput
                                    value={createData.assigned_personnel}
                                    onChange={(event) => setCreateData('assigned_personnel', event.target.value)}
                                    disabled={readOnly || creating}
                                    style={inputStyle}
                                />
                            )}
                            {createErrors.assigned_personnel && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.assigned_personnel}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Progress (%)</div>
                            <TextInput
                                type="number"
                                min="0"
                                max="100"
                                value={createData.progress_percent}
                                onChange={(event) => setCreateData('progress_percent', event.target.value)}
                                disabled={readOnly || creating}
                                style={inputStyle}
                            />
                            {createErrors.progress_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.progress_percent}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                            <SelectInput
                                value={createData.status}
                                onChange={(event) => setCreateData('status', event.target.value)}
                                disabled={readOnly || creating}
                                style={inputStyle}
                            >
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </SelectInput>
                            {createErrors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.status}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Contract Amount</div>
                            <TextInput
                                type="number"
                                min="0"
                                step="0.01"
                                value={createData.contract_amount}
                                onChange={(event) => setCreateData('contract_amount', event.target.value)}
                                disabled={readOnly || creating}
                                style={inputStyle}
                            />
                            {createErrors.contract_amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.contract_amount}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Weight %</div>
                            <TextInput
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={createData.weight_percent}
                                onChange={(event) => setCreateData('weight_percent', event.target.value)}
                                disabled={readOnly || creating}
                                style={inputStyle}
                            />
                            {createErrors.weight_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.weight_percent}</div>}
                        </label>

                        {/* Start Date and Target Completion hidden for now */}
                        {/*
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Start Date</div>
                            <DatePickerInput
                                value={createData.start_date}
                                onChange={(value) => setCreateData('start_date', value)}
                                style={inputStyle}
                                disabled={readOnly || creating}
                            />
                            {createErrors.start_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.start_date}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Target Completion</div>
                            <DatePickerInput
                                value={createData.target_completion}
                                onChange={(value) => setCreateData('target_completion', value)}
                                style={inputStyle}
                                disabled={readOnly || creating}
                            />
                            {createErrors.target_completion && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.target_completion}</div>}
                        </label>
                        */}

                        <label style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Remarks</div>
                            <TextareaInput
                                value={createData.remarks}
                                onChange={(event) => setCreateData('remarks', event.target.value)}
                                disabled={readOnly || creating}
                                style={{ ...inputStyle, minHeight: 90 }}
                            />
                            {createErrors.remarks && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.remarks}</div>}
                        </label>

                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <ActionButton type="button" onClick={() => setShowCreateModal(false)} disabled={creating} style={{ padding: '10px 16px', fontSize: 13 }}>
                                Cancel
                            </ActionButton>
                            <ActionButton type="submit" variant="success" disabled={creating || readOnly} style={{ padding: '10px 16px', fontSize: 13 }}>
                                {creating ? 'Adding...' : 'Add Scope'}
                            </ActionButton>
                        </div>
                    </form>
                </Modal>

                <ConfirmationModal
                    open={!!scopeToDelete}
                    title="Delete Scope"
                    message={scopeToDelete ? `Delete "${scopeToDelete.scope_name}"? This action cannot be undone.` : 'Delete this scope?'}
                    confirmLabel={deleting ? 'Deleting...' : 'Delete'}
                    cancelLabel="Cancel"
                    danger
                    processing={deleting}
                    onClose={closeDeleteModal}
                    onConfirm={confirmDeleteScope}
                />
                <ConfirmationModal
                    open={!!photoToDelete}
                    title="Delete Scope Photo"
                    message={
                        photoToDelete
                            ? `Delete this photo${photoToDelete.caption ? ` "${photoToDelete.caption}"` : ''}? This action cannot be undone.`
                            : 'Delete this photo?'
                    }
                    confirmLabel={deletingPhoto ? 'Deleting...' : 'Delete'}
                    cancelLabel="Cancel"
                    danger
                    processing={deletingPhoto}
                    onClose={closeDeletePhoto}
                    onConfirm={confirmDeletePhoto}
                />
                <Modal
                    open={showHistoryModal}
                    onClose={closeHistoryModal}
                    title="Weekly Progress History Comparison"
                    maxWidth={1200}
                >
                    <div style={{ display: 'grid', gap: 14 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                flexWrap: 'wrap',
                                padding: 12,
                                borderRadius: 10,
                                border: '1px solid var(--border-color)',
                                background: 'var(--surface-2)',
                            }}
                        >
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <ActionButton
                                    type="button"
                                    onClick={goToPreviousHistoryWeek}
                                    disabled={!previousHistoryWeekStart}
                                    style={{ padding: '8px 12px', fontSize: 12 }}
                                >
                                    Prev Week
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    onClick={goToNextHistoryWeek}
                                    disabled={!nextHistoryWeekStart}
                                    style={{ padding: '8px 12px', fontSize: 12 }}
                                >
                                    Next Week
                                </ActionButton>
                            </div>

                            <div style={{ minWidth: 240 }}>
                                <SelectInput
                                    value={activeHistoryWeekStart}
                                    onChange={(event) => setHistoryWeekStart(event.target.value)}
                                    style={{ ...inputStyle, padding: '8px 10px' }}
                                >
                                    {effectiveHistoryWeekStarts.map((weekStart) => (
                                        <option key={weekStart} value={weekStart}>
                                            {`${formatWeekLabel(weekStart)} (${weekStart})`}
                                        </option>
                                    ))}
                                </SelectInput>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                            <div style={{ ...cardStyle, padding: 12 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                    Selected Week
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>{formatWeekLabel(activeHistoryWeekStart)}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeHistoryWeekStart || '-'}</div>
                            </div>
                            <div style={{ ...cardStyle, padding: 12 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                    Compared Week
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>
                                    {previousHistoryWeekStart ? formatWeekLabel(previousHistoryWeekStart) : 'No previous week'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{previousHistoryWeekStart || '-'}</div>
                            </div>
                            <div style={{ ...cardStyle, padding: 12 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                    Weighted Progress
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>{formatPercent(historySummary.currentWeighted)}</div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: historySummary.deltaWeighted >= 0 ? '#16a34a' : '#dc2626',
                                        marginTop: 2,
                                    }}
                                >
                                    {formatSignedPercent(historySummary.deltaWeighted)} vs previous
                                </div>
                            </div>
                            <div style={{ ...cardStyle, padding: 12 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                    Accomplishment Amount
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>{money(historySummary.currentAmount)}</div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: historySummary.deltaAmount >= 0 ? '#16a34a' : '#dc2626',
                                        marginTop: 2,
                                    }}
                                >
                                    {formatSignedMoney(historySummary.deltaAmount)} vs previous
                                </div>
                            </div>
                        </div>

                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ maxHeight: 430, overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr>
                                            {[
                                                'Scope',
                                                'Weight',
                                                'Prev %',
                                                'Current %',
                                                'Delta %',
                                                'Prev WT %',
                                                'Current WT %',
                                                'Delta WT %',
                                                'Prev Accomp Amount',
                                                'Current Accomp Amount',
                                                'Delta Amount',
                                            ].map((label) => (
                                                <th
                                                    key={label}
                                                    style={{
                                                        textAlign: 'left',
                                                        borderBottom: '1px solid var(--border-color)',
                                                        padding: '10px 8px',
                                                        fontSize: 12,
                                                        color: 'var(--text-muted)',
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap',
                                                        background: 'var(--surface-1)',
                                                        position: 'sticky',
                                                        top: 0,
                                                        zIndex: 1,
                                                    }}
                                                >
                                                    {label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyRows.map((row) => (
                                            <tr key={row.scope_key}>
                                                <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', minWidth: 220 }}>
                                                    {row.scope_name}
                                                </td>
                                                <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                                    {formatPercent(row.weight_percent)}
                                                </td>
                                                <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                                    {formatPercent(row.previous_progress)}
                                                </td>
                                                <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                    {formatPercent(row.current_progress)}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '10px 8px',
                                                        borderBottom: '1px solid var(--border-color)',
                                                        whiteSpace: 'nowrap',
                                                        color: row.delta_progress >= 0 ? '#16a34a' : '#dc2626',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {formatSignedPercent(row.delta_progress)}
                                                </td>
                                                <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                                    {formatPercent(row.previous_weighted)}
                                                </td>
                                                <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                    {formatPercent(row.current_weighted)}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '10px 8px',
                                                        borderBottom: '1px solid var(--border-color)',
                                                        whiteSpace: 'nowrap',
                                                        color: row.delta_weighted >= 0 ? '#16a34a' : '#dc2626',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {formatSignedPercent(row.delta_weighted)}
                                                </td>
                                                <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                                    {money(row.previous_amount)}
                                                </td>
                                                <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                    {money(row.current_amount)}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '10px 8px',
                                                        borderBottom: '1px solid var(--border-color)',
                                                        whiteSpace: 'nowrap',
                                                        color: row.delta_amount >= 0 ? '#16a34a' : '#dc2626',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {formatSignedMoney(row.delta_amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </Modal>
                <Modal
                    open={showSortModal}
                    onClose={closeSortModal}
                    title="Manage Scope Sorting"
                    maxWidth={640}
                >
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Drag scopes to rearrange their order. This will affect the weekly progress form and progress receipt.
                        </div>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                            {sortDraftScopes.length === 0 ? (
                                <div style={{ padding: 16, color: 'var(--text-muted)' }}>No scopes available.</div>
                            ) : (
                                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                                    {sortDraftScopes.map((scope) => (
                                        <div
                                            key={scope.id}
                                            onDragOver={handleSortDragOver(scope.id)}
                                            onDrop={handleSortDrop(scope.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                padding: '10px 12px',
                                                borderBottom: '1px solid var(--border-color)',
                                                background: sortDropTargetId === scope.id ? 'var(--surface-2)' : 'transparent',
                                                opacity: sortDraggingId === scope.id ? 0.6 : 1,
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onDragStart={handleSortDragStart(scope.id)}
                                                onDragEnd={handleSortDragEnd}
                                                draggable={!readOnly && !reordering}
                                                title="Drag to reorder"
                                                style={{
                                                    border: '1px solid var(--border-color)',
                                                    background: 'var(--surface-2)',
                                                    color: 'var(--text-muted)',
                                                    borderRadius: 6,
                                                    padding: 4,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: readOnly || reordering ? 'not-allowed' : 'grab',
                                                }}
                                            >
                                                <GripVertical size={14} />
                                            </button>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{scope.scope_name}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <ActionButton type="button" onClick={closeSortModal} disabled={reordering}>
                                Cancel
                            </ActionButton>
                            <ActionButton
                                type="button"
                                variant="success"
                                onClick={saveSortOrder}
                                disabled={reordering || sortDraftScopes.length === 0}
                            >
                                {reordering ? 'Saving...' : 'Save Order'}
                            </ActionButton>
                        </div>
                    </div>
                </Modal>
                <Modal
                    open={!!previewPhoto}
                    onClose={closeScopePreview}
                    title={previewPhoto?.caption || previewScope?.scope_name || 'Scope Photo'}
                    headerContent={previewPhoto ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {previewScope?.scope_name ? `Scope: ${previewScope.scope_name}` : null}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text-muted)' }}>
                                    {`${previewIndex + 1} / ${previewPhotos.length}`}
                                </span>
                                <ActionButton
                                    type="button"
                                    onClick={goPrevScopePhoto}
                                    disabled={!canPrevPhoto}
                                    style={{ padding: '6px 10px', fontSize: 12 }}
                                >
                                    Prev
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    onClick={goNextScopePhoto}
                                    disabled={!canNextPhoto}
                                    style={{ padding: '6px 10px', fontSize: 12 }}
                                >
                                    Next
                                </ActionButton>
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
                                alt={previewPhoto.caption || previewScope?.scope_name || 'Scope photo'}
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
                                {previewScope?.scope_name ? `Scope: ${previewScope.scope_name}` : null}
                                {previewScope?.scope_name && previewPhoto.created_at ? ' | ' : ''}
                                {formatYmdHmAmPm(previewPhoto.created_at)}
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </>
    );

    return (
        <>
            {!embedded && <Head title={`Monitoring Board #${project.id}`} />}
            {embedded ? (
                <div>{content}</div>
            ) : (
                <Layout title={`Monitoring Board - Project #${project.id}`}>{content}</Layout>
            )}
            <style>{`
                .bb-photo-tile .bb-photo-delete{
                    opacity:0;
                    pointer-events:none;
                    transform:translateY(0);
                    transition:opacity 160ms ease, transform 160ms ease;
                }
                .bb-photo-tile:hover .bb-photo-delete,
                .bb-photo-tile:focus-within .bb-photo-delete{
                    opacity:1;
                    pointer-events:auto;
                    transform:translateY(-1px);
                }
            `}</style>
        </>
    );
}
