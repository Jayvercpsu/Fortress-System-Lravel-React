import Layout from './Layout';
import DatePickerInput from './DatePickerInput';
import { Head, useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';

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

function Field({ label, error, children }) {
    return (
        <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>{label}</label>
            {children}
            {error && <div style={{ color: '#f85149', fontSize: 12 }}>{error}</div>}
        </div>
    );
}

export default function UserFormPage({ mode = 'create', user = {} }) {
    const isEdit = mode === 'edit';

    const { data, setData, post, patch, errors, processing } = useForm({
        fullname: user?.fullname ?? '',
        email: user?.email ?? '',
        password: '',
        role: user?.role ?? 'foreman',
        birth_date: user?.birth_date ?? '',
        place_of_birth: user?.place_of_birth ?? '',
        sex: user?.sex ?? '',
        civil_status: user?.civil_status ?? '',
        phone: user?.phone ?? '',
        address: user?.address ?? '',
    });

    const submit = (e) => {
        e.preventDefault();

        if (isEdit) {
            const qs = window.location.search || '';
            patch(`/users/${user.id}${qs}`, {
                preserveScroll: true,
                onSuccess: () => toast.success('User updated.'),
                onError: () => toast.error('Unable to update user. Check the form fields.'),
            });
            return;
        }

        post('/users', {
            preserveScroll: true,
            onSuccess: () => toast.success('User created successfully.'),
            onError: () => toast.error('Unable to create user. Check the form fields.'),
        });
    };

    const pageTitle = isEdit ? 'Edit User' : 'Create User';
    const layoutTitle = isEdit ? `Edit User - ${user?.fullname ?? ''}` : 'Create New User';

    return (
        <>
            <Head title={pageTitle} />
            <Layout title={layoutTitle}>
                <div style={{ maxWidth: 980, display: 'grid', gap: 16 }}>
                    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
                        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                            <Field label="Full Name" error={errors.fullname}>
                                <input type="text" value={data.fullname} onChange={(e) => setData('fullname', e.target.value)} style={inputStyle} />
                            </Field>

                            <Field label="Email" error={errors.email}>
                                <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} style={inputStyle} />
                            </Field>

                            <Field label={isEdit ? 'New Password (optional)' : 'Password'} error={errors.password}>
                                <input
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    style={inputStyle}
                                    placeholder={isEdit ? 'Leave blank to keep current password' : ''}
                                />
                            </Field>

                            <Field label="Role" error={errors.role}>
                                <select value={data.role} onChange={(e) => setData('role', e.target.value)} style={inputStyle}>
                                    <option value="admin">Admin</option>
                                    <option value="hr">HR</option>
                                    <option value="foreman">Foreman</option>
                                </select>
                            </Field>
                        </div>

                        <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                            <div style={{ fontWeight: 700 }}>User Details</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                                <Field label="Birth Date" error={errors.birth_date}>
                                    <DatePickerInput value={data.birth_date} onChange={(value) => setData('birth_date', value)} style={inputStyle} maxDate={new Date()} />
                                </Field>

                                <Field label="Place of Birth" error={errors.place_of_birth}>
                                    <input type="text" value={data.place_of_birth} onChange={(e) => setData('place_of_birth', e.target.value)} style={inputStyle} />
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
                                    <input type="text" value={data.phone} onChange={(e) => setData('phone', e.target.value)} style={inputStyle} />
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

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.history.length > 1) {
                                        window.history.back();
                                    } else {
                                        window.location.href = '/users';
                                    }
                                }}
                                style={{
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>

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
                                {processing ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
                            </button>
                        </div>
                    </form>
                </div>
            </Layout>
        </>
    );
}
