import { DEMO_PROJECT_ID, PRIMARY_PUBLIC_TOKEN, CO_FOREMAN_PUBLIC_TOKEN, RoleKey } from './constants';

export type RouteExpectation = {
    name: string;
    path: string;
    bodyText: string | RegExp;
};

export const routeCoverage: Record<RoleKey, RouteExpectation[]> = {
    head_admin: [
        { name: 'Head admin dashboard', path: '/head-admin', bodyText: 'Head Admin Dashboard' },
        { name: 'Projects board', path: '/projects', bodyText: 'Fortress Building' },
        { name: 'Project overview', path: `/projects/${DEMO_PROJECT_ID}`, bodyText: 'Project - Fortress Building' },
        { name: 'Project files tab', path: `/projects/${DEMO_PROJECT_ID}?tab=files`, bodyText: 'Upload Plan/File' },
        { name: 'Project updates tab', path: `/projects/${DEMO_PROJECT_ID}?tab=updates`, bodyText: 'Add Remark/Update' },
        { name: 'Project create form', path: '/projects/create', bodyText: 'Create Project' },
        { name: 'Project edit form', path: `/projects/${DEMO_PROJECT_ID}/edit`, bodyText: 'Edit Project - Fortress Building' },
        { name: 'Design tracker', path: `/projects/${DEMO_PROJECT_ID}/design`, bodyText: `Design Tracker - Project #${DEMO_PROJECT_ID}` },
        { name: 'Build tracker', path: `/projects/${DEMO_PROJECT_ID}/build`, bodyText: `Build Tracker - Project #${DEMO_PROJECT_ID}` },
        { name: 'Expenses tab', path: `/projects/${DEMO_PROJECT_ID}/build?tab=expenses`, bodyText: 'Add Expense' },
        { name: 'Monitoring board', path: `/projects/${DEMO_PROJECT_ID}/monitoring`, bodyText: `Monitoring Board - Project #${DEMO_PROJECT_ID}` },
        { name: 'Payments page', path: `/projects/${DEMO_PROJECT_ID}/payments`, bodyText: 'Payments - Fortress Building' },
        { name: 'Financials page', path: `/projects/${DEMO_PROJECT_ID}/financials`, bodyText: 'Project Financials - Fortress Building' },
        { name: 'Attendance logs', path: '/attendance', bodyText: 'Attendance Logs' },
        { name: 'Attendance summary', path: '/attendance/summary', bodyText: 'Attendance Cutoff Summary' },
        { name: 'Payroll run', path: '/payroll/run', bodyText: 'Payroll Run' },
        { name: 'Materials page', path: '/materials', bodyText: 'Materials / Requests' },
        { name: 'Delivery page', path: '/delivery', bodyText: 'Delivery Confirmations' },
        { name: 'Issues page', path: '/issues', bodyText: 'Issue Reports' },
        { name: 'Progress photos page', path: '/progress-photos', bodyText: 'Progress Photos' },
        { name: 'Reports page', path: '/reports', bodyText: 'Reports / Project Profitability' },
        { name: 'Weekly accomplishments page', path: '/weekly-accomplishments', bodyText: 'Weekly Accomplishments' },
        { name: 'Users page', path: '/users', bodyText: 'User Management' },
        { name: 'Settings page', path: '/settings', bodyText: 'Account Settings' },
    ],
    admin: [
        { name: 'Admin dashboard', path: '/admin', bodyText: 'Admin Dashboard' },
        { name: 'Projects board', path: '/projects', bodyText: 'Fortress Building' },
        { name: 'Project overview', path: `/projects/${DEMO_PROJECT_ID}`, bodyText: 'Project - Fortress Building' },
        { name: 'Design tracker', path: `/projects/${DEMO_PROJECT_ID}/design`, bodyText: `Design Tracker - Project #${DEMO_PROJECT_ID}` },
        { name: 'Build tracker', path: `/projects/${DEMO_PROJECT_ID}/build`, bodyText: `Build Tracker - Project #${DEMO_PROJECT_ID}` },
        { name: 'Expenses tab', path: `/projects/${DEMO_PROJECT_ID}/build?tab=expenses`, bodyText: 'Add Expense' },
        { name: 'Monitoring board', path: `/projects/${DEMO_PROJECT_ID}/monitoring`, bodyText: `Monitoring Board - Project #${DEMO_PROJECT_ID}` },
        { name: 'Attendance logs', path: '/attendance', bodyText: 'Attendance Logs' },
        { name: 'Attendance summary', path: '/attendance/summary', bodyText: 'Attendance Cutoff Summary' },
        { name: 'Materials page', path: '/materials', bodyText: 'Materials / Requests' },
        { name: 'Delivery page', path: '/delivery', bodyText: 'Delivery Confirmations' },
        { name: 'Issues page', path: '/issues', bodyText: 'Issue Reports' },
        { name: 'Progress photos page', path: '/progress-photos', bodyText: 'Progress Photos' },
        { name: 'Reports page', path: '/reports', bodyText: 'Reports / Project Profitability' },
        { name: 'Weekly accomplishments page', path: '/weekly-accomplishments', bodyText: 'Weekly Accomplishments' },
        { name: 'Settings page', path: '/settings', bodyText: 'Account Settings' },
    ],
    hr: [
        { name: 'HR dashboard', path: '/hr', bodyText: 'HR Dashboard' },
        { name: 'Payroll run page', path: '/payroll/run', bodyText: 'Payroll Run' },
        { name: 'Worker rates page', path: '/payroll/worker-rates', bodyText: 'HR Worker Rate Management' },
        { name: 'Manual payroll page', path: '/payroll', bodyText: 'Payroll Management' },
        { name: 'Project payments page', path: `/projects/${DEMO_PROJECT_ID}/payments`, bodyText: 'Payments - Fortress Building' },
        { name: 'Project financials page', path: `/projects/${DEMO_PROJECT_ID}/financials`, bodyText: 'Project Financials - Fortress Building' },
        { name: 'Settings page', path: '/settings', bodyText: 'Account Settings' },
    ],
    foreman: [
        { name: 'Foreman dashboard', path: '/foreman', bodyText: 'Open Submissions' },
        { name: 'Foreman submissions page', path: '/foreman/submissions', bodyText: 'Foreman Submissions' },
        { name: 'Foreman workers page', path: '/foreman/workers', bodyText: 'Add Worker' },
        { name: 'Foreman attendance page', path: '/foreman/attendance', bodyText: 'Daily Attendance' },
        { name: 'Settings page', path: '/settings', bodyText: 'Account Settings' },
    ],
};

