import Layout from '../../Components/Layout';
import DatePickerInput from '../../Components/DatePickerInput';
import ActionButton from '../../Components/ActionButton';
import { Head, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 18,
};

const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_MAX_LABEL = '5 MB';

const filePickerStyles = {
    wrapper: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: '6px 12px',
        background: 'var(--surface-2)',
        cursor: 'pointer',
        fontSize: 13,
        color: 'var(--text-main)',
    },
    helperText: {
        fontSize: 12,
        color: 'var(--text-muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: 140,
    },
    hiddenInput: {
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        border: 0,
    },
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
    const { data, setData, post, processing, errors, wasSuccessful } = useForm({
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
        profile_photo: null,
    });

    const formRef = useRef(null);

    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState(
        account?.profile_photo_path ? `/storage/${account.profile_photo_path}` : ''
    );
    const [photoError, setPhotoError] = useState('');

    useEffect(() => {
        if (!selectedPhoto) {
            setPreviewPhotoUrl(account?.profile_photo_path ? `/storage/${account.profile_photo_path}` : '');
            return;
        }

        const url = URL.createObjectURL(selectedPhoto);
        setPreviewPhotoUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [selectedPhoto, account?.profile_photo_path]);

    useEffect(() => {
        if (wasSuccessful) {
            toast.success('Settings updated successfully.');
        }
    }, [wasSuccessful]);

    const submit = (e) => {
        e.preventDefault();

        const formElement = formRef.current ?? e.currentTarget;
        if (!(formElement instanceof HTMLFormElement)) {
            return;
        }

        const profilePhotoInput = formElement.querySelector('input[name="profile_photo"]');
        const hasProfilePhoto = Boolean(profilePhotoInput?.files?.length);
        const payload = hasProfilePhoto ? new FormData(formElement) : data;

        post('/settings', payload, {
            preserveScroll: true,
            forceFormData: hasProfilePhoto,
            onSuccess: () => {
                setData('password', '');
                setData('password_confirmation', '');
                setData('profile_photo', null);
                setSelectedPhoto(null);
                setPhotoError('');
            },
            onError: () => toast.error('Unable to update settings. Check the form fields.'),
        });
    };

    const handleProfilePhotoChange = (event) => {
        const file = event.target.files?.[0] ?? null;
        if (!file) {
            setSelectedPhoto(null);
            setData('profile_photo', null);
            setPhotoError('');
            return;
        }

        if (file.size > PROFILE_PHOTO_MAX_BYTES) {
            setSelectedPhoto(null);
            setData('profile_photo', null);
            setPhotoError(`Profile photo must be ${PROFILE_PHOTO_MAX_LABEL} or smaller.`);
            return;
        }

        setPhotoError('');
        setSelectedPhoto(file);
        setData('profile_photo', file);
    };

    return (
        <>
            <Head title="Settings" />
            <Layout title="Settings">
                <div style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
                    <form ref={formRef} onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' }}>
                        <div
                            style={{
                                ...cardStyle,
                                display: 'grid',
                                gap: 12,
                                alignItems: 'center',
                                textAlign: 'center',
                            }}
                        >
                                <div style={{ fontWeight: 700 }}>Profile Photo</div>
                                <div
                                    style={{
                                        width: 140,
                                        height: 140,
                                        borderRadius: 999,
                                        overflow: 'hidden',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--surface-2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto',
                                    }}
                                >
                                    {previewPhotoUrl ? (
                                        <img
                                            src={previewPhotoUrl}
                                            alt="Profile"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                                            No profile photo uploaded yet.
                                        </div>
                                    )}
                                </div>
                                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-main)' }}>
                                    {account?.fullname || 'No name yet'}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: 'var(--text-muted)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: '100%',
                                    }}
                                >
                                    {account?.email || 'No email yet'}
                                </div>
                                <label style={filePickerStyles.wrapper}>
                                    Choose File
                                    <input
                                        name="profile_photo"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleProfilePhotoChange}
                                        style={filePickerStyles.hiddenInput}
                                    />
                                </label>
                                {selectedPhoto?.name && (
                                    <div style={filePickerStyles.helperText}>{selectedPhoto.name}</div>
                                )}
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Max {PROFILE_PHOTO_MAX_LABEL}. JPEG, PNG, GIF, and WEBP only.
                                </div>
                                {(photoError || errors.profile_photo) && (
                                    <div style={{ color: '#f87171', fontSize: 12 }}>{photoError || errors.profile_photo}</div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gap: 16 }}>
                                <div style={cardStyle}>
                                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Account Settings</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                                        Update your account information and password.
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                                        <Field label="Full Name" error={errors.fullname}>
                                        <input
                                            name="fullname"
                                            type="text"
                                            value={data.fullname}
                                            onChange={(e) => setData('fullname', e.target.value)}
                                            style={inputStyle}
                                        />
                                        </Field>

                                        <Field label="Email" error={errors.email}>
                                        <input
                                            name="email"
                                            type="email"
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                            style={inputStyle}
                                        />
                                        </Field>

                                        <Field label="Role">
                                        <input
                                            name="role"
                                            type="text"
                                            value={String(data.role || '').replace('_', ' ')}
                                            readOnly
                                            style={inputStyle}
                                        />
                                        </Field>

                                        <Field label="New Password (optional)" error={errors.password}>
                                        <input
                                            name="password"
                                            type="password"
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            style={inputStyle}
                                            placeholder="Leave blank to keep current password"
                                        />
                                        </Field>

                                        <Field label="Confirm New Password" error={errors.password_confirmation}>
                                        <input
                                            name="password_confirmation"
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
                                                name="birth_date"
                                                value={data.birth_date}
                                                onChange={(value) => setData('birth_date', value)}
                                                style={inputStyle}
                                                maxDate={new Date()}
                                            />
                                        </Field>

                                        <Field label="Place of Birth" error={errors.place_of_birth}>
                                            <input
                                                name="place_of_birth"
                                                type="text"
                                                value={data.place_of_birth}
                                                onChange={(e) => setData('place_of_birth', e.target.value)}
                                                style={inputStyle}
                                            />
                                        </Field>

                                        <Field label="Sex" error={errors.sex}>
                                            <select name="sex" value={data.sex} onChange={(e) => setData('sex', e.target.value)} style={inputStyle}>
                                                <option value="">Select sex</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </Field>

                                        <Field label="Civil Status" error={errors.civil_status}>
                                            <select
                                                name="civil_status"
                                                value={data.civil_status}
                                                onChange={(e) => setData('civil_status', e.target.value)}
                                                style={inputStyle}
                                            >
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
                                                name="phone"
                                                type="text"
                                                value={data.phone}
                                                onChange={(e) => setData('phone', e.target.value)}
                                                style={inputStyle}
                                            />
                                        </Field>

                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <Field label="Address" error={errors.address}>
                                            <textarea
                                                name="address"
                                                value={data.address}
                                                onChange={(e) => setData('address', e.target.value)}
                                                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                                            />
                                            </Field>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <ActionButton
                                type="submit"
                                variant="success"
                                disabled={processing}
                                style={{ padding: '10px 16px', fontSize: 13 }}
                            >
                                {processing ? 'Saving...' : 'Save Settings'}
                            </ActionButton>
                        </div>
                    </form>
                </div>
            </Layout>
        </>
    );
}
