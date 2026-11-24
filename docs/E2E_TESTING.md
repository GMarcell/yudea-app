# End-to-End Testing

The end-to-end suite drives the real Next.js application in Chromium with a **real database and
a real login**. It verifies the things unit tests cannot: that the proxy redirects work, that
API guards run in the deployed stack, that TanStack Query hydrates the tables with live data,
and that the role-specific UI is correct after an actual `signIn()`.

Unit and component tests are covered in
[docs/PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) §9.1 and are run with `npm test`.
This document covers Playwright only.

---

## 1. What is in the suite

| File | Coverage | Database |
|---|---|---|
| `e2e/full-app.spec.ts` | Auth redirect, admin dashboard counts, master-data pages, coordinator region scoping and sidebar RBAC, legacy `/dashboard/evets` redirect | Real, read-only |
| `e2e/authz-api.spec.ts` | Server-side authorisation via direct API calls: unauthenticated `401`, wrong-password login, coordinator list/single-record scoping (`404`/`403`), role guards on attendance/users, duplicate attendance and user-email `409`s (total unchanged) | Real, read-only |
| `e2e/exports.spec.ts` | XLSX and PDF downloads: captures the browser download, parses the workbook (sheet name, headers, row count) and checks the PDF header/EOF trailer. Covers all four XLSX exporters (report, birthday, pelkat, region) and the report PDF | Real, read-only |
| `e2e/user-admin.spec.ts` | Last-admin protection (demoting the final admin blocked, demoting one of two allowed, self-delete refused) and the six-character password policy at the UI level | Real for last-admin (probe user created and deleted); APIs mocked for password policy |
| `e2e/dialogs.spec.ts` | Family and member dialog create/update/delete flows, validation, province/regency/district cascade | APIs mocked; real login |
| `e2e/sort.spec.ts` | Every sortable table: URL persistence, asc/desc toggle, reload restore | Real, read-only |
| `e2e/helpers.ts` | Shared login, seeded credentials, sortable-page table, sort helpers | — |
| `playwright.config.ts` | Chromium project, `baseURL`, HTML reporter, dev-server boot | — |

The suite deliberately mixes two strategies:

- **Real database** — proves the guards and queries against actual Prisma data. They are
  safe to re-run: all are read-only except `user-admin.spec.ts`, which creates one uniquely
  named probe admin and deletes it in `finally`.
- **Mocked APIs** (`dialogs.spec.ts`, the password-policy half of `user-admin.spec.ts`) —
  proves UI behaviour that would otherwise create and delete records on every run. They still
  log in for real, because auth is enforced by the proxy and cannot be mocked away.

---

## 2. Prerequisites

- Node.js 20+ and `npm ci` completed.
- The Chromium browser for Playwright:
  `npx playwright install chromium` (add `--with-deps` on a bare Linux host).
- A **throwaway local PostgreSQL database** that you can wipe.
- `DATABASE_URL` and `DIRECT_URL` exported in the shell that runs Playwright, and the
  Prisma client generated (`npx prisma generate`).

> **Do not run the suite against the shared/hosted database.** The repository's default `.env`
> may point at a remote Neon instance, and the seed's `--reset` wipes data. Use a local
> database, as below.

### 2.1 Set up a local database

```bash
docker run -d --name yudea-e2e-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=yudea_e2e \
  -p 5433:5432 postgres:16-alpine

export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/yudea_e2e"
export DIRECT_URL="$DATABASE_URL"

npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts --reset
```

Port 5433 avoids clashing with a local Postgres on 5432. If you use the project's own `.env`,
make sure both variables point at the local database before seeding.

Seed accounts the specs use:

| Account | Password | Role | Used by |
|---|---|---|---|
| `admin@example.com` | `admin123` | `ADMIN` | every spec |
| `coordinator-a@example.com` | `coordinator123` | `COORDINATOR` (region A) | `full-app`, `authz-api` |
| `demo@example.com` | `demo1234` | `STAFF` | available, not used by the suite |

