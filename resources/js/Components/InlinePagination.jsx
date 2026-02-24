import { router } from '@inertiajs/react';

const pagerBtn = (enabled) => ({
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
    cursor: enabled ? 'pointer' : 'not-allowed',
    background: 'var(--button-bg)',
    color: 'var(--text-main)',
    opacity: enabled ? 1 : 0.55,
});

export default function InlinePagination({
    pager,
    onNavigate,
    preserveScroll = true,
    preserveState = true,
    pageLabelSuffix = '',
}) {
    const totalItems = Number(pager?.total || 0);
    const totalPages = Math.max(1, Number(pager?.last_page || 1));
    const currentPage = Math.max(1, Number(pager?.current_page || 1));
    const from = totalItems === 0 ? 0 : Number(pager?.from || 0);
    const to = totalItems === 0 ? 0 : Number(pager?.to || 0);

    const goTo = (url) => {
        if (!url) return;

        if (typeof onNavigate === 'function') {
            onNavigate(url);
            return;
        }

        router.visit(url, {
            preserveScroll,
            preserveState,
        });
    };

    if (totalItems === 0 || totalPages <= 1) return null;

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Showing {from}-{to} of {totalItems}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                    type="button"
                    onClick={() => goTo(pager.prev_page_url)}
                    disabled={!pager?.prev_page_url}
                    style={pagerBtn(Boolean(pager?.prev_page_url))}
                >
                    Prev
                </button>
                <div style={{ minWidth: 62, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                    {currentPage} / {totalPages}
                    {pageLabelSuffix ? ` ${pageLabelSuffix}` : ''}
                </div>
                <button
                    type="button"
                    onClick={() => goTo(pager.next_page_url)}
                    disabled={!pager?.next_page_url}
                    style={pagerBtn(Boolean(pager?.next_page_url))}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
