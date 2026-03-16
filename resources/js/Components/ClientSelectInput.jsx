import ActionButton from './ActionButton';
import SearchableDropdown from './SearchableDropdown';

export default function ClientSelectInput({
    clients = [],
    value = '',
    onChange,
    placeholder = 'Select client',
    searchPlaceholder = 'Search clients...',
    emptyMessage = 'No clients found',
    addClientHref = '/clients',
    addClientLabel = 'Add client',
    pageSize = 10,
    loadMoreLabel = 'Show more',
    style = {},
    dropdownWidth,
    disabled = false,
    clearable = false,
}) {
    const resolveLabel = (option) => option?.label ?? option?.name ?? option?.fullname ?? String(option ?? '');
    const resolveValue = (option) => option?.value ?? option?.label ?? option?.fullname ?? option?.name ?? option;

    const baseOptions = Array.isArray(clients) ? clients : [];
    const currentValue = String(value ?? '').trim();
    const options = currentValue
        ? baseOptions.some((option) => String(resolveValue(option)) === currentValue)
            ? baseOptions
            : [{ label: currentValue, value: currentValue, missing: true }, ...baseOptions]
        : baseOptions;

    const footer = addClientHref ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Can&apos;t find a client?</span>
            <ActionButton href={addClientHref} variant="view" style={{ padding: '6px 10px', fontSize: 11 }}>
                {addClientLabel}
            </ActionButton>
        </div>
    ) : null;

    return (
        <SearchableDropdown
            options={options}
            value={value}
            onChange={(nextValue) => onChange?.(nextValue)}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            emptyMessage={emptyMessage}
            pageSize={pageSize}
            loadMoreLabel={loadMoreLabel}
            style={style}
            dropdownWidth={dropdownWidth}
            disabled={disabled}
            clearable={clearable}
            footer={footer}
            getOptionLabel={resolveLabel}
            getOptionValue={resolveValue}
        />
    );
}
