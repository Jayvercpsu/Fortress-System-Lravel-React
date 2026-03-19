import ActionButton from './ActionButton';
import EditModal from './EditModal';
import ConfirmationModal from './ConfirmationModal';
import Modal from './Modal';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import TextareaInput from './TextareaInput';
import DatePickerInput from './DatePickerInput';
import SearchableDropdown from './SearchableDropdown';
import ClientSelectInput from './ClientSelectInput';
import Layout from './Layout';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Trash2 } from 'lucide-react';
import OptimizedImage from './OptimizedImage';

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
};

const shortcutPill = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid var(--border-color)',
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'var(--surface-2)',
};

const boardShell = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    padding: 16,
    display: 'grid',
    gap: 16,
    color: 'var(--text-main)',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
};

const boardToolbar = {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
};

const boardPanel = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
};

const boardInputStyle = {
    width: '100%',
    background: 'var(--surface-1)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '9px 10px',
    fontSize: 12,
    boxSizing: 'border-box',
};

const boardTableHeaderCell = {
    textAlign: 'left',
    border: '1px solid color-mix(in srgb, var(--border-color) 85%, transparent)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    padding: '10px 8px',
    whiteSpace: 'nowrap',
};

const boardTableCell = {
    padding: '10px 8px',
    border: '1px solid color-mix(in srgb, var(--border-color) 85%, transparent)',
    whiteSpace: 'nowrap',
    color: 'var(--text-main)',
};

const actionDropdownStyle = {
    minHeight: 34,
    padding: '6px 10px',
    borderRadius: 10,
    background: 'var(--surface-1)',
    fontSize: 12,
};

const selectionToggleStyle = {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: '1px solid color-mix(in srgb, var(--border-color) 85%, transparent)',
    background: 'var(--surface-1)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    padding: 0,
};

const selectionToggleActiveStyle = {
    background: 'var(--active-bg)',
    borderColor: 'color-mix(in srgb, var(--active-text) 60%, var(--border-color))',
    color: 'var(--active-text)',
};

const selectionHeaderStyle = {
    textAlign: 'center',
    width: 36,
    position: 'sticky',
    left: 0,
    zIndex: 3,
    background: 'var(--surface-2)',
};

const selectionCellStyle = {
    textAlign: 'center',
    width: 36,
    position: 'sticky',
    left: 0,
    zIndex: 2,
    background: 'var(--surface-2)',
};

const progressHeaderStyle = {
    textAlign: 'center',
};

const progressCellStyle = {
    textAlign: 'center',
};

const progressCircleSize = 44;
const progressCircleStroke = 4;
const progressCircleRadius = 16;
const progressCircleCircumference = 2 * Math.PI * progressCircleRadius;
const progressCircleCenter = progressCircleSize / 2;
const PROJECT_TYPE_OPTIONS = ['2Storey', '3Storey', 'w/ Roofdeck', 'Bungalow', 'Commercial', 'Renovation'];
const OTHER_PROJECT_TYPE_OPTION = '__OTHER__';
const OTHER_DEPARTMENT_OPTION = '__OTHER_DEPARTMENT__';

const statusBadgeBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    border: '1px solid transparent',
    background: 'var(--surface-1)',
    color: 'var(--text-main)',
};

const statusBadgeTones = {
    PROPOSAL: {
        backgroundColor: 'var(--status-proposal-bg)',
        borderColor: 'var(--status-proposal-border)',
        color: 'var(--status-proposal-text)',
    },
    IN_REVIEW: {
        backgroundColor: 'var(--status-review-bg)',
        borderColor: 'var(--status-review-border)',
        color: 'var(--status-review-text)',
    },
    APPROVED: {
        backgroundColor: 'var(--status-approved-bg)',
        borderColor: 'var(--status-approved-border)',
        color: 'var(--status-approved-text)',
    },
    DONE: {
        backgroundColor: 'var(--status-done-bg)',
        borderColor: 'var(--status-done-border)',
        color: 'var(--status-done-text)',
    },
};

const deletedBadgeStyle = {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    color: '#f87171',
};

const groupColors = ['#38bdf8', '#a3e635', '#fbbf24', '#f472b6', '#f97316', '#22d3ee', '#c084fc'];

const normalizeGroupKey = (value) => {
    const trimmed = String(value || '').trim();
    return trimmed === '' ? 'General' : trimmed;
};

const normalizeStatus = (status, fallback) => {
    const normalized = String(status || '').trim().toUpperCase();
    return normalized === '' ? fallback : normalized;
};

const normalizeProgressValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
};

const parseTimelineRange = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return { start: '', end: '' };
    const match = raw.split(/\s+(?:to|–|—|-)\s+/i);
    if (match.length >= 2) {
        const start = match[0]?.trim() || '';
        const end = match.slice(1).join(' - ').trim();
        return { start, end };
    }
    return { start: raw, end: '' };
};

const buildTimelineRange = (start, end) => {
    const safeStart = String(start || '').trim();
    const safeEnd = String(end || '').trim();
    if (safeStart && safeEnd) return `${safeStart} to ${safeEnd}`;
    if (safeStart) return safeStart;
    if (safeEnd) return safeEnd;
    return '';
};

const sortOptions = [
    { value: 'default', label: 'Default' },
    { value: 'project_name', label: 'Project Name' },
    { value: 'client_name', label: 'Client Name' },
    { value: 'start_date', label: 'Start Date' },
    { value: 'due_date', label: 'Due Date' },
    { value: 'date_paid', label: 'Date Paid' },
    { value: 'progress_percent', label: 'Progress %' },
    { value: 'status', label: 'Status' },
];

const sortDirectionOptions = [
    { value: 'asc', label: 'Asc' },
    { value: 'desc', label: 'Desc' },
];

const getSortValue = (row, key) => {
    const raw = row?.[key];
    if (key === 'progress_percent') {
        const numeric = Number(raw);
        return Number.isFinite(numeric) ? numeric : null;
    }
    if (key === 'created_at') {
        const createdAt = raw ? Date.parse(raw) : NaN;
        if (Number.isFinite(createdAt)) return createdAt;
        const updatedAt = row?.updated_at ? Date.parse(row.updated_at) : NaN;
        if (Number.isFinite(updatedAt)) return updatedAt;
        const fallbackId = Number(row?.id);
        return Number.isFinite(fallbackId) ? fallbackId : null;
    }
    if (key === 'updated_at') {
        const updatedAt = raw ? Date.parse(raw) : NaN;
        if (Number.isFinite(updatedAt)) return updatedAt;
        const fallbackId = Number(row?.id);
        return Number.isFinite(fallbackId) ? fallbackId : null;
    }
    if (key.endsWith('_date')) {
        const timestamp = raw ? Date.parse(raw) : NaN;
        return Number.isFinite(timestamp) ? timestamp : null;
    }
    if (raw == null || raw === '') return null;
    return String(raw).toLowerCase();
};

