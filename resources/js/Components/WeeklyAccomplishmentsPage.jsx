import Layout from './Layout';
import ProjectAccordionTable from './ProjectAccordionTable';
import { Head } from '@inertiajs/react';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
};

export default function WeeklyAccomplishmentsPage({
    weeklyAccomplishments = [],
    weeklyAccomplishmentTable = {},
}) {
    const columns = [
        {
            key: 'created_at',
            label: 'Submitted',
            width: 170,
            render: (row) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.created_at || '-'}</span>,
        },
        {
            key: 'foreman_name',
            label: 'Foreman',
            width: 170,
            render: (row) => row.foreman_name || '-',
        },
        {
            key: 'project_name',
            label: 'Project',
            width: 180,
            render: (row) => row.project_name || '-',
        },
        {
            key: 'week_start',
            label: 'Week Start',
            width: 130,
            render: (row) => row.week_start || '-',
        },
        {
            key: 'scope_of_work',
            label: 'Scope of Work',
            render: (row) => <div style={{ fontWeight: 600, whiteSpace: 'normal' }}>{row.scope_of_work || '-'}</div>,
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
    ];

    return (
        <>
            <Head title="Weekly Accomplishments" />
            <Layout title="Weekly Accomplishments">
                <div style={cardStyle}>
                    <ProjectAccordionTable
                        columns={columns}
                        rows={weeklyAccomplishments}
                        rowKey="id"
                        searchPlaceholder="Search weekly accomplishments..."
                        emptyMessage="No weekly accomplishments yet."
                        routePath="/weekly-accomplishments"
                        table={weeklyAccomplishmentTable}
                    />
                </div>
            </Layout>
        </>
    );
}

