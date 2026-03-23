import { Head, usePage } from '@inertiajs/react';
import ActionButton from '../../Components/ActionButton';
import BrandIcon from '../../Components/BrandIcon';

const dashboardByRole = {
    head_admin: '/head-admin',
    admin: '/admin',
    hr: '/hr',
    foreman: '/foreman',
    client: '/client',
};

export default function NotFound() {
    const { auth } = usePage().props;
    const role = auth?.user?.role;
    const fallbackPath = auth?.user ? (dashboardByRole[role] || '/') : '/login';
    const primaryLabel = auth?.user ? 'Go to Dashboard' : 'Go to Login';

    return (
        <>
            <Head title="Not Found" />

            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-page)',
                    color: 'var(--text-main)',
                    padding: 24,
                    fontFamily: "'DM Sans', sans-serif",
                }}
            >
                <div
                    style={{
                        width: '100%',
                        maxWidth: 620,
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 16,
                        padding: 40,
                        textAlign: 'center',
                        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
                    }}
                >
                    <div style={{ marginBottom: 16, display: 'inline-flex' }}>
                        <BrandIcon size={52} borderRadius={12} />
                    </div>

                    <div
                        style={{
                            fontSize: 14,
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                            color: 'var(--text-muted)',
                            marginBottom: 8,
                        }}
                    >
                        404 Error
                    </div>

                    <h1 style={{ margin: '0 0 10px', fontSize: 30, fontWeight: 700 }}>
                        Page Not Found
                    </h1>

                    <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)' }}>
                        The page you are looking for does not exist or has been moved.
                    </p>

                    <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <ActionButton href={fallbackPath} variant="success" style={{ padding: '10px 18px' }}>
                            {primaryLabel}
                        </ActionButton>
                        <ActionButton
                            type="button"
                            variant="neutral"
                            style={{ padding: '10px 18px' }}
                            onClick={() => window.history.back()}
                        >
                            Go Back
                        </ActionButton>
                    </div>
                </div>
            </div>
        </>
    );
}
