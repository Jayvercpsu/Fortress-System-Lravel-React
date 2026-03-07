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
    ...rest
}) {
    const resolvedStyle = {
        ...baseStyle,
        ...(variantStyle[variant] || variantStyle.neutral),
        ...(active ? activeStyle : {}),
        ...(disabled
            ? {
                  opacity: 0.6,
                  cursor: 'not-allowed',
              }
            : {}),
        ...style,
    };

    if (href) {
        if (disabled) {
            return (
                <span aria-disabled="true" style={resolvedStyle}>
                    {children}
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
                    {children}
                </a>
            );
        }

        return (
            <Link href={href} style={resolvedStyle} {...rest}>
                {children}
            </Link>
        );
    }

    return (
        <button
            type={type}
            disabled={disabled}
            style={resolvedStyle}
            {...rest}
        >
            {children}
        </button>
    );
}
