import './bootstrap';
import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

createInertiaApp({
    title: (title) => `${title} - BuildBooks`,
    resolve: (name) => resolvePageComponent(`./Pages/${name}.jsx`, import.meta.glob('./Pages/**/*.jsx')),
    setup({ el, App, props }) {
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
