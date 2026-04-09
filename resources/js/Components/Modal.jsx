import { useEffect } from 'react';

function resolveMaxHeight(value) {
    if (value === null || value === undefined || value === '') return '90vh';
    if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
    return value;
}

export default function Modal({ open, onClose, title, headerContent, children, maxWidth = 960, maxHeight }) {
    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                zIndex: 1100,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth,
                    maxHeight: resolveMaxHeight(maxHeight),
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-color)',
                    }}
                >
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            border: '1px solid var(--border-color)',
                            background: 'var(--button-bg)',
                            color: 'var(--text-main)',
                            borderRadius: 8,
                            padding: '6px 10px',
                            cursor: 'pointer',
                            fontSize: 12,
                        }}
                    >
                        Close
                    </button>
                </div>

                {headerContent ? (
                    <div
                        style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--border-color)',
                            background: 'var(--surface-1)',
                        }}
                    >
                        {headerContent}
                    </div>
                ) : null}

                <div style={{ padding: 14, overflow: 'auto' }}>{children}</div>
            </div>
        </div>
    );
}
