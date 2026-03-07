import { Link } from '@inertiajs/react';

const baseStyle = {
    borderRadius: 8,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.2,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    border: '1px solid var(--border-color)',
    background: 'var(--button-bg)',
    boxSizing: 'border-box',
    cursor: 'pointer',
};

const variantStyle = {
    view: {
        color: 'var(--active-text)',
        border: '1px solid color-mix(in srgb, var(--active-text) 25%, var(--border-color))',
        background: 'color-mix(in srgb, var(--active-bg) 55%, transparent)',
    },
    edit: {
        color: '#60a5fa',
        border: '1px solid rgba(96,165,250,0.25)',
        background: 'rgba(96,165,250,0.08)',
    },
    danger: {
        color: '#f87171',
        border: '1px solid rgba(248,81,73,0.25)',
        background: 'rgba(248,81,73,0.12)',
    },
    neutral: {
        color: 'var(--text-main)',
    },
    success: {
        color: '#fff',
        border: '1px solid color-mix(in srgb, var(--success) 45%, transparent)',
        background: 'var(--success)',
    },
};

const activeStyle = {
    color: 'var(--active-text)',
    border: '1px solid color-mix(in srgb, var(--active-text) 25%, var(--border-color))',
    background: 'var(--active-bg)',
};

export default function ActionButton({
    href,
    external = false,
    variant = 'neutral',
    active = false,
    style,
    children,
    type = 'button',
    disabled = false,
    loading = false,
    ...rest
}) {
    const isDisabled = disabled || loading;
    const resolvedStyle = {
        ...baseStyle,
        ...(variantStyle[variant] || variantStyle.neutral),
        ...(active ? activeStyle : {}),
        ...(isDisabled
            ? {
                  opacity: 0.6,
                  cursor: 'not-allowed',
              }
            : {}),
        ...style,
    };

    const spinner = (
        <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            style={{ display: 'block' }}
            aria-hidden="true"
        >
            <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="56"
                strokeDashoffset="20"
            >
                <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 12 12"
                    to="360 12 12"
                    dur="0.8s"
                    repeatCount="indefinite"
                />
            </circle>
        </svg>
    );

    const content = (
        <>
            {loading ? <span style={{ display: 'inline-flex' }}>{spinner}</span> : null}
            <span>{children}</span>
        </>
    );

    if (href) {
        if (isDisabled) {
            return (
                <span aria-disabled="true" aria-busy={loading || undefined} style={resolvedStyle}>
                    {content}
                </span>
            );
        }

        if (external) {
            return (
                <a
                    href={href}
                    style={resolvedStyle}
                    target="_blank"
                    rel="noreferrer noopener"
                    {...rest}
                >
                    {content}
                </a>
            );
        }

        return (
            <Link href={href} style={resolvedStyle} aria-busy={loading || undefined} {...rest}>
                {content}
            </Link>
        );
    }

    return (
        <button
            type={type}
            disabled={isDisabled}
            style={resolvedStyle}
            aria-busy={loading || undefined}
            {...rest}
        >
            {content}
        </button>
    );
}
