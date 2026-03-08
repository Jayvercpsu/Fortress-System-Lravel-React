import { test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID, RoleKey } from './support/constants';
import { SearchCase, verifySearch } from './support/search';

const searchValue = 'fortress';
const emptySearchValue = 'zzzz';

const headAdminSearchCases: SearchCase[] = [
    { name: 'Projects board', path: '/projects', placeholder: 'Search projects...', queryParam: 'search', value: searchValue, mode: 'submit' },
    { name: 'Attendance logs', path: '/attendance', placeholder: 'Search attendance logs...', queryParam: 'search', value: searchValue },
    { name: 'Attendance summary', path: '/attendance/summary', placeholder: 'Search cutoff summary...', queryParam: 'search', value: searchValue },
    { name: 'Materials requests', path: '/materials', placeholder: 'Search material requests...', queryParam: 'search', value: searchValue },
    { name: 'Delivery confirmations', path: '/delivery', placeholder: 'Search deliveries...', queryParam: 'search', value: searchValue },
    { name: 'Issue reports', path: '/issues', placeholder: 'Search issues...', queryParam: 'search', value: searchValue },
    { name: 'Progress photos', path: '/progress-photos', placeholder: 'Search foreman, project, or caption...', queryParam: 'search', value: searchValue },
    { name: 'Weekly accomplishments', path: '/weekly-accomplishments', placeholder: 'Search weekly accomplishments...', queryParam: 'search', value: searchValue },
    { name: 'Users', path: '/users', placeholder: 'Search users...', queryParam: 'search', value: searchValue },
    { name: 'Worker rates', path: '/payroll/worker-rates', placeholder: 'Search workers / foreman...', queryParam: 'search', value: searchValue },
    { name: 'Payroll run', path: '/payroll/run', placeholder: 'Search payroll rows...', queryParam: 'search', value: searchValue },
    { name: 'Manual payroll', path: '/payroll', placeholder: 'Search payroll entries...', queryParam: 'search', value: emptySearchValue, mode: 'client', emptyMessage: 'No payroll entries yet.' },
    { name: 'Project payments', path: `/projects/${DEMO_PROJECT_ID}/payments`, placeholder: 'Search payments...', queryParam: 'search', value: searchValue },
    { name: 'Project expenses', path: `/projects/${DEMO_PROJECT_ID}/build?tab=expenses`, placeholder: 'Search expenses...', queryParam: 'expense_search', value: searchValue },
    { name: 'Project team', path: `/projects/${DEMO_PROJECT_ID}?tab=overview`, placeholder: 'Search project workers...', queryParam: 'team_search', value: searchValue },
    { name: 'Project files', path: `/projects/${DEMO_PROJECT_ID}?tab=files`, placeholder: 'Search files...', queryParam: 'files_search', value: searchValue },
    { name: 'Project updates', path: `/projects/${DEMO_PROJECT_ID}?tab=updates`, placeholder: 'Search updates...', queryParam: 'updates_search', value: searchValue },
];

const adminSearchCases: SearchCase[] = [
    { name: 'Projects board', path: '/projects', placeholder: 'Search projects...', queryParam: 'search', value: searchValue, mode: 'submit' },
    { name: 'Attendance logs', path: '/attendance', placeholder: 'Search attendance logs...', queryParam: 'search', value: searchValue },
    { name: 'Attendance summary', path: '/attendance/summary', placeholder: 'Search cutoff summary...', queryParam: 'search', value: searchValue },
    { name: 'Materials requests', path: '/materials', placeholder: 'Search material requests...', queryParam: 'search', value: searchValue },
    { name: 'Delivery confirmations', path: '/delivery', placeholder: 'Search deliveries...', queryParam: 'search', value: searchValue },
    { name: 'Issue reports', path: '/issues', placeholder: 'Search issues...', queryParam: 'search', value: searchValue },
    { name: 'Progress photos', path: '/progress-photos', placeholder: 'Search foreman, project, or caption...', queryParam: 'search', value: searchValue },
    { name: 'Weekly accomplishments', path: '/weekly-accomplishments', placeholder: 'Search weekly accomplishments...', queryParam: 'search', value: searchValue },
    { name: 'Project expenses', path: `/projects/${DEMO_PROJECT_ID}/build?tab=expenses`, placeholder: 'Search expenses...', queryParam: 'expense_search', value: searchValue },
    { name: 'Project team', path: `/projects/${DEMO_PROJECT_ID}?tab=overview`, placeholder: 'Search project workers...', queryParam: 'team_search', value: searchValue },
    { name: 'Project files', path: `/projects/${DEMO_PROJECT_ID}?tab=files`, placeholder: 'Search files...', queryParam: 'files_search', value: searchValue },
    { name: 'Project updates', path: `/projects/${DEMO_PROJECT_ID}?tab=updates`, placeholder: 'Search updates...', queryParam: 'updates_search', value: searchValue },
];

const hrSearchCases: SearchCase[] = [
    { name: 'Payroll run', path: '/payroll/run', placeholder: 'Search payroll rows...', queryParam: 'search', value: searchValue },
    { name: 'Worker rates', path: '/payroll/worker-rates', placeholder: 'Search workers / foreman...', queryParam: 'search', value: searchValue },
    { name: 'Manual payroll', path: '/payroll', placeholder: 'Search payroll entries...', queryParam: 'search', value: emptySearchValue, mode: 'client', emptyMessage: 'No payroll entries yet.' },
    { name: 'Project payments', path: `/projects/${DEMO_PROJECT_ID}/payments`, placeholder: 'Search payments...', queryParam: 'search', value: searchValue },
];

const foremanSearchCases: SearchCase[] = [
    { name: 'Foreman workers', path: '/foreman/workers', placeholder: 'Search workers...', queryParam: 'search', value: searchValue },
    { name: 'Foreman attendance', path: '/foreman/attendance', placeholder: 'Search my attendance...', queryParam: 'search', value: searchValue },
];

const searchCoverage: Record<RoleKey, SearchCase[]> = {
    head_admin: headAdminSearchCases,
    admin: adminSearchCases,
    hr: hrSearchCases,
    foreman: foremanSearchCases,
};

for (const role of Object.keys(searchCoverage) as RoleKey[]) {
    test(`${role} search inputs update query params`, async ({ page }) => {
        await loginAs(page, role);

        for (const searchCase of searchCoverage[role]) {
            await test.step(`Search on ${searchCase.name}`, async () => {
                await verifySearch(page, searchCase);
            });
        }
    });
}
