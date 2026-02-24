import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Moon, Settings, Sun } from 'lucide-react';

const navByRole = {
    head_admin: [
        { label: 'Dashboard', href: '/head-admin', icon: 'fi fi-rr-dashboard' },
        { label: 'Projects', href: '/projects', icon: 'fi fi-rr-diagram-project' },
        { label: 'Builders', href: '/builders', icon: 'fi fi-rr-users' },
        { label: 'Attendance', href: '/attendance', icon: 'fi fi-rr-calendar-check' },
        { label: 'Payroll', href: '/payroll/run', icon: 'fi fi-rr-money-bill-wave' },
        { label: 'Worker Rates', href: '/payroll/worker-rates', icon: 'fi fi-rr-users' },
        { label: 'Materials', href: '/materials', icon: 'fi fi-rr-shopping-cart' },
        { label: 'Delivery', href: '/delivery', icon: 'fi fi-rr-truck-side' },
        { label: 'Issues', href: '/issues', icon: 'fi fi-rr-exclamation' },
        { label: 'Progress Photos', href: '/progress-photos', icon: 'fi fi-rr-picture' },
        { label: 'Reports', href: '/reports', icon: 'fi fi-rr-document' },
        { label: 'Users', href: '/users', icon: 'fi fi-rr-user-add' },
        { label: 'Settings', href: '/settings', icon: 'fi fi-rr-settings' },
    ],
    admin: [
        { label: 'Dashboard', href: '/admin', icon: 'fi fi-rr-dashboard' },
        { label: 'Projects', href: '/projects', icon: 'fi fi-rr-diagram-project' },
        { label: 'Attendance', href: '/attendance', icon: 'fi fi-rr-calendar-check' },
        { label: 'Materials', href: '/materials', icon: 'fi fi-rr-shopping-cart' },
        { label: 'Delivery', href: '/delivery', icon: 'fi fi-rr-truck-side' },
        { label: 'Issues', href: '/issues', icon: 'fi fi-rr-exclamation' },
        { label: 'Progress Photos', href: '/progress-photos', icon: 'fi fi-rr-picture' },
        { label: 'Reports', href: '/reports', icon: 'fi fi-rr-document' },
        { label: 'Settings', href: '/settings', icon: 'fi fi-rr-settings' },
    ],
    hr: [
        { label: 'Dashboard', href: '/hr', icon: 'fi fi-rr-dashboard' },
        { label: 'Payroll', href: '/payroll/run', icon: 'fi fi-rr-money-bill-wave' },
        { label: 'Worker Rates', href: '/payroll/worker-rates', icon: 'fi fi-rr-users' },
        { label: 'Settings', href: '/settings', icon: 'fi fi-rr-settings' },
    ],
    foreman: [
        { label: 'Dashboard', href: '/foreman', icon: 'fi fi-rr-dashboard' },
        { label: 'Submissions', href: '/foreman/submissions', icon: 'fi fi-rr-apps' },
        { label: 'Workers', href: '/foreman/workers', icon: 'fi fi-rr-users' },
        { label: 'Attendance', href: '/foreman/attendance', icon: 'fi fi-rr-calendar-check' },
        { label: 'Settings', href: '/settings', icon: 'fi fi-rr-settings' },
    ],
};

const roleLabels = {
    head_admin: 'Head Admin',
    admin: 'Admin',
    hr: 'HR',
    foreman: 'Foreman',
};

export default function Layout({ children, title }) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const navItems = navByRole[user?.role] || [];
    const currentPath =
        typeof window !== 'undefined'
            ? window.location.pathname.replace(/\/+$/, '') || '/'
            : '/';

    const [showLogoutModal, setShowLogoutModal] = useState(false);

    // ✅ Theme state (persisted)
    const [theme, setTheme] = useState(() => localStorage.getItem('bb_theme') || 'dark');
    const isDark = theme === 'dark';

    // ✅ Apply theme globally to <html>
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('bb_theme', theme);
    }, [theme]);

    const confirmLogout = () => {
        router.post('/logout');
    };

    return (
        <>
            <div
                style={{
                    fontFamily: "'DM Sans', sans-serif",
                    background: 'var(--bg-page)',
                    color: 'var(--text-main)',
                    minHeight: '100vh',
                    height: '100vh',
                    display: 'flex',
                    overflow: 'hidden',
                }}
            >
                <aside
                    style={{
                        width: 240,
                        background: 'var(--bg-sidebar)',
                        borderRight: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '16px 0',
                        flexShrink: 0,
                        height: '100vh',
                        overflowY: 'auto',
                        position: 'sticky',
                        top: 0,
                    }}
                >
                    <div style={{ padding: '12px 16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                background: '#1b8a7a',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Settings size={18} strokeWidth={2.25} color="#fff" />
                        </div>

                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>Fortress System</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{roleLabels[user?.role]}</div>
                        </div>
                    </div>

                    <nav style={{ flex: 1 }}>
                        {navItems.map((item) => {
                            const itemPath = item.href.replace(/\/+$/, '') || '/';
                            const exactOnlyPaths = new Set(['/head-admin', '/admin', '/hr', '/foreman']);
                            const exactOnly = exactOnlyPaths.has(itemPath);
                            const aliasPathsByHref = {
                                '/payroll/run': ['/payroll'],
                                '/payroll/worker-rates': ['/payroll/worker-rates'],
                            };
                            const aliases = aliasPathsByHref[itemPath] || [];
                            const active =
                                currentPath === itemPath ||
                                aliases.includes(currentPath) ||
                                (!exactOnly && itemPath !== '/' && currentPath.startsWith(`${itemPath}/`));

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '9px 16px',
                                        margin: '1px 8px',
                                        borderRadius: 6,
                                        color: active ? 'var(--active-text)' : 'var(--text-muted)',
                                        background: active ? 'var(--active-bg)' : 'transparent',
                                        textDecoration: 'none',
                                        fontSize: 13.5,
                                        fontWeight: 500,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <i className={item.icon} style={{ fontSize: 14 }} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{user?.fullname}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted-2)', marginBottom: 10 }}>{user?.email}</div>

                        <button
                            onClick={() => setShowLogoutModal(true)}
                            style={{
                                background: 'var(--button-bg)',
                                border: '1px solid var(--border-color)',
                                color: '#f87171',
                                borderRadius: 6,
                                padding: '6px 12px',
                                fontSize: 12,
                                cursor: 'pointer',
                                width: '100%',
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </aside>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                    {/* Header (flex + toggle icon) */}
                    <div
                        style={{
                            padding: '14px 24px',
                            borderBottom: '1px solid var(--border-color)',
                            background: 'var(--bg-page)',
                            position: 'sticky',
                            top: 0,
                            zIndex: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 16,
                        }}
                    >
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>

                        <button
                            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                            aria-label="Toggle theme"
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: 'var(--button-bg)',
                                border: '1px solid var(--border-color)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'var(--text-main)',
                            }}
                        >
                            {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{children}</div>
                </div>
            </div>

            {/* Logout Modal */}
            {showLogoutModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            background: 'var(--bg-sidebar)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 10,
                            padding: 24,
                            width: 320,
                            textAlign: 'center',
                            color: 'var(--text-main)',
                        }}
                    >
                        <h3 style={{ marginBottom: 12, color: '#f87171' }}>Confirm Logout</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                            Are you sure you want to logout?
                        </p>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                onClick={confirmLogout}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: '#ef4444',
                                    color: '#fff',
                                    cursor: 'pointer',
                                }}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
