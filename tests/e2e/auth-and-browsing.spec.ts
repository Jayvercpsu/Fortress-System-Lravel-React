import { test } from '@playwright/test';
import { ACCOUNTS, RoleKey } from './support/constants';
import { loginAs } from './support/auth';
import { publicCoverage, routeCoverage } from './support/routes';
import { visitRoute } from './support/navigation';

const roles = Object.keys(routeCoverage) as RoleKey[];

for (const role of roles) {
    test(`${ACCOUNTS[role].label} can browse every assigned page`, async ({ page }) => {
        await test.step(`Go to the login page and login as ${ACCOUNTS[role].label}`, async () => {
            await loginAs(page, role);
        });

        for (const route of routeCoverage[role]) {
            await test.step(`Browse ${route.name}`, async () => {
                await visitRoute(page, route);
            });
        }
    });
}

test('Public progress pages load for both demo tokens', async ({ page }) => {
    for (const route of publicCoverage) {
        await test.step(`Browse ${route.name}`, async () => {
            await visitRoute(page, route);
        });
    }
});
