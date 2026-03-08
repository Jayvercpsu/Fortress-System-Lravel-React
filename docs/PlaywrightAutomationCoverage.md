# Playwright Automation Coverage

This repo now includes a dedicated browser automation layer for the Laravel + React system.

## Runtime

- Config: `playwright.config.ts`
- E2E folder: `tests/e2e`
- Seed data: `database/seeders/BrowserAutomationSeeder.php`
- Dedicated database: `database/playwright.sqlite`

## Demo Accounts

- `headadmin@buildbooks.com` / `password`
- `admin@buildbooks.com` / `password`
- `hr@buildbooks.com` / `password`
- `fortress.foreman@buildbooks.com` / `password`
- `fortress.coforeman@buildbooks.com` / `password`

## Coverage Shape

- Role login and route browsing for `head_admin`, `admin`, `hr`, and `foreman`
- Public browsing for both seeded submit and receipt links
- Permission checks for forbidden pages by role
- Dashboard/report sync checks for payment and expense computations across `head-admin`, `admin`, `hr`, and `reports`
- Workflow coverage for:
- Foreman worker creation
- Head admin project update posting
- HR worker-rate editing
- HR payroll cutoff dropdown pagination with in-dropdown `Load more`
- Projects kanban drag-and-drop phase move and phase dropdown change
- Receipt page open, CSV download, and print action checks
- Profile settings persistence, including profile photo upload
- Foreman self time in/time out plus foreman attendance row add, submit, and edit flows
- Data-table filter coverage for per-page, pagination, and status filters across head-admin, HR, and foreman pages
- Data-table action coverage for:
- Users create/edit/delete
- Project team info, files upload/open/download/delete, and updates posting
- Build expense add/edit/delete
- Materials approve/reject and issues resolve/reopen
- Delivery, progress photo, and weekly accomplishment previews
- Payroll deductions add/delete and manual payroll edit
- Search input coverage for key pages in every role, validated by query param updates

## Run

```bash
npx playwright install chromium
npm run e2e
npx playwright test --project=chromium
```

## Files to Extend

- Route inventory: `tests/e2e/support/routes.ts`
- Auth helpers: `tests/e2e/support/auth.ts`
- Dashboard sync: `tests/e2e/dashboard-sync.spec.ts`
- Table filters: `tests/e2e/table-filters.spec.ts`
- Table actions: `tests/e2e/table-actions.spec.ts`
- Settings/receipts/foreman: `tests/e2e/settings-receipts-foreman.spec.ts`
- Stateful workflows: `tests/e2e/workflows.spec.ts`
