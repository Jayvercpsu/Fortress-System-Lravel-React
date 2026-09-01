import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const buildYearOptions = (anchor, minDate, maxDate) => {
    const currentYear = new Date().getFullYear();
    const anchorYear = anchor?.getFullYear?.() ?? currentYear;
    const minYear = minDate?.getFullYear?.() ?? Math.max(1900, currentYear - 80);
    const maxYear = maxDate?.getFullYear?.() ?? currentYear + 10;
    const from = Math.min(minYear, anchorYear);
    const to = Math.max(maxYear, anchorYear);
    const years = [];
    for (let y = from; y <= to; y += 1) years.push(y);
    return years;
};

/* ── Custom input that shows the range label ─────────────────── */
const RangeInput = forwardRef(function RangeInput(
    { value, onClick, placeholder, style, disabled, wrapperRef },
    ref
) {
    return (
        <div
            ref={wrapperRef}
            className={`bb-date-input-wrap${disabled ? ' is-disabled' : ''}`}
            onClick={disabled ? undefined : onClick}
        >
            <span className="bb-date-input-icon" aria-hidden="true">
                <Calendar size={15} strokeWidth={2} />
            </span>
            <input
                ref={ref}
                type="text"
                value={value || ''}
                onClick={onClick}
                placeholder={placeholder}
                style={style}
                disabled={disabled}
                autoComplete="off"
                className="bb-date-input"
                readOnly
            />
        </div>
    );
});
/* ── Main component ─────────────────────────────────────────── */
/**
 * Reusable single-calendar date range picker.
 * Click a start date, then click an end date — a connected
 * highlight line appears between them inside the calendar.
 *
 * Props:
 *   startDate   – YYYY-MM-DD string for range start
 *   endDate     – YYYY-MM-DD string for range end
 *   onStartChange(dateString)
 *   onEndChange(dateString)
 *   onChange({ startDate, endDate }) – convenience callback (both values)
 *   label           – label above the input
 *   placeholder     – input placeholder
 *   style           – input style override
 *   minDate         – Date or YYYY-MM-DD string
 *   maxDate         – Date or YYYY-MM-DD string
 */
export default function DateRangePicker({
    startDate = '',
    endDate = '',
    onStartChange,
    onEndChange,
    onChange,
    label = '',
    placeholder = 'Select date range…',
    style,
    minDate,
    maxDate,
    disabled = false,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const pendingRangeRef = useRef(false);

    const selectedStart = useMemo(() => parseYmd(startDate), [startDate]);
    const selectedEnd = useMemo(() => parseYmd(endDate), [endDate]);
    const parsedMinDate = useMemo(() => (typeof minDate === 'string' ? parseYmd(minDate) : minDate ?? null), [minDate]);
    const parsedMaxDate = useMemo(() => (typeof maxDate === 'string' ? parseYmd(maxDate) : maxDate ?? null), [maxDate]);

    // react-datepicker's selectsRange derives its state from the startDate /
    // endDate props. When a page only navigates once BOTH dates are chosen,
    // the props stay empty after the first click and the picker treats the
    // second click as a new start — the range never completes. Keep an
    // internal draft of the in-progress selection and pass that instead,
    // re-syncing whenever the committed props change.
    const [draftRange, setDraftRange] = useState({ start: selectedStart, end: selectedEnd });

    useEffect(() => {
        setDraftRange({ start: selectedStart, end: selectedEnd });
    }, [selectedStart, selectedEnd]);

    // For the year dropdown header — anchor to whichever date is set
    const anchorDate = selectedStart ?? selectedEnd ?? new Date();
    const yearOptions = useMemo(
        () => buildYearOptions(anchorDate, parsedMinDate, parsedMaxDate),
        [anchorDate, parsedMinDate, parsedMaxDate]
    );

    /* close on outside click */
    useEffect(() => {
        if (!isOpen) return;
        const handlePointerDown = (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (wrapperRef.current?.contains(target)) return;
            if (target.closest('.react-datepicker-popper')) return;
            if (target.closest('.bb-datepicker-popper')) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown, true);
        document.addEventListener('touchstart', handlePointerDown, true);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown, true);
            document.removeEventListener('touchstart', handlePointerDown, true);
        };
    }, [isOpen]);

    const handleChange = useCallback((value) => {
        const [start, end] = Array.isArray(value) ? value : [null, null];
        const s = toYmd(start);
        const e = toYmd(end);

        pendingRangeRef.current = Boolean(s && !e);

        setDraftRange({ start: start ?? null, end: end ?? null });

        onStartChange?.(s);
        onEndChange?.(e);
        onChange?.({ startDate: s, endDate: e });
    }, [onStartChange, onEndChange, onChange]);

    return (
        <div>
            {label && (
                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>
                    {label}
                </div>
            )}
            <ReactDatePicker
                selectsRange
                startDate={draftRange.start}
                endDate={draftRange.end}
                onChange={handleChange}
                onCalendarClose={() => {
                    if (pendingRangeRef.current) return;
                    setIsOpen(false);
                }}
                selected={draftRange.start}
                dateFormat="yyyy-MM-dd"
                showPopperArrow={false}
                fixedHeight
                placeholderText={placeholder}
                disabled={disabled}
                minDate={parsedMinDate}
                maxDate={parsedMaxDate}
                isClearable
                popperPlacement="bottom-start"
                calendarClassName="bb-datepicker bb-datepicker--range"
                popperClassName="bb-datepicker-popper"
                open={isOpen}
                onInputClick={() => setIsOpen(true)}

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
                                    <option key={month} value={index}>{month}</option>
                                ))}
                            </select>
                            <select
                                value={date.getFullYear()}
                                onChange={(e) => changeYear(Number(e.target.value))}
                                className="bb-datepicker-select"
                            >
                                {yearOptions.map((year) => (
                                    <option key={year} value={year}>{year}</option>
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
                customInput={
                    <RangeInput
                        style={style}
                        wrapperRef={wrapperRef}
                        placeholder={placeholder}
                        disabled={disabled}
                    />
                }
            />
        </div>
    );
}