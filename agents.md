# Form Input Standards

## 🎯 Migration Output Purpose

To maintain consistency, validation control, and reusable UI behavior across the system,
all form input elements must use shared custom components.

## ✅ Required Rule

Always use custom input components instead of native HTML elements.

---

## Code Change Verification

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
4. **Every code change that touches a layer must be covered by a test in that layer — before
   finishing, add or update tests for the files you changed:**
   - **Backend (`.php` files — controllers, services, repositories, models, migrations,
     routes):** add or update a PHPUnit feature test in `tests/Feature/` (or `tests/Unit/` for
     pure logic). Assert the behavior: page loads, payload props, role access, mutation flows.
   - **Frontend (`.jsx`/`.ts`/`.tsx`/`resources/js` files — pages, components, behavior):**
     add or update a Playwright e2e spec in `tests/e2e/`. Assert the user-visible behavior and
     content the change affects.
   - **Both layers changed:** add both the backend and frontend test.
   - If the change fixes a bug, write/update a test that reproduces the bug first (red), then
     make it green with the fix.
   - A change is only done when its new/updated tests pass alongside the full relevant suite.

---

## Migration Console Output

## 🎯 Database Safety Purpose

Migrations that print progress/summaries must do so without referencing `$this->command`,
which Laravel never sets on migration classes (the base `Migration` class only declares
`$connection` and `$withinTransaction`).

## ✅ Migration Output Rules

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

## Database Safety

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

---

## Code Quality: No Unused Code

## 🎯 Purpose

Prevent dead code, unused variables, imports, and functions from accumulating in the codebase,
which increases bundle size, reduces readability, and creates maintenance burden.

## ✅ Required Rules

1. **No unused variables** — Every declared variable must be used. Remove or prefix with `_` if intentionally unused (e.g., `_` in destructuring).

2. **No unused imports** — Every import must be referenced. Remove unused imports immediately.

3. **No dead functions/components** — If a function, component, or class is no longer called/rendered, delete it. Do not leave it "for future use."

4. **No commented-out code** — Delete instead of commenting. Use version control for history.

5. **Verify during changes** — When editing a file, scan for and remove any unused code you encounter in the modified scope.

6. **Lint/typecheck catches this** — The build/lint step (Rule 1 in Code Change Verification) should surface unused code. Fix warnings before finishing.

---

## Git Rules

## 🎯 Purpose

Prevent accidental commits and keep the user in full control of version control.

## ✅ Required Rules

1. **Never auto-commit.** Do not run `git commit` or `git add` unless the user explicitly asks for it. Make the code changes, verify them, and leave committing to the user.
