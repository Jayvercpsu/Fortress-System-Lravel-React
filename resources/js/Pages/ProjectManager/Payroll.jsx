import { useLayoutTitle } from '../../Components/Layout';
import DataTable from '../../Components/DataTable';
import DateRangePicker from '../../Components/DateRangePicker';
import ActionButton from '../../Components/ActionButton';
import { Head, router } from '@inertiajs/react';
import { useMemo } from 'react';

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mono = { fontFamily: "'DM Mono', monospace" };

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatCutoff = (cutoff) => {
    if (!cutoff?.start_date || !cutoff?.end_date) return '-';
    const start = new Date(cutoff.start_date);
    const end = new Date(cutoff.end_date);
    const startMonth = monthNames[start.getMonth()];
    const endMonth = monthNames[end.getMonth()];
    if (startMonth === endMonth) {
        return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
};

const statusColor = {
    pending: '#8b949e',
    ready: '#fbbf24',
    approved: '#4ade80',
    paid: '#60a5fa',
};

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

// Matches DataTable's search control so the cutoff range picker aligns inline
const filterControlStyle = {
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    minWidth: 210,
};

export default function ProjectManagerPayroll({ payrolls = [], totalPayable = 0, payrollGroup = 'workers', payrollTable = {} }) {
    const table = useMemo(
        () => ({
            search: payrollTable?.search ?? '',
            cutoffStart: payrollTable?.cutoff_start ?? '',
            cutoffEnd: payrollTable?.cutoff_end ?? '',
            perPage: Number(payrollTable?.per_page ?? 50),
            page: Number(payrollTable?.current_page ?? 1),
            lastPage: Number(payrollTable?.last_page ?? 1),
            total: Number(payrollTable?.total ?? payrolls.length ?? 0),
            from: payrollTable?.from ?? null,
            to: payrollTable?.to ?? null,
        }),
        [payrollTable, payrolls.length]
    );

    const navigateTable = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            cutoff_start: overrides.cutoff_start !== undefined ? overrides.cutoff_start : table.cutoffStart,
            cutoff_end: overrides.cutoff_end !== undefined ? overrides.cutoff_end : table.cutoffEnd,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };

        Object.keys(params).forEach((key) => {
            if (params[key] === '' || params[key] === null || params[key] === undefined) delete params[key];
        });

        router.get('/project-manager/payroll', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const hasActiveFilters = table.search || table.cutoffStart || table.cutoffEnd;
    const columns = [
        {
            key: 'worker_name',
            label: 'Name',
            render: (row) => <div style={{ fontWeight: 600 }}>{row.worker_name}</div>,
            searchAccessor: (row) => row.worker_name,
        },
        {
            key: 'role',
            label: 'Role',
            render: (row) => row.role || '-',
            searchAccessor: (row) => row.role,
        },
        {
            key: 'cutoff',
            label: 'Cutoff',
            render: (row) => <span style={{ ...mono, fontSize: 12, color: 'var(--text-muted-2)' }}>{formatCutoff(row.cutoff)}</span>,
            searchAccessor: (row) => row.cutoff ? `${row.cutoff.start_date} ${row.cutoff.end_date}` : '',
        },
        {
            key: 'hours',
            label: 'Hours',
            render: (row) => <span style={{ ...mono }}>{Number(row.hours || 0).toFixed(1)}</span>,
            searchAccessor: (row) => row.hours,
        },
        {
            key: 'net',
            label: 'Net Pay',
            render: (row) => <span style={{ ...mono }}>{money(row.net)}</span>,
            searchAccessor: (row) => row.net,
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => (
                <span
                    style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: `${statusColor[row.status] || 'var(--text-muted)'}22`,
                        color: statusColor[row.status] || 'var(--text-muted)',
                        border: `1px solid ${(statusColor[row.status] || 'var(--text-muted)')}44`,
                        fontWeight: 700,
                    }}
                >
                    {String(row.status || '—').toUpperCase()}
                </span>
            ),
            searchAccessor: (row) => row.status,
        },
    ];

    useLayoutTitle('Payroll (View Only)');

    return (
        <>
            <Head title="Payroll - View Only" />

            <div style={cardStyle}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        marginBottom: 12,
                        fontSize: 13,
                        color: 'var(--text-muted)',
                    }}
                >
                    <span>Payroll attendance — view only for counter-checking.</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: 'var(--text-main)' }}>
                        {hasActiveFilters ? 'Filtered Total Payable' : 'Total Payable'}: {money(totalPayable)}
                    </span>
                </div>

                <DataTable
                    columns={columns}
                    rows={payrolls}
                    rowKey="id"
                    searchPlaceholder="Search payroll..."
                    emptyMessage="No payroll records found."
                    serverSide
                    serverSearchValue={table.search}
                    serverPage={table.page}
                    serverPerPage={table.perPage}
                    serverTotalItems={table.total}
                    serverTotalPages={table.lastPage}
                    serverFrom={table.from}
                    serverTo={table.to}
                    topLeftExtra={
<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                     <DateRangePicker
                         startDate={table.cutoffStart}
                         endDate={table.cutoffEnd}
                         onChange={({ startDate: s, endDate: e }) => {
                             // Navigate only when both dates are set or both are cleared
                             if ((s && e) || (!s && !e)) {
                                 navigateTable({ cutoff_start: s || '', cutoff_end: e || '', page: 1 });
                             }
                         }}
                         placeholder="Select cutoff range…"
                         style={filterControlStyle}
                     />
                     <ActionButton
                         type="button"
                         variant="neutral"
                         className="bb-clear-filter-btn"
                         onClick={() => navigateTable({ search: '', cutoff_start: '', cutoff_end: '', page: 1 })}
                         style={{ padding: '8px 12px', fontSize: 13 }}
                     >
                         Clear filter
                     </ActionButton>
                 </div>
                    }
                    onServerSearchChange={(value) => navigateTable({ search: value, page: 1 })}
                    onServerPerPageChange={(value) => navigateTable({ per_page: value, page: 1 })}
                    onServerPageChange={(value) => navigateTable({ page: value })}
                />
            </div>
        </>
    );
}
