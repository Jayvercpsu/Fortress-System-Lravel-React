import './bootstrap';
import 'react-datepicker/dist/react-datepicker.css';
import '../css/app.css';
import { createInertiaApp, router } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import Layout from './Components/Layout';

// Pages rendered without the app shell (login, public Jotform pages, error page).
const STANDALONE_PAGES = new Set([
    'Auth/Login',
    'Auth/ClientLogin',
    'Public/ProgressSubmit',
    'Public/ProgressReceipt',
    'Errors/NotFound',
]);

const pageModules = import.meta.glob('./Pages/**/*.jsx', { eager: true });

if (typeof window !== 'undefined') {
    const savedTheme = window.localStorage.getItem('bb_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // After login, session()->regenerate() rotates the session ID.  Inertia
    // only issues partial reloads so the HTML shell (and the meta CSRF token)
    // is never re-rendered.  Sync the fresh token from the server-provided
    // page props back into the meta tag so that raw fetch() calls always
    // send a valid CSRF token.
    router.on('success', (event) => {
        const token = event?.detail?.page?.props?.csrf_token;
        if (token) {
            const meta = document.querySelector('meta[name="csrf-token"]');
            if (meta && meta.getAttribute('content') !== token) {
                meta.setAttribute('content', token);
            }
        }
    });
}

createInertiaApp({
    title: (title) => `${title} - BuildBooks`,
    resolve: (name) => {
        const page = pageModules[`./Pages/${name}.jsx`];
        const Page = page?.default;
        // Persistent layout: Layout stays mounted across navigations so the sidebar
        // (logo, profile photo) is never recreated and never flickers.
        if (Page && !STANDALONE_PAGES.has(name) && !Page.layout) {
            Page.layout = (pageNode) => <Layout>{pageNode}</Layout>;
        }
        return page;
    },
    setup({ el, App, props }) {
        if (typeof window !== 'undefined') {
            const timezone = props?.initialPage?.props?.app?.timezone;
            if (timezone) {
                window.__APP_TIMEZONE = timezone;
            }
        }

        createRoot(el).render(
            <>
                <App {...props} />
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: 'var(--toast-bg)',
                            color: 'var(--toast-text)',
                            border: '1px solid var(--toast-border)',
                            fontSize: '13px',
                        },
                        success: {
                            style: {
                                background: 'var(--toast-success-bg)',
                                border: '1px solid var(--toast-success-border)',
                            },
                        },
                        error: {
                            style: {
                                background: 'var(--toast-error-bg)',
                                border: '1px solid var(--toast-error-border)',
                            },
                        },
                    }}
                />
            </>
        );
    },
    progress: { color: '#2ea043' },
});
