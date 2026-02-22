import { useEffect, useMemo, useState } from 'react';

const controlStyle = {
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
};

export default function DataTable({
    columns = [],
    rows = [],
    rowKey = 'id',
    searchPlaceholder = 'Search...',
    pageSizeOptions = [5, 10, 25, 50],
    initialPageSize = 5,
    emptyMessage = 'No records found.',
    searchFn,
    serverSide = false,
    serverSearchValue = '',
    serverPage = 1,
    serverPerPage = 5,
    serverTotalItems = 0,
    serverTotalPages = 1,
    serverFrom = null,
    serverTo = null,
    onServerSearchChange,
    onServerPageChange,
    onServerPerPageChange,
    topLeftExtra = null,
    topRightExtra = null,
    getRowStyle,
}) {
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(initialPageSize);
    const [serverQueryDraft, setServerQueryDraft] = useState(serverSearchValue || '');

    useEffect(() => {
        if (!serverSide) return;
        setServerQueryDraft(serverSearchValue || '');
    }, [serverSide, serverSearchValue]);

    const normalizedQuery = query.trim().toLowerCase();

    const filteredRows = useMemo(() => {
        if (!normalizedQuery) return rows;

        if (typeof searchFn === 'function') {
            return rows.filter((row) => searchFn(row, normalizedQuery));
        }

        return rows.filter((row) =>
            columns.some((column) => {
                const raw =
                    typeof column.searchAccessor === 'function'
                        ? column.searchAccessor(row)
                        : row?.[column.key];
                return String(raw ?? '')
                    .toLowerCase()
                    .includes(normalizedQuery);
            })
        );
    }, [rows, normalizedQuery, columns, searchFn]);

    const totalPages = serverSide ? Math.max(1, serverTotalPages || 1) : Math.max(1, Math.ceil(filteredRows.length / perPage));

    useEffect(() => {
        if (serverSide) return;
        setPage(1);
    }, [normalizedQuery, perPage, rows.length, serverSide]);

    useEffect(() => {
        if (serverSide) return;
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages, serverSide]);

    useEffect(() => {
        if (!serverSide || typeof onServerSearchChange !== 'function') return;

        const handle = window.setTimeout(() => {
            if ((serverSearchValue || '') !== serverQueryDraft) {
                onServerSearchChange(serverQueryDraft);
            }
        }, 300);

        return () => window.clearTimeout(handle);
    }, [serverSide, serverQueryDraft, serverSearchValue, onServerSearchChange]);

    const pagedRows = useMemo(() => {
        if (serverSide) return rows;
        const start = (page - 1) * perPage;
        return filteredRows.slice(start, start + perPage);
    }, [filteredRows, page, perPage, rows, serverSide]);

    const resolveRowKey = (row, index) => {
        if (typeof rowKey === 'function') return rowKey(row, index);
        return row?.[rowKey] ?? index;
    };

    return (
        <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                    <input
                        type="text"
                        value={serverSide ? serverQueryDraft : query}
                        onChange={(e) => (serverSide ? setServerQueryDraft(e.target.value) : setQuery(e.target.value))}
                        placeholder={searchPlaceholder}
                        style={{ ...controlStyle, minWidth: 220, maxWidth: 420, flex: '0 1 420px', width: '100%' }}
                    />
                    {topLeftExtra}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {topRightExtra}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Per page</span>
                    <select
                        value={serverSide ? serverPerPage : perPage}
                        onChange={(e) =>
                            serverSide
                                ? onServerPerPageChange?.(Number(e.target.value))
                                : setPerPage(Number(e.target.value))
                        }
                        style={controlStyle}
                    >
                        {pageSizeOptions.map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                    <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
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
                        {pagedRows.length === 0 && (
                            <tr>
                                <td colSpan={Math.max(columns.length, 1)} style={{ padding: 14, fontSize: 13, color: 'var(--text-muted)' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        )}

                        {pagedRows.map((row, index) => (
                            <tr
                                key={resolveRowKey(row, index)}
                                style={typeof getRowStyle === 'function' ? getRowStyle(row, index) : undefined}
                            >
                                {columns.map((column) => (
                                    <td
                                        key={`${resolveRowKey(row, index)}-${column.key}`}
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {serverSide ? (
                        <>
                            Showing {serverTotalItems === 0 ? 0 : serverFrom ?? 0}-{serverTotalItems === 0 ? 0 : serverTo ?? 0} of {serverTotalItems}
                        </>
                    ) : (
                        <>
                            Showing {filteredRows.length === 0 ? 0 : (page - 1) * perPage + 1}-
                            {Math.min(page * perPage, filteredRows.length)} of {filteredRows.length}
                        </>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() =>
                            serverSide
                                ? onServerPageChange?.(Math.max(1, serverPage - 1))
                                : setPage((p) => Math.max(1, p - 1))
                        }
                        disabled={serverSide ? serverPage <= 1 : page <= 1}
                        style={{
                            ...controlStyle,
                            cursor: (serverSide ? serverPage <= 1 : page <= 1) ? 'not-allowed' : 'pointer',
                            opacity: (serverSide ? serverPage <= 1 : page <= 1) ? 0.6 : 1,
                        }}
                    >
                        Prev
                    </button>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Page {serverSide ? serverPage : page} of {totalPages}
                    </div>
                    <button
                        type="button"
                        onClick={() =>
                            serverSide
                                ? onServerPageChange?.(Math.min(totalPages, serverPage + 1))
                                : setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={serverSide ? serverPage >= totalPages : page >= totalPages}
                        style={{
                            ...controlStyle,
                            cursor: (serverSide ? serverPage >= totalPages : page >= totalPages) ? 'not-allowed' : 'pointer',
                            opacity: (serverSide ? serverPage >= totalPages : page >= totalPages) ? 0.6 : 1,
                        }}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
