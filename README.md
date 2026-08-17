🏗️ Fortress System

Built with:

* Laravel 12
* Inertia.js + React
* Tailwind CSS v3.4.x
* MySQL
 

👨‍💻 Developed By

Jayver-Joshua
BroCode-Devs
 
📦 Version

Current Version: `v1.0.0`
Release Type: Initial Stable Release
 

📄 License

This project is licensed under the MIT License.

You are free to use, modify, and distribute this software with proper attribution.
 
🔐 LOGIN CREDENTIALS

Email - headadmin@buildbooks.com
Pass - password
Role - Head Admin 

foreman account 
email jayjay@gmail.com
pass jayjay@gmail.com123

> Head Admin creates all other users from the dashboard.
 

🚀 RUNNING THE PROJECT LOCALLY

### Prerequisites

* PHP >= 8.2
* Composer
* Node.js (with npm)
* MySQL (or SQLite for a zero-config start — see step 2)

### Step-by-step setup

1. **Install PHP dependencies**
   ```bash
   composer install
   ```

2. **Create and configure the environment file**
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```
   The default config uses **SQLite** — create the database file:
   ```bash
   touch database/database.sqlite
   ```
   To use **MySQL** instead, edit `.env` and set:
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=fortress
   DB_USERNAME=root
   DB_PASSWORD=yourpassword
   ```

3. **Install frontend dependencies**
   ```bash
   npm install
   ```

4. **Migrate and seed the database**
   ```bash
   php artisan migrate --seed
   ```
   This creates the tables and seeds the default accounts (see login credentials below).

5. **Start the app** (server + queue worker + Vite dev server in one command)
   ```bash
   composer dev
   ```
   Then open **http://localhost:8000**.

   Prefer separate terminals? Run these instead:
   ```bash
   php artisan serve
   php artisan queue:listen --tries=1 --timeout=0
   npm run dev
   ```

6. **(Optional) One-shot setup** — the composer `setup` script runs steps 1–4 plus a production frontend build:
   ```bash
   composer setup
   ```

> 💡 The queue worker matters: the queue connection is `database`, so jobs won't process until `queue:listen` (or `queue:work`) is running.

📌 QUICK REFERENCE — WHAT EACH ROLE SEES

| Role       | Pages              | Can Do                                                            |
| ---------- | ------------------ | ----------------------------------------------------------------- |
| Head Admin | Dashboard, Users   | View stats, Create/Delete users                                   |
| Admin      | Dashboard          | View project/submission stats                                     |
| HR         | Dashboard, Payroll | Add payroll entries, update status                                |
| Foreman    | Dashboard          | Submit attendance, accomplishments, materials, issues, deliveries |

UI AUTOMATION (PLAYWRIGHT)

Install browser runtime:
`npx playwright install chromium`

Run tests:
`npm run e2e`

Run headed:
`npm run e2e:headed`

Open Playwright UI:
`npm run e2e:ui`

 
