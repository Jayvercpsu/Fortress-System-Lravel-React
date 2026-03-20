import TextInput from './TextInput';

const normalizeTime = (value) => {
    const raw = String(value ?? '').trim();
    if (raw === '') return '';
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw);
    if (!match) return '';
    return `${match[1]}:${match[2]}`;
};

export default function TimeInput({
    value = '',
    onChange,
    style,
    disabled = false,
    name,
    min,
    max,
    step = 60,
}) {
    const safeValue = normalizeTime(value);

    return (
        <TextInput
            type="time"
            value={safeValue}
            onChange={(e) => onChange?.(normalizeTime(e.target.value))}
            style={style}
            disabled={disabled}
            name={name}
            min={min}
            max={max}
            step={step}
        />
    );
}
