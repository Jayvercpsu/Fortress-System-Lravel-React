# Form Input Standards

## 🎯 Purpose

To maintain consistency, validation control, and reusable UI behavior across the system,
all form input elements must use shared custom components.

## ✅ Required Rule

Always use custom input components instead of native HTML elements.

---

# Code Change Verification

## 🎯 Purpose

Every code change must be syntax-checked before it is considered complete, so errors never
ship silently to the user.

## ✅ Required Rules

1. **After every change, run a syntax check on the files you touched:**
   - PHP: `php -l <file>` for each changed `.php` file.
   - JS/JSX/TS: run the project's build (`npm run build`) or the relevant linter/typecheck.
   - Blade/React components: rely on the build above; fix any compile errors.
2. **Run the relevant test suite when the change is non-trivial** (e.g. new logic, changed
   queries, new migrations). The PHPUnit suite runs against an in-memory SQLite DB and is
   safe to run.
3. **Fix any syntax/type/build errors you introduced before finishing** — a change is only
   done when it passes its own checks.

---

# Migration Console Output

## 🎯 Purpose

Migrations that print progress/summaries must do so without referencing `$this->command`,
which Laravel never sets on migration classes (the base `Migration` class only declares
`$connection` and `$withinTransaction`).

## ✅ Required Rules

1. **Never use `$this->command` inside a migration** — it is an undefined property that
   triggers warnings and (in tests, where warnings become exceptions) failures. Use it only
   in Seeders, which do receive a `$command` property.
2. **Write migration output straight to STDOUT**, e.g.:
   ```php
   private function write(string $message): void
   {
       if (! app()->runningInConsole() || app()->runningUnitTests()) {
           return;
       }

       fwrite(STDOUT, $message.PHP_EOL);
   }
   ```
   The `runningUnitTests()` guard keeps the PHPUnit output clean (migrations run via
   RefreshDatabase on every test class).
3. **Reuse the helper pattern** (e.g. `info()`, `warn()`, `table()` delegating to `write()`)
   instead of duplicating raw `fwrite` calls.

---

# Database Safety

## 🎯 Purpose

The agent must never run a command that modifies, deletes, or resets database data — or any
project data files — without the user's explicit, case-by-case approval.

## ✅ Required Rules

1. **Ask before any data-mutating command.** Do not run (or suggest running) commands that
   INSERT, UPDATE, DELETE, TRUNCATE, DROP, or ALTER database data unless the user explicitly
   asked for that exact operation.

2. **Treat these as destructive for this project — always ask the user first:**
   - `php artisan migrate:fresh` / `migrate:fresh --seed` (drops every table, including `users`)
   - `php artisan db:wipe` / `db:seed` (wipes or rewrites table data)
   - `php artisan db:seed --class=FortressBuildingFlowSeeder` (truncates all project data)
   - `php artisan migrate:rollback` / `migrate:refresh` / `migrate:down`
   - `php artisan tinker` (or `--execute`) that writes or deletes records
   - raw `mysql`, `sqlite3`, or `php artisan db` commands that mutate data
   - deleting, moving, or overwriting files under `storage/`, `database/`, or `public/` that hold
     user-uploaded or seeded data (e.g. `storage/app/public`)

3. **Read-only commands are fine without permission:** `php -l`, `migrate:status`, `route:list`,
   `config:show`, SELECT/count queries via tinker, `npm run build`, and the PHPUnit test suite
   (which runs against an in-memory SQLite DB per `phpunit.xml` — it never touches the real
   MySQL `fortress` database).

4. **Never verify a destructive change by running it.** If verification is needed, ask the user to
   run the command themselves, use a dedicated throwaway test database, or rely on read-only checks.

## ⚠️ Project-Specific Notes

- The real database is MySQL `fortress` (see `.env`). The PHPUnit suite uses an in-memory SQLite DB;
  the Playwright e2e suite uses `database/playwright.sqlite`.
- `FortressBuildingFlowSeeder` truncates every table except `users`, `user_details`, and `migrations`.
  It is destructive and not idempotent — it will destroy existing project data.
- `DatabaseSeeder` only creates the master admin and head admin accounts; all demo users, foremen,
  workers, and project data come from `FortressBuildingFlowSeeder`.
