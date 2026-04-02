import ActionButton from './ActionButton';
import EditModal from './EditModal';
import ConfirmationModal from './ConfirmationModal';
import Modal from './Modal';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import TextareaInput from './TextareaInput';
import DatePickerInput from './DatePickerInput';
import SearchableDropdown from './SearchableDropdown';
import Layout from './Layout';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Lock, Trash2, User as UserIcon } from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import { toastMessages } from '../constants/toastMessages';
import { DESIGN_COMPUTATION_BASIS } from '../Utils/designComputation';

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
const OTHER_DESIGNER_OPTION = '__OTHER_DESIGNER__';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SUPPORTED_FILE_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'bmp',
    'gif',
    'svg',
    'webp',
    'avif',
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'csv',
    'ppt',
    'pptx',
    'txt',
];
const SUPPORTED_FILE_ACCEPT = SUPPORTED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');

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
const COMPLETED_DEPARTMENT = 'Completed';

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
    return Math.max(0, Math.min(100, round2(numeric)));
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
        const numeric = Number(row?.computed_progress ?? raw);
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
const round2 = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round((numeric + Number.EPSILON) * 100) / 100;
};
const formatPercent2 = (value) =>
    round2(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (value) =>
    `P ${round2(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const getInitials = (value) => {
    const parts = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0) return 'NA';
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
};

const basisEditableHeaderStyle = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 90px 120px 90px 80px 130px 60px',
    gap: 10,
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    padding: '4px 0',
};

const basisEditableRowStyle = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 90px 120px 90px 80px 130px 60px',
    gap: 10,
    alignItems: 'center',
    fontSize: 12,
    padding: '6px 0',
    borderTop: '1px solid rgba(148, 163, 184, 0.12)',
};

const milestoneTextStyle = {
    lineHeight: 1.35,
};

const modalTabContainerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderRadius: 999,
    border: '1px solid var(--border-color)',
    background: 'var(--surface-2)',
};

const modalTabButtonStyle = {
    padding: '6px 14px',
    borderRadius: 999,
    border: '1px solid transparent',
    background: 'transparent',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    cursor: 'pointer',
};

const modalTabButtonActiveStyle = {
    background: 'var(--active-bg)',
    borderColor: 'color-mix(in srgb, var(--active-text) 60%, var(--border-color))',
    color: 'var(--active-text)',
};
const DEFAULT_DESIGN_BASIS = DESIGN_COMPUTATION_BASIS.map((milestone, index) => ({
    key: milestone.key || `basis-${index + 1}`,
    label: milestone.label,
    percent: Number(milestone.percent || 0),
    progress: 0,
}));

const cloneDesignBasis = (basis) => basis.map((item) => ({ ...item }));

const normalizeDesignBasis = (basis) => {
    if (!Array.isArray(basis)) {
        return cloneDesignBasis(DEFAULT_DESIGN_BASIS);
    }
    return basis.map((item, index) => ({
        key: item?.key || `basis-${index + 1}`,
        label: typeof item?.label === 'string' ? item.label : String(item?.label ?? ''),
        percent: item?.percent ?? 0,
        progress: item?.progress ?? 0,
    }));
};

const computeDesignProgressWithBasis = ({ basis, designContractAmount, totalReceived, clientApprovalStatus }) => {
    const normalizedBasis = normalizeDesignBasis(basis);
    const totalPercent = normalizedBasis.reduce((sum, item) => sum + Number(item.percent || 0), 0);
    const progressSum = normalizedBasis.reduce(
        (sum, item) => sum + (Number(item.percent || 0) * Number(item.progress || 0)) / 100,
        0
    );

    return Math.max(0, Math.min(100, round2(progressSum)));
};

const computeDesignMilestoneBreakdownWithBasis = (basis, designContractAmount) => {
    const normalizedBasis = normalizeDesignBasis(basis);
    const contractAmount = Math.max(0, Number(designContractAmount || 0));
    let cumulativePercent = 0;
    let cumulativeAmount = 0;

    return normalizedBasis.map((milestone) => {
        const percent = round2(Number(milestone.percent || 0));
        const progress = round2(Number(milestone.progress || 0));
        const amount = round2((contractAmount * percent) / 100);
        const wtPercent = round2((percent * progress) / 100);
        const accompAmount = round2((amount * progress) / 100);
        cumulativePercent += percent;
        cumulativeAmount += amount;

        return {
            ...milestone,
            percent,
            progress,
            amount,
            wt_percent: wtPercent,
            accomp_amount: accompAmount,
            cumulative_percent: cumulativePercent,
            cumulative_amount: cumulativeAmount,
        };
    });
};

const computationCardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 12,
};
const normalizeNameKey = (value) =>
    String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
const isImageFile = (file) => {
    const mime = String(file?.mime_type || '').toLowerCase();
    if (mime.startsWith('image/')) return true;
    const name = String(file?.original_name || '').toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].some((ext) => name.endsWith(ext));
};
const isSupportedUpload = (file) => {
    const name = String(file?.name || file?.original_name || '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    return ext ? SUPPORTED_FILE_EXTENSIONS.includes(ext) : false;
};

export default function MonitoringBoardIndexPage({
    items = [],
    status_options: statusOptions = [],
    designerOptions = [],
    departments = [],
    department_pagination: departmentPagination = {},
}) {
    const { auth } = usePage().props;
    const isHeadAdmin = auth?.user?.role === 'head_admin';
    const resolvedStatusOptions = statusOptions.length > 0 ? statusOptions : ['PROPOSAL', 'IN_REVIEW', 'APPROVED', 'DONE'];
    const resolveOptionLabel = (option) => option?.label ?? option?.name ?? option?.fullname ?? String(option ?? '');
    const resolveOptionValue = (option) => option?.value ?? option?.label ?? option?.fullname ?? option?.name ?? option;

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
        design_contract_amount: '',
        downpayment: '',
        total_received: '',
        office_payroll_deduction: '',
        client_approval_status: 'pending',
        design_computation_basis: cloneDesignBasis(DEFAULT_DESIGN_BASIS),
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
        design_contract_amount: '',
        downpayment: '',
        total_received: '',
        office_payroll_deduction: '',
        client_approval_status: 'pending',
        design_computation_basis: cloneDesignBasis(DEFAULT_DESIGN_BASIS),
    });
    const baseDesignerOptions = Array.isArray(designerOptions) ? designerOptions : [];
    const baseDepartmentEntries = Array.isArray(departments) ? departments : [];
    const designerPhotoLookup = useMemo(() => {
        const next = new Map();
        baseDesignerOptions.forEach((option) => {
            const name = String(resolveOptionLabel(option) || '').trim();
            if (!name) return;
            const key = normalizeNameKey(name);
            next.set(key, option?.profile_photo_path || '');
        });
        return next;
    }, [baseDesignerOptions]);
    const designerSelectOptions = [
        ...baseDesignerOptions,
        { label: 'Other (manual)', value: OTHER_DESIGNER_OPTION },
    ];
    const designerEditOptions = designerSelectOptions;
    const [projectTypeOption, setProjectTypeOption] = useState(PROJECT_TYPE_OPTIONS[0]);
    const [customProjectType, setCustomProjectType] = useState('');
    const [editProjectTypeOption, setEditProjectTypeOption] = useState(PROJECT_TYPE_OPTIONS[0]);
    const [editCustomProjectType, setEditCustomProjectType] = useState('');
    const [createDesignerOption, setCreateDesignerOption] = useState('');
    const [editDesignerOption, setEditDesignerOption] = useState('');
    const [departmentOption, setDepartmentOption] = useState('');
    const [customDepartment, setCustomDepartment] = useState('');
    const [editDepartmentOption, setEditDepartmentOption] = useState('');
    const [editCustomDepartment, setEditCustomDepartment] = useState('');
    const [editItem, setEditItem] = useState(null);
    const [infoItem, setInfoItem] = useState(null);
    const [createActiveTab, setCreateActiveTab] = useState('details');
    const [editActiveTab, setEditActiveTab] = useState('details');
    const toNumber = (value) => Number(value || 0);
    const createDesignBasis = normalizeDesignBasis(createData.design_computation_basis);
    const createDesignProgress = computeDesignProgressWithBasis({
        basis: createDesignBasis,
        designContractAmount: toNumber(createData.design_contract_amount),
        totalReceived: toNumber(createData.total_received),
        clientApprovalStatus: createData.client_approval_status,
    });
    const createMilestoneBreakdown = computeDesignMilestoneBreakdownWithBasis(
        createDesignBasis,
        toNumber(createData.design_contract_amount)
    );
    const createRemaining = toNumber(createData.design_contract_amount) - toNumber(createData.total_received);
    const createNetIncome = toNumber(createData.total_received) - toNumber(createData.office_payroll_deduction);
    const editDesignBasis = normalizeDesignBasis(editData.design_computation_basis);
    const editDesignProgress = computeDesignProgressWithBasis({
        basis: editDesignBasis,
        designContractAmount: toNumber(editData.design_contract_amount),
        totalReceived: toNumber(editData.total_received),
        clientApprovalStatus: editData.client_approval_status,
    });
    const editMilestoneBreakdown = computeDesignMilestoneBreakdownWithBasis(
        editDesignBasis,
        toNumber(editData.design_contract_amount)
    );
    const editRemaining = toNumber(editData.design_contract_amount) - toNumber(editData.total_received);
    const editNetIncome = toNumber(editData.total_received) - toNumber(editData.office_payroll_deduction);
    const createBasisKey = () => `basis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const getCreateBasisList = () =>
        Array.isArray(createData.design_computation_basis)
            ? createData.design_computation_basis
            : cloneDesignBasis(DEFAULT_DESIGN_BASIS);
    const getEditBasisList = () =>
        Array.isArray(editData.design_computation_basis)
            ? editData.design_computation_basis
            : cloneDesignBasis(DEFAULT_DESIGN_BASIS);
    const updateCreateBasisItem = (key, field, value) => {
        const next = getCreateBasisList().map((item) =>
            item.key === key ? { ...item, [field]: value } : item
        );
        setCreateData('design_computation_basis', next);
    };
    const updateEditBasisItem = (key, field, value) => {
        const next = getEditBasisList().map((item) =>
            item.key === key ? { ...item, [field]: value } : item
        );
        setEditData('design_computation_basis', next);
    };
    const addCreateBasisItem = () => {
        const next = [...getCreateBasisList(), { key: createBasisKey(), label: '', percent: 0 }];
        setCreateData('design_computation_basis', next);
    };
    const addEditBasisItem = () => {
        const next = [...getEditBasisList(), { key: createBasisKey(), label: '', percent: 0 }];
        setEditData('design_computation_basis', next);
    };
    const removeCreateBasisItem = (key) => {
        const next = getCreateBasisList().filter((item) => item.key !== key);
        setCreateData('design_computation_basis', next);
    };
    const removeEditBasisItem = (key) => {
        const next = getEditBasisList().filter((item) => item.key !== key);
        setEditData('design_computation_basis', next);
    };
    const renderModalTabs = (activeTab, onChange, showSnapshot = true) => (
        <div style={modalTabContainerStyle}>
            <button
                type="button"
                onClick={() => onChange('details')}
                style={{
                    ...modalTabButtonStyle,
                    ...(activeTab === 'details' ? modalTabButtonActiveStyle : {}),
                }}
            >
                Project Details
            </button>
            {showSnapshot ? (
                <button
                    type="button"
                    onClick={() => onChange('snapshot')}
                    style={{
                        ...modalTabButtonStyle,
                        ...(activeTab === 'snapshot' ? modalTabButtonActiveStyle : {}),
                    }}
                >
                    Design Snapshot
                </button>
            ) : null}
        </div>
    );

    useEffect(() => {
        const rounded = Math.round(Number(createDesignProgress || 0));
        if (Number(createData.progress_percent || 0) !== rounded) {
            setCreateData('progress_percent', rounded);
        }
    }, [createDesignProgress]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!editItem) return;
        const rounded = Math.round(Number(editDesignProgress || 0));
        if (Number(editData.progress_percent || 0) !== rounded) {
            setEditData('progress_percent', rounded);
        }
    }, [editDesignProgress, editItem]); // eslint-disable-line react-hooks/exhaustive-deps
    const [knownDepartments, setKnownDepartments] = useState([]);
    const departmentIdLookup = useMemo(() => {
        const next = new Map();
        baseDepartmentEntries.forEach((department) => {
            const label = String(department?.name ?? department).trim();
            if (!label) return;
            const key = label.toLowerCase();
            next.set(key, department?.id ?? null);
        });
        return next;
    }, [baseDepartmentEntries]);

    const renderAvatar = (name, photoPath, tone = 'var(--active-bg)') => {
        const safeName = String(name || '').trim();
        const initials = getInitials(safeName);
        const hasPhoto = Boolean(photoPath);
        return (
            <span
                style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    background: tone,
                    border: '1px solid var(--border-color)',
                    position: 'relative',
                    overflow: 'hidden',
                    flexShrink: 0,
                }}
                aria-hidden="true"
            >
                {hasPhoto ? null : safeName ? initials : <UserIcon size={12} />}
                {hasPhoto ? (
                    <OptimizedImage
                        src={`/files/${photoPath}`}
                        alt={safeName || 'User'}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(event) => {
                            event.currentTarget.remove();
                        }}
                    />
                ) : null}
            </span>
        );
    };

    useEffect(() => {
        if (!Array.isArray(items)) return;
        setKnownDepartments((prev) => {
            const next = new Map();
            prev.forEach((department) => {
                const label = String(department || '').trim();
                if (!label || label === COMPLETED_DEPARTMENT) return;
                next.set(label.toLowerCase(), label);
            });
            baseDepartmentEntries.forEach((department) => {
                const label = String(department?.name ?? department).trim();
                if (!label || label === COMPLETED_DEPARTMENT) return;
                next.set(label.toLowerCase(), label);
            });
            items.forEach((item) => {
                const raw = String(item?.department || '').trim();
                if (!raw || raw === COMPLETED_DEPARTMENT) return;
                const key = raw.toLowerCase();
                if (!next.has(key)) {
                    next.set(key, raw);
                }
            });
            return Array.from(next.values()).sort((a, b) => a.localeCompare(b));
        });
    }, [items, baseDepartmentEntries]);

    const departmentOptions = useMemo(
        () => knownDepartments.filter((dept) => dept !== COMPLETED_DEPARTMENT),
        [knownDepartments]
    );

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
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [departmentToDelete, setDepartmentToDelete] = useState(null);
    const [deletingDepartment, setDeletingDepartment] = useState(false);
    const [filesItem, setFilesItem] = useState(null);
    const [fileToDelete, setFileToDelete] = useState(null);
    const [deletingFileId, setDeletingFileId] = useState(null);
    const [filesPage, setFilesPage] = useState(1);
    const [previewFile, setPreviewFile] = useState(null);
    const [fileInputKey, setFileInputKey] = useState(0);
    const [collapsedDepartments, setCollapsedDepartments] = useState({});
    const [selectedRowsByDepartment, setSelectedRowsByDepartment] = useState({});
    const [bulkActionByDepartment, setBulkActionByDepartment] = useState({});
    const [bulkDeleteIds, setBulkDeleteIds] = useState([]);
    const [bulkDeleteDepartment, setBulkDeleteDepartment] = useState(null);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [globalSort, setGlobalSort] = useState({ key: 'default', dir: 'desc' });
    const [departmentSort, setDepartmentSort] = useState({});
    const [departmentPage, setDepartmentPage] = useState(departmentPagination.pages || {});
    const [departmentPageSize, setDepartmentPageSize] = useState(departmentPagination.sizes || {});

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const createFlag = params.get('create');
        if (createFlag === '1' || createFlag === 'true') {
            setShowCreateModal(true);
        }
    }, []);

    const resolveDesignerOption = (value) => {
        const normalizedValue = String(value ?? '').trim();
        if (!normalizedValue) return '';
        const hasValue = baseDesignerOptions.some(
            (option) => String(resolveOptionValue(option)).trim() === normalizedValue
        );
        return hasValue ? normalizedValue : OTHER_DESIGNER_OPTION;
    };

    useEffect(() => {
        if (!showCreateModal) return;
        setCreateDesignerOption(resolveDesignerOption(createData.assigned_to));
    }, [showCreateModal, baseDesignerOptions]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!editItem) return;
        setEditDesignerOption(resolveDesignerOption(editData.assigned_to));
    }, [editItem, baseDesignerOptions]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const preparedItems = Array.isArray(items)
            ? items.map((item) => ({
                ...item,
                computed_progress: computeDesignProgressWithBasis({
                    basis: item.design_computation_basis,
                    designContractAmount: Number(item.design_contract_amount || 0),
                    totalReceived: Number(item.total_received || 0),
                    clientApprovalStatus: item.client_approval_status,
                }),
            }))
            : [];
        const filtered = needle === ''
            ? preparedItems
            : preparedItems.filter((item) => (
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
        if (needle === '') {
            departmentOptions.forEach((department) => {
                const key = normalizeGroupKey(department);
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
            });
        }
        filtered.forEach((item) => {
            const key = normalizeGroupKey(item.department);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(item);
        });

        const completedRows = groups.get(COMPLETED_DEPARTMENT) || [];
        groups.delete(COMPLETED_DEPARTMENT);

        const orderedGroups = Array.from(groups.entries())
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
        orderedGroups.push({ department: COMPLETED_DEPARTMENT, rows: completedRows });
        return orderedGroups;
    }, [items, search, departmentOptions]);

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
        setDepartmentPage((prev) => {
            const next = { ...prev };
            groupedItems.forEach((group) => {
                if (!(group.department in next) || !Number.isFinite(Number(next[group.department])) || Number(next[group.department]) < 1) {
                    next[group.department] = 1;
                }
            });
            return next;
        });
    }, [groupedItems]);

    useEffect(() => {
        if (groupedItems.length === 0) return;
        setDepartmentPageSize((prev) => {
            const next = { ...prev };
            groupedItems.forEach((group) => {
                if (!(group.department in next) || !Number.isFinite(Number(next[group.department])) || Number(next[group.department]) < 1) {
                    next[group.department] = 10;
                }
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
                const selectedStatus = normalizeStatus(selectedRows[0]?.status, '');
                const canEdit = selectedIds.length === 1 && !selectedRows[0]?.project_id && selectedStatus !== 'DONE';
                const canInfo = selectedIds.length === 1 && selectedStatus === 'DONE';
                if (selectedIds.length === 0) {
                    next[group.department] = '';
                    return;
                }
                if (next[group.department] === 'edit' && !canEdit) {
                    next[group.department] = '';
                }
                if (next[group.department] === 'info' && !canInfo) {
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

    const syncDepartmentPagination = (nextPages, nextSizes) => {
        router.get(
            '/monitoring-board',
            {
                dept_page: JSON.stringify(nextPages),
                dept_size: JSON.stringify(nextSizes),
            },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            }
        );
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
                setCreateData('design_contract_amount', '');
                setCreateData('downpayment', '');
                setCreateData('total_received', '');
                setCreateData('office_payroll_deduction', '');
                setCreateData('client_approval_status', 'pending');
                setCreateData('design_computation_basis', cloneDesignBasis(DEFAULT_DESIGN_BASIS));
                setShowCreateModal(false);
                toast.success(toastMessages.monitoringBoard.entryAdded);
            },
            onError: () => toast.error(toastMessages.monitoringBoard.entryAddError),
        });
    };

    const openEdit = (item) => {
        const initialProjectType = String(item.project_type ?? '').trim();
        const isPresetType = PROJECT_TYPE_OPTIONS.includes(initialProjectType);
        const initialDepartment = String(item.department ?? '').trim();
        const isPresetDepartment = departmentOptions.includes(initialDepartment);
        setEditItem(item);
        setEditActiveTab('details');
        if (clearEditErrors) clearEditErrors();
        setEditProjectTypeOption(isPresetType ? initialProjectType : OTHER_PROJECT_TYPE_OPTION);
        setEditCustomProjectType(isPresetType ? '' : initialProjectType);
        setEditDepartmentOption(
            departmentOptions.length > 0
                ? (isPresetDepartment ? initialDepartment : OTHER_DEPARTMENT_OPTION)
                : ''
        );
        setEditCustomDepartment(isPresetDepartment ? '' : initialDepartment);
        const normalizedBasis = Array.isArray(item.design_computation_basis)
            ? normalizeDesignBasis(item.design_computation_basis)
            : cloneDesignBasis(DEFAULT_DESIGN_BASIS);
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
            design_contract_amount: item.design_contract_amount ?? '',
            downpayment: item.downpayment ?? '',
            total_received: item.total_received ?? '',
            office_payroll_deduction: item.office_payroll_deduction ?? '',
            client_approval_status: item.client_approval_status ?? 'pending',
            design_computation_basis: normalizedBasis,
        });
    };

    const openInfo = (item) => {
        setInfoItem(item);
    };

    const closeInfo = () => {
        setInfoItem(null);
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
                toast.success(toastMessages.monitoringBoard.entryUpdated);
            },
            onError: () => toast.error(toastMessages.monitoringBoard.entryUpdateError),
        });
    };

    const confirmDelete = () => {
        if (!itemToDelete) return;
        setDeletingId(itemToDelete.id);
        router.delete(`/monitoring-board/${itemToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setItemToDelete(null);
                toast.success(toastMessages.monitoringBoard.entryDeleted);
            },
            onError: () => toast.error(toastMessages.monitoringBoard.entryDeleteError),
            onFinish: () => setDeletingId(null),
        });
    };

    const requestDeleteDepartment = (departmentName, rows = []) => {
        if (!departmentName || departmentName === COMPLETED_DEPARTMENT) return;
        const lookupKey = String(departmentName).toLowerCase();
        const departmentId = departmentIdLookup.get(lookupKey);
        const entryNames = Array.isArray(rows)
            ? rows
                .map((row) => String(row?.project_name || '').trim())
                .filter((name) => name !== '')
            : [];
        const entryCount = Array.isArray(rows) ? rows.length : 0;
        if (!departmentId) {
            setKnownDepartments((prev) =>
                prev.filter((department) => department.toLowerCase() !== lookupKey)
            );
            toast.success(toastMessages.monitoringBoard.departmentDeleted);
            return;
        }
        setDepartmentToDelete({
            id: departmentId,
            name: departmentName,
            count: entryCount,
            names: entryNames,
        });
    };

    const confirmDeleteDepartment = () => {
        if (!departmentToDelete?.id) return;
        setDeletingDepartment(true);
        router.delete(`/monitoring-board/departments/${departmentToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                const lookupKey = String(departmentToDelete.name || '').toLowerCase();
                setKnownDepartments((prev) =>
                    prev.filter((department) => department.toLowerCase() !== lookupKey)
                );
                setDepartmentToDelete(null);
                toast.success(toastMessages.monitoringBoard.departmentDeleted);
            },
            onError: () => toast.error(toastMessages.monitoringBoard.departmentDeleteError),
            onFinish: () => setDeletingDepartment(false),
        });
    };

    const requestBulkDelete = (department, ids) => {
        if (!ids.length) return;
        if (department === COMPLETED_DEPARTMENT && !isHeadAdmin) return;
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
                toast.success(toastMessages.monitoringBoard.selectedDeleted);
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
                    toast.error(toastMessages.monitoringBoard.selectedDeleteError);
                },
            });
        };

        deleteNext();
    };

    const openFiles = (item) => {
        setFilesItem(item);
        resetFileData();
        setFileInputKey((key) => key + 1);
        setFileToDelete(null);
        setFilesPage(1);
        setPreviewFile(null);
    };

    const closeFiles = () => {
        if (uploadingFile) return;
        setFilesItem(null);
        setFileToDelete(null);
        resetFileData();
        setFileInputKey((key) => key + 1);
        setPreviewFile(null);
    };

    const submitFile = (event) => {
        event.preventDefault();
        if (!filesItem) return;
        if (!fileData.file) {
            toast.error(toastMessages.monitoringBoard.fileChoose);
            return;
        }
        if (!isSupportedUpload(fileData.file)) {
            toast.error(toastMessages.monitoringBoard.fileTypeUnsupported);
            return;
        }
        if (fileData.file.size > MAX_UPLOAD_BYTES) {
            toast.error(toastMessages.monitoringBoard.fileTooLarge);
            return;
        }
        const filesItemId = filesItem.id;

        postFile(`/monitoring-board/${filesItem.id}/files`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: (page) => {
                resetFileData();
                setFileInputKey((key) => key + 1);
                if (page?.props?.items && filesItemId) {
                    const updated = page.props.items.find((item) => item.id === filesItemId);
                    if (updated) setFilesItem(updated);
                }
                toast.success(toastMessages.monitoringBoard.fileUploaded);
            },
            onError: () => toast.error(toastMessages.monitoringBoard.fileUploadError),
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
                toast.success(toastMessages.monitoringBoard.fileDeleted);
            },
            onError: () => toast.error(toastMessages.monitoringBoard.fileDeleteError),
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
                                 onClick={() => {
                                     setCreateActiveTab('details');
                                     setShowCreateModal(true);
                                 }}
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
                        const isCompletedGroup = group.department === COMPLETED_DEPARTMENT;
                        const groupColor = isCompletedGroup ? '#22c55e' : groupColors[groupIndex % groupColors.length];
                        const isCollapsed = collapsedDepartments[group.department];
                        const rowIds = group.rows.map((row) => row.id);
                        const selectedIds = selectedRowsByDepartment[group.department] || [];
                        const selectedCount = selectedIds.length;
                        const allSelected = rowIds.length > 0 && selectedCount === rowIds.length;
                        const selectedRows = group.rows.filter((row) => selectedIds.includes(row.id));
                        const selectedStatus = normalizeStatus(selectedRows[0]?.status, '');
                        const canEditSelection = selectedCount === 1 && !selectedRows[0]?.project_id && selectedStatus !== 'DONE';
                        const canInfoSelection = selectedCount === 1 && selectedStatus === 'DONE';
                        const bulkActionValue = bulkActionByDepartment[group.department] || '';
                        const bulkActionOptions = isCompletedGroup
                            ? [
                                  ...(canInfoSelection ? [{ value: 'info', label: 'Info selected' }] : []),
                                  ...(isHeadAdmin ? [{ value: 'delete', label: 'Delete selected' }] : []),
                              ]
                            : canEditSelection
                                ? [
                                      { value: 'edit', label: 'Edit selected' },
                                      { value: 'delete', label: 'Delete selected' },
                                  ]
                                : canInfoSelection
                                    ? [
                                          { value: 'info', label: 'Info selected' },
                                          { value: 'delete', label: 'Delete selected' },
                                      ]
                                    : [{ value: 'delete', label: 'Delete selected' }];
                        const sortConfig = { ...globalSort, ...(departmentSort[group.department] || {}) };
                        const sortedRows = sortRows(group.rows, sortConfig.key, sortConfig.dir);
                        const pageSize = isCompletedGroup
                            ? Math.max(1, Number(departmentPageSize[group.department] ?? 10))
                            : sortedRows.length || 1;
                        const totalPages = isCompletedGroup ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
                        const currentPage = isCompletedGroup
                            ? Math.min(departmentPage[group.department] ?? 1, totalPages)
                            : 1;
                        const pageStart = (currentPage - 1) * pageSize;
                        const pagedRows = isCompletedGroup ? sortedRows.slice(pageStart, pageStart + pageSize) : sortedRows;
                        const stickyHeaderStyle = {
                            ...selectionHeaderStyle,
                            background: `color-mix(in srgb, ${groupColor} 14%, var(--surface-2))`,
                        };
                        const stickyCellStyle = {
                            ...selectionCellStyle,
                            background: `color-mix(in srgb, ${groupColor} 10%, var(--surface-1))`,
                        };
                        const headerLabels = isCompletedGroup
                            ? [
                                  'Project',
                                  'Department',
                                  'Client',
                                  'Type',
                                  'Location',
                                  'Assigned Designer',
                                  'Completed Date',
                                  'Status',
                                  'Files',
                                  'Actions',
                              ]
                            : [
                                  'Project',
                                  'Client',
                                  'Type',
                                  'Location',
                                  'Assigned Designer',
                                  'Start Date',
                                  'Timeline',
                                  'Due Date',
                                  'Date Paid',
                                  'Status',
                                  'Progress',
                                  'Files',
                                  'Actions',
                              ];
                        const emptyRowColSpan = 1 + headerLabels.length;

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
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            {group.department}
                                            {isCompletedGroup ? <Lock size={14} style={{ color: 'var(--text-muted)' }} /> : null}
                                        </span>
                                    </div>
                                    {!isCompletedGroup ? (
                                            <ActionButton
                                                type="button"
                                                variant="danger"
                                                onClick={() => requestDeleteDepartment(group.department, group.rows)}
                                                disabled={deletingDepartment}
                                                style={{ padding: '6px 10px', fontSize: 11 }}
                                                aria-label={`Delete ${group.department} department`}
                                            >
                                            <Trash2 size={14} />
                                        </ActionButton>
                                    ) : (
                                        <div style={{ width: 32 }} />
                                    )}
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
                                                if (value === 'info' && canInfoSelection) {
                                                    openInfo(selectedRows[0]);
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
                                            disabled={selectedCount === 0 || bulkActionOptions.length === 0}
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
                                <>
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
                                                {headerLabels.map((label) => (
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
                                            {sortedRows.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={emptyRowColSpan}
                                                        style={{
                                                            ...boardTableCell,
                                                            textAlign: 'center',
                                                            color: 'var(--text-muted)',
                                                            fontStyle: 'italic',
                                                        }}
                                                    >
                                                        No entries yet in this department.
                                                    </td>
                                                </tr>
                                            ) : (
                                                pagedRows.map((item) => {
                                                const isProjectDeleted = Boolean(item.project_deleted);
                                                const progressValue = normalizeProgressValue(item.computed_progress ?? item.progress_percent);
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
                                                        {isCompletedGroup ? (
                                                            <td style={boardTableCell}>{item.origin_department || '-'}</td>
                                                        ) : null}
                                                        <td style={boardTableCell}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                                {renderAvatar(item.client_name, '', 'rgba(59, 130, 246, 0.16)')}
                                                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {item.client_name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td style={boardTableCell}>{item.project_type}</td>
                                                        <td style={boardTableCell}>{item.location}</td>
                                                        <td style={boardTableCell}>
                                                            {item.assigned_to ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                                    {renderAvatar(
                                                                        item.assigned_to,
                                                                        designerPhotoLookup.get(normalizeNameKey(item.assigned_to)) || '',
                                                                        'rgba(34, 197, 94, 0.16)'
                                                                    )}
                                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {item.assigned_to}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                '-'
                                                            )}
                                                        </td>
                                                        {isCompletedGroup ? (
                                                            <td style={boardTableCell}>{formatDate(item.completed_at)}</td>
                                                        ) : (
                                                            <>
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
                                                            </>
                                                        )}
                                                        <td style={boardTableCell}>
                                                            <span style={{ ...statusBadgeBase, ...getStatusBadgeStyle(statusValue) }}>
                                                                {statusValue}
                                                            </span>
                                                        </td>
                                                        {!isCompletedGroup ? (
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
                                                                            {formatPercent2(progressValue)}%
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        ) : null}
                                                        <td style={boardTableCell}>
                                                        <ActionButton
                                                            type="button"
                                                            variant="neutral"
                                                            onClick={() => openFiles(item)}
                                                            style={{ padding: '6px 10px' }}
                                                        >
                                                            {fileCount ? `Files (${fileCount})` : 'View Files'}
                                                        </ActionButton>
                                                    </td>
                                                        <td style={boardTableCell}>
                                                            {isCompletedGroup && !isHeadAdmin ? (
                                                                <span style={{ color: 'var(--text-muted)' }}>Locked</span>
                                                            ) : (
                                                                <ActionButton
                                                                    type="button"
                                                                    variant="danger"
                                                                    onClick={() => setItemToDelete(item)}
                                                                    style={{ padding: '6px 10px', fontSize: 11 }}
                                                                >
                                                                    Delete
                                                                </ActionButton>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {isCompletedGroup && sortedRows.length > 0 ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            flexWrap: 'wrap',
                                            gap: 8,
                                            marginTop: 12,
                                        }}
                                    >
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            Showing {sortedRows.length ? pageStart + 1 : 0}-{Math.min(pageStart + pageSize, sortedRows.length)} of {sortedRows.length}
                                        </div>
                                        <SelectInput
                                            value={String(pageSize)}
                                            onChange={(event) => {
                                                const nextSize = Number(event.target.value) || 10;
                                                const nextPages = { ...departmentPage, [group.department]: 1 };
                                                const nextSizes = { ...departmentPageSize, [group.department]: nextSize };
                                                setDepartmentPageSize(nextSizes);
                                                setDepartmentPage(nextPages);
                                                syncDepartmentPagination(nextPages, nextSizes);
                                            }}
                                            style={{ ...boardInputStyle, width: 80 }}
                                        >
                                            {[5, 10, 25, 50].map((size) => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </SelectInput>
                                        <ActionButton
                                            type="button"
                                            variant="neutral"
                                            onClick={() => {
                                                const nextPages = { ...departmentPage, [group.department]: Math.max(1, currentPage - 1) };
                                                setDepartmentPage(nextPages);
                                                syncDepartmentPagination(nextPages, departmentPageSize);
                                            }}
                                            disabled={currentPage <= 1}
                                        >
                                            Prev
                                        </ActionButton>
                                        <ActionButton
                                            type="button"
                                            variant="neutral"
                                            onClick={() => {
                                                const nextPages = { ...departmentPage, [group.department]: Math.min(totalPages, currentPage + 1) };
                                                setDepartmentPage(nextPages);
                                                syncDepartmentPagination(nextPages, departmentPageSize);
                                            }}
                                            disabled={currentPage >= totalPages}
                                        >
                                            Next
                                        </ActionButton>
                                    </div>
                                ) : null}
                                </>
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
                        {filesItem?.department === COMPLETED_DEPARTMENT ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Files are read-only for completed entries.
                            </div>
                        ) : (
                            <form onSubmit={submitFile} style={{ display: 'grid', gap: 10 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Upload photos or supporting files for this monitoring entry.
                                </div>
                                <label style={{ display: 'grid', gap: 6 }}>
                                    <div style={{ fontSize: 12 }}>File</div>
                                    <TextInput
                                        key={fileInputKey}
                                        type="file"
                                        onChange={(event) => setFileData('file', event.target.files?.[0] ?? null)}
                                        accept={SUPPORTED_FILE_ACCEPT}
                                        style={inputStyle}
                                    />
                                    {fileErrors.file && <div style={{ color: '#f87171', fontSize: 12 }}>{fileErrors.file}</div>}
                                </label>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    Supported: images, PDF, DOC/DOCX, XLS/XLSX, CSV, PPT/PPTX, TXT. Max 10MB.
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <ActionButton type="submit" variant="success" disabled={uploadingFile}>
                                        {uploadingFile ? 'Uploading...' : 'Upload File'}
                                    </ActionButton>
                                </div>
                            </form>
                        )}

                        <div style={{ display: 'grid', gap: 10 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>Attached Files</div>
                                {pagedFiles.length ? (
                                    pagedFiles.map((file) => {
                                        const fileUrl = file.file_path ? `/files/${file.file_path}` : '#';
                                        const downloadUrl = file.file_path
                                            ? `/files/${file.file_path}?download=1&name=${encodeURIComponent(file.original_name || 'file')}`
                                            : '#';
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
                                                    href={!isImage ? downloadUrl : undefined}
                                                    external={!isImage}
                                                    onClick={() => {
                                                        if (isImage && file.file_path) {
                                                            setPreviewFile(file);
                                                        }
                                                    }}
                                                >
                                                    {isImage ? 'Preview' : 'Download'}
                                                </ActionButton>
                                                {filesItem?.department === COMPLETED_DEPARTMENT ? null : (
                                                    <ActionButton
                                                        type="button"
                                                        variant="danger"
                                                        style={{ padding: '6px 10px' }}
                                                        onClick={() => setFileToDelete(file)}
                                                    >
                                                        Delete
                                                    </ActionButton>
                                                )}
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
                    open={!!infoItem}
                    onClose={closeInfo}
                    title={infoItem ? `Monitoring Entry Info - ${infoItem.project_name}` : 'Monitoring Entry Info'}
                    maxWidth={860}
                >
                    {infoItem ? (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {/*
                                Keep computed snapshot for completed entries visible in info modal.
                            */}
                            {(() => {
                                const infoMilestones = computeDesignMilestoneBreakdownWithBasis(
                                    infoItem.design_computation_basis,
                                    Number(infoItem.design_contract_amount || 0)
                                );
                                return (
                                    <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Department</div>
                                    <TextInput value={infoItem.department ?? ''} readOnly style={inputStyle} />
                                </label>
                                {infoItem.department === COMPLETED_DEPARTMENT ? (
                                    <label>
                                        <div style={{ fontSize: 12, marginBottom: 6 }}>Origin Department</div>
                                        <TextInput value={infoItem.origin_department ?? ''} readOnly style={inputStyle} />
                                    </label>
                                ) : null}
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Client Name</div>
                                    <TextInput value={infoItem.client_name ?? ''} readOnly style={inputStyle} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Project Name</div>
                                    <TextInput value={infoItem.project_name ?? ''} readOnly style={inputStyle} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Type</div>
                                    <TextInput value={infoItem.project_type ?? ''} readOnly style={inputStyle} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Location</div>
                                    <TextInput value={infoItem.location ?? ''} readOnly style={inputStyle} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned Designer</div>
                                    <TextInput value={infoItem.assigned_to ?? ''} readOnly style={inputStyle} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                                    <TextInput value={infoItem.status ?? ''} readOnly style={inputStyle} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Start Date</div>
                                    <TextInput value={formatDate(infoItem.start_date)} readOnly style={inputStyle} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Timeline</div>
                                    <TextInput value={infoItem.timeline ?? ''} readOnly style={inputStyle} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Due Date</div>
                                    <TextInput value={formatDate(infoItem.due_date)} readOnly style={inputStyle} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Date Paid</div>
                                    <TextInput value={formatDate(infoItem.date_paid)} readOnly style={inputStyle} />
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Design Progress (%) (Automatic)</div>
                                    <TextInput
                                        value={String(
                                            round2(
                                                computeDesignProgressWithBasis({
                                                    basis: infoItem.design_computation_basis,
                                                    designContractAmount: Number(infoItem.design_contract_amount || 0),
                                                    totalReceived: Number(infoItem.total_received || 0),
                                                    clientApprovalStatus: infoItem.client_approval_status,
                                                })
                                            ).toFixed(2)
                                        )}
                                        readOnly
                                        style={inputStyle}
                                    />
                                </label>
                            </div>

                            <label style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontSize: 12 }}>Remarks</div>
                                <TextareaInput value={infoItem.remarks ?? ''} readOnly style={{ ...inputStyle, minHeight: 90 }} />
                            </label>

                            <div style={{ ...boardPanel, display: 'grid', gap: 8 }}>
                                <div style={{ fontWeight: 700 }}>Design Computation Snapshot</div>
                                <div style={basisEditableHeaderStyle}>
                                    <div>Milestone</div>
                                    <div>Weight</div>
                                    <div>Contract</div>
                                    <div>Progress</div>
                                    <div>WT %</div>
                                    <div>Accomp Amount</div>
                                    <div />
                                </div>
                                {infoMilestones.length === 0 ? (
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No milestones yet.</div>
                                ) : (
                                    infoMilestones.map((milestone) => (
                                        <div key={milestone.key} style={basisEditableRowStyle}>
                                            <div style={milestoneTextStyle}>{milestone.label}</div>
                                            <div style={milestoneTextStyle}>{formatPercent2(milestone.percent)}%</div>
                                            <div style={milestoneTextStyle}>{money(milestone.amount)}</div>
                                            <div style={milestoneTextStyle}>{formatPercent2(milestone.progress)}%</div>
                                            <div style={milestoneTextStyle}>{formatPercent2(milestone.wt_percent)}%</div>
                                            <div style={milestoneTextStyle}>{money(milestone.accomp_amount)}</div>
                                            <div />
                                        </div>
                                    ))
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <ActionButton type="button" variant="neutral" onClick={closeInfo}>
                                    Close
                                </ActionButton>
                            </div>
                                    </>
                                );
                            })()}
                        </div>
                    ) : null}
                </Modal>

                <Modal
                    open={showCreateModal}
                    onClose={() => {
                        if (creating) return;
                        setShowCreateModal(false);
                    }}
                    title="Add Monitoring Entry"
                    headerContent={renderModalTabs(createActiveTab, setCreateActiveTab, true)}
                    maxWidth={860}
                >
                    <form onSubmit={submitCreate} style={{ display: 'grid', gap: 12 }}>
                        <div style={{ display: createActiveTab === 'details' ? 'grid' : 'none', gap: 12 }}>
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
                                <TextInput
                                    value={createData.client_name}
                                    onChange={(event) => setCreateData('client_name', event.target.value)}
                                    placeholder="Enter client name"
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
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned Designer</div>
                            <SearchableDropdown
                                options={designerSelectOptions}
                                    value={createDesignerOption}
                                    onChange={(value) => {
                                        setCreateDesignerOption(value || '');
                                        if (value === OTHER_DESIGNER_OPTION) {
                                            setCreateData('assigned_to', '');
                                            return;
                                        }
                                        setCreateData('assigned_to', value || '');
                                    }}
                                    placeholder="Select designer"
                                    searchPlaceholder="Search designers..."
                                    emptyMessage="No designers found"
                                    pageSize={10}
                                    loadMoreLabel="Show more"
                                    style={boardInputStyle}
                                    getOptionLabel={resolveOptionLabel}
                                    getOptionValue={resolveOptionValue}
                                />
                                {createDesignerOption === OTHER_DESIGNER_OPTION ? (
                                    <TextInput
                                        value={createData.assigned_to}
                                        onChange={(event) => setCreateData('assigned_to', event.target.value)}
                                        placeholder="Type designer name"
                                        style={{ ...boardInputStyle, marginTop: 6 }}
                                    />
                                ) : null}
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
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Design Progress (%)</div>
                                <TextInput
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={round2(createDesignProgress).toFixed(2)}
                                    readOnly
                                    style={{ ...boardInputStyle, opacity: 0.9, cursor: 'not-allowed' }}
                                />
                            </label>

                            </div>
                        </div>

                        <div style={{ display: createActiveTab === 'snapshot' ? 'grid' : 'none', gap: 12 }}>
                        <div style={{ ...boardPanel, display: 'grid', gap: 12 }}>
                            <div style={{ fontWeight: 600 }}>Design Computation Snapshot</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                                <div style={computationCardStyle}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Design Contract Amount</div>
                                    <div style={{ fontWeight: 700 }}>{money(createData.design_contract_amount)}</div>
                                </div>
                                <div style={computationCardStyle}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Design Remaining</div>
                                    <div style={{ fontWeight: 700, color: createRemaining < 0 ? '#f87171' : '#4ade80' }}>
                                        {money(createRemaining)}
                                    </div>
                                </div>
                                <div style={computationCardStyle}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Net Income</div>
                                    <div style={{ fontWeight: 700, color: createNetIncome < 0 ? '#f87171' : '#4ade80' }}>
                                        {money(createNetIncome)}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Design Contract Amount</div>
                                    <TextInput
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={createData.design_contract_amount}
                                        onChange={(event) => setCreateData('design_contract_amount', event.target.value)}
                                        style={boardInputStyle}
                                    />
                                    {createErrors.design_contract_amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.design_contract_amount}</div>}
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Downpayment</div>
                                    <TextInput
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={createData.downpayment}
                                        onChange={(event) => setCreateData('downpayment', event.target.value)}
                                        style={boardInputStyle}
                                    />
                                    {createErrors.downpayment && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.downpayment}</div>}
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Total Received</div>
                                    <TextInput
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={createData.total_received}
                                        onChange={(event) => setCreateData('total_received', event.target.value)}
                                        style={boardInputStyle}
                                    />
                                    {createErrors.total_received && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.total_received}</div>}
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Office Payroll Deduction</div>
                                    <TextInput
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={createData.office_payroll_deduction}
                                        onChange={(event) => setCreateData('office_payroll_deduction', event.target.value)}
                                        style={boardInputStyle}
                                    />
                                    {createErrors.office_payroll_deduction && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.office_payroll_deduction}</div>}
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Design Progress (%) (Automatic)</div>
                                    <TextInput
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={round2(createDesignProgress).toFixed(2)}
                                        readOnly
                                        style={{ ...boardInputStyle, opacity: 0.9, cursor: 'not-allowed' }}
                                    />
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Client Approval Status</div>
                                    <SelectInput
                                        value={createData.client_approval_status}
                                        onChange={(event) => setCreateData('client_approval_status', event.target.value)}
                                        style={boardInputStyle}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected">Rejected</option>
                                    </SelectInput>
                                    {createErrors.client_approval_status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{createErrors.client_approval_status}</div>}
                                </label>
                            </div>

                            <div style={{ display: 'grid', gap: 8 }}>
                                <div style={{ fontWeight: 700 }}>Design Computation Basis</div>
                                <div style={basisEditableHeaderStyle}>
                                    <div>Milestone</div>
                                    <div>Weight</div>
                                    <div>Contract</div>
                                    <div>Progress</div>
                                    <div>WT %</div>
                                    <div>Accomp Amount</div>
                                    <div />
                                </div>
                                {createMilestoneBreakdown.length === 0 ? (
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No milestones yet.</div>
                                ) : (
                                    createMilestoneBreakdown.map((milestone) => (
                                        <div key={milestone.key} style={basisEditableRowStyle}>
                                        <TextInput
                                            value={milestone.label}
                                            onChange={(event) => updateCreateBasisItem(milestone.key, 'label', event.target.value)}
                                            placeholder="Milestone label"
                                            style={boardInputStyle}
                                        />
                                        <TextInput
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={milestone.percent}
                                            onChange={(event) => updateCreateBasisItem(milestone.key, 'percent', event.target.value)}
                                            style={boardInputStyle}
                                        />
                                        <div style={milestoneTextStyle}>{money(milestone.amount)}</div>
                                        <TextInput
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={milestone.progress}
                                            onChange={(event) => updateCreateBasisItem(milestone.key, 'progress', event.target.value)}
                                            style={boardInputStyle}
                                        />
                                        <div style={milestoneTextStyle}>{formatPercent2(milestone.wt_percent)}%</div>
                                        <div style={milestoneTextStyle}>{money(milestone.accomp_amount)}</div>
                                        <ActionButton
                                            type="button"
                                            variant="danger"
                                            onClick={() => removeCreateBasisItem(milestone.key)}
                                            style={{ padding: '6px 8px', fontSize: 11 }}
                                            >
                                                <Trash2 size={14} />
                                            </ActionButton>
                                        </div>
                                    ))
                                )}
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <ActionButton type="button" variant="neutral" onClick={addCreateBasisItem} style={{ padding: '8px 12px', fontSize: 12 }}>
                                        Add Milestone
                                    </ActionButton>
                                </div>
                            </div>
                        </div>
                        </div>

                        <label style={{ display: createActiveTab === 'details' ? 'grid' : 'none', gap: 6 }}>
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
                    headerContent={renderModalTabs(editActiveTab, setEditActiveTab, editItem?.department !== COMPLETED_DEPARTMENT)}
                    maxWidth={860}
                >
                    <div style={{ display: editActiveTab === 'details' ? 'grid' : 'none', gap: 12 }}>
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
                            <TextInput
                                value={editData.client_name}
                                onChange={(event) => setEditData('client_name', event.target.value)}
                                placeholder="Enter client name"
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
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Assigned Designer</div>
                            <SearchableDropdown
                                options={designerEditOptions}
                                value={editDesignerOption}
                                onChange={(value) => {
                                    setEditDesignerOption(value || '');
                                    if (value === OTHER_DESIGNER_OPTION) {
                                        setEditData('assigned_to', '');
                                        return;
                                    }
                                    setEditData('assigned_to', value || '');
                                }}
                                placeholder="Select designer"
                                searchPlaceholder="Search designers..."
                                emptyMessage="No designers found"
                                pageSize={10}
                                loadMoreLabel="Show more"
                                style={inputStyle}
                                getOptionLabel={resolveOptionLabel}
                                getOptionValue={resolveOptionValue}
                            />
                            {editDesignerOption === OTHER_DESIGNER_OPTION ? (
                                <TextInput
                                    value={editData.assigned_to}
                                    onChange={(event) => setEditData('assigned_to', event.target.value)}
                                    placeholder="Type designer name"
                                    style={{ ...inputStyle, marginTop: 6 }}
                                />
                            ) : null}
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
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Design Progress (%)</div>
                            <TextInput
                                type="number"
                                min="0"
                                max="100"
                                value={round2(editDesignProgress).toFixed(2)}
                                readOnly
                                style={{ ...inputStyle, opacity: 0.9, cursor: 'not-allowed' }}
                            />
                        </label>

                    </div>
                    </div>

                        <div style={{ display: editActiveTab === 'snapshot' && editItem?.department !== COMPLETED_DEPARTMENT ? 'grid' : 'none', gap: 12 }}>
                    <div style={{ ...boardPanel, display: 'grid', gap: 12 }}>
                        <div style={{ fontWeight: 600 }}>Design Computation Snapshot</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                            <div style={computationCardStyle}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Design Contract Amount</div>
                                <div style={{ fontWeight: 700 }}>{money(editData.design_contract_amount)}</div>
                            </div>
                            <div style={computationCardStyle}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Design Remaining</div>
                                <div style={{ fontWeight: 700, color: editRemaining < 0 ? '#f87171' : '#4ade80' }}>
                                    {money(editRemaining)}
                                </div>
                            </div>
                            <div style={computationCardStyle}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Net Income</div>
                                <div style={{ fontWeight: 700, color: editNetIncome < 0 ? '#f87171' : '#4ade80' }}>
                                    {money(editNetIncome)}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Design Contract Amount</div>
                                <TextInput
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editData.design_contract_amount}
                                    onChange={(event) => setEditData('design_contract_amount', event.target.value)}
                                    style={inputStyle}
                                />
                                {editErrors.design_contract_amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.design_contract_amount}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Downpayment</div>
                                <TextInput
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editData.downpayment}
                                    onChange={(event) => setEditData('downpayment', event.target.value)}
                                    style={inputStyle}
                                />
                                {editErrors.downpayment && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.downpayment}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Total Received</div>
                                <TextInput
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editData.total_received}
                                    onChange={(event) => setEditData('total_received', event.target.value)}
                                    style={inputStyle}
                                />
                                {editErrors.total_received && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.total_received}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Office Payroll Deduction</div>
                                <TextInput
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editData.office_payroll_deduction}
                                    onChange={(event) => setEditData('office_payroll_deduction', event.target.value)}
                                    style={inputStyle}
                                />
                                {editErrors.office_payroll_deduction && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.office_payroll_deduction}</div>}
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Design Progress (%) (Automatic)</div>
                                <TextInput
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={round2(editDesignProgress).toFixed(2)}
                                    readOnly
                                    style={{ ...inputStyle, opacity: 0.9, cursor: 'not-allowed' }}
                                />
                            </label>

                            <label>
                                <div style={{ fontSize: 12, marginBottom: 6 }}>Client Approval Status</div>
                                <SelectInput
                                    value={editData.client_approval_status}
                                    onChange={(event) => setEditData('client_approval_status', event.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </SelectInput>
                                {editErrors.client_approval_status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{editErrors.client_approval_status}</div>}
                            </label>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontWeight: 700 }}>Design Computation Basis</div>
                            <div style={basisEditableHeaderStyle}>
                                <div>Milestone</div>
                                <div>Weight</div>
                                <div>Contract</div>
                                <div>Progress</div>
                                <div>WT %</div>
                                <div>Accomp Amount</div>
                                <div />
                            </div>
                            {editMilestoneBreakdown.length === 0 ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No milestones yet.</div>
                            ) : (
                                editMilestoneBreakdown.map((milestone) => (
                                    <div key={milestone.key} style={basisEditableRowStyle}>
                                    <TextInput
                                        value={milestone.label}
                                        onChange={(event) => updateEditBasisItem(milestone.key, 'label', event.target.value)}
                                        placeholder="Milestone label"
                                        style={inputStyle}
                                    />
                                    <TextInput
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={milestone.percent}
                                        onChange={(event) => updateEditBasisItem(milestone.key, 'percent', event.target.value)}
                                        style={inputStyle}
                                    />
                                    <div style={milestoneTextStyle}>{money(milestone.amount)}</div>
                                    <TextInput
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={milestone.progress}
                                        onChange={(event) => updateEditBasisItem(milestone.key, 'progress', event.target.value)}
                                        style={inputStyle}
                                    />
                                    <div style={milestoneTextStyle}>{formatPercent2(milestone.wt_percent)}%</div>
                                    <div style={milestoneTextStyle}>{money(milestone.accomp_amount)}</div>
                                    <ActionButton
                                        type="button"
                                        variant="danger"
                                        onClick={() => removeEditBasisItem(milestone.key)}
                                        style={{ padding: '6px 8px', fontSize: 11 }}
                                        >
                                            <Trash2 size={14} />
                                        </ActionButton>
                                    </div>
                                ))
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <ActionButton type="button" variant="neutral" onClick={addEditBasisItem} style={{ padding: '8px 12px', fontSize: 12 }}>
                                    Add Milestone
                                </ActionButton>
                            </div>
                        </div>
                    </div>
                    </div>

                    <label style={{ display: editActiveTab === 'details' ? 'grid' : 'none', gap: 6 }}>
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
                    open={!!departmentToDelete}
                    title="Delete Department"
                    message={
                        departmentToDelete
                            ? (() => {
                                const total = departmentToDelete.count || 0;
                                const names = Array.isArray(departmentToDelete.names) ? departmentToDelete.names : [];
                                const preview = names.slice(0, 5);
                                const remaining = Math.max(0, names.length - preview.length);
                                const list = preview.length
                                    ? `Entries: ${preview.join(', ')}${remaining ? `, and ${remaining} more` : ''}.`
                                    : '';
                                return `Delete "${departmentToDelete.name}" and its ${total} entr${total === 1 ? 'y' : 'ies'}? ${list} This action cannot be undone.`;
                            })()
                            : 'Delete this department?'
                    }
                    confirmLabel={deletingDepartment ? 'Deleting...' : 'Delete'}
                    cancelLabel="Cancel"
                    danger
                    processing={deletingDepartment}
                    onClose={() => (deletingDepartment ? null : setDepartmentToDelete(null))}
                    onConfirm={confirmDeleteDepartment}
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


