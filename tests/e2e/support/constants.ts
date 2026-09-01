import { loadTestData, TestAccount } from './test-data';

const data = loadTestData();

export const TEST_BASE_URL = 'http://127.0.0.1:8010';
export const VITE_URL = 'http://127.0.0.1:5180';
export const DEMO_PROJECT_ID = 1;
export const DEMO_ACTIVE_PROJECT_ID = 4;
export const DEMO_ACTIVE_PROJECT_LABEL = 'Fortress Building (Construction)';
export const PRIMARY_PUBLIC_TOKEN = data.demo_tokens.primary;
export const CO_FOREMAN_PUBLIC_TOKEN = data.demo_tokens.co_foreman;

export const ACCOUNTS = {
    master_admin: {
        email: data.accounts.master_admin.email,
        password: data.accounts.master_admin.password,
        landingPath: data.accounts.master_admin.landingPath,
        label: data.accounts.master_admin.label,
    },
    head_admin: {
        email: data.accounts.head_admin.email,
        password: data.accounts.head_admin.password,
        landingPath: data.accounts.head_admin.landingPath,
        label: data.accounts.head_admin.label,
    },
    head_admin_2: {
        email: data.accounts.head_admin_2.email,
        password: data.accounts.head_admin_2.password,
        landingPath: data.accounts.head_admin_2.landingPath,
        label: data.accounts.head_admin_2.label,
    },
    admin: {
        email: data.accounts.admin.email,
        password: data.accounts.admin.password,
        landingPath: data.accounts.admin.landingPath,
        label: data.accounts.admin.label,
    },
    hr: {
        email: data.accounts.hr.email,
        password: data.accounts.hr.password,
        landingPath: data.accounts.hr.landingPath,
        label: data.accounts.hr.label,
    },
    foreman: {
        email: data.accounts.foreman.email,
        password: data.accounts.foreman.password,
        landingPath: data.accounts.foreman.landingPath,
        label: data.accounts.foreman.label,
    },
    co_foreman: {
        email: data.accounts.co_foreman.email,
        password: data.accounts.co_foreman.password,
        landingPath: data.accounts.co_foreman.landingPath,
        label: data.accounts.co_foreman.label,
    },
    project_manager: {
        email: data.accounts.project_manager.email,
        password: data.accounts.project_manager.password,
        landingPath: data.accounts.project_manager.landingPath,
        label: data.accounts.project_manager.label,
    },
} as const;

export type RoleKey = Exclude<keyof typeof ACCOUNTS, 'co_foreman'>;
export type AccountKey = keyof typeof ACCOUNTS;

export function getAccountByKey(key: AccountKey): TestAccount {
    const account = ACCOUNTS[key];
    return {
        email: account.email,
        password: account.password,
        role: account.label.replace(' ', '_'),
        fullname: account.label.replace(/\b\w/g, l => l.toUpperCase()),
        landingPath: account.landingPath,
        label: account.label,
    };
}

export function getAllRoleKeys(): RoleKey[] {
    return Object.keys(ACCOUNTS).filter(k => k !== 'co_foreman') as RoleKey[];
}