import { useEffect, useState, useRef } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

function resolveMaxHeight(value) {
    if (value === null || value === undefined || value === '') return '90vh';
    if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
    return value;
}

export default function Modal({ open, onClose, title, headerContent, children, maxWidth = 960, maxHeight, showMaximize = true }) {
    const [isMaximized, setIsMaximized] = useState(false);
    const modalRef = useRef(null);

    // Animation for maximize transition
    const [animateMaximize, setAnimateMaximize] = useState(false);

    const handleMaximizeToggle = () => {
        setAnimateMaximize(true);
        setIsMaximized(!isMaximized);
        setTimeout(() => setAnimateMaximize(false), 300);
    };

    useEffect(() => {
        if (!open) {
            setIsMaximized(false);
            return;
        }

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

    // Common transition styles for smooth animation
    const transitionStyle = {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: animateMaximize ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: isMaximized ? 'stretch' : 'center',
                justifyContent: isMaximized ? 'stretch' : 'center',
                padding: isMaximized ? 0 : 16,
                zIndex: 1100,
                transition: 'background 0.25s ease, padding 0.25s ease',
                opacity: 1,
            }}
        >
            <div
                ref={modalRef}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: isMaximized ? '100%' : '100%',
                    maxWidth: isMaximized ? '100%' : maxWidth,
                    maxHeight: isMaximized ? '100vh' : resolveMaxHeight(maxHeight),
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-color)',
                    borderRadius: isMaximized ? 0 : 12,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    margin: isMaximized ? 0 : undefined,
                    padding: isMaximized ? 0 : undefined,
                    inset: isMaximized ? 0 : undefined,
                    position: isMaximized ? 'fixed' : undefined,
                    ...transitionStyle,
                    transform: isMaximized ? 'scale(1)' : 'scale(1)',
                    opacity: 1,
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
                        ...transitionStyle,
                    }}
                >
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {showMaximize && (
                            <button
                                type="button"
                                onClick={handleMaximizeToggle}
                                title={isMaximized ? 'Minimize' : 'Maximize'}
                                style={{
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-main)',
                                    borderRadius: 8,
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'transform 0.25s ease, background 0.2s ease',
                                }}
                            >
                                <span style={{
                                    display: 'flex',
                                    transition: 'transform 0.25s ease',
                                    transform: animateMaximize ? (isMaximized ? 'rotate(0deg)' : 'rotate(-90deg)') : 'rotate(0deg)',
                                }}>
                                    {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                </span>
                            </button>
                        )}
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
