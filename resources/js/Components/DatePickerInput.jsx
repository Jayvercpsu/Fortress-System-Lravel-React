import { forwardRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactDatePicker from 'react-datepicker';

const parseYmd = (value) => {
    if (!value || typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);

    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
};

const toYmd = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

const buildYearOptions = (selected, minDate, maxDate) => {
    const currentYear = new Date().getFullYear();
    const selectedYear = selected?.getFullYear?.() ?? currentYear;
    const minYear = minDate?.getFullYear?.() ?? Math.max(1900, currentYear - 80);
    const maxYear = maxDate?.getFullYear?.() ?? currentYear + 10;

    const from = Math.min(minYear, selectedYear);
    const to = Math.max(maxYear, selectedYear);
    const years = [];

    for (let year = from; year <= to; year += 1) {
        years.push(year);
    }

    return years;
};

const DateTextInput = forwardRef(function DateTextInput(
    { value, onClick, onChange, placeholder, style, disabled, name, onBlur },
    ref
) {
    return (
        <div className={`bb-date-input-wrap${disabled ? ' is-disabled' : ''}`} onClick={disabled ? undefined : onClick}>
            <span className="bb-date-input-icon" aria-hidden="true">
                <Calendar size={15} strokeWidth={2} />
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

export default function DatePickerInput({
    value = '',
    onChange,
    style,
    placeholder = 'YYYY-MM-DD',
    disabled = false,
    name,
    minDate,
    maxDate,
}) {
    const selected = useMemo(() => parseYmd(value), [value]);
    const parsedMinDate = useMemo(() => (typeof minDate === 'string' ? parseYmd(minDate) : minDate ?? null), [minDate]);
    const parsedMaxDate = useMemo(() => (typeof maxDate === 'string' ? parseYmd(maxDate) : maxDate ?? null), [maxDate]);
    const yearOptions = useMemo(
        () => buildYearOptions(selected, parsedMinDate, parsedMaxDate),
        [selected, parsedMinDate, parsedMaxDate]
    );

    return (
        <ReactDatePicker
            selected={selected}
            onChange={(date) => onChange?.(toYmd(date))}
            dateFormat="yyyy-MM-dd"
            showPopperArrow={false}
            fixedHeight
            placeholderText={placeholder}
            disabled={disabled}
            name={name}
            minDate={parsedMinDate}
            maxDate={parsedMaxDate}
            isClearable={false}
            popperPlacement="bottom-start"
            calendarClassName="bb-datepicker"
            popperClassName="bb-datepicker-popper"
            formatWeekDay={(nameOfDay) => nameOfDay.slice(0, 2).toUpperCase()}
            renderCustomHeader={({
                date,
                changeYear,
                changeMonth,
                decreaseMonth,
                increaseMonth,
                prevMonthButtonDisabled,
                nextMonthButtonDisabled,
            }) => (
                <div className="bb-datepicker-header">
                    <button
                        type="button"
                        onClick={decreaseMonth}
                        disabled={prevMonthButtonDisabled}
                        className="bb-datepicker-nav"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <div className="bb-datepicker-selects">
                        <select
                            value={date.getMonth()}
                            onChange={(e) => changeMonth(Number(e.target.value))}
                            className="bb-datepicker-select"
                        >
                            {MONTH_NAMES.map((month, index) => (
                                <option key={month} value={index}>
                                    {month}
                                </option>
                            ))}
                        </select>

                        <select
                            value={date.getFullYear()}
                            onChange={(e) => changeYear(Number(e.target.value))}
                            className="bb-datepicker-select"
                        >
                            {yearOptions.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={increaseMonth}
                        disabled={nextMonthButtonDisabled}
                        className="bb-datepicker-nav"
                        aria-label="Next month"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
            customInput={<DateTextInput style={style} />}
        />
    );
}