const sortRows = (rows, sortKey, sortDir) => {
    if (!sortKey) return rows;
    const effectiveKey = sortKey === 'default' ? 'created_at' : sortKey;
    const direction = sortDir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
        const left = getSortValue(a, effectiveKey);
        const right = getSortValue(b, effectiveKey);
        if (left == null && right == null) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        if (left < right) return -1 * direction;
        if (left > right) return 1 * direction;
        return 0;
    });
};

const getStatusBadgeStyle = (statusValue) => {
    const normalized = normalizeStatus(statusValue, '');
    return statusBadgeTones[normalized] ?? {
        backgroundColor: 'var(--surface-1)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-main)',
    };
};

const formatDate = (value) => (value ? String(value) : '-');
const isImageFile = (file) => {
    const mime = String(file?.mime_type || '').toLowerCase();
    if (mime.startsWith('image/')) return true;
    const name = String(file?.original_name || '').toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].some((ext) => name.endsWith(ext));
};

export default function MonitoringBoardIndexPage({
    items = [],
    status_options: statusOptions = [],
    clientOptions = [],
    foremanOptions = [],
}) {
    const resolvedStatusOptions = statusOptions.length > 0 ? statusOptions : ['PROPOSAL', 'IN_REVIEW', 'APPROVED', 'DONE'];
    const resolveOptionLabel = (option) => option?.label ?? option?.name ?? option?.fullname ?? String(option ?? '');
    const resolveOptionValue = (option) => option?.value ?? option?.label ?? option?.fullname ?? option?.name ?? option;
    const withCurrentOption = (options, value) => {
        const normalizedValue = String(value ?? '').trim();
        if (!normalizedValue) return options;
        const hasValue = options.some((option) => String(resolveOptionValue(option)) === normalizedValue);
        if (hasValue) return options;
        return [{ label: normalizedValue, value: normalizedValue, missing: true }, ...options];
    };

    const {
        data: createData,
        setData: setCreateData,
        post,
        processing: creating,
        errors: createErrors,
        reset: resetCreateData,
    } = useForm({
        department: '',
        client_name: '',
        project_name: '',
        project_type: PROJECT_TYPE_OPTIONS[0],
        location: '',
        assigned_to: '',
        status: resolvedStatusOptions[0],
        start_date: '',
        timeline: '',
        due_date: '',
        date_paid: '',
        progress_percent: 0,
        remarks: '',
    });

    const {
        data: fileData,
        setData: setFileData,
        post: postFile,
        processing: uploadingFile,
        errors: fileErrors,
        reset: resetFileData,
    } = useForm({
        file: null,
    });

    const {
        data: editData,
        setData: setEditData,
        patch,
        processing: updating,
        errors: editErrors,
        clearErrors: clearEditErrors,
    } = useForm({
        department: '',
        client_name: '',
        project_name: '',
        project_type: PROJECT_TYPE_OPTIONS[0],
        location: '',
        assigned_to: '',
        status: resolvedStatusOptions[0],
        start_date: '',
        timeline: '',
        due_date: '',
        date_paid: '',
        progress_percent: 0,
        remarks: '',
    });
    const baseForemanOptions = Array.isArray(foremanOptions) ? foremanOptions : [];
    const foremanSelectOptions = withCurrentOption(baseForemanOptions, createData.assigned_to);
    const foremanEditOptions = withCurrentOption(baseForemanOptions, editData.assigned_to);
    const foremanFooter = (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Can&apos;t find a foreman?</span>
            <ActionButton href="/users/create?role=foreman" variant="view" style={{ padding: '6px 10px', fontSize: 11 }}>
                Add foreman
            </ActionButton>
        </div>
    );
    const [projectTypeOption, setProjectTypeOption] = useState(PROJECT_TYPE_OPTIONS[0]);
    const [customProjectType, setCustomProjectType] = useState('');
    const [editProjectTypeOption, setEditProjectTypeOption] = useState(PROJECT_TYPE_OPTIONS[0]);
    const [editCustomProjectType, setEditCustomProjectType] = useState('');
    const [departmentOption, setDepartmentOption] = useState('');
    const [customDepartment, setCustomDepartment] = useState('');
    const [editDepartmentOption, setEditDepartmentOption] = useState('');
    const [editCustomDepartment, setEditCustomDepartment] = useState('');

    const departmentOptions = useMemo(() => {
        const map = new Map();
        items.forEach((item) => {
            const raw = String(item?.department || '').trim();
            if (!raw) return;
            const key = raw.toLowerCase();
            if (!map.has(key)) {
                map.set(key, raw);
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [items]);

    const handleProjectTypeOptionChange = (value) => {
        setProjectTypeOption(value);
        if (value === OTHER_PROJECT_TYPE_OPTION) {
            setCreateData('project_type', customProjectType.trim());
            return;
        }
        setCustomProjectType('');
        setCreateData('project_type', value);
    };

    const handleEditProjectTypeOptionChange = (value) => {
        setEditProjectTypeOption(value);
        if (value === OTHER_PROJECT_TYPE_OPTION) {
            setEditData('project_type', editCustomProjectType.trim());
            return;
        }
        setEditCustomProjectType('');
        setEditData('project_type', value);
    };

    const handleDepartmentOptionChange = (value) => {
        setDepartmentOption(value);
        if (value === OTHER_DEPARTMENT_OPTION) {
            setCreateData('department', customDepartment.trim());
            return;
        }
        setCustomDepartment('');
        setCreateData('department', value);
    };

    const handleEditDepartmentOptionChange = (value) => {
        setEditDepartmentOption(value);
        if (value === OTHER_DEPARTMENT_OPTION) {
            setEditData('department', editCustomDepartment.trim());
            return;
        }
        setEditCustomDepartment('');
        setEditData('department', value);
    };

    const [search, setSearch] = useState('');
    const [editItem, setEditItem] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [filesItem, setFilesItem] = useState(null);
    const [fileToDelete, setFileToDelete] = useState(null);
    const [deletingFileId, setDeletingFileId] = useState(null);
    const [filesPage, setFilesPage] = useState(1);
    const [previewFile, setPreviewFile] = useState(null);
    const [collapsedDepartments, setCollapsedDepartments] = useState({});
    const [selectedRowsByDepartment, setSelectedRowsByDepartment] = useState({});
    const [bulkActionByDepartment, setBulkActionByDepartment] = useState({});
    const [bulkDeleteIds, setBulkDeleteIds] = useState([]);
    const [bulkDeleteDepartment, setBulkDeleteDepartment] = useState(null);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [globalSort, setGlobalSort] = useState({ key: 'default', dir: 'desc' });
    const [departmentSort, setDepartmentSort] = useState({});

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const createFlag = params.get('create');
        if (createFlag === '1' || createFlag === 'true') {
            setShowCreateModal(true);
        }
    }, []);

    useEffect(() => {
        if (!filesItem) return;
        const updated = items.find((item) => item.id === filesItem.id);
        if (updated && updated !== filesItem) {
            setFilesItem(updated);
        }
    }, [items, filesItem]);

    useEffect(() => {
        if (filesItem) {
            setFilesPage(1);
        }
    }, [filesItem?.id]);

    const filesList = filesItem?.files ?? [];
    const filesPerPage = 5;
    const filesPageCount = Math.max(1, Math.ceil(filesList.length / filesPerPage));
    const safeFilesPage = Math.min(filesPage, filesPageCount);
    const filesStartIndex = (safeFilesPage - 1) * filesPerPage;
    const filesEndIndex = Math.min(filesStartIndex + filesPerPage, filesList.length);
    const pagedFiles = filesList.slice(filesStartIndex, filesEndIndex);

    useEffect(() => {
        if (filesPage > filesPageCount) {
            setFilesPage(filesPageCount);
        }
    }, [filesPage, filesPageCount]);

    const groupedItems = useMemo(() => {
        const needle = String(search || '').trim().toLowerCase();
        const filtered = needle === ''
            ? items
            : items.filter((item) => (
                [
                    item.department,
                    item.client_name,
                    item.project_name,
                    item.project_type,
                    item.location,
                    item.assigned_to,
                    item.status,
                ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(needle))
            ));

        const groups = new Map();
        filtered.forEach((item) => {
            const key = normalizeGroupKey(item.department);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(item);
        });

        return Array.from(groups.entries())
            .map(([department, rows]) => {
                const latestCreated = rows.reduce((maxValue, row) => {
                    const timestamp = row?.created_at ? Date.parse(row.created_at) : NaN;
                    if (!Number.isFinite(timestamp)) return maxValue;
                    return Math.max(maxValue, timestamp);
                }, 0);
                return { department, rows, latestCreated };
            })
            .sort((a, b) => {
                if (b.latestCreated !== a.latestCreated) return b.latestCreated - a.latestCreated;
                return a.department.localeCompare(b.department);
            })
            .map(({ department, rows }) => ({ department, rows }));
    }, [items, search]);

    useEffect(() => {
        if (groupedItems.length === 0) return;
        setCollapsedDepartments((prev) => {
            const next = { ...prev };
            groupedItems.forEach((group, index) => {
                if (!(group.department in next)) {
                    next[group.department] = false;
                }
            });
            return next;
        });
    }, [groupedItems]);

    useEffect(() => {
        if (groupedItems.length === 0) return;
        setSelectedRowsByDepartment((prev) => {
            const next = {};
            groupedItems.forEach((group) => {
                const validIds = group.rows.map((row) => row.id);
                const selected = (prev[group.department] || []).filter((id) => validIds.includes(id));
                next[group.department] = selected;
            });
            return next;
        });
    }, [groupedItems]);

    useEffect(() => {
        if (groupedItems.length === 0) return;
        setBulkActionByDepartment((prev) => {
            const next = { ...prev };
            groupedItems.forEach((group) => {
                const selectedIds = selectedRowsByDepartment[group.department] || [];
                const selectedRows = group.rows.filter((row) => selectedIds.includes(row.id));
                const canEdit = selectedIds.length === 1 && !selectedRows[0]?.project_id;
                if (selectedIds.length === 0) {
                    next[group.department] = '';
                    return;
                }
                if (next[group.department] === 'edit' && !canEdit) {
                    next[group.department] = '';
                }
            });
            return next;
        });
    }, [groupedItems, selectedRowsByDepartment]);

    useEffect(() => {
        if (departmentOptions.length === 0) return;
        if (departmentOption === OTHER_DEPARTMENT_OPTION) return;
        if (!createData.department) {
            const first = departmentOptions[0];
            setDepartmentOption(first);
            setCustomDepartment('');
            setCreateData('department', first);
            return;
        }
        const isPreset = departmentOptions.includes(createData.department);
        setDepartmentOption(isPreset ? createData.department : OTHER_DEPARTMENT_OPTION);
        setCustomDepartment(isPreset ? '' : createData.department);
    }, [departmentOptions, createData.department, setCreateData, departmentOption]);

    const toggleDepartment = (department) => {
        setCollapsedDepartments((prev) => ({ ...prev, [department]: !prev[department] }));
    };

    const updateDepartmentSort = (department, next) => {
        setDepartmentSort((prev) => {
            const base = { ...globalSort, ...(prev[department] || {}) };
            return { ...prev, [department]: { ...base, ...next } };
        });
    };

    const toggleRowSelection = (department, rowId) => {
        setSelectedRowsByDepartment((prev) => {
            const current = new Set(prev[department] || []);
            if (current.has(rowId)) {
                current.delete(rowId);
            } else {
                current.add(rowId);
            }
            return { ...prev, [department]: Array.from(current) };
        });
    };

    const toggleSelectAllRows = (department, rowIds) => {
        setSelectedRowsByDepartment((prev) => {
            const current = prev[department] || [];
            const allSelected = rowIds.length > 0 && rowIds.every((id) => current.includes(id));
            return { ...prev, [department]: allSelected ? [] : rowIds };
        });
    };

    const clearDepartmentSelection = (department) => {
        setSelectedRowsByDepartment((prev) => ({ ...prev, [department]: [] }));
        setBulkActionByDepartment((prev) => ({ ...prev, [department]: '' }));
    };

    const submitCreate = (event) => {
        event.preventDefault();
        post('/monitoring-board', {
            preserveScroll: true,
            onSuccess: () => {
                resetCreateData();
                setProjectTypeOption(PROJECT_TYPE_OPTIONS[0]);
                setCustomProjectType('');
                setDepartmentOption(departmentOptions[0] ?? '');
                setCustomDepartment('');
                setCreateData('progress_percent', 0);
                setCreateData('status', resolvedStatusOptions[0]);
                setCreateData('project_type', PROJECT_TYPE_OPTIONS[0]);
                setShowCreateModal(false);
                toast.success('Monitoring entry added.');
            },
            onError: () => toast.error('Unable to add entry.'),
        });
    };

    const openEdit = (item) => {
        const initialProjectType = String(item.project_type ?? '').trim();
        const isPresetType = PROJECT_TYPE_OPTIONS.includes(initialProjectType);
        const initialDepartment = String(item.department ?? '').trim();
        const isPresetDepartment = departmentOptions.includes(initialDepartment);
        setEditItem(item);
        if (clearEditErrors) clearEditErrors();
        setEditProjectTypeOption(isPresetType ? initialProjectType : OTHER_PROJECT_TYPE_OPTION);
        setEditCustomProjectType(isPresetType ? '' : initialProjectType);
        setEditDepartmentOption(
            departmentOptions.length > 0
                ? (isPresetDepartment ? initialDepartment : OTHER_DEPARTMENT_OPTION)
                : ''
        );
        setEditCustomDepartment(isPresetDepartment ? '' : initialDepartment);
        setEditData({
            department: item.department ?? '',
            client_name: item.client_name ?? '',
            project_name: item.project_name ?? '',
            project_type: item.project_type ?? '',
            location: item.location ?? '',
            assigned_to: item.assigned_to ?? '',
            status: normalizeStatus(item.status, resolvedStatusOptions[0]),
            start_date: item.start_date ?? '',
            timeline: item.timeline ?? '',
            due_date: item.due_date ?? '',
            date_paid: item.date_paid ?? '',
            progress_percent: Number(item.progress_percent ?? 0),
            remarks: item.remarks ?? '',
        });
    };

    const closeEdit = () => {
        if (updating) return;
        setEditItem(null);
        if (clearEditErrors) clearEditErrors();
    };

    const submitEdit = (event) => {
        event.preventDefault();
        if (!editItem) return;
        patch(`/monitoring-board/${editItem.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditItem(null);
                toast.success('Monitoring entry updated.');
            },
            onError: () => toast.error('Unable to update entry.'),
        });
    };

    const confirmDelete = () => {
        if (!itemToDelete) return;
        setDeletingId(itemToDelete.id);
        router.delete(`/monitoring-board/${itemToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setItemToDelete(null);
                toast.success('Monitoring entry deleted.');
            },
            onError: () => toast.error('Unable to delete entry.'),
            onFinish: () => setDeletingId(null),
        });
    };

    const requestBulkDelete = (department, ids) => {
        if (!ids.length) return;
        setBulkDeleteDepartment(department);
        setBulkDeleteIds(ids);
    };

    const confirmBulkDelete = () => {
        if (bulkDeleteIds.length === 0) return;
        const idsQueue = [...bulkDeleteIds];
        setBulkDeleting(true);

        const deleteNext = () => {
            if (idsQueue.length === 0) {
                setBulkDeleting(false);
                setBulkDeleteIds([]);
                if (bulkDeleteDepartment) {
                    clearDepartmentSelection(bulkDeleteDepartment);
                }
                setBulkDeleteDepartment(null);
                toast.success('Selected entries deleted.');
                return;
            }

            const currentId = idsQueue.shift();
            router.delete(`/monitoring-board/${currentId}`, {
                preserveScroll: true,
                onSuccess: () => deleteNext(),
                onError: () => {
                    setBulkDeleting(false);
                    setBulkDeleteIds([]);
                    setBulkDeleteDepartment(null);
                    toast.error('Unable to delete selected entries.');
                },
            });
        };

        deleteNext();
    };

    const openFiles = (item) => {
        setFilesItem(item);
        resetFileData();
        setFileToDelete(null);
        setFilesPage(1);
        setPreviewFile(null);
    };

    const closeFiles = () => {
        if (uploadingFile) return;
        setFilesItem(null);
        setFileToDelete(null);
        resetFileData();
        setPreviewFile(null);
    };

    const submitFile = (event) => {
        event.preventDefault();
        if (!filesItem) return;
        if (!fileData.file) {
            toast.error('Please choose a file.');
            return;
        }
        if (fileData.file.size > 5 * 1024 * 1024) {
            toast.error('File must be 5MB or smaller.');
            return;
        }
        const filesItemId = filesItem.id;

        postFile(`/monitoring-board/${filesItem.id}/files`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: (page) => {
                resetFileData();
                if (page?.props?.items && filesItemId) {
                    const updated = page.props.items.find((item) => item.id === filesItemId);
                    if (updated) setFilesItem(updated);
                }
                toast.success('File uploaded.');
            },
            onError: () => toast.error('Unable to upload file.'),
        });
    };

    const confirmDeleteFile = () => {
        if (!fileToDelete) return;
        const filesItemId = filesItem?.id;
        setDeletingFileId(fileToDelete.id);
        router.delete(`/monitoring-board-files/${fileToDelete.id}`, {
            preserveScroll: true,
            onSuccess: (page) => {
                setFileToDelete(null);
                if (previewFile?.id === fileToDelete.id) {
                    setPreviewFile(null);
                }
                if (page?.props?.items && filesItemId) {
                    const updated = page.props.items.find((item) => item.id === filesItemId);
                    if (updated) setFilesItem(updated);
                }
                toast.success('File deleted.');
            },
            onError: () => toast.error('Unable to delete file.'),
            onFinish: () => setDeletingFileId(null),
        });
    };

    return (
        <>
            <Head title="Monitoring Board" />
            <Layout title="Monitoring Board">
                <div style={boardShell}>
                    <div style={boardToolbar}>
                        <div style={{ flex: '1 1 360px', minWidth: 220, maxWidth: 520 }}>
                            <TextInput
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search"
                                style={boardInputStyle}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <ActionButton
                                type="button"
                                variant="success"
                                onClick={() => setShowCreateModal(true)}
                                style={{ padding: '8px 14px', fontSize: 12 }}
                            >
                                Add Entry
                            </ActionButton>
                            <div style={shortcutPill}>{items.length} items</div>
                        </div>
                    </div>

                {groupedItems.length === 0 ? (
                    <div style={{ ...boardPanel, fontSize: 13, color: 'var(--text-muted)' }}>No monitoring entries found.</div>
                ) : (
                    groupedItems.map((group, groupIndex) => {
                        const groupColor = groupColors[groupIndex % groupColors.length];
                        const isCollapsed = collapsedDepartments[group.department];
                        const rowIds = group.rows.map((row) => row.id);
                        const selectedIds = selectedRowsByDepartment[group.department] || [];
                        const selectedCount = selectedIds.length;
                        const allSelected = rowIds.length > 0 && selectedCount === rowIds.length;
                        const selectedRows = group.rows.filter((row) => selectedIds.includes(row.id));
                        const canEditSelection = selectedCount === 1 && !selectedRows[0]?.project_id;
                        const bulkActionValue = bulkActionByDepartment[group.department] || '';
                        const bulkActionOptions = canEditSelection
                            ? [
                                  { value: 'edit', label: 'Edit selected' },
                                  { value: 'delete', label: 'Delete selected' },
                              ]
                            : [{ value: 'delete', label: 'Delete selected' }];
                        const sortConfig = { ...globalSort, ...(departmentSort[group.department] || {}) };
                        const sortedRows = sortRows(group.rows, sortConfig.key, sortConfig.dir);
                        const stickyHeaderStyle = {
                            ...selectionHeaderStyle,
                            background: `color-mix(in srgb, ${groupColor} 14%, var(--surface-2))`,
                        };
                        const stickyCellStyle = {
                            ...selectionCellStyle,
                            background: `color-mix(in srgb, ${groupColor} 10%, var(--surface-1))`,
                        };

                        return (
                            <div key={group.department} style={boardPanel}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: 12,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                                        <span
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: '50%',
                                                background: groupColor,
                                            boxShadow: `0 0 0 3px ${groupColor}30`,
                                        }}
                                    />
                                        {group.department}
                                    </div>
                                    <ActionButton
                                        type="button"
                                        variant="danger"
                                        onClick={() => requestBulkDelete(group.department, rowIds)}
                                        disabled={rowIds.length === 0 || bulkDeleting}
                                        style={{ padding: '6px 10px', fontSize: 11 }}
                                        aria-label={`Delete ${group.department} entries`}
                                    >
                                        <Trash2 size={14} />
                                    </ActionButton>
                                </div>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                    marginTop: 8,
                                    marginBottom: 12,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ minWidth: 180 }}>
                                        <SearchableDropdown
                                            options={bulkActionOptions}
                                            value={bulkActionValue}
                                            onChange={(value) => {
                                                setBulkActionByDepartment((prev) => ({ ...prev, [group.department]: value }));
                                                if (!value) return;
                                                if (value === 'edit' && canEditSelection) {
                                                    openEdit(selectedRows[0]);
                                                    clearDepartmentSelection(group.department);
                                                    return;
                                                }
                                                if (value === 'delete') {
                                                    requestBulkDelete(group.department, selectedIds);
                                                }
                                            }}
                                            placeholder="Select action"
                                            searchPlaceholder="Search actions..."
                                            emptyMessage="No actions available"
                                            disabled={selectedCount === 0}
                                            getOptionLabel={(option) => option.label}
                                            getOptionValue={(option) => option.value}
                                            style={{ ...actionDropdownStyle, minHeight: 32, padding: '5px 10px' }}
                                            dropdownWidth={220}
                                        />
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        {selectedCount} selected
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sort</span>
                                    <SelectInput
                                        value={sortConfig.key}
                                        onChange={(event) => updateDepartmentSort(group.department, { key: event.target.value })}
                                        style={{ ...boardInputStyle, width: 150, padding: '6px 8px', fontSize: 11 }}
                                    >
                                        {sortOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </SelectInput>
                                    <SelectInput
                                        value={sortConfig.dir}
                                        onChange={(event) => updateDepartmentSort(group.department, { dir: event.target.value })}
                                        style={{ ...boardInputStyle, width: 80, padding: '6px 8px', fontSize: 11 }}
                                    >
                                        {sortDirectionOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </SelectInput>
                                </div>
                            </div>
                            {!isCollapsed && (
                                <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', minWidth: 0 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1500 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...boardTableHeaderCell, ...stickyHeaderStyle }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSelectAllRows(group.department, rowIds)}
                                                        disabled={rowIds.length === 0}
                                                        aria-label="Select all rows"
                                                        style={{
                                                            ...selectionToggleStyle,
                                                            ...(allSelected ? selectionToggleActiveStyle : {}),
                                                            ...(rowIds.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                                                        }}
                                                    >
                                                        {allSelected ? <Check size={12} /> : null}
                                                    </button>
                                                </th>
                                                {[
                                                    'Project',
                                                    'Client',
                                                    'Type',
                                                    'Location',
                                                    'Assigned',
                                                    'Start Date',
                                                    'Timeline',
                                                    'Due Date',
                                                    'Date Paid',
                                                    'Status',
                                                    'Progress',
                                                    'Files',
                                                    'Converted',
                                                ].map((label) => (
                                                    <th
                                                        key={label}
                                                        style={label === 'Progress' ? { ...boardTableHeaderCell, ...progressHeaderStyle } : boardTableHeaderCell}
                                                    >
                                                        {label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedRows.map((item) => {
                                                const isConverted = Boolean(item.project_id);
                                                const isProjectDeleted = Boolean(item.project_deleted);
                                                const progressValue = normalizeProgressValue(item.progress_percent);
                                                const statusValue = item.status ?? resolvedStatusOptions[0];
                                                const fileCount = Array.isArray(item.files) ? item.files.length : 0;
                                                const timelineRange = parseTimelineRange(item.timeline);
                                                const progressDashOffset = progressCircleCircumference - (progressValue / 100) * progressCircleCircumference;

                                                return (
                                                    <tr key={item.id}>
                                                        <td style={{ ...boardTableCell, ...stickyCellStyle }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleRowSelection(group.department, item.id)}
                                                                aria-label={`Select ${item.project_name}`}
                                                                style={{
                                                                    ...selectionToggleStyle,
                                                                    ...(selectedIds.includes(item.id) ? selectionToggleActiveStyle : {}),
                                                                }}
                                                            >
                                                                {selectedIds.includes(item.id) ? <Check size={12} /> : null}
                                                            </button>
                                                        </td>
                                                        <td style={{ ...boardTableCell, fontWeight: 600 }}>{item.project_name}</td>
                                                        <td style={boardTableCell}>{item.client_name}</td>
                                                        <td style={boardTableCell}>{item.project_type}</td>
                                                        <td style={boardTableCell}>{item.location}</td>
                                                        <td style={boardTableCell}>{item.assigned_to || '-'}</td>
                                                        <td style={boardTableCell}>{formatDate(item.start_date)}</td>
                                                        <td style={boardTableCell}>
                                                            {timelineRange.start || timelineRange.end ? (
                                                                <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                                                                    {timelineRange.start ? (
                                                                        <span
                                                                            style={{
                                                                                padding: '4px 10px',
                                                                                borderRadius: 999,
                                                                                fontSize: 11,
                                                                                fontWeight: 600,
                                                                                background: 'var(--status-review-bg)',
                                                                                color: 'var(--status-review-text)',
                                                                                border: '1px solid var(--status-review-border)',
                                                                                whiteSpace: 'nowrap',
                                                                            }}
                                                                        >
                                                                            {timelineRange.start}
                                                                        </span>
                                                                    ) : null}
                                                                    {timelineRange.end ? (
                                                                        <span
                                                                            style={{
                                                                                padding: '4px 10px',
                                                                                borderRadius: 999,
                                                                                fontSize: 11,
                                                                                fontWeight: 600,
                                                                                background: 'var(--surface-2)',
                                                                                color: 'var(--text-main)',
                                                                                border: '1px solid var(--border-color)',
                                                                                whiteSpace: 'nowrap',
                                                                            }}
                                                                        >
                                                                            {timelineRange.end}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            ) : (
                                                                '-'
                                                            )}
                                                        </td>
                                                        <td style={boardTableCell}>{formatDate(item.due_date)}</td>
                                                        <td style={boardTableCell}>{formatDate(item.date_paid)}</td>
                                                        <td style={boardTableCell}>
                                                            <span style={{ ...statusBadgeBase, ...getStatusBadgeStyle(statusValue) }}>
                                                                {statusValue}
                                                            </span>
                                                        </td>
                                                        <td style={{ ...boardTableCell, ...progressCellStyle }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 70 }}>
                                                                <div style={{ position: 'relative', width: progressCircleSize, height: progressCircleSize }}>
                                                                    <svg
                                                                        width={progressCircleSize}
                                                                        height={progressCircleSize}
                                                                        viewBox={`0 0 ${progressCircleSize} ${progressCircleSize}`}
                                                                        style={{ transform: 'rotate(-90deg)' }}
                                                                    >
                                                                        <circle
                                                                            cx={progressCircleCenter}
                                                                            cy={progressCircleCenter}
                                                                            r={progressCircleRadius}
                                                                            fill="none"
                                                                            stroke="var(--border-color)"
                                                                            strokeWidth={progressCircleStroke}
                                                                        />
                                                                        <circle
                                                                            cx={progressCircleCenter}
                                                                            cy={progressCircleCenter}
                                                                            r={progressCircleRadius}
                                                                            fill="none"
                                                                            stroke="var(--active-text)"
                                                                            strokeWidth={progressCircleStroke}
                                                                            strokeLinecap="round"
                                                                            strokeDasharray={progressCircleCircumference}
                                                                            strokeDashoffset={progressDashOffset}
                                                                        />
                                                                    </svg>
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            inset: 0,
                                                                            display: 'grid',
                                                                            placeItems: 'center',
                                                                            fontSize: 11,
                                                                            fontWeight: 700,
                                                                            color: 'var(--text-main)',
                                                                            lineHeight: 1,
                                                                            textAlign: 'center',
                                                                        }}
                                                                    >
                                                                        {progressValue}%
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={boardTableCell}>
                                                            <ActionButton
                                                                type="button"
                                                                variant="neutral"
                                                                onClick={() => openFiles(item)}
                                                                style={{ padding: '6px 10px' }}
                                                            >
                                                                {fileCount ? `Files (${fileCount})` : 'Add Files'}
                                                            </ActionButton>
                                                        </td>
                                                        <td style={boardTableCell}>
                                                            {isProjectDeleted ? (
                                                                <span style={{ ...statusBadgeBase, ...deletedBadgeStyle }}>Project deleted</span>
                                                            ) : isConverted ? (
                                                                <ActionButton href={`/projects/${item.project_id}`} variant="view" style={{ padding: '6px 10px' }}>
                                                                    Open Project
                                                                </ActionButton>
                                                            ) : (
                                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not yet</span>
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
                        );
                    })
                )}

                </div>

                <Modal
                    open={!!filesItem}
                    onClose={closeFiles}
                    title={filesItem ? `Files - ${filesItem.project_name}` : 'Files'}
                    maxWidth={720}
                >
                    <div style={{ display: 'grid', gap: 16 }}>
                        <form onSubmit={submitFile} style={{ display: 'grid', gap: 10 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Upload photos or supporting files for this monitoring entry.
                            </div>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontSize: 12 }}>File</div>
                                <TextInput
                                    type="file"
                                    onChange={(event) => setFileData('file', event.target.files?.[0] ?? null)}
                                    style={inputStyle}
                                />
                                {fileErrors.file && <div style={{ color: '#f87171', fontSize: 12 }}>{fileErrors.file}</div>}
                            </label>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <ActionButton type="submit" variant="success" disabled={uploadingFile}>
                                    {uploadingFile ? 'Uploading...' : 'Upload File'}
                                </ActionButton>
                            </div>
                        </form>

                        <div style={{ display: 'grid', gap: 10 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>Attached Files</div>
                                {pagedFiles.length ? (
                                    pagedFiles.map((file) => {
                                        const fileUrl = file.file_path ? `/files/${file.file_path}` : '#';
                                        const isImage = isImageFile(file);

                                        return (
                                            <div
                                                key={file.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 12,
                                                padding: 10,
                                                borderRadius: 10,
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--surface-2)',
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{file.original_name || 'File'}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {(file.mime_type || 'file').toUpperCase()} • {file.created_at || 'Uploaded'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <ActionButton
                                                    type="button"
                                                    variant="view"
                                                    style={{ padding: '6px 10px' }}
                                                    disabled={!file.file_path}
                                                    href={!isImage ? fileUrl : undefined}
                                                    external={!isImage}
                                                    onClick={() => {
                                                        if (isImage && file.file_path) {
                                                            setPreviewFile(file);
                                                        }
                                                    }}
                                                >
                                                    {isImage ? 'Preview' : 'Open'}
                                                </ActionButton>
                                                <ActionButton
                                                    type="button"
                                                    variant="danger"
                                                    style={{ padding: '6px 10px' }}
                                                    onClick={() => setFileToDelete(file)}
                                                >
                                                    Delete
                                                </ActionButton>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No files uploaded yet.</div>
                            )}
                            {filesList.length > filesPerPage && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        Showing {filesList.length ? filesStartIndex + 1 : 0}-{filesEndIndex} of {filesList.length}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <ActionButton
                                            type="button"
                                            variant="neutral"
                                            onClick={() => setFilesPage((page) => Math.max(1, page - 1))}
                                            disabled={safeFilesPage <= 1}
                                        >
                                            Prev
                                        </ActionButton>
                                        <ActionButton
                                            type="button"
                                            variant="neutral"
                                            onClick={() => setFilesPage((page) => Math.min(filesPageCount, page + 1))}
                                            disabled={safeFilesPage >= filesPageCount}
                                        >
                                            Next
                                        </ActionButton>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>

                <Modal
                    open={showCreateModal}
                    onClose={() => {
                        if (creating) return;
                        setShowCreateModal(false);
                    }}
                    title="Add Monitoring Entry"
                    maxWidth={860}
                >
                    <form onSubmit={submitCreate} style={{ display: 'grid', gap: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>New project name/client</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Department</div>
                                {departmentOptions.length === 0 ? (
                                    <TextInput
                                        value={createData.department}
                                        onChange={(event) => setCreateData('department', event.target.value)}
                                        placeholder="Autocad"
                                        style={boardInputStyle}
                                    />
                                ) : (
                                    <div style={{ display: 'grid', gap: 6 }}>
                                        <SelectInput
                                            value={departmentOption}
                                            onChange={(event) => handleDepartmentOptionChange(event.target.value)}
                                            style={boardInputStyle}
                                        >
                                            {departmentOptions.map((department) => (
                                                <option key={department} value={department}>{department}</option>
                                            ))}
                                            <option value={OTHER_DEPARTMENT_OPTION}>Other (manual)</option>
                                        </SelectInput>
                                        {departmentOption === OTHER_DEPARTMENT_OPTION ? (
                                            <TextInput
                                                value={customDepartment}
                                                onChange={(event) => {
                                                    setCustomDepartment(event.target.value);
                                                    setCreateData('department', event.target.value);
                                                }}
                                                placeholder="Enter department"
                                                style={boardInputStyle}
                                            />
                                        ) : null}
                                    </div>
                                )}
                                {createErrors.department && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.department}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Client Name</div>
                                <ClientSelectInput
                                    clients={clientOptions}
                                    value={createData.client_name}
                                    onChange={(value) => setCreateData('client_name', value)}
                                    style={boardInputStyle}
                                />
                                {createErrors.client_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.client_name}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Project Name</div>
                                <TextInput
                                    value={createData.project_name}
                                    onChange={(event) => setCreateData('project_name', event.target.value)}
                                    style={boardInputStyle}
                                />
                                {createErrors.project_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.project_name}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Type</div>
                                <div style={{ display: 'grid', gap: 6 }}>
                                    <SelectInput
                                        value={projectTypeOption}
                                        onChange={(event) => handleProjectTypeOptionChange(event.target.value)}
                                        style={boardInputStyle}
                                    >
                                        {PROJECT_TYPE_OPTIONS.map((type) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                        <option value={OTHER_PROJECT_TYPE_OPTION}>Other (manual)</option>
                                    </SelectInput>
                                    {projectTypeOption === OTHER_PROJECT_TYPE_OPTION ? (
                                        <TextInput
                                            value={customProjectType}
                                            onChange={(event) => {
                                                setCustomProjectType(event.target.value);
                                                setCreateData('project_type', event.target.value);
                                            }}
                                            placeholder="Enter project type"
                                            style={boardInputStyle}
                                        />
                                    ) : null}
                                </div>
                                {createErrors.project_type && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.project_type}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Location</div>
                                <TextInput
                                    value={createData.location}
                                    onChange={(event) => setCreateData('location', event.target.value)}
                                    style={boardInputStyle}
                                />
                                {createErrors.location && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.location}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned</div>
                                <SearchableDropdown
                                    options={foremanSelectOptions}
                                    value={createData.assigned_to}
                                    onChange={(value) => setCreateData('assigned_to', value)}
                                    placeholder="Select foreman"
                                    searchPlaceholder="Search foremen..."
                                    emptyMessage="No foremen found"
                                    pageSize={10}
                                    loadMoreLabel="Show more"
                                    style={boardInputStyle}
                                    footer={foremanFooter}
                                    getOptionLabel={resolveOptionLabel}
                                    getOptionValue={resolveOptionValue}
                                />
                                {createErrors.assigned_to && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.assigned_to}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                                <SelectInput
                                    value={createData.status}
                                    onChange={(event) => setCreateData('status', event.target.value)}
                                    style={boardInputStyle}
                                >
                                    {resolvedStatusOptions.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </SelectInput>
                                {createErrors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.status}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Start Date</div>
                                <DatePickerInput
                                    value={createData.start_date}
                                    onChange={(value) => setCreateData('start_date', value)}
                                    style={boardInputStyle}
                                />
                                {createErrors.start_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.start_date}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Timeline</div>
                                <div style={{ display: 'grid', gap: 6 }}>
                                    <DatePickerInput
                                        value={parseTimelineRange(createData.timeline).start}
                                        onChange={(value) =>
                                            setCreateData('timeline', buildTimelineRange(value, parseTimelineRange(createData.timeline).end))
                                        }
                                        style={boardInputStyle}
                                    />
                                    <DatePickerInput
                                        value={parseTimelineRange(createData.timeline).end}
                                        onChange={(value) =>
                                            setCreateData('timeline', buildTimelineRange(parseTimelineRange(createData.timeline).start, value))
                                        }
                                        style={boardInputStyle}
                                    />
                                </div>
                                {createErrors.timeline && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.timeline}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Due Date</div>
                                <DatePickerInput
                                    value={createData.due_date}
                                    onChange={(value) => setCreateData('due_date', value)}
                                    style={boardInputStyle}
                                />
                                {createErrors.due_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.due_date}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Date Paid</div>
                                <DatePickerInput
                                    value={createData.date_paid}
                                    onChange={(value) => setCreateData('date_paid', value)}
                                    style={boardInputStyle}
                                />
                                {createErrors.date_paid && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.date_paid}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Progress (%)</div>
                                <TextInput
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={createData.progress_percent}
                                    onChange={(event) => setCreateData('progress_percent', event.target.value)}
                                    style={boardInputStyle}
                                />
                                {createErrors.progress_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.progress_percent}</div>}
                            </label>
                        </div>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Remarks</div>
                            <TextareaInput
                                value={createData.remarks}
                                onChange={(event) => setCreateData('remarks', event.target.value)}
                                style={{ ...boardInputStyle, minHeight: 90 }}
                            />
                            {createErrors.remarks && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.remarks}</div>}
                        </label>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <ActionButton
                                type="button"
                                onClick={() => {
                                    if (creating) return;
                                    setShowCreateModal(false);
                                }}
                            >
                                Cancel
                            </ActionButton>
                            <ActionButton type="submit" variant="success" disabled={creating} style={{ padding: '10px 16px', fontSize: 13 }}>
                                {creating ? 'Saving...' : 'Add Entry'}
                            </ActionButton>
                        </div>
                    </form>
                </Modal>

                <Modal
                    open={!!previewFile}
                    onClose={() => setPreviewFile(null)}
                    title={previewFile ? previewFile.original_name || 'Image Preview' : 'Image Preview'}
                    maxWidth={820}
                >
                    {previewFile ? (
                        <div style={{ display: 'grid', gap: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {previewFile.mime_type || 'image'}
                            </div>
                            <div
                                style={{
                                    borderRadius: 12,
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--surface-2)',
                                    padding: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <OptimizedImage
                                    src={previewFile.file_path ? `/files/${previewFile.file_path}` : ''}
                                    alt={previewFile.original_name || 'Preview'}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '70vh',
                                        objectFit: 'contain',
                                        borderRadius: 8,
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <ActionButton
                                    href={previewFile.file_path ? `/files/${previewFile.file_path}` : '#'}
                                    external
                                    variant="view"
                                >
                                    Open in New Tab
                                </ActionButton>
                            </div>
                        </div>
                    ) : null}
                </Modal>

                <EditModal
                    open={!!editItem}
                    onClose={closeEdit}
                    onSubmit={submitEdit}
                    title={editItem ? `Edit Monitoring Entry - ${editItem.project_name}` : 'Edit Monitoring Entry'}
                    submitLabel="Save Changes"
                    processing={updating}
                    maxWidth={860}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Department</div>
                            {departmentOptions.length === 0 ? (
                                <TextInput
                                    value={editData.department}
                                    onChange={(event) => setEditData('department', event.target.value)}
                                    style={inputStyle}
                                />
                            ) : (
                                <div style={{ display: 'grid', gap: 6 }}>
                                    <SelectInput
                                        value={editDepartmentOption}
                                        onChange={(event) => handleEditDepartmentOptionChange(event.target.value)}
                                        style={inputStyle}
                                    >
                                        {departmentOptions.map((department) => (
                                            <option key={department} value={department}>{department}</option>
                                        ))}
                                        <option value={OTHER_DEPARTMENT_OPTION}>Other (manual)</option>
                                    </SelectInput>
                                    {editDepartmentOption === OTHER_DEPARTMENT_OPTION ? (
                                        <TextInput
                                            value={editCustomDepartment}
                                            onChange={(event) => {
                                                setEditCustomDepartment(event.target.value);
                                                setEditData('department', event.target.value);
                                            }}
                                            placeholder="Enter department"
                                            style={inputStyle}
                                        />
                                    ) : null}
                                </div>
                            )}
                            {editErrors.department && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.department}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Client Name</div>
                            <ClientSelectInput
                                clients={clientOptions}
                                value={editData.client_name}
                                onChange={(value) => setEditData('client_name', value)}
                                style={inputStyle}
                            />
                            {editErrors.client_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.client_name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Project Name</div>
                            <TextInput
                                value={editData.project_name}
                                onChange={(event) => setEditData('project_name', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.project_name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.project_name}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Type</div>
                            <div style={{ display: 'grid', gap: 6 }}>
                                <SelectInput
                                    value={editProjectTypeOption}
                                    onChange={(event) => handleEditProjectTypeOptionChange(event.target.value)}
                                    style={inputStyle}
                                >
                                    {PROJECT_TYPE_OPTIONS.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                    <option value={OTHER_PROJECT_TYPE_OPTION}>Other (manual)</option>
                                </SelectInput>
                                {editProjectTypeOption === OTHER_PROJECT_TYPE_OPTION ? (
                                    <TextInput
                                        value={editCustomProjectType}
                                        onChange={(event) => {
                                            setEditCustomProjectType(event.target.value);
                                            setEditData('project_type', event.target.value);
                                        }}
                                        placeholder="Enter project type"
                                        style={inputStyle}
                                    />
                                ) : null}
                            </div>
                            {editErrors.project_type && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.project_type}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Location</div>
                            <TextInput
                                value={editData.location}
                                onChange={(event) => setEditData('location', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.location && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.location}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned</div>
                            <SearchableDropdown
                                options={foremanEditOptions}
                                value={editData.assigned_to}
                                onChange={(value) => setEditData('assigned_to', value)}
                                placeholder="Select foreman"
                                searchPlaceholder="Search foremen..."
                                emptyMessage="No foremen found"
                                pageSize={10}
                                loadMoreLabel="Show more"
                                style={inputStyle}
                                footer={foremanFooter}
                                getOptionLabel={resolveOptionLabel}
                                getOptionValue={resolveOptionValue}
                            />
                            {editErrors.assigned_to && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.assigned_to}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                            <SelectInput
                                value={editData.status}
                                onChange={(event) => setEditData('status', event.target.value)}
                                style={inputStyle}
                            >
                                {resolvedStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </SelectInput>
                            {editErrors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.status}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Start Date</div>
                            <DatePickerInput
                                value={editData.start_date}
                                onChange={(value) => setEditData('start_date', value)}
                                style={inputStyle}
                            />
                            {editErrors.start_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.start_date}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Timeline</div>
                            <div style={{ display: 'grid', gap: 6 }}>
                                <DatePickerInput
                                    value={parseTimelineRange(editData.timeline).start}
                                    onChange={(value) =>
                                        setEditData('timeline', buildTimelineRange(value, parseTimelineRange(editData.timeline).end))
                                    }
                                    style={inputStyle}
                                />
                                <DatePickerInput
                                    value={parseTimelineRange(editData.timeline).end}
                                    onChange={(value) =>
                                        setEditData('timeline', buildTimelineRange(parseTimelineRange(editData.timeline).start, value))
                                    }
                                    style={inputStyle}
                                />
                            </div>
                            {editErrors.timeline && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.timeline}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Due Date</div>
                            <DatePickerInput
                                value={editData.due_date}
                                onChange={(value) => setEditData('due_date', value)}
                                style={inputStyle}
                            />
                            {editErrors.due_date && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.due_date}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Date Paid</div>
                            <DatePickerInput
                                value={editData.date_paid}
                                onChange={(value) => setEditData('date_paid', value)}
                                style={inputStyle}
                            />
                            {editErrors.date_paid && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.date_paid}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Progress (%)</div>
                            <TextInput
                                type="number"
                                min="0"
                                max="100"
                                value={editData.progress_percent}
                                onChange={(event) => setEditData('progress_percent', event.target.value)}
                                style={inputStyle}
                            />
                            {editErrors.progress_percent && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.progress_percent}</div>}
                        </label>
                    </div>

                    <label style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12 }}>Remarks</div>
                        <TextareaInput
                            value={editData.remarks}
                            onChange={(event) => setEditData('remarks', event.target.value)}
                            style={{ ...inputStyle, minHeight: 90 }}
                        />
                        {editErrors.remarks && <div style={{ color: '#f87171', fontSize: 12 }}>{editErrors.remarks}</div>}
                    </label>
                </EditModal>

                <ConfirmationModal
                    open={!!itemToDelete}
                    title="Delete Monitoring Entry"
                    message={itemToDelete ? `Delete \"${itemToDelete.project_name}\"? This action cannot be undone.` : 'Delete this entry?'}
                    confirmLabel={deletingId ? 'Deleting...' : 'Delete'}
                    cancelLabel="Cancel"
                    danger
                    processing={Boolean(deletingId)}
                    onClose={() => (deletingId ? null : setItemToDelete(null))}
                    onConfirm={confirmDelete}
                />

                <ConfirmationModal
                    open={bulkDeleteIds.length > 0}
                    title="Delete Selected Entries"
                    message={`Delete ${bulkDeleteIds.length} selected entr${bulkDeleteIds.length === 1 ? 'y' : 'ies'}? This action cannot be undone.`}
                    confirmLabel={bulkDeleting ? 'Deleting...' : 'Delete'}
                    cancelLabel="Cancel"
                    danger
                    processing={bulkDeleting}
                    onClose={() => {
                        if (bulkDeleting) return;
                        setBulkDeleteIds([]);
                        setBulkDeleteDepartment(null);
                    }}
                    onConfirm={confirmBulkDelete}
                />

                <ConfirmationModal
                    open={!!fileToDelete}
                    title="Delete File"
                    message={fileToDelete ? `Delete \"${fileToDelete.original_name || 'this file'}\"?` : 'Delete this file?'}
                    confirmLabel={deletingFileId ? 'Deleting...' : 'Delete'}
                    cancelLabel="Cancel"
                    danger
                    processing={Boolean(deletingFileId)}
                    onClose={() => (deletingFileId ? null : setFileToDelete(null))}
                    onConfirm={confirmDeleteFile}
                />
            </Layout>
        </>
    );
}


