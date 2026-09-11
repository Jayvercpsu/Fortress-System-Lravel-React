import { useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { MessageCircle, Send } from 'lucide-react';
import ActionButton from './ActionButton';
import TextareaInput from './TextareaInput';

const PAGE_SIZE = 10;
const HISTORY_SIZE = 5;

const avatarPalette = [
    { bg: '#dbeafe', color: '#1d4ed8' },
    { bg: '#dcfce7', color: '#15803d' },
    { bg: '#fef3c7', color: '#b45309' },
    { bg: '#fee2e2', color: '#b91c1c' },
    { bg: '#e0e7ff', color: '#3730a3' },
    { bg: '#fce7f3', color: '#be185d' },
];

const paletteFor = (id) => avatarPalette[Math.abs(Number(id ?? 0)) % avatarPalette.length];

const inputStyle = {
    background: 'var(--ac-bg, #fff)',
    border: '1px solid var(--ac-border, #e8edf3)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    color: 'var(--ac-text, #0f172a)',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    resize: 'vertical',
};

const postButtonStyle = {
    background: '#ffffff',
    border: '1px solid #0f172a',
    color: '#2563eb',
};

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

const jsonHeaders = () => ({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-CSRF-TOKEN': csrfToken(),
    'X-Requested-With': 'XMLHttpRequest',
});

export default function SubmissionComments({ submissionId }) {
    const { auth } = usePage().props;
    const currentUserId = auth?.user?.id;
    const currentUserRole = auth?.user?.role;
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [draft, setDraft] = useState('');
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState('');
    const [optionsFor, setOptionsFor] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editDraft, setEditDraft] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const listRef = useRef(null);

    const scrollListToBottom = () => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const list = listRef.current;
                if (list) list.scrollTop = list.scrollHeight;
            });
        });
    };

    const fetchPage = async (beforeId, limit, signal) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (beforeId) params.set('before_id', String(beforeId));
        const response = await fetch(
            `/weekly-accomplishments/submissions/${submissionId}/comments?${params.toString()}`,
            { headers: { Accept: 'application/json' }, credentials: 'same-origin', signal },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    };

    useEffect(() => {
        setComments([]);
        setError('');
        setDraft('');
        setOptionsFor(null);
        setEditingId(null);
        setHasMore(true);
        if (!submissionId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const controller = new AbortController();

        fetchPage(null, PAGE_SIZE, controller.signal)
            .then((data) => {
                setComments(data);
                setHasMore(data.length === PAGE_SIZE);
                // Start at the latest comments (bottom), like chat threads.
                scrollListToBottom();
            })
            .catch((err) => {
                if (err?.name !== 'AbortError') {
                    setError('Unable to load comments. Please try again.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submissionId]);

    const loadOlder = async () => {
        if (loadingMore || !hasMore || comments.length === 0) return;
        setLoadingMore(true);
        setError('');

        const list = listRef.current;
        const previousHeight = list ? list.scrollHeight : 0;
        const oldestId = comments[0]?.id;

        try {
            const older = await fetchPage(oldestId, HISTORY_SIZE);
            setComments((prev) => [...older, ...prev]);
            setHasMore(older.length === HISTORY_SIZE);
            requestAnimationFrame(() => {
                if (list) list.scrollTop = list.scrollHeight - previousHeight;
            });
        } catch (err) {
            setError('Unable to load older comments. Please try again.');
        } finally {
            setLoadingMore(false);
        }
    };

    const handleListScroll = () => {
        const list = listRef.current;
        if (!list || loading || loadingMore || !hasMore) return;
        if (list.scrollTop <= 60) {
            loadOlder();
        }
    };

    const postComment = async () => {
        const body = draft.trim();
        if (!body || posting) return;

        setPosting(true);
        setError('');

        try {
            const response = await fetch(`/weekly-accomplishments/submissions/${submissionId}/comments`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: jsonHeaders(),
                body: JSON.stringify({ body }),
            });

            if (response.status === 422) {
                setError('Comment cannot be empty (max 2000 characters).');
                return;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const created = await response.json();
            setComments((prev) => [...prev, created]);
            setDraft('');
            scrollListToBottom();
        } catch (err) {
            setError('Unable to post your comment. Please try again.');
        } finally {
            setPosting(false);
        }
    };

    const saveEdit = async (comment) => {
        const body = editDraft.trim();
        if (!body || savingEdit) return;

        setSavingEdit(true);
        setError('');

        try {
            const response = await fetch(
                `/weekly-accomplishments/submissions/${submissionId}/comments/${comment.id}`,
                {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: jsonHeaders(),
                    body: JSON.stringify({ body }),
                },
            );

            if (response.status === 422) {
                setError('Comment cannot be empty (max 2000 characters).');
                return;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const updated = await response.json();
            setComments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            toast.success('Comment updated successfully.');
            setEditingId(null);
            setEditDraft('');
            setOptionsFor(null);
        } catch (err) {
            setError('Unable to save your edit. Please try again.');
        } finally {
            setSavingEdit(false);
        }
    };

    const deleteComment = async (comment) => {
        if (deletingId) return;

        setDeletingId(comment.id);
        setError('');

        try {
            const response = await fetch(
                `/weekly-accomplishments/submissions/${submissionId}/comments/${comment.id}`,
                {
                    method: 'DELETE',
                    credentials: 'same-origin',
                    headers: jsonHeaders(),
                },
            );

            if (response.status === 403) {
                setError('You can only delete your own comments.');
                return;
            }
            if (!response.ok && response.status !== 204) throw new Error(`HTTP ${response.status}`);

            setComments((prev) => prev.filter((item) => item.id !== comment.id));
            toast.success('Comment deleted successfully.');
        } catch (err) {
            setError('Unable to delete the comment. Please try again.');
        } finally {
            setDeletingId(null);
            setOptionsFor(null);
        }
    };

    const isOwn = (comment) => currentUserId !== null
        && currentUserId !== undefined
        && Number(comment?.author_id) === Number(currentUserId);
    const canDelete = (comment) => isOwn(comment) || currentUserRole === 'master_admin';
    const editingComment = editingId !== null && editingId !== undefined
        ? comments.find((item) => String(item?.id) === String(editingId)) ?? null
        : null;

    return (
        <div data-testid="submission-comments" style={{ display: 'grid', gap: 10, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, background: '#eff6ff', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={15} />
                </span>
                <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--ac-text, #0f172a)' }}>
                    Comments{comments.length > 0 ? ` (${comments.length})` : ''}
                </div>
            </div>

            {loading ? (
                <div style={{ fontSize: 13, color: 'var(--ac-muted, #64748b)' }}>Loading comments…</div>
            ) : comments.length === 0 ? (
                <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--ac-muted, #64748b)' }}>
                    No comments yet — start the discussion below.
                </div>
            ) : (
                <div
                    ref={listRef}
                    onScroll={handleListScroll}
                    style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}
                >
                    {loadingMore || (hasMore && comments.length > 0) ? (
                        <div style={{ fontSize: 12, color: 'var(--ac-muted, #64748b)', textAlign: 'center' }}>
                            {loadingMore ? 'Loading older comments…' : 'Scroll up to load older comments'}
                        </div>
                    ) : null}
                    {comments.map((comment) => {
                        const own = isOwn(comment);
                        const palette = paletteFor(comment?.author_id ?? comment?.id);
                        return (
                            <div
                                key={comment.id}
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    flexDirection: own ? 'row-reverse' : 'row',
                                    alignItems: 'flex-start',
                                }}
                            >
                                <span
                                    style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 999,
                                        background: palette.bg,
                                        color: palette.color,
                                        fontWeight: 800,
                                        fontSize: 11,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    {comment?.author?.initials || '?'}
                                </span>
                                <div style={{ maxWidth: '85%', flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                                        <div
                                            style={{
                                                background: own ? 'rgba(37, 99, 235, 0.12)' : 'var(--ac-border-soft, #f1f5f9)',
                                                color: 'var(--ac-text, #0f172a)',
                                                borderRadius: 12,
                                                borderTopLeftRadius: own ? 12 : 2,
                                                borderTopRightRadius: own ? 2 : 12,
                                                padding: '8px 12px',
                                                fontSize: 13,
                                                whiteSpace: 'pre-wrap',
                                                overflowWrap: 'anywhere',
                                                flex: 1,
                                                minWidth: 0,
                                            }}
                                        >
                                            {comment?.body}
                                        </div>
                                        {(own || currentUserRole === 'master_admin') ? (
                                            <ActionButton
                                                type="button"
                                                onClick={() => {
                                                    setOptionsFor(comment);
                                                }}
                                                aria-label={`Comment options for ${comment?.author?.name || 'comment'}`}
                                                style={{ padding: '4px 8px', flexShrink: 0 }}
                                            >
                                                •••
                                            </ActionButton>
                                        ) : null}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: own ? 'right' : 'left' }}>
                                        {comment?.author?.name}
                                        {comment?.author?.role ? ` · ${comment.author.role}` : ''}
                                        {own ? ' · You' : ''}
                                        {comment?.created_human ? ` · ${comment.created_human}` : ''}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {optionsFor ? (
                <div
                    onClick={() => setOptionsFor(null)}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(15,23,42,0.45)',
                        borderRadius: 8,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-label="Comment options"
                        style={{
                            background: 'var(--ac-bg, #ffffff)',
                            border: '1px solid var(--ac-border, #e8edf3)',
                            borderRadius: 12,
                            padding: 12,
                            width: 'min(240px, 85%)',
                            display: 'grid',
                            gap: 8,
                            boxShadow: '0 12px 32px rgba(15,23,42,0.25)',
                        }}
                    >
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ac-text, #0f172a)', textAlign: 'center' }}>
                            Comment options
                        </div>
                        {isOwn(optionsFor) ? (
                            <ActionButton
                                type="button"
                                onClick={() => {
                                    setEditDraft(optionsFor?.body || '');
                                    setEditingId(optionsFor.id);
                                    setOptionsFor(null);
                                }}
                                style={{ width: '100%' }}
                            >
                                Edit
                            </ActionButton>
                        ) : null}
                        {canDelete(optionsFor) ? (
                            <ActionButton
                                type="button"
                                variant="danger"
                                loading={deletingId === optionsFor.id}
                                disabled={deletingId === optionsFor.id}
                                onClick={() => deleteComment(optionsFor)}
                                style={{ width: '100%' }}
                            >
                                Delete
                            </ActionButton>
                        ) : null}
                        <ActionButton
                            type="button"
                            onClick={() => setOptionsFor(null)}
                            style={{ width: '100%' }}
                        >
                            Cancel
                        </ActionButton>
                    </div>
                </div>
            ) : null}

            {editingComment ? (
                <div
                    onClick={() => {
                        setEditingId(null);
                        setEditDraft('');
                    }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(15,23,42,0.45)',
                        borderRadius: 8,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-label="Edit comment"
                        style={{
                            background: 'var(--ac-bg, #ffffff)',
                            border: '1px solid var(--ac-border, #e8edf3)',
                            borderRadius: 12,
                            padding: 12,
                            width: 'min(320px, 90%)',
                            display: 'grid',
                            gap: 8,
                            boxShadow: '0 12px 32px rgba(15,23,42,0.25)',
                        }}
                    >
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ac-text, #0f172a)', textAlign: 'center' }}>
                            Edit comment
                        </div>
                        <TextareaInput
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={4}
                            aria-label="Edit comment"
                            style={inputStyle}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <ActionButton
                                type="button"
                                onClick={() => {
                                    setEditingId(null);
                                    setEditDraft('');
                                }}
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </ActionButton>
                            <ActionButton
                                type="button"
                                loading={savingEdit}
                                disabled={savingEdit || editDraft.trim() === ''}
                                onClick={() => saveEdit(editingComment)}
                                style={{ ...postButtonStyle, flex: 1 }}
                            >
                                Save
                            </ActionButton>
                        </div>
                    </div>
                </div>
            ) : null}

            {error ? (
                <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>
            ) : null}

                    <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--ac-border-soft, #f1f5f9)', paddingTop: 10 }}>
                <TextareaInput
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            postComment();
                        }
                    }}
                    placeholder="Write a comment... (Ctrl+Enter to post)"
                    aria-label="Write a comment"
                    rows={3}
                    style={inputStyle}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ActionButton
                        type="button"
                        loading={posting}
                        disabled={posting || draft.trim() === ''}
                        onClick={postComment}
                        style={postButtonStyle}
                    >
                        <Send size={13} />
                        Post comment
                    </ActionButton>
                </div>
            </div>
        </div>
    );
}
