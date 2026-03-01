import { router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const controlStyle = {
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
};

const groupCardStyle = {
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    background: 'var(--surface-2)',
    overflow: 'hidden',
};

function resolveRowKey(rowKey, row, index) {
    if (typeof rowKey === 'function') return rowKey(row, index);
    return row?.[rowKey] ?? index;
}

export default function ProjectAccordionTable({
    columns = [],
    rows = [],
    rowKey = 'id',
    searchPlaceholder = 'Search...',
    emptyMessage = 'No records found.',
    routePath,
    table = {},
    groupPageSize = 5,
    expandAllGroups = false,
}) {
    const [searchDraft, setSearchDraft] = useState(String(table?.search ?? ''));
    const [expandedByGroup, setExpandedByGroup] = useState({});
    const [groupPageByKey, setGroupPageByKey] = useState({});

    const tableState = {
        search: String(table?.search ?? ''),
        perPage: Number(table?.per_page ?? 10),
        page: Number(table?.current_page ?? 1),
        lastPage: Number(table?.last_page ?? 1),
        total: Number(table?.total ?? rows.length ?? 0),
        from: table?.from ?? null,
        to: table?.to ?? null,
    };

    useEffect(() => {
        setSearchDraft(String(tableState.search ?? ''));
    }, [tableState.search]);

    const grouped = useMemo(() => {
        const groups = new Map();

        rows.forEach((row) => {
            const projectName = String(row?.project_name || 'Unassigned').trim() || 'Unassigned';
            const projectId = row?.project_id ?? null;
            const key = projectId !== null && projectId !== undefined
                ? `project-${projectId}`
                : `project-name-${projectName.toLowerCase()}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    project_id: projectId,
                    project_name: projectName,
                    rows: [],
                });
            }

            groups.get(key).rows.push(row);
        });

        return Array.from(groups.values());
    }, [rows]);

    useEffect(() => {
        setExpandedByGroup((prev) => {
            const next = {};
            grouped.forEach((group) => {
                if (expandAllGroups) {
                    next[group.key] = true;
                    return;
                }

                if (prev[group.key]) next[group.key] = true;
            });
            if (!expandAllGroups && grouped.length > 0 && Object.keys(next).length === 0) {
                next[grouped[0].key] = true;
            }
            return next;
        });

        setGroupPageByKey((prev) => {
            const next = {};
            grouped.forEach((group) => {
                const last = Math.max(1, Math.ceil(group.rows.length / Math.max(1, groupPageSize)));
                const current = Number(prev[group.key] ?? 1);
                next[group.key] = Math.min(Math.max(1, current), last);
            });
            return next;
        });
    }, [grouped, groupPageSize, expandAllGroups]);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            if (String(tableState.search ?? '') === String(searchDraft ?? '')) {
                return;
            }

            router.get(routePath, {
                search: searchDraft,
                per_page: tableState.perPage,
                page: 1,
            }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(handle);
    }, [routePath, searchDraft, tableState.search, tableState.perPage]);

    const applyTablePage = (page) => {
        router.get(routePath, {
            search: tableState.search,
            per_page: tableState.perPage,
            page,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const applyPerPage = (perPage) => {
        router.get(routePath, {
            search: tableState.search,
            per_page: perPage,
            page: 1,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const toggleGroup = (key) => {
        setExpandedByGroup((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const totalPages = Math.max(1, tableState.lastPage || 1);

    return (
        <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                    <input
                        type="text"
                        value={searchDraft}
                        onChange={(e) => setSearchDraft(e.target.value)}
                        placeholder={searchPlaceholder}
                        style={{ ...controlStyle, minWidth: 220, maxWidth: 420, flex: '0 1 420px', width: '100%' }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Per page</span>
                    <select
                        value={tableState.perPage}
                        onChange={(e) => applyPerPage(Number(e.target.value))}
                        style={controlStyle}
                    >
                        {[5, 10, 25, 50].map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {grouped.length === 0 ? (
                <div style={{ ...groupCardStyle, padding: 14, fontSize: 13, color: 'var(--text-muted)' }}>
                    {emptyMessage}
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                    {grouped.map((group) => {
                        const currentGroupPage = Number(groupPageByKey[group.key] ?? 1);
                        const groupLastPage = Math.max(1, Math.ceil(group.rows.length / Math.max(1, groupPageSize)));
                        const safeGroupPage = Math.min(Math.max(1, currentGroupPage), groupLastPage);
                        const startIndex = (safeGroupPage - 1) * groupPageSize;
                        const pagedRows = group.rows.slice(startIndex, startIndex + groupPageSize);
                        const isExpanded = !!expandedByGroup[group.key];

                        return (
                            <div key={group.key} style={groupCardStyle}>
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group.key)}
                                    style={{
                                        width: '100%',
                                        border: 'none',
                                        background: 'var(--surface-2)',
                                        color: 'var(--text-main)',
                                        padding: '10px 12px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
                                        <div style={{ fontWeight: 700 }}>
                                            {group.project_name}
                                            {group.project_id !== null && group.project_id !== undefined ? ` (ID: ${group.project_id})` : ''}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {group.rows.length} record{group.rows.length === 1 ? '' : 's'}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 16, lineHeight: 1 }}>{isExpanded ? '▾' : '▸'}</span>
                                </button>

                                {isExpanded ? (
                                    <div style={{ borderTop: '1px solid var(--border-color)', padding: 10, display: 'grid', gap: 10 }}>
                                        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--surface-1)' }}>
                                                        {columns.map((column) => (
                                                            <th
                                                                key={column.key}
                                                                style={{
                                                                    textAlign: column.align === 'right' ? 'right' : 'left',
                                                                    padding: '10px 12px',
                                                                    fontSize: 12,
                                                                    color: 'var(--text-muted)',
                                                                    borderBottom: '1px solid var(--border-color)',
                                                                    whiteSpace: 'nowrap',
                                                                    width: column.width,
                                                                    minWidth: column.width,
                                                                }}
                                                            >
                                                                {column.label}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pagedRows.map((row, index) => (
                                                        <tr key={resolveRowKey(rowKey, row, index)}>
                                                            {columns.map((column) => (
                                                                <td
                                                                    key={`${resolveRowKey(rowKey, row, index)}-${column.key}`}
                                                                    style={{
                                                                        padding: '10px 12px',
                                                                        borderBottom: '1px solid var(--border-color)',
                                                                        verticalAlign: 'top',
                                                                        textAlign: column.align === 'right' ? 'right' : 'left',
                                                                        width: column.width,
                                                                        minWidth: column.width,
                                                                    }}
                                                                >
                                                                    {column.render ? column.render(row) : row?.[column.key] ?? '-'}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {groupLastPage > 1 ? (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                    Showing {group.rows.length === 0 ? 0 : startIndex + 1}-
                                                    {Math.min(startIndex + groupPageSize, group.rows.length)} of {group.rows.length}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <button
                                                        type="button"
                                                        style={controlStyle}
                                                        onClick={() => setGroupPageByKey((prev) => ({ ...prev, [group.key]: Math.max(1, safeGroupPage - 1) }))}
                                                        disabled={safeGroupPage <= 1}
                                                    >
                                                        Prev
                                                    </button>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                        Page {safeGroupPage} of {groupLastPage}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        style={controlStyle}
                                                        onClick={() => setGroupPageByKey((prev) => ({ ...prev, [group.key]: Math.min(groupLastPage, safeGroupPage + 1) }))}
                                                        disabled={safeGroupPage >= groupLastPage}
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Showing {tableState.total === 0 ? 0 : tableState.from ?? 0}-
                    {tableState.total === 0 ? 0 : tableState.to ?? 0} of {tableState.total}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => applyTablePage(Math.max(1, tableState.page - 1))}
                        disabled={tableState.page <= 1}
                        style={{
                            ...controlStyle,
                            cursor: tableState.page <= 1 ? 'not-allowed' : 'pointer',
                            opacity: tableState.page <= 1 ? 0.6 : 1,
                        }}
                    >
                        Prev
                    </button>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Page {tableState.page} of {totalPages}
                    </div>
                    <button
                        type="button"
                        onClick={() => applyTablePage(Math.min(totalPages, tableState.page + 1))}
                        disabled={tableState.page >= totalPages}
                        style={{
                            ...controlStyle,
                            cursor: tableState.page >= totalPages ? 'not-allowed' : 'pointer',
                            opacity: tableState.page >= totalPages ? 0.6 : 1,
                        }}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
