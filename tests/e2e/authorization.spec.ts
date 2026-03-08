import { test } from '@playwright/test';
import { ACCOUNTS, RoleKey } from './support/constants';
import { loginAs } from './support/auth';
import { expectForbidden } from './support/navigation';
import { forbiddenCoverage } from './support/routes';

const roles = (Object.keys(forbiddenCoverage) as RoleKey[]).filter((role) => forbiddenCoverage[role].length > 0);

for (const role of roles) {
    test(`${ACCOUNTS[role].label} is blocked from restricted pages`, async ({ page }) => {
        await test.step(`Go to the login page and login as ${ACCOUNTS[role].label}`, async () => {
            await loginAs(page, role);
        });

        for (const path of forbiddenCoverage[role]) {
            await test.step(`Verify ${path} is forbidden for ${ACCOUNTS[role].label}`, async () => {
                await expectForbidden(page, path);
            });
        }
    });
}