export const forbiddenCoverage: Record<RoleKey, string[]> = {
    head_admin: [],
    admin: [
        '/payroll/run',
        `/projects/${DEMO_PROJECT_ID}/financials`,
        `/projects/${DEMO_PROJECT_ID}/payments`,
        `/projects/${DEMO_PROJECT_ID}/edit`,
        '/users',
        '/projects/create',
    ],
    hr: [
        '/projects',
        '/attendance',
        '/reports',
        '/weekly-accomplishments',
    ],
    foreman: [
        '/projects',
        '/attendance',
        '/payroll/run',
        '/users',
    ],
};

export const publicCoverage: RouteExpectation[] = [
    {
        name: 'Primary public submit page',
        path: `/progress-submit/${PRIMARY_PUBLIC_TOKEN}`,
        bodyText: 'Daily Attendance',
    },
    {
        name: 'Primary public receipt page',
        path: `/progress-receipt/${PRIMARY_PUBLIC_TOKEN}`,
        bodyText: 'Fortress Building',
    },
    {
        name: 'Co-foreman public submit page',
        path: `/progress-submit/${CO_FOREMAN_PUBLIC_TOKEN}`,
        bodyText: 'Daily Attendance',
    },
    {
        name: 'Co-foreman public receipt page',
        path: `/progress-receipt/${CO_FOREMAN_PUBLIC_TOKEN}`,
        bodyText: 'Fortress Building',
    },
];