The seed also creates `coordinator-b`/`coordinator-c` and three regions with families and
members. Specs rely on there being **at least two regions** and on the coordinator having a
region assignment.

---

## 3. Running the suite

```bash
npm run test:e2e              # all specs
npm run test:e2e:ui           # Playwright UI mode (watch, time-travel)
npx playwright test e2e/authz-api.spec.ts
npx playwright test -g "coordinator"      # filter by title
npx playwright test --headed              # watch the browser
npx playwright test --debug               # step through with Inspector
npx playwright show-report                # open the last HTML report
```

`playwright.config.ts` starts `npm run dev` on port 3000 and reuses an already-running server
unless `CI` is set. First hits compile routes on demand, which is why timeouts are generous.

### 3.1 CI behaviour

There is no CI pipeline checked into this repository. If you add one, the config already
switches to CI-safe defaults when `CI=true`:

- `forbidOnly: true` — a stray `test.only` fails the run instead of silently skipping tests.
- `retries: 2`, `workers: 1` — serial execution, which also avoids exhausting a small
  serverless database's connection pool.
- `reuseExistingServer: false` — Playwright always boots its own server.

A CI job needs a PostgreSQL service (migrations plus `tsx prisma/seed.ts --reset`), the
Chromium install step, and the environment variables above. Upload `playwright-report/` and
`test-results/` as artifacts on failure; the report contains traces for retried tests.

---

## 4. How authentication works in tests

`login()` in `e2e/helpers.ts` performs a real UI login:

1. `/public/login`, fill `#email` and `#password`, submit.
2. Wait for the URL to reach `/dashboard**` (a coordinator lands on `/dashboard/families`).

Auth is enforced by `proxy.ts`/Auth.js on the server, so replacing `/api/auth/session` with a
mock would only change the client's idea of the session — the next API request would still be
rejected. Always log in through the UI.

The session is a JWT cookie in the browser context. `page.request` shares that cookie jar, so
after `login(page)` you can call protected APIs directly:

```ts
await login(page);
const res = await page.request.get("/api/family?limit=1000");
```

To switch users, clear cookies first — `await page.context().clearCookies()` — then log in
again. A stale JWT otherwise keeps the previous role and region.

---

## 5. Data strategy and test hygiene

- **Prefer read-only assertions.** Read totals and names from the live API response instead of
  hard-coding counts, so tests survive legitimate data changes:
  ```ts
  await expect.poll(() => captured.total).toBeTruthy();
  await expect(page.getByText(`Showing 1-10 of ${captured.total}`)).toBeVisible();
  ```
  Seed names such as `Region A Family 1` are stable because `--reset` recreates them.
- **Never delete seeded records in a test.** `authz-api.spec.ts` sends rejected `PATCH`
  requests with the record's *current* value, so even a regression that removes a guard cannot
  corrupt the seed.
- **If a test must write**, create a uniquely named record and remove it in `finally`, or mock
  the API as `dialogs.spec.ts` does. Deletion cascades, there is no soft delete, and no audit
  log to reconstruct what a test removed.
- **Run real-database specs serially** (`test.describe.configure({ mode: "serial" })`). Parallel
  logins against a pooled database produce intermittent "Invalid email or password" failures.
- **Reset between exploratory runs** with `npx tsx prisma/seed.ts --reset`; it refuses to wipe
  unless `--reset` is passed.

Use synthetic data only. Member records contain personal information; never point the suite at
a production database or attach real data to a failure report.

---

## 6. Coverage and gaps

Covered end-to-end:

- Unauthenticated redirect (`/dashboard`) and JSON `401` (`/api/*`).
- Successful and failed credential login; logout.
- Admin dashboard counts and every master-data/specialised page renders live data.
- Coordinator login: region-scoped families and members, restricted sidebar, cross-region
  reads (`404`) and writes (`403`), denied attendance/users routes.
- Every sortable header writes `?sortBy=&sortOrder=`, toggles, and survives reload.
- Family/member create, edit, and delete dialogs, including validation and the province
  cascade (mocked APIs).
