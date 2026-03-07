# Fortress Building Demo Flow

This repo now includes a dedicated seeder for a complete demo project flow:

- Seeder: `database/seeders/FortressBuildingFlowSeeder.php`
- Project name: `Fortress Building`

## Accounts

- `headadmin@buildbooks.com` / `password`
- `fortress.foreman@buildbooks.com` / `password`
- `fortress.coforeman@buildbooks.com` / `password`

## Public Flow URLs

- Submit form: `/progress-submit/fortress-building-main-demo-token`
- Receipt: `/progress-receipt/fortress-building-main-demo-token`
- Co-foreman submit form: `/progress-submit/fortress-building-co-demo-token`
- Co-foreman receipt: `/progress-receipt/fortress-building-co-demo-token`

## What Gets Seeded

- Project master record with design/build financials
- Project assignments for two foremen
- Project scopes with scope photos
- Workers assigned to each foreman
- Foreman attendance and worker attendance across two weeks
- Weekly accomplishments tied to the project
- Material requests, issue reports, delivery confirmations, and progress photos
- Payments, expenses, project files, and project updates
- Payroll cutoff plus deduction items for the active week

## Run

```bash
php artisan db:seed --class=Database\\Seeders\\FortressBuildingFlowSeeder
```

## Suggested Walkthrough

1. Open the project as head admin and inspect the budget, files, updates, scopes, and connected records.
2. Log in as the demo foreman and review dashboard, workers, attendance, and submissions.
3. Open the public submit and receipt links to review the end-to-end jotform flow tied to the same project.
