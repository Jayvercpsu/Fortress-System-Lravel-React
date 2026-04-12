import Layout from '../../Components/Layout';
import DataTable from '../../Components/DataTable';
import DatePickerInput from '../../Components/DatePickerInput';
import SearchableDropdown from '../../Components/SearchableDropdown';
import Modal from '../../Components/Modal';
import ActionButton from '../../Components/ActionButton';
import ConfirmationModal from '../../Components/ConfirmationModal';
import InlinePagination from '../../Components/InlinePagination';
import SelectInput from '../../Components/SelectInput';
import TextInput from '../../Components/TextInput';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { toastMessages } from '../../constants/toastMessages';
import { Trash2 } from 'lucide-react';

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
    boxSizing: 'border-box',
};

const money = (value) => `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });

const statusPill = (status) => {
    const colors = {
        pending: '#94a3b8',
        ready: '#f59e0b',
        approved: '#10b981',
        paid: '#60a5fa',
    };
    const color = colors[status] || 'var(--text-muted)';
    return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 999,
        border: `1px solid ${color}33`,
        background: `${color}14`,
        color,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'capitalize',
    };
};

export default function PayrollRun({
    projectOptions = [],
    selectedProject = null,
    cutoffs = [],
    selectedCutoff = null,
    payrollRows = [],
    projectFinancialSummary = null,
    generateProjectOptions = [],
    payrollHistory = [],
    projectPayrollHistory = [],
    payrollHistoryTable = {},
    payrollTable = {},
    payrollGroup = 'workers',
    today = '',
}) {
    const [selectedPayrollId, setSelectedPayrollId] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
    const [deductionToDelete, setDeductionToDelete] = useState(null);
    const [deletingDeduction, setDeletingDeduction] = useState(false);
    const [historyDetailRow, setHistoryDetailRow] = useState(null);
    const [historyToDelete, setHistoryToDelete] = useState(null);
    const isStaff = payrollGroup === 'staff';
    const selectedProjectId = !isStaff && selectedProject?.id ? String(selectedProject.id) : '';
    const groupQueryParams = new URLSearchParams();
    if (payrollGroup) {
        groupQueryParams.set('group', payrollGroup);
    }
    if (!isStaff && selectedProjectId) {
        groupQueryParams.set('project_id', selectedProjectId);
    }
    const groupQuery = groupQueryParams.toString() ? `?${groupQueryParams.toString()}` : '';
    const ratesLabel = payrollGroup === 'staff' ? 'Staff Rates' : 'Worker Rates';
    const personLabel = payrollGroup === 'staff' ? 'Staff' : 'Worker';

    const table = {
        search: payrollTable?.search ?? '',
        perPage: Number(payrollTable?.per_page ?? 10),
        page: Number(payrollTable?.current_page ?? 1),
        lastPage: Number(payrollTable?.last_page ?? 1),
        total: Number(payrollTable?.total ?? 0),
        from: payrollTable?.from ?? null,
        to: payrollTable?.to ?? null,
    };
    const historyPager = payrollHistoryTable || {};
    const historyPage = Number(historyPager?.current_page ?? 1);
    const historyPerPage = Number(historyPager?.per_page ?? 20);

    const generateForm = useForm({
        project_id: selectedProjectId,
        start_date: selectedCutoff?.start_date ?? '',
        end_date: selectedCutoff?.end_date ?? '',
    });
    const generateProjectOptionsList = Array.isArray(generateProjectOptions) ? generateProjectOptions : [];

    const deductionForm = useForm({
        type: 'cash_advance',
        amount: '',
        note: '',
    });

    const incentiveForm = useForm({
        type: 'incentive',
        amount: '',
        note: '',
    });

    const hoursForm = useForm({
        hours: '',
    });

    const markPaidForm = useForm({
        cutoff_id: selectedCutoff?.id ?? '',
        payment_reference: '',
        bank_export_ref: '',
    });

    useEffect(() => {
        if (!isStaff && selectedProjectId && String(generateForm.data.project_id || '') !== selectedProjectId) {
            generateForm.setData('project_id', selectedProjectId);
        }
        if (isStaff && generateForm.data.project_id) {
            generateForm.setData('project_id', '');
        }
        if (!isStaff && generateForm.data.project_id) {
            const exists = generateProjectOptionsList.some((project) => String(project.id) === String(generateForm.data.project_id));
            if (!exists) {
                generateForm.setData('project_id', '');
            }
        }
        if (!generateForm.data.start_date && selectedCutoff?.start_date) {
            generateForm.setData('start_date', selectedCutoff.start_date);
        }
        if (!generateForm.data.end_date && selectedCutoff?.end_date) {
            generateForm.setData('end_date', selectedCutoff.end_date);
        }
        markPaidForm.setData('cutoff_id', selectedCutoff?.id ?? '');
    }, [selectedCutoff?.id, selectedProjectId, isStaff, generateProjectOptionsList.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectedPayroll = useMemo(
        () => payrollRows.find((row) => Number(row.id) === Number(selectedPayrollId)) || null,
        [payrollRows, selectedPayrollId]
    );

    useEffect(() => {
        if (showEditModal && selectedPayrollId && !selectedPayroll) {
            setShowEditModal(false);
            setSelectedPayrollId(null);
        }
    }, [showEditModal, selectedPayrollId, selectedPayroll]);

    const buildQuery = (overrides = {}) => {
        const params = {
            project_id: isStaff
                ? null
                : (overrides.project_id !== undefined ? overrides.project_id : selectedProject?.id),
            cutoff_id: overrides.cutoff_id !== undefined ? overrides.cutoff_id : selectedCutoff?.id,
            search: overrides.search !== undefined ? overrides.search : table.search,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
            group: overrides.group !== undefined ? overrides.group : payrollGroup,
            history_page: overrides.history_page !== undefined ? overrides.history_page : historyPage,
            history_per_page: overrides.history_per_page !== undefined ? overrides.history_per_page : historyPerPage,
        };

        return Object.fromEntries(
            Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== '')
        );
    };

    const queryString = (overrides = {}) => {
        const params = new URLSearchParams(buildQuery(overrides));
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    };

    const navigateTable = (overrides = {}) => {
        router.get('/payroll/run', buildQuery(overrides), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const submitGenerate = (e) => {
        e.preventDefault();
        generateForm.post(`/payroll/run/generate${queryString({ page: 1 })}`, {
            preserveScroll: true,
            onSuccess: () => toast.success(toastMessages.payrollRun.generateSuccess),
            onError: () => toast.error(toastMessages.payrollRun.generateError),
        });
    };

    const openEdit = (row) => {
        setSelectedPayrollId(row.id);
        deductionForm.reset();
        deductionForm.setData({ type: 'cash_advance', amount: '', note: '' });
        deductionForm.clearErrors();
        incentiveForm.reset();
        incentiveForm.setData({ type: 'incentive', amount: '', note: '' });
        incentiveForm.clearErrors();
        hoursForm.reset();
        hoursForm.setData({ hours: String(row.hours ?? '') });
        hoursForm.clearErrors();
        setShowEditModal(true);
    };

    const submitDeduction = (e) => {
        e.preventDefault();
        if (!selectedPayroll) return;

        deductionForm.post(`/payroll/${selectedPayroll.id}/deductions${queryString()}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                deductionForm.reset();
                deductionForm.setData({ type: 'cash_advance', amount: '', note: '' });
                toast.success(toastMessages.payrollRun.deductionAddSuccess);
            },
            onError: () => toast.error(toastMessages.payrollRun.deductionAddError),
        });
    };

    const submitIncentive = (e) => {
        e.preventDefault();
        if (!selectedPayroll) return;

        incentiveForm.post(`/payroll/${selectedPayroll.id}/deductions${queryString()}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                incentiveForm.reset();
                toast.success('Incentive added.');
            },
            onError: () => toast.error('Unable to add incentive.'),
        });
    };

    const submitHours = (e) => {
        e.preventDefault();
        if (!selectedPayroll) return;

        hoursForm.patch(`/payroll/${selectedPayroll.id}/hours${queryString()}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => toast.success('Hours updated.'),
            onError: () => toast.error('Unable to update hours.'),
        });
    };

    const deleteDeduction = (deductionId) => {
        if (!selectedPayroll) return;

        setDeletingDeduction(true);
        router.delete(`/payroll-deductions/${deductionId}${queryString()}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => toast.success(toastMessages.payrollRun.deductionRemoveSuccess),
            onError: () => toast.error(toastMessages.payrollRun.deductionRemoveError),
            onFinish: () => {
                setDeletingDeduction(false);
                setDeductionToDelete(null);
            },
        });
    };

    const submitMarkPaid = (e) => {
        e.preventDefault();
        if (!selectedCutoff?.id) return;

        markPaidForm.post(`/payroll/run/mark-paid${queryString()}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setShowMarkPaidModal(false);
                toast.success(toastMessages.payrollRun.cutoffPaidSuccess);
            },
            onError: () => toast.error(toastMessages.payrollRun.cutoffPaidError),
        });
    };

    const submitHistoryDelete = () => {
        if (!historyToDelete?.cutoff_id) return;
        const payload = {
            cutoff_id: historyToDelete.cutoff_id,
        };
        if (historyToDelete.project_id) {
            payload.project_id = historyToDelete.project_id;
        }
        router.delete(`/payroll/history${queryString()}`, {
            data: payload,
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setHistoryToDelete(null);
                setHistoryDetailRow(null);
                toast.success('Payroll history deleted.');
            },
            onError: () => toast.error('Unable to delete payroll history.'),
        });
    };

    const buildHistoryExportUrl = (row) => {
        if (!row?.cutoff_id) return '';
        const params = new URLSearchParams();
        params.set('cutoff_id', row.cutoff_id);
        if (payrollGroup) {
            params.set('group', payrollGroup);
        }
        if (row.project_id) {
            params.set('project_id', row.project_id);
        }
        return `/payroll/export?${params.toString()}`;
    };

    const printHistoryReceipt = (row, transactions) => {
        if (!row?.cutoff_id) return;
        const title = `Payroll Receipt - ${row.cutoff_start || ''} to ${row.cutoff_end || ''}`.trim();
        const projectLine = isStaff
            ? 'Office Payroll'
            : `${row.project_name || '-'}${row.project_client ? ` - ${row.project_client}` : ''}`;
        const printedAt = new Date().toLocaleString();
        const paymentRef = (Array.isArray(transactions) ? transactions : [])
            .map((item) => String(item.payment_reference || '').trim())
            .find((value) => value !== '') || '-';
        const bankRef = (Array.isArray(transactions) ? transactions : [])
            .map((item) => String(item.bank_export_ref || '').trim())
            .find((value) => value !== '') || '-';
        const rows = (Array.isArray(transactions) ? transactions : []).map((txn) => `
            <tr>
                <td>${txn.worker_name || '-'}</td>
                <td>${txn.role || '-'}</td>
                <td class="num">${num(txn.hours)}</td>
                <td class="num">${money(txn.rate_per_hour)}</td>
                <td class="num">${money(txn.gross)}</td>
                <td class="num">${money(txn.incentives)}</td>
                <td class="num">${money(txn.deductions)}</td>
                <td class="num">${money(txn.net)}</td>
                <td>${txn.status || '-'}</td>
            </tr>
        `).join('');

        const html = `
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body{font-family:Arial, sans-serif; padding:24px; color:#0f172a;}
                        .meta{margin-bottom:16px;}
                        .meta h1{margin:0 0 8px 0; font-size:20px;}
                        .meta div{font-size:12px; color:#64748b;}
                        table{width:100%; border-collapse:collapse; font-size:12px; margin-top:16px;}
                        th,td{border:1px solid #e2e8f0; padding:8px; text-align:left;}
                        th{background:#f8fafc; font-weight:600;}
                        .num{text-align:right; font-family: "DM Mono", monospace;}
                        @media print { body{padding:0;} }
                    </style>
                </head>
                <body>
                    <div class="meta">
                        <h1>Payroll Receipt</h1>
                        <div>Cutoff: ${row.cutoff_start || '-'} to ${row.cutoff_end || '-'}</div>
                        <div>Project: ${projectLine}</div>
                        <div>Rows: ${row.payroll_count || 0} | Hours: ${num(row.total_hours)} | Net: ${money(row.total_net)}</div>
                        <div>Payment Ref: ${paymentRef}</div>
                        <div>Bank Export Ref: ${bankRef}</div>
                        <div>Printed: ${printedAt}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>${personLabel}</th>
                                <th>Role</th>
                                <th>Hours</th>
                                <th>Rate</th>
                                <th>Gross</th>
                                <th>Incentives</th>
                                <th>Deductions</th>
                                <th>Net</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || `<tr><td colspan="9">No transactions.</td></tr>`}
                        </tbody>
                    </table>
                </body>
            </html>
        `;

        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
        const frameDoc = printFrame.contentWindow?.document;
        if (!frameDoc) {
            document.body.removeChild(printFrame);
            return;
        }
        frameDoc.open();
        frameDoc.write(html);
        frameDoc.close();
        printFrame.onload = () => {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
            setTimeout(() => {
                document.body.removeChild(printFrame);
            }, 500);
        };
    };

    const baseColumns = [
        {
            key: 'worker_name',
            label: personLabel,
            align: 'left',
            headerAlign: 'left',
            render: (row) => <div style={{ fontWeight: 700 }}>{row.worker_name}</div>,
            searchAccessor: (row) => row.worker_name,
        },
        {
            key: 'project_name',
            label: 'Project',
            width: 200,
            align: 'left',
            headerAlign: 'left',
            render: (row) => <span>{row.project_name || (isStaff ? 'Office Payroll' : '-')}</span>,
            searchAccessor: (row) => row.project_name || (isStaff ? 'Office Payroll' : ''),
        },
        { key: 'role', label: 'Role', width: 120, align: 'left', headerAlign: 'left' },
        { key: 'hours', label: 'Hours', width: 100, align: 'left', headerAlign: 'left', render: (row) => <span style={{ fontFamily: "'DM Mono', monospace" }}>{num(row.hours)}</span> },
        { key: 'rate_per_hour', label: 'Rate', width: 120, align: 'left', headerAlign: 'left', render: (row) => <span style={{ fontFamily: "'DM Mono', monospace" }}>{money(row.rate_per_hour)}</span> },
        { key: 'gross', label: 'Gross', width: 120, align: 'left', headerAlign: 'left', render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>{money(row.gross)}</span> },
        {
            key: 'incentives',
            label: 'Incentives',
            width: 120,
            align: 'left',
            headerAlign: 'left',
            render: (row) => {
                const incentiveTotal = (row.deduction_items || [])
                    .filter((item) => item.type === 'incentive')
                    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
                return <span style={{ fontFamily: "'DM Mono', monospace", color: '#38bdf8' }}>{money(incentiveTotal)}</span>;
            },
        },
        { key: 'deductions', label: 'Deductions', width: 120, align: 'left', headerAlign: 'left', render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", color: '#f87171' }}>{money(row.deductions)}</span> },
        { key: 'net', label: 'Net Pay', width: 120, align: 'left', headerAlign: 'left', render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: '#4ade80', whiteSpace: 'nowrap' }}>{money(row.net)}</span> },
        { key: 'status', label: 'Status', width: 100, align: 'left', headerAlign: 'left', render: (row) => <span style={statusPill(row.status)}>{row.status}</span> },
        {
            key: 'actions',
            label: 'Actions',
            width: 140,
            align: 'left',
            headerAlign: 'left',
            render: (row) => (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                    <ActionButton
                        type="button"
                        variant={row.can_edit_deductions ? 'edit' : 'neutral'}
                        disabled={!row.can_edit_deductions}
                        onClick={() => openEdit(row)}
                    >
                        Edit
                    </ActionButton>
                </div>
            ),
        },
    ];
    const columns = isStaff
        ? baseColumns.filter((column) => column.key !== 'project_name')
        : baseColumns;

    const cutoffSelectControl = (
        <div className="grid grid-cols-1 sm:[grid-template-columns:84px_minmax(260px,380px)] gap-2 sm:items-center">
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>View Cutoff</span>
            <div style={{ width: '100%' }}>
                <SearchableDropdown
                    options={cutoffs.map((cutoff) => ({
                        id: cutoff.id,
                        label: `${cutoff.start_date} to ${cutoff.end_date} (${cutoff.status})`,
                    }))}
                    value={selectedCutoff?.id ?? ''}
                    onChange={(value) => navigateTable({ cutoff_id: value || '', page: 1 })}
                    placeholder="Select cutoff"
                    searchPlaceholder="Search cutoffs..."
                    emptyMessage="No cutoffs found"
                    pageSize={5}
                    loadMoreLabel="Load more"
                />
            </div>
        </div>
    );

    const projectSelectControl = (
        <div className="grid grid-cols-1 sm:[grid-template-columns:84px_minmax(260px,380px)] gap-2 sm:items-center">
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Project</span>
            <div style={{ width: '100%' }}>
                <SearchableDropdown
                    options={generateProjectOptionsList.map((project) => ({
                        id: project.id,
                        label: `${project.name}${project.client ? ` - ${project.client}` : ''}`,
                    }))}
                    value={selectedProject?.id ?? ''}
                    onChange={(value) => navigateTable({ project_id: value || '', cutoff_id: '', page: 1, search: '' })}
                    placeholder="Select project"
                    searchPlaceholder="Search project..."
                    emptyMessage="No projects found"
                    pageSize={6}
                    loadMoreLabel="Load more"
                />
            </div>
        </div>
    );

    const groupTabs = (
        <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 items-center"
            style={{ ...cardStyle, padding: 6, background: 'var(--surface-2)' }}
        >
            {[
                { key: 'workers', label: 'Payroll for Workers', note: 'Workers + Foremen' },
                { key: 'staff', label: 'Payroll for Staff', note: 'HR, Admin, Designer' },
            ].map((tab) => {
                const active = payrollGroup === tab.key;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => navigateTable({ group: tab.key, page: 1 })}
                        style={{
                            border: '1px solid transparent',
                            background: active ? 'var(--surface-1)' : 'transparent',
                            color: 'var(--text-main)',
                            padding: '10px 14px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            textAlign: 'left',
                            boxShadow: active ? '0 6px 14px rgba(15, 23, 42, 0.12)' : 'none',
                        }}
                    >
                        <div style={{ display: 'grid', gap: 2 }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{tab.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tab.note}</span>
                        </div>
                        <span
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: active ? 'var(--primary, #2563eb)' : 'var(--border-color)',
                                boxShadow: active ? '0 0 0 4px rgba(37, 99, 235, 0.12)' : 'none',
                            }}
                            aria-hidden="true"
                        />
                    </button>
                );
            })}
        </div>
    );

    const projectTotals = projectFinancialSummary?.totals || null;
    const selectedCutoffProjectTotals = projectFinancialSummary?.selected_cutoff || null;
    const projectHistoryRows = Array.isArray(payrollHistory) && payrollHistory.length
        ? payrollHistory
        : (Array.isArray(projectPayrollHistory) ? projectPayrollHistory : []);
    const historyDetailTransactions = Array.isArray(historyDetailRow?.transactions)
        ? historyDetailRow.transactions
        : [];
    const hasSelectedCutoff = !!selectedCutoff?.id;
    const activeCutoff = hasSelectedCutoff
        ? selectedCutoff
        : {
            id: '',
            start_date: generateForm.data.start_date || today || '-',
            end_date: generateForm.data.end_date || today || '-',
            status: 'generated',
            payroll_count: payrollRows.length,
            total_hours: 0,
            total_gross: 0,
            total_deductions: 0,
            total_net: 0,
            paid_count: 0,
        };
    const tableTopControls = (
        <div style={{ display: 'grid', gap: 10, alignItems: 'start', alignSelf: 'flex-start' }}>
            {!isStaff ? projectSelectControl : null}
            {cutoffSelectControl}
        </div>
    );
    const canGenerate = isStaff
        ? Boolean(generateForm.data.start_date && generateForm.data.end_date)
        : Boolean(generateForm.data.project_id);
    const showPayrollRun = isStaff || !!selectedProject;

    return (
        <>
            <Head title="Payroll Run" />
            <Layout title="Payroll Run">
                <div style={{ display: 'grid', gap: 16 }}>
                    {groupTabs}
                    <form onSubmit={submitGenerate} style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                        <div
                            style={{
                                display: 'flex',
                                gap: 28,
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                justifyContent: 'space-between',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <ActionButton href={`/payroll/worker-rates${groupQuery}`} variant="success" style={{ padding: '10px 16px', fontSize: 13 }}>
                                    {ratesLabel}
                                </ActionButton>
                                {/*
                                <ActionButton href={`/payroll${groupQuery}`} variant="success" style={{ padding: '10px 16px', fontSize: 13 }}>
                                    Manual Payroll
                                </ActionButton>
                                */}
                            </div>

                            <div
                                className={`w-full grid grid-cols-1 sm:grid-cols-2 gap-3 items-start justify-center ${
                                    isStaff
                                        ? 'lg:[grid-template-columns:repeat(2,minmax(220px,300px))_auto]'
                                        : 'lg:[grid-template-columns:minmax(280px,420px)_repeat(2,minmax(220px,300px))_auto]'
                                }`}
                                style={{ minWidth: 0 }}
                            >
                                {!isStaff ? (
                                    <label style={{ display: 'grid', alignContent: 'start', minWidth: 0 }}>
                                        <div style={{ fontSize: 12, marginBottom: 6 }}>Project</div>
                                        <SearchableDropdown
                                            options={generateProjectOptionsList.map((project) => ({
                                                id: project.id,
                                                label: `${project.name}${project.client ? ` - ${project.client}` : ''}`,
                                            }))}
                                            value={generateForm.data.project_id}
                                            onChange={(value) => {
                                                generateForm.setData('project_id', value || '');
                                                navigateTable({ project_id: value || '', cutoff_id: '', page: 1, search: '' });
                                            }}
                                            placeholder="Select project"
                                            searchPlaceholder="Search project..."
                                            emptyMessage="No projects found"
                                            pageSize={6}
                                            loadMoreLabel="Load more"
                                        />
                                        {generateForm.errors.project_id ? (
                                            <div style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>
                                                {generateForm.errors.project_id}
                                            </div>
                                        ) : null}
                                    </label>
                                ) : null}

                                <label style={{ display: 'grid', alignContent: 'start', minWidth: 0 }}>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Cutoff Start</div>
                                    <DatePickerInput
                                        value={generateForm.data.start_date}
                                        onChange={(value) => generateForm.setData('start_date', value)}
                                        style={inputStyle}
                                        maxDate={today || undefined}
                                    />
                                    {generateForm.errors.start_date ? (
                                        <div style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>
                                            {generateForm.errors.start_date}
                                        </div>
                                    ) : null}
                                </label>

                                <label style={{ display: 'grid', alignContent: 'start', minWidth: 0 }}>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Cutoff End</div>
                                    <DatePickerInput
                                        value={generateForm.data.end_date}
                                        onChange={(value) => generateForm.setData('end_date', value)}
                                        style={inputStyle}
                                        minDate={generateForm.data.start_date || undefined}
                                        maxDate={today || undefined}
                                    />
                                    {generateForm.errors.end_date ? (
                                        <div style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>
                                            {generateForm.errors.end_date}
                                        </div>
                                    ) : null}
                                </label>

                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'start', paddingTop: 16 }}>
                                    <ActionButton type="submit" variant="success" disabled={generateForm.processing || !canGenerate} style={{ padding: '10px 16px', fontSize: 13 }}>
                                        {generateForm.processing ? 'Generating...' : 'Generate Payroll'}
                                    </ActionButton>
                                </div>
                            </div>
                        </div>
                    </form>

                    {showPayrollRun ? (
                        <>
                            {isStaff ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Cutoff</div>
                                        <div style={{ fontWeight: 700 }}>{activeCutoff.start_date} to {activeCutoff.end_date}</div>
                                        <div style={{ marginTop: 6 }}><span style={statusPill(activeCutoff.status)}>{activeCutoff.status}</span></div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Payroll Scope</div>
                                        <div style={{ fontWeight: 700 }}>Office Payroll</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Staff payroll (general)</div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Hours / Rows</div>
                                        <div style={{ fontWeight: 700 }}>{num(activeCutoff.total_hours)} hrs</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeCutoff.payroll_count} payroll rows</div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Net Pay</div>
                                        <div style={{ fontWeight: 700, color: '#4ade80' }}>{money(activeCutoff.total_net)}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeCutoff.paid_count} paid rows</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Cutoff</div>
                                        <div style={{ fontWeight: 700 }}>{activeCutoff.start_date} to {activeCutoff.end_date}</div>
                                        <div style={{ marginTop: 6 }}><span style={statusPill(activeCutoff.status)}>{activeCutoff.status}</span></div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Project</div>
                                        <div style={{ fontWeight: 700 }}>{selectedProject.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedProject.client || '-'}</div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Hours / Rows</div>
                                        <div style={{ fontWeight: 700 }}>{num(activeCutoff.total_hours)} hrs</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeCutoff.payroll_count} payroll rows</div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Net Pay</div>
                                        <div style={{ fontWeight: 700, color: '#4ade80' }}>{money(activeCutoff.total_net)}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeCutoff.paid_count} paid rows</div>
                                    </div>
                                </div>
                            )}

                            {!isStaff && projectTotals ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Contract Budget</div>
                                        <div style={{ fontWeight: 700 }}>{money(projectTotals.contract_amount)}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            Utilized {Number(projectTotals.budget_utilization_pct || 0).toFixed(2)}%
                                        </div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Payroll / Expenses</div>
                                        <div style={{ fontWeight: 700, color: '#4ade80' }}>{money(projectTotals.payroll_net)}</div>
                                        <div style={{ fontSize: 12, color: '#f59e0b' }}>{money(projectTotals.expenses_total)}</div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Tracked Cost</div>
                                        <div style={{ fontWeight: 700 }}>{money(projectTotals.tracked_total_cost)}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {projectTotals.payroll_rows} payroll records tagged to this project
                                        </div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Remaining Budget</div>
                                        <div style={{ fontWeight: 700, color: projectTotals.remaining_budget >= 0 ? '#4ade80' : '#f87171' }}>
                                            {money(projectTotals.remaining_budget)}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            Cutoff net: {money(selectedCutoffProjectTotals?.net || 0)}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {isStaff
                                        ? 'Staff payroll is recorded as office payroll and is not tagged to projects.'
                                        : 'Rates are reused from latest payroll history. Records are now tagged per project so payroll, expenses, and budget computations stay aligned in one professional flow.'}
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <ActionButton
                                        type="button"
                                        variant="success"
                                        onClick={() => {
                                            markPaidForm.setData('cutoff_id', activeCutoff.id);
                                            setShowMarkPaidModal(true);
                                        }}
                                        disabled={!hasSelectedCutoff || activeCutoff.status === 'paid' || activeCutoff.payroll_count === 0}
                                    >
                                        Mark Paid
                                    </ActionButton>
                                    <ActionButton
                                        href={`/payroll/export?${new URLSearchParams(buildQuery({ cutoff_id: activeCutoff.id, page: 1, search: '' })).toString()}`}
                                        external
                                        variant="neutral"
                                        disabled={!hasSelectedCutoff}
                                    >
                                        Export CSV
                                    </ActionButton>
                                </div>
                            </div>

                            <div style={cardStyle}>
                                <DataTable
                                    columns={columns}
                                    rows={payrollRows}
                                    rowKey="id"
                                    searchPlaceholder="Search payroll rows..."
                                    emptyMessage="No payroll rows generated for this cutoff."
                                    topLeftExtra={tableTopControls}
                                    perPageLabelStyle={{ alignSelf: 'center' }}
                                    serverSide
                                    serverSearchValue={table.search}
                                    serverPage={table.page}
                                    serverPerPage={table.perPage}
                                    serverTotalItems={table.total}
                                    serverTotalPages={table.lastPage}
                                    serverFrom={table.from}
                                    serverTo={table.to}
                                    onServerSearchChange={(value) => navigateTable({ search: value, page: 1 })}
                                    onServerPerPageChange={(value) => navigateTable({ per_page: value, page: 1 })}
                                    onServerPageChange={(value) => navigateTable({ page: value })}
                                />
                            </div>

                            <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                    <div style={{ fontWeight: 700 }}>Payroll History</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Recent tagged cutoffs across all projects</div>
                                </div>
                                {projectHistoryRows.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No payroll history yet.</div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Cutoff</th>
                                                    {!isStaff ? (
                                                        <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Project</th>
                                                    ) : null}
                                                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Status</th>
                                                    <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Rows</th>
                                                    <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Hours</th>
                                                    <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Gross</th>
                                                    <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Deductions</th>
                                                    <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Net</th>
                                                    <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {projectHistoryRows.map((row) => (
                                                    <tr key={`${row.cutoff_id}-${row.project_id || 'project'}`}>
                                                        <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)' }}>
                                                            {(row.cutoff_start && row.cutoff_end) ? `${row.cutoff_start} to ${row.cutoff_end}` : `Cutoff #${row.cutoff_id}`}
                                                        </td>
                                                        {!isStaff ? (
                                                            <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)' }}>
                                                                <div style={{ fontWeight: 700 }}>{row.project_name || '-'}</div>
                                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.project_client || '-'}</div>
                                                            </td>
                                                        ) : null}
                                                        <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)' }}>
                                                            <span style={statusPill(row.status)}>{row.status}</span>
                                                        </td>
                                                        <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{row.payroll_count}</td>
                                                        <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{num(row.total_hours)}</td>
                                                        <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{money(row.total_gross)}</td>
                                                        <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#f87171' }}>{money(row.total_deductions)}</td>
                                                        <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#4ade80' }}>{money(row.total_net)}</td>
                                                        <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                                <ActionButton
                                                                    type="button"
                                                                    variant="neutral"
                                                                    onClick={() => setHistoryDetailRow(row)}
                                                                >
                                                                    View Transactions
                                                                </ActionButton>
                                                                <ActionButton
                                                                    type="button"
                                                                    variant="danger"
                                                                    onClick={() => setHistoryToDelete(row)}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </ActionButton>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <InlinePagination
                                    pager={historyPager}
                                    onNavigate={(url) => router.visit(url, { preserveScroll: true, preserveState: true })}
                                />
                            </div>
                        </>
                    ) : (
                        <div style={{ ...cardStyle, color: 'var(--text-muted)' }}>
                            No active project found for payroll. Please create or activate a project first.
                        </div>
                    )}
                </div>

                <Modal
                    open={showEditModal && !!selectedPayroll}
                    onClose={() => setShowEditModal(false)}
                    title={selectedPayroll ? `Edit Payroll - ${selectedPayroll.worker_name}` : 'Edit Payroll'}
                    maxWidth={900}
                >
                    {selectedPayroll && (
                        <div style={{ display: 'grid', gap: 14 }}>
                        <div style={{ ...cardStyle, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tagged Project</div>
                                <div style={{ fontWeight: 700 }}>{selectedPayroll.project_name || '-'}</div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedPayroll.project_client || '-'}</div>
                        </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                {(() => {
                                    const incentiveItems = (selectedPayroll?.deduction_items || []).filter((item) => item.type === 'incentive');
                                    const incentiveTotal = incentiveItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                                    return (
                                        <>
                                            <div style={cardStyle}>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gross Pay</div>
                                                <div style={{ fontWeight: 700 }}>{money(selectedPayroll.gross)}</div>
                                            </div>
                                            <div style={cardStyle}>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Incentives</div>
                                                <div style={{ fontWeight: 700, color: '#38bdf8' }}>{money(incentiveTotal)}</div>
                                            </div>
                                            <div style={cardStyle}>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Deductions</div>
                                                <div style={{ fontWeight: 700, color: '#f87171' }}>{money(selectedPayroll.deductions)}</div>
                                            </div>
                                            <div style={cardStyle}>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Salary Balance / Net Pay</div>
                                                <div style={{ fontWeight: 700, color: '#4ade80' }}>{money(selectedPayroll.net)}</div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            <form onSubmit={submitHours} style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                                <div style={{ fontWeight: 700 }}>Update Hours</div>
                                <div className="grid grid-cols-1 md:[grid-template-columns:160px_minmax(0,1fr)_auto] gap-3 md:items-end">
                                    <label>
                                        <div style={{ fontSize: 12, marginBottom: 6 }}>Hours Worked</div>
                                        <TextInput
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={hoursForm.data.hours}
                                            onChange={(e) => hoursForm.setData('hours', e.target.value)}
                                            style={inputStyle}
                                        />
                                    </label>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        Adjusting hours will recompute gross and net pay.
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <ActionButton type="submit" variant="success" disabled={hoursForm.processing || !selectedPayroll.can_edit_deductions}>
                                            Save Hours
                                        </ActionButton>
                                    </div>
                                </div>
                                {(hoursForm.errors.hours || hoursForm.errors.payroll) && (
                                    <div style={{ color: '#f87171', fontSize: 12 }}>{hoursForm.errors.hours || hoursForm.errors.payroll}</div>
                                )}
                            </form>

                            <div style={{ display: 'grid', gap: 12 }}>
                                    <form onSubmit={submitIncentive} style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                                        <div style={{ fontWeight: 700 }}>Add Incentive</div>
                                        <div className="grid grid-cols-1 md:[grid-template-columns:160px_minmax(0,1fr)_auto] gap-3 md:items-end">
                                            <label>
                                                <div style={{ fontSize: 12, marginBottom: 6 }}>Amount</div>
                                                <TextInput
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={incentiveForm.data.amount}
                                                    onChange={(e) => incentiveForm.setData('amount', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </label>

                                            <label>
                                                <div style={{ fontSize: 12, marginBottom: 6 }}>Note (optional)</div>
                                                <TextInput
                                                    value={incentiveForm.data.note}
                                                    onChange={(e) => incentiveForm.setData('note', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </label>

                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <ActionButton type="submit" variant="success" disabled={incentiveForm.processing || !selectedPayroll.can_edit_deductions}>
                                                    Add Incentive
                                                </ActionButton>
                                            </div>
                                        </div>
                                        {(incentiveForm.errors.type || incentiveForm.errors.amount || incentiveForm.errors.note || incentiveForm.errors.payroll) && (
                                            <div style={{ color: '#f87171', fontSize: 12 }}>
                                                {incentiveForm.errors.type || incentiveForm.errors.amount || incentiveForm.errors.note || incentiveForm.errors.payroll}
                                            </div>
                                        )}
                                    </form>

                                    <div style={cardStyle}>
                                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Incentives</div>
                                        {(() => {
                                            const incentiveItems = (selectedPayroll.deduction_items || []).filter((item) => item.type === 'incentive');
                                            if (!incentiveItems.length) {
                                                return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No incentives yet.</div>;
                                            }

                                            return (
                                                <div style={{ display: 'grid', gap: 8 }}>
                                                    {incentiveItems.map((item) => (
                                                        <div
                                                            key={item.id}
                                                            className="grid grid-cols-1 gap-2 sm:[grid-template-columns:140px_120px_minmax(0,1fr)_auto] sm:gap-2.5 sm:items-center"
                                                            style={{
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: 10,
                                                                padding: 10,
                                                            }}
                                                        >
                                                            <div style={{ fontSize: 12, textTransform: 'capitalize' }}>Incentive</div>
                                                            <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: '#38bdf8' }}>{money(item.amount)}</div>
                                                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.note || '-'}</div>
                                                            <ActionButton
                                                                type="button"
                                                                variant="danger"
                                                                disabled={!selectedPayroll.can_edit_deductions || deletingDeduction}
                                                                loading={deletingDeduction && deductionToDelete?.id === item.id}
                                                                onClick={() => setDeductionToDelete(item)}
                                                            >
                                                                {deletingDeduction && deductionToDelete?.id === item.id ? 'Deleting...' : 'Delete'}
                                                            </ActionButton>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <form onSubmit={submitDeduction} style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                                        <div style={{ fontWeight: 700 }}>Add Deduction</div>
                                        <div className="grid grid-cols-1 md:[grid-template-columns:160px_160px_minmax(0,1fr)_auto] gap-3 md:items-end">
                                            <label>
                                                <div style={{ fontSize: 12, marginBottom: 6 }}>Type</div>
                                                <SelectInput value={deductionForm.data.type} onChange={(e) => deductionForm.setData('type', e.target.value)} style={inputStyle}>
                                                    <option value="cash_advance">Cash Advance</option>
                                                    <option value="loan">Loan</option>
                                                    <option value="other">Other</option>
                                                </SelectInput>
                                            </label>

                                            <label>
                                                <div style={{ fontSize: 12, marginBottom: 6 }}>Amount</div>
                                                <TextInput
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={deductionForm.data.amount}
                                                    onChange={(e) => deductionForm.setData('amount', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </label>

                                            <label>
                                                <div style={{ fontSize: 12, marginBottom: 6 }}>Note (optional)</div>
                                                <TextInput value={deductionForm.data.note} onChange={(e) => deductionForm.setData('note', e.target.value)} style={inputStyle} />
                                            </label>

                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <ActionButton type="submit" variant="success" disabled={deductionForm.processing || !selectedPayroll.can_edit_deductions}>
                                                    Add Deduction
                                                </ActionButton>
                                            </div>
                                        </div>
                                        {(deductionForm.errors.type || deductionForm.errors.amount || deductionForm.errors.note || deductionForm.errors.payroll) && (
                                            <div style={{ color: '#f87171', fontSize: 12 }}>
                                                {deductionForm.errors.type || deductionForm.errors.amount || deductionForm.errors.note || deductionForm.errors.payroll}
                                            </div>
                                        )}
                                    </form>

                                    <div style={cardStyle}>
                                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Deductions</div>
                                        {(() => {
                                            const deductionItems = (selectedPayroll.deduction_items || []).filter((item) => item.type !== 'incentive');
                                            if (!deductionItems.length) {
                                                return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No deductions yet.</div>;
                                            }

                                            return (
                                                <div style={{ display: 'grid', gap: 8 }}>
                                                    {deductionItems.map((item) => (
                                                        <div
                                                            key={item.id}
                                                            className="grid grid-cols-1 gap-2 sm:[grid-template-columns:140px_120px_minmax(0,1fr)_auto] sm:gap-2.5 sm:items-center"
                                                            style={{
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: 10,
                                                                padding: 10,
                                                            }}
                                                        >
                                                            <div style={{ fontSize: 12, textTransform: 'capitalize' }}>{String(item.type).replace('_', ' ')}</div>
                                                            <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: '#f87171' }}>{money(item.amount)}</div>
                                                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.note || '-'}</div>
                                                            <ActionButton
                                                                type="button"
                                                                variant="danger"
                                                                disabled={!selectedPayroll.can_edit_deductions || deletingDeduction}
                                                                loading={deletingDeduction && deductionToDelete?.id === item.id}
                                                                onClick={() => setDeductionToDelete(item)}
                                                            >
                                                                {deletingDeduction && deductionToDelete?.id === item.id ? 'Deleting...' : 'Delete'}
                                                            </ActionButton>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                            </div>
                        </div>
                    )}
                </Modal>

                <Modal
                    open={showMarkPaidModal && !!activeCutoff?.id}
                    onClose={() => setShowMarkPaidModal(false)}
                    title="Finalize Payroll Cutoff"
                    maxWidth={680}
                >
                    {activeCutoff?.id && (
                        <form onSubmit={submitMarkPaid} style={{ display: 'grid', gap: 14 }}>
                            <div style={{ ...cardStyle, display: 'grid', gap: 4 }}>
                                <div style={{ fontWeight: 700 }}>
                                    Cutoff: {activeCutoff.start_date} to {activeCutoff.end_date}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {isStaff ? 'Payroll Scope: Office Payroll' : `Project: ${selectedProject?.name || '-'}`}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {isStaff
                                        ? 'Marking this cutoff as paid will lock deductions and store release tracking for staff payroll.'
                                        : 'Marking this cutoff as paid will lock deductions and store release tracking on tagged rows for this project.'}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Payment Reference (optional)</div>
                                    <TextInput
                                        value={markPaidForm.data.payment_reference}
                                        onChange={(e) => markPaidForm.setData('payment_reference', e.target.value)}
                                        style={inputStyle}
                                    />
                                </label>

                                <label>
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>Bank Export Ref (optional)</div>
                                    <TextInput
                                        value={markPaidForm.data.bank_export_ref}
                                        onChange={(e) => markPaidForm.setData('bank_export_ref', e.target.value)}
                                        style={inputStyle}
                                    />
                                </label>
                            </div>

                            {(markPaidForm.errors.cutoff_id || markPaidForm.errors.payroll) && (
                                <div style={{ color: '#f87171', fontSize: 12 }}>
                                    {markPaidForm.errors.cutoff_id || markPaidForm.errors.payroll}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <ActionButton type="button" variant="neutral" onClick={() => setShowMarkPaidModal(false)}>
                                    Cancel
                                </ActionButton>
                                <ActionButton type="submit" variant="success" disabled={markPaidForm.processing}>
                                    {markPaidForm.processing ? 'Saving...' : 'Confirm Mark Paid'}
                                </ActionButton>
                            </div>
                        </form>
                    )}
                </Modal>

                <Modal
                    open={!!historyDetailRow}
                    onClose={() => setHistoryDetailRow(null)}
                    title="Payroll History Transactions"
                    maxWidth={1100}
                >
                    {historyDetailRow && (
                        <div style={{ display: 'grid', gap: 14 }}>
                            <div style={{ ...cardStyle, display: 'grid', gap: 4 }}>
                                <div style={{ fontWeight: 700 }}>
                                    {(historyDetailRow.cutoff_start && historyDetailRow.cutoff_end)
                                        ? `${historyDetailRow.cutoff_start} to ${historyDetailRow.cutoff_end}`
                                        : `Cutoff #${historyDetailRow.cutoff_id}`}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Project: {historyDetailRow.project_name || '-'}{historyDetailRow.project_client ? ` - ${historyDetailRow.project_client}` : ''}
                                </div>
                                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                                    <span>Rows: {historyDetailRow.payroll_count || 0}</span>
                                    <span>Hours: {num(historyDetailRow.total_hours)}</span>
                                    <span>Gross: {money(historyDetailRow.total_gross)}</span>
                                    <span>Deductions: {money(historyDetailRow.total_deductions)}</span>
                                    <span>Net: {money(historyDetailRow.total_net)}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                                <ActionButton
                                    type="button"
                                    variant="neutral"
                                    onClick={() => printHistoryReceipt(historyDetailRow, historyDetailTransactions)}
                                >
                                    Print Receipt
                                </ActionButton>
                                <ActionButton
                                    href={buildHistoryExportUrl(historyDetailRow)}
                                    external
                                    variant="success"
                                    disabled={!historyDetailRow?.cutoff_id}
                                >
                                    Export CSV
                                </ActionButton>
                            </div>

                            {historyDetailTransactions.length === 0 ? (
                                <div style={{ ...cardStyle, fontSize: 13, color: 'var(--text-muted)' }}>
                                    No transactions found for this cutoff and project.
                                </div>
                            ) : (
                                <div style={{ ...cardStyle, overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border-color)' }}>{personLabel}</th>
                                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Role</th>
                                                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Hours</th>
                                                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Rate</th>
                                                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Gross</th>
                                                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Incentives</th>
                                                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Deductions</th>
                                                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Net</th>
                                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Status</th>
                                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border-color)' }}>Transaction Info</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyDetailTransactions.map((txn) => (
                                                <tr key={txn.id}>
                                                    <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
                                                        {txn.worker_name || '-'}
                                                    </td>
                                                    <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)' }}>{txn.role || '-'}</td>
                                                    <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                        {num(txn.hours)}
                                                    </td>
                                                    <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                        {money(txn.rate_per_hour)}
                                                    </td>
                                                    <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                                                        {money(txn.gross)}
                                                    </td>
                                                    <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#38bdf8' }}>
                                                        {money(txn.incentives)}
                                                    </td>
                                                    <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#f87171' }}>
                                                        {money(txn.deductions)}
                                                    </td>
                                                    <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#4ade80', fontWeight: 700 }}>
                                                        {money(txn.net)}
                                                    </td>
                                                    <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)' }}>
                                                        <span style={statusPill(txn.status)}>{txn.status || '-'}</span>
                                                    </td>
                                                    <td style={{ padding: 8, borderBottom: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)' }}>
                                                        <div>Released: {txn.released_at || '-'}</div>
                                                        <div>By: {txn.released_by_name || '-'}</div>
                                                        <div>Payment Ref: {txn.payment_reference || '-'}</div>
                                                        <div>Bank Export Ref: {txn.bank_export_ref || '-'}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <ActionButton type="button" variant="neutral" onClick={() => setHistoryDetailRow(null)}>
                                    Close
                                </ActionButton>
                            </div>
                        </div>
                    )}
                </Modal>
                <ConfirmationModal
                    open={!!deductionToDelete}
                    onClose={() => (deletingDeduction ? null : setDeductionToDelete(null))}
                    onConfirm={() => (deductionToDelete ? deleteDeduction(deductionToDelete.id) : null)}
                    title="Delete Deduction"
                    message={
                        deductionToDelete
                            ? `Delete this ${String(deductionToDelete.type || 'deduction').replace('_', ' ')} deduction (${money(deductionToDelete.amount)})?`
                            : 'Delete this deduction?'
                    }
                    confirmLabel={deletingDeduction ? 'Deleting...' : 'Delete'}
                    processing={deletingDeduction}
                    danger
                />
                <ConfirmationModal
                    open={!!historyToDelete}
                    onClose={() => setHistoryToDelete(null)}
                    onConfirm={submitHistoryDelete}
                    title="Delete Payroll History"
                    message={
                        historyToDelete
                            ? `Delete payroll history for cutoff ${historyToDelete.cutoff_start || historyToDelete.cutoff_id} ${historyToDelete.project_name ? `(${historyToDelete.project_name})` : ''}?`
                            : 'Delete payroll history?'
                    }
                    confirmLabel="Delete"
                    danger
                />
            </Layout>
        </>
    );
}