- Duplicate attendance (`serviceDate` + `serviceType`) and duplicate user email return
  `409`, and the record totals do not change.
- XLSX/PDF downloads produce real files whose contents (sheet, columns, row count, PDF
  structure) are asserted, on every exporter page.
- The last admin cannot be demoted, while demoting one of two admins still works; deleting
  your own account is refused.
- A five-character password is rejected in the user dialog without sending a request; six
  characters is accepted and submitted.

Known gaps — do not assume these are tested:

- **Unassigned coordinator** (`regionId = null`) returning `403`: covered by Vitest only, since
  changing an assignment requires a second login and a database write.
- **Deleting the last admin through the API** — unreachable in practice because an admin
  deleting the final admin is deleting their own account, which the self-delete rule rejects
  first; the last-admin delete check exists as a server-side backstop.
- **`window.print()` “Cetak PDF” buttons** on the region/birthday/pelkat pages — they open
  the print dialog rather than producing a downloadable file.
- **Mobile/responsive layouts**, dark mode, and visual regression.
- **Cross-browser** — only the `chromium` project is configured.
- **Rate limiting, CSRF, and security headers** — not implemented/configured in the app, so
  there is nothing to assert.

---

## 7. Writing a new test

1. Decide whether it needs the real database. If yes, keep it read-only; if it needs writes,
   mock the API or clean up deterministically.
2. Put shared credentials and navigation helpers in `e2e/helpers.ts`. Import
   `ADMIN_EMAIL`/`ADMIN_PASSWORD` rather than re-typing them.
3. Set `test.setTimeout()` for flows that log in and load live data (the existing specs use
   90–240 seconds).
4. Use role-based locators (`getByRole`, `getByText`) and visible headings, not CSS structure.
5. Wait for the list API response before interacting with a table — sort buttons exist in the
   server-rendered HTML before hydration, and early clicks are silently dropped. See
   `trackListResponse`/`verifySortableHeader` in `helpers.ts`.
6. Track failures for read-only page walks so unexpected `4xx`/`5xx` responses and page errors
   fail the test (`trackFailures` pattern in `full-app.spec.ts`).
7. Reset state if the test wrote anything; then run the spec twice in a row to prove it is
   repeatable.

Minimal API-level template:

```ts
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("coordinator cannot read another region's family", async ({ page }) => {
  await login(page, { email: "coordinator-a@example.com", password: "coordinator123" });
  const res = await page.request.get("/api/family/<other-region-id>");
  expect(res.status()).toBe(404);
});
```

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `browserType.launch: Executable doesn't exist` | Chromium not installed | `npx playwright install chromium` |
| Every login fails with "Invalid email or password" | Database not seeded, or `DATABASE_URL` points at an empty/remote database | Seed the local database; confirm the env vars in the shell running Playwright |
| `connect ECONNREFUSED` / Prisma `P1001` | Local Postgres not running or wrong port | Start the container; check `DATABASE_URL`/`DIRECT_URL` |
| Port 3000 already in use | Another dev server is running | Stop it — Playwright reuses it locally — or set a different port consistently in `playwright.config.ts` |
| Page renders but the table stays empty | API call failed or is still compiling | Check the HTML report's network tab/trace; assert on the captured API total |
| Coordinator test sees another region's data | JWT from the previous login is still in the browser context | `await page.context().clearCookies()` before logging in |
| Tests pass alone, fail together | Parallel logins exhausting the connection pool | Keep real-database specs serial; run with `--workers=1` |
| Stale schema errors after pulling | Migrations not applied | `npx prisma migrate deploy` against the e2e database |

---

## 9. Related documentation

- [README.md](../README.md) §End-to-End Tests — short version for new contributors.
- [docs/PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) §9 — full testing and quality
  section, including Vitest.
- [docs/DATA_MODEL.md](DATA_MODEL.md) — seed data and table shapes used in assertions.
- [docs/AUTH_RBAC.md](AUTH_RBAC.md) — roles, guards, and coordinator scoping.
- [SECURITY.md](../SECURITY.md) §4 — why client-side checks are not a security boundary.
