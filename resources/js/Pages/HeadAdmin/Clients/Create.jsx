import { useLayoutTitle } from '../../../Components/Layout';
import ActionButton from '../../../Components/ActionButton';
import TextInput from '../../../Components/TextInput';
import SearchableDropdown from '../../../Components/SearchableDropdown';
import { Head, useForm } from '@inertiajs/react';
import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { toastMessages } from '../../../constants/toastMessages';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 24,
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'var(--text-main)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
};

function Field({ label, required = false, error, children }) {
    return (
        <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>
                {label}
                {required ? <span style={{ color: '#f85149' }}> *</span> : null}
            </label>
            {children}
            {error && <div style={{ color: '#f85149', fontSize: 12 }}>{error}</div>}
        </div>
    );
}

export default function ClientCreate({ projectOptions = [] }) {
    const { data, setData, post, errors, processing } = useForm({
        client_name: '',
        project_id: '',
        location: '',
        email: '',
        phone: '',
        username: '',
        password: '',
        password_confirmation: '',
    });

    const projectDropdownOptions = useMemo(
        () =>
            (Array.isArray(projectOptions) ? projectOptions : []).map((option) => ({
                id: String(option.id),
                name: option.label || option.name,
            })),
        [projectOptions]
    );

    const submit = (e) => {
        e.preventDefault();

        post('/clients', {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(toastMessages.clients.createSuccess);
            },
            onError: () => {
                toast.error(toastMessages.clients.createError);
            },
        });
    };

    useLayoutTitle('Create New Client');

    return (
        <>
            <Head title="Create Client" />
                <div style={{ maxWidth: 980, display: 'grid', gap: 16 }}>
                    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
                        <div style={cardStyle}>
                            <div style={{ fontWeight: 700, marginBottom: 12 }}>Create New Client</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                <Field label="Client Name" required error={errors.client_name}>
                                    <TextInput
                                        type="text"
                                        value={data.client_name}
                                        onChange={(e) => setData('client_name', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>

                                <Field label="Username" required error={errors.username}>
                                    <TextInput
                                        type="text"
                                        value={data.username}
                                        onChange={(e) => setData('username', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>

                                <Field label="Password" required error={errors.password}>
                                    <TextInput
                                        type="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>

                                <Field label="Confirm Password" required error={errors.password_confirmation}>
                                    <TextInput
                                        type="password"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>
                            </div>
                        </div>

                        <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                            <div style={{ fontWeight: 700 }}>Client Details</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                <Field label="Assigned Project (optional)" error={errors.project_id}>
                                    <SearchableDropdown
                                        options={projectDropdownOptions}
                                        value={data.project_id}
                                        onChange={(value) => setData('project_id', value || '')}
                                        getOptionLabel={(option) => option.name}
                                        getOptionValue={(option) => option.id}
                                        placeholder={projectDropdownOptions.length > 0 ? 'Select project (optional)' : 'No projects available'}
                                        searchPlaceholder="Search project..."
                                        emptyMessage="No projects found"
                                        clearable
                                        style={{ ...inputStyle, padding: '8px 10px', minHeight: 40 }}
                                        dropdownWidth={320}
                                    />
                                </Field>

                                <Field label="Location (optional)" error={errors.location}>
                                    <TextInput
                                        type="text"
                                        value={data.location}
                                        onChange={(e) => setData('location', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>

                                <Field label="Email (optional)" error={errors.email}>
                                    <TextInput
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>

                                <Field label="Phone (optional)" error={errors.phone}>
                                    <TextInput
                                        type="text"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <ActionButton
                                type="button"
                                onClick={() => {
                                    if (window.history.length > 1) {
                                        window.history.back();
                                    } else {
                                        window.location.href = '/clients';
                                    }
                                }}
                                style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}
                            >
                                Cancel
                            </ActionButton>

                            <ActionButton
                                type="submit"
                                variant="success"
                                disabled={processing}
                                style={{ padding: '10px 16px', fontSize: 13 }}
                            >
                                {processing ? 'Saving...' : 'Create Client'}
                            </ActionButton>
                        </div>
                    </form>
                </div>
        </>
    );
}
