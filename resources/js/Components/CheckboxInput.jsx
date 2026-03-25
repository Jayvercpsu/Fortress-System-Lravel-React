export default function CheckboxInput({
    label,
    checked,
    disabled = false,
    style = {},
    labelStyle = {},
    ...props
}) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: 'var(--text-main)',
                fontSize: 12,
                ...labelStyle,
            }}
        >
            <input
                type="checkbox"
                checked={!!checked}
                disabled={disabled}
                style={{
                    width: 16,
                    height: 16,
                    accentColor: 'var(--active-text)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    ...style,
                }}
                {...props}
            />
            {label ? <span>{label}</span> : null}
        </label>
    );
}
