export const TEST_BASE_URL = 'http://127.0.0.1:8010';
export const VITE_URL = 'http://127.0.0.1:5180';
export const DEMO_PROJECT_ID = 1;
export const DEMO_ACTIVE_PROJECT_ID = 4;
export const DEMO_ACTIVE_PROJECT_LABEL = 'Fortress Building (Construction)';
export const PRIMARY_PUBLIC_TOKEN = 'fortress-building-main-demo-token';
export const CO_FOREMAN_PUBLIC_TOKEN = 'fortress-building-co-demo-token';

export const ACCOUNTS = {
    head_admin: {
        email: 'headadmin@buildbooks.com',
        password: 'password',
        landingPath: '/head-admin',
        label: 'head admin',
    },
    admin: {
        email: 'admin@buildbooks.com',
        password: 'password',
        landingPath: '/admin',
        label: 'admin',
    },
    hr: {
        email: 'hr@buildbooks.com',
        password: 'password',
        landingPath: '/hr',
        label: 'hr',
    },
    foreman: {
        email: 'fortress.foreman@buildbooks.com',
        password: 'password',
        landingPath: '/foreman',
        label: 'foreman',
    },
    co_foreman: {
        email: 'fortress.coforeman@buildbooks.com',
        password: 'password',
        landingPath: '/foreman',
        label: 'co-foreman',
    },
} as const;

export type RoleKey = Exclude<keyof typeof ACCOUNTS, 'co_foreman'>;
export type AccountKey = keyof typeof ACCOUNTS;
