import { Link } from '@inertiajs/react';

const baseStyle = {
    borderRadius: 8,
    padding: '5px 12px',
    fontSize: 12,
    lineHeight: 1.2,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-color)',
    background: 'var(--button-bg)',
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

export default function ActionButton({
    href,
    external = false,
    variant = 'neutral',
    style,
    children,
    type = 'button',
    disabled = false,
    ...rest
}) {
    const resolvedStyle = {
        ...baseStyle,
        ...(variantStyle[variant] || variantStyle.neutral),
        ...(disabled
            ? {
                  opacity: 0.6,
                  cursor: 'not-allowed',
              }
            : {}),
        ...style,
    };

    if (href) {
        if (external) {
            return (
                <a href={href} style={resolvedStyle} {...rest}>
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
            style={{
                ...resolvedStyle,
                cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            {...rest}
        >
            {children}
        </button>
    );
}
