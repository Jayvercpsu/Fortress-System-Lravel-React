import { forwardRef, useMemo } from 'react';
import { Clock3 } from 'lucide-react';
import ReactDatePicker from 'react-datepicker';

const parseHm = (value) => {
    if (!value || typeof value !== 'string') return null;
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
};

const toHm = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

const TimeTextInput = forwardRef(function TimeTextInput(
    { value, onClick, onChange, placeholder, style, disabled, name, onBlur },
    ref
) {
    return (
        <div className={`bb-date-input-wrap${disabled ? ' is-disabled' : ''}`} onClick={disabled ? undefined : onClick}>
            <span className="bb-date-input-icon" aria-hidden="true">
                <Clock3 size={15} strokeWidth={2} />
            </span>
            <input
                ref={ref}
                type="text"
                value={value || ''}
                onClick={onClick}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                style={style}
                disabled={disabled}
                name={name}
                autoComplete="off"
                className="bb-date-input"
                readOnly
            />
        </div>
    );
});

export default function TimePickerInput({
    value = '',
    onChange,
    style,
    placeholder = 'HH:mm',
    disabled = false,
    name,
    minTime,
    maxTime,
    timeIntervals = 5,
}) {
    const selected = useMemo(() => parseHm(value), [value]);
    const parsedMinTime = useMemo(() => (typeof minTime === 'string' ? parseHm(minTime) : minTime ?? null), [minTime]);
    const parsedMaxTime = useMemo(() => (typeof maxTime === 'string' ? parseHm(maxTime) : maxTime ?? null), [maxTime]);

    return (
        <ReactDatePicker
            selected={selected}
            onChange={(date) => onChange?.(toHm(date))}
            showTimeSelect
            showTimeSelectOnly
            timeIntervals={timeIntervals}
            timeCaption="Time"
            dateFormat="HH:mm"
            showPopperArrow={false}
            placeholderText={placeholder}
            disabled={disabled}
            name={name}
            minTime={parsedMinTime || undefined}
            maxTime={parsedMaxTime || undefined}
            isClearable={false}
            popperPlacement="bottom-start"
            calendarClassName="bb-datepicker bb-timepicker"
            popperClassName="bb-datepicker-popper"
            customInput={<TimeTextInput style={style} />}
        />
    );
}
