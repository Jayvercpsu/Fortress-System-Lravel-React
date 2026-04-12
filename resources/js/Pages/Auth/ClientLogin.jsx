import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ActionButton from '../../Components/ActionButton';
import BrandIcon from '../../Components/BrandIcon';
import TextInput from '../../Components/TextInput';
import { toastMessages } from '../../constants/toastMessages';

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

export default function ClientLogin() {
    useEffect(() => {
        const savedTheme = localStorage.getItem('bb_theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    const { flash } = usePage().props;
    const flashCooldownSeconds = Number(flash?.cooldown ?? 0) || 0;
    const flashCooldownFor = String(flash?.cooldown_for ?? '');

    const { data, setData, post, errors, processing } = useForm({
        username: '',
        password: '',
    });

    const identifier = useMemo(() => String(data.username || '').trim().toLowerCase(), [data.username]);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [cooldownFor, setCooldownFor] = useState('');

    useEffect(() => {
        if (!flashCooldownSeconds) return;
        setCooldownRemaining(Math.max(0, Math.floor(flashCooldownSeconds)));
        setCooldownFor(flashCooldownFor);
    }, [flashCooldownSeconds, flashCooldownFor]);

    const cooldownActive = cooldownRemaining > 0 && (!cooldownFor || cooldownFor === identifier);

    useEffect(() => {
        if (!cooldownRemaining) return undefined;
        const timer = window.setInterval(() => {
            setCooldownRemaining((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [cooldownRemaining]);

    const cooldownLabel = useMemo(() => {
        const minutes = Math.floor(cooldownRemaining / 60);
        const seconds = String(cooldownRemaining % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }, [cooldownRemaining]);

    const submit = (e) => {
        e.preventDefault();
        if (cooldownActive) return;
        post('/client/login', {
            onError: (formErrors) => {
                if (formErrors?.username === 'Invalid client credentials.') {
                    toast.error(formErrors.username, { id: 'client-login-invalid-credentials' });
                }
            },
            onSuccess: () => {
                toast.success(toastMessages.auth.loginSuccess, { id: 'client-login-success' });
            },
        });
    };

    return (
        <>
            <Head title="Client Login" />

            <div
                style={{
                    fontFamily: "'DM Sans', sans-serif",
                    background: 'var(--bg-page)',
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-main)',
                }}
            >
                <div style={{ width: 400 }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div
                            style={{
                                display: 'inline-flex',
                                margin: '0 auto 12px',
                            }}
                        >
                            <BrandIcon size={56} borderRadius={12} />
                        </div>

                        <h1 style={{ color: 'var(--text-main)', fontSize: 24, fontWeight: 700, margin: 0 }}>
                            Client Login
                        </h1>

                        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                            Fortress Client Portal
                        </p>
                    </div>

                    <div
                        style={{
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 12,
                            padding: 32,
                        }}
                    >
                        <form onSubmit={submit}>
                            <div style={{ marginBottom: 16 }}>
                                <label
                                    style={{
                                        display: 'block',
                                        color: 'var(--text-muted)',
                                        fontSize: 12,
                                        marginBottom: 6,
                                        fontWeight: 500,
                                    }}
                                >
                                    Username
                                </label>

                                <TextInput
                                    type="text"
                                    value={data.username}
                                    onChange={(e) => setData('username', e.target.value)}
                                    style={inputStyle}
                                />

                                {cooldownActive ? (
                                    <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 6 }}>
                                        Too many attempts. Try again in {cooldownLabel}.
                                    </p>
                                ) : errors.username && errors.username !== 'Invalid client credentials.' ? (
                                    <p style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>
                                        {errors.username}
                                    </p>
                                ) : null}
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <label
                                    style={{
                                        display: 'block',
                                        color: 'var(--text-muted)',
                                        fontSize: 12,
                                        marginBottom: 6,
                                        fontWeight: 500,
                                    }}
                                >
                                    Password
                                </label>

                                <TextInput
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    disabled={processing || cooldownActive}
                                    style={inputStyle}
                                />
                            </div>

                            <ActionButton
                                type="submit"
                                variant="success"
                                disabled={processing || cooldownActive}
                                style={{
                                    width: '100%',
                                    padding: '11px 0',
                                    fontSize: 14,
                                }}
                            >
                                {processing ? 'Signing in...' : cooldownActive ? `Try again in ${cooldownLabel}` : 'Sign In'}
                            </ActionButton>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
