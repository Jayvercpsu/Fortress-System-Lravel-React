import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

const defaultControlStyle = {
    width: '100%',
    minHeight: 40,
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    boxSizing: 'border-box',
};

export default function SearchableDropdown({
    options = [],
    value = '',
    onChange,
    placeholder = 'Select option',
    searchPlaceholder = 'Search...',
    emptyMessage = 'No options found',
    disabled = false,
    clearable = false,
    style = {},
    dropdownWidth,
    getOptionLabel = (option) => option?.label ?? option?.name ?? String(option ?? ''),
    getOptionValue = (option) => option?.value ?? option?.id ?? option,
}) {
    const rootRef = useRef(null);
    const searchRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [hoveredValue, setHoveredValue] = useState(null);

    const selectedOption = useMemo(
        () => options.find((option) => String(getOptionValue(option)) === String(value)),
        [options, value, getOptionValue]
    );

    const filteredOptions = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((option) => String(getOptionLabel(option)).toLowerCase().includes(needle));
    }, [options, query, getOptionLabel]);

    useEffect(() => {
        if (!open) return;

        const onInteractOutside = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('pointerdown', onInteractOutside, true);
        document.addEventListener('mousedown', onInteractOutside, true);
        document.addEventListener('touchstart', onInteractOutside, true);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('focusin', onInteractOutside, true);

        return () => {
            document.removeEventListener('pointerdown', onInteractOutside, true);
            document.removeEventListener('mousedown', onInteractOutside, true);
            document.removeEventListener('touchstart', onInteractOutside, true);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('focusin', onInteractOutside, true);
        };
    }, [open]);

    useEffect(() => {
        if (open) {
            const t = window.setTimeout(() => searchRef.current?.focus(), 0);
            return () => window.clearTimeout(t);
        }
        setQuery('');
        setHoveredValue(null);
    }, [open]);

    const selectOption = (option) => {
        onChange?.(String(getOptionValue(option)), option);
        setOpen(false);
    };

    return (
        <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen((prev) => !prev)}
                style={{
                    ...defaultControlStyle,
                    ...(open
                        ? {
                              borderColor: 'color-mix(in srgb, var(--active-text) 45%, var(--border-color))',
                              boxShadow: '0 0 0 3px color-mix(in srgb, var(--active-bg) 35%, transparent)',
                          }
                        : {}),
                    ...(disabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    ...style,
                }}
            >
                <div
                    style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'color-mix(in srgb, var(--active-bg) 50%, transparent)',
                        color: 'var(--active-text)',
                        flexShrink: 0,
                    }}
                >
                    <Search size={13} />
                </div>

                <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedOption ? (
                        <span>{getOptionLabel(selectedOption)}</span>
                    ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
                    )}
                </div>

                {clearable && !disabled && value ? (
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange?.('', null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                onChange?.('', null);
                            }
                        }}
                        style={{
                            width: 20,
                            height: 20,
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: 6,
                            color: 'var(--text-muted)',
                        }}
                    >
                        <X size={14} />
                    </span>
                ) : null}

                <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.15s' }} />
            </button>

            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: dropdownWidth || '100%',
                        minWidth: 240,
                        zIndex: 40,
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12,
                        boxShadow: '0 14px 34px rgba(0,0,0,0.18)',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ padding: 10, borderBottom: '1px solid var(--border-color)', background: 'var(--surface-2)' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                padding: '7px 9px',
                                background: 'var(--surface-1)',
                            }}
                        >
                            <Search size={14} style={{ color: 'var(--text-muted)' }} />
                            <input
                                ref={searchRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={searchPlaceholder}
                                style={{
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    color: 'var(--text-main)',
                                    fontSize: 13,
                                    width: '100%',
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ maxHeight: 240, overflowY: 'auto', padding: 6 }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{emptyMessage}</div>
                        ) : (
                            filteredOptions.map((option) => {
                                const optionValue = String(getOptionValue(option));
                                const selected = String(value) === optionValue;
                                const hovered = hoveredValue === optionValue;

                                return (
                                    <button
                                        key={optionValue}
                                        type="button"
                                        onClick={() => selectOption(option)}
                                        onMouseEnter={() => setHoveredValue(optionValue)}
                                        onMouseLeave={() => setHoveredValue((prev) => (prev === optionValue ? null : prev))}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            border: '1px solid transparent',
                                            background: selected
                                                ? 'color-mix(in srgb, var(--active-bg) 45%, transparent)'
                                                : hovered
                                                  ? 'color-mix(in srgb, var(--surface-2) 80%, var(--active-bg) 20%)'
                                                  : 'transparent',
                                            color: selected ? 'var(--active-text)' : 'var(--text-main)',
                                            borderColor: 'transparent',
                                            borderRadius: 8,
                                            padding: '9px 10px',
                                            fontSize: 12,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 10,
                                            cursor: 'pointer',
                                            transition: 'background-color 120ms ease',
                                        }}
                                    >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {getOptionLabel(option)}
                                        </span>
                                        {selected && <Check size={14} />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
