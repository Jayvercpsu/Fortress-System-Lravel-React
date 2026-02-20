import { Link, router } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';

const navByRole = {
    head_admin: [
        { label: 'Dashboard', href: '/head-admin', icon: '⊞' },
        { label: 'Users', href: '/users', icon: '👤' },
    ],
    admin: [
        { label: 'Dashboard', href: '/admin', icon: '⊞' },
    ],
    hr: [
        { label: 'Dashboard', href: '/hr', icon: '⊞' },
        { label: 'Payroll', href: '/payroll', icon: '💳' },
    ],
    foreman: [
        { label: 'Dashboard', href: '/foreman', icon: '🏗️' },
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

    const logout = () => router.post('/logout');

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#0d1117', color: '#e6edf3', minHeight: '100vh', display: 'flex' }}>
            <aside style={{ width: 240, background: '#161b22', borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column', padding: '16px 0', flexShrink: 0, height: '100vh', overflowY: 'auto', position: 'sticky', top: 0 }}>
                <div style={{ padding: '12px 16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, background: '#1b8a7a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏗️</div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>BuildBooks</div>
                        <div style={{ fontSize: 11, color: '#8b949e' }}>{roleLabels[user?.role]}</div>
                    </div>
                </div>

                <nav style={{ flex: 1 }}>
                    {navItems.map(item => {
                        const active = window.location.pathname === item.href;
                        return (
                            <Link key={item.href} href={item.href} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 16px', margin: '1px 8px', borderRadius: 6,
                                color: active ? '#4ade80' : '#8b949e',
                                background: active ? '#1f2d1f' : 'transparent',
                                textDecoration: 'none', fontSize: 13.5, fontWeight: 500,
                                transition: 'all 0.15s',
                            }}>
                                <span>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div style={{ padding: '12px 16px', borderTop: '1px solid #30363d' }}>
                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>{user?.fullname}</div>
                    <div style={{ fontSize: 11, color: '#6e7681', marginBottom: 10 }}>{user?.email}</div>
                    <button onClick={logout} style={{ background: '#21262d', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', width: '100%' }}>
                        Logout
                    </button>
                </div>
            </aside>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '14px 24px', borderBottom: '1px solid #30363d', background: '#0d1117', fontSize: 16, fontWeight: 600, color: '#e6edf3' }}>
                    {title}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                    {children}
                </div>
            </div>
        </div>
    );
}