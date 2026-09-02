import { useLayoutTitle } from '../../Components/Layout';
import DataTable from '../../Components/DataTable';
import ActionButton from '../../Components/ActionButton';
import DatePickerInput from '../../Components/DatePickerInput';
import SelectInput from '../../Components/SelectInput';
import { Head, router } from '@inertiajs/react';
import { useMemo } from 'react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

const filterControlStyle = {
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    minWidth: 150,
};

export default function ProjectManagerAttendance({ attendances = [], projects = [], foremen = [], attendanceTable = {} }) {
    const table = useMemo(
        () => ({
            search: attendanceTable?.search ?? '',
            date: attendanceTable?.date ?? '',
            projectId: attendanceTable?.project_id ?? '',
            foremanId: attendanceTable?.foreman_id ?? '',
            perPage: Number(attendanceTable?.per_page ?? 50),
            page: Number(attendanceTable?.current_page ?? 1),
            lastPage: Number(attendanceTable?.last_page ?? 1),
            total: Number(attendanceTable?.total ?? attendances.length ?? 0),
            from: attendanceTable?.from ?? null,
            to: attendanceTable?.to ?? null,
        }),
        [attendanceTable, attendances.length]
    );

    const navigateTable = (overrides = {}) => {
        const params = {
            search: overrides.search !== undefined ? overrides.search : table.search,
            date: overrides.date !== undefined ? overrides.date : table.date,
            project_id: overrides.project_id !== undefined ? overrides.project_id : table.projectId,
            foreman_id: overrides.foreman_id !== undefined ? overrides.foreman_id : table.foremanId,
            per_page: overrides.per_page !== undefined ? overrides.per_page : table.perPage,
            page: overrides.page !== undefined ? overrides.page : table.page,
        };

        Object.keys(params).forEach((key) => {
            if (params[key] === '' || params[key] === null || params[key] === undefined) delete params[key];
        });

        router.get('/project-manager/attendance', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const columns = [
        {
            key: 'date',
            label: 'Date',
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace" }}>{row.date || '-'}</span>,
            searchAccessor: (row) => row.date,
        },
        {
            key: 'project',
            label: 'Project',
            render: (row) => row.project_name || '-',
            searchAccessor: (row) => row.project_name,
        },
        {
            key: 'foreman',
            label: 'Foreman',
            render: (row) => row.foreman_name || '-',
            searchAccessor: (row) => row.foreman_name,
        },
        {
            key: 'worker_name',
            label: 'Worker',
            render: (row) => <div style={{ fontWeight: 600 }}>{row.worker_name}</div>,
            searchAccessor: (row) => row.worker_name,
        },
        {
            key: 'worker_role',
            label: 'Role',
            render: (row) => row.worker_role || '-',
            searchAccessor: (row) => row.worker_role,
        },
        {
            key: 'hours',
            label: 'Hours',
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace" }}>{Number(row.hours || 0).toFixed(1)}</span>,
            searchAccessor: (row) => row.hours,
        },
        {
            key: 'code',
            label: 'Code',
            render: (row) => row.attendance_code || '-',
            searchAccessor: (row) => row.attendance_code,
        },
    ];

    useLayoutTitle('Attendance (View Only)');

    return (
        <>
            <Head title="Attendance - View Only" />

            <div style={cardStyle}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Foreman attendance — view only, editing is disabled for this role.
                </div>

                <div className="flex flex-wrap items-end gap-3" style={{ marginBottom: 12 }}>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Project</div>
                        <SelectInput
                            value={table.projectId}
                            onChange={(e) => navigateTable({ project_id: e.target.value, page: 1 })}
                            style={filterControlStyle}
                        >
                            <option value="">All Projects</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                        </SelectInput>
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Foreman</div>
                        <SelectInput
                            value={table.foremanId}
                            onChange={(e) => navigateTable({ foreman_id: e.target.value, page: 1 })}
                            style={filterControlStyle}
                        >
                            <option value="">All Foremen</option>
                            {foremen.map((foreman) => (
                                <option key={foreman.id} value={foreman.id}>{foreman.fullname}</option>
                            ))}
                        </SelectInput>
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Date</div>
                        <DatePickerInput
                            value={table.date}
                            onChange={(value) => navigateTable({ date: value || '', page: 1 })}
                            style={filterControlStyle}
                        />
                    </label>

                    <ActionButton
                        type="button"
                        variant="neutral"
                        className="bb-clear-filter-btn"
                        onClick={() => navigateTable({ search: '', project_id: '', foreman_id: '', date: '', page: 1 })}
                        style={{ padding: '8px 12px', fontSize: 13 }}
                    >
                        Clear Filter
                    </ActionButton>
                </div>

                <DataTable
                    columns={columns}
                    rows={attendances}
                    rowKey="id"
                    searchPlaceholder="Search workers..."
                    emptyMessage="No attendance records found."
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
        </>
    );
}
