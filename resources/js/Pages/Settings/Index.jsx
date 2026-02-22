import Layout from '../../Components/Layout';
import DatePickerInput from '../../Components/DatePickerInput';
import { Head, useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 18,
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    color: 'var(--text-main)',
    fontSize: 13,
    boxSizing: 'border-box',
};

function Field({ label, error, children }) {
    return (
        <label style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
            {children}
            {error && <div style={{ color: '#f87171', fontSize: 12 }}>{error}</div>}
        </label>
    );
}

export default function SettingsIndex({ account }) {
    const { data, setData, patch, processing, errors } = useForm({
        fullname: account?.fullname ?? '',
        email: account?.email ?? '',
        role: account?.role ?? '',
        password: '',
        password_confirmation: '',
        birth_date: account?.birth_date ?? '',
        place_of_birth: account?.place_of_birth ?? '',
        sex: account?.sex ?? '',
        civil_status: account?.civil_status ?? '',
        phone: account?.phone ?? '',
        address: account?.address ?? '',
    });

    const submit = (e) => {
        e.preventDefault();

        patch('/settings', {
            preserveScroll: true,
            onSuccess: () => {
                setData('password', '');
                setData('password_confirmation', '');
                toast.success('Settings updated.');
            },
            onError: () => toast.error('Unable to update settings. Check the form fields.'),
        });
    };

    return (
        <>
            <Head title="Settings" />
            <Layout title="Settings">
                <div style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
                    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
                        <div style={cardStyle}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Account Settings</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                                Update your account information and password.
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                                <Field label="Full Name" error={errors.fullname}>
                                    <input
                                        type="text"
                                        value={data.fullname}
                                        onChange={(e) => setData('fullname', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>

                                <Field label="Email" error={errors.email}>
                                    <input
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>

                                <Field label="Role">
                                    <input type="text" value={String(data.role || '').replace('_', ' ')} readOnly style={inputStyle} />
                                </Field>

                                <Field label="New Password (optional)" error={errors.password}>
                                    <input
                                        type="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        style={inputStyle}
                                        placeholder="Leave blank to keep current password"
                                    />
                                </Field>

                                <Field label="Confirm New Password" error={errors.password_confirmation}>
                                    <input
                                        type="password"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>
                            </div>
                        </div>

                        <div style={cardStyle}>
                            <div style={{ fontWeight: 700, marginBottom: 12 }}>Personal Details</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                                <Field label="Birth Date" error={errors.birth_date}>
                                    <DatePickerInput
                                        value={data.birth_date}
                                        onChange={(value) => setData('birth_date', value)}
                                        style={inputStyle}
                                        maxDate={new Date()}
                                    />
                                </Field>

                                <Field label="Place of Birth" error={errors.place_of_birth}>
                                    <input
                                        type="text"
                                        value={data.place_of_birth}
                                        onChange={(e) => setData('place_of_birth', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>

                                <Field label="Sex" error={errors.sex}>
                                    <select value={data.sex} onChange={(e) => setData('sex', e.target.value)} style={inputStyle}>
                                        <option value="">Select sex</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </Field>

                                <Field label="Civil Status" error={errors.civil_status}>
                                    <select value={data.civil_status} onChange={(e) => setData('civil_status', e.target.value)} style={inputStyle}>
                                        <option value="">Select civil status</option>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Widowed">Widowed</option>
                                        <option value="Separated">Separated</option>
                                        <option value="Divorced">Divorced</option>
                                    </select>
                                </Field>

                                <Field label="Phone" error={errors.phone}>
                                    <input
                                        type="text"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        style={inputStyle}
                                    />
                                </Field>

                                <div style={{ gridColumn: '1 / -1' }}>
                                    <Field label="Address" error={errors.address}>
                                        <textarea
                                            value={data.address}
                                            onChange={(e) => setData('address', e.target.value)}
                                            style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                                        />
                                    </Field>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="submit"
                                disabled={processing}
                                style={{
                                    background: 'var(--success)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '10px 16px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: processing ? 'not-allowed' : 'pointer',
                                    opacity: processing ? 0.7 : 1,
                                }}
                            >
                                {processing ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </form>
                </div>
            </Layout>
        </>
    );
}
