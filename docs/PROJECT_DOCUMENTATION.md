# Yudea App — Project Documentation

**Church administration dashboard for GPIB Yudea**

| | |
|---|---|
| **Status** | Active development (v0.1.0) |
| **Last verified against code** | 9 November 2026 |
| **Audience** | Developers, maintainers, and technical administrators |
| **Companion documents** | [User Manual](USER_MANUAL.md) · [API Reference](API.md) · [Data Model](DATA_MODEL.md) · [Auth & RBAC](AUTH_RBAC.md) · [PRD](PRD.md) |

This document explains what the application is, how it is put together, how to run and
test it, and how to extend it safely. The companion documents go deeper on the API,
database schema, and access-control details; this one connects them.

---

## Table of contents

1. [What the application does](#1-what-the-application-does)
2. [Feature map](#2-feature-map)
3. [Technology stack](#3-technology-stack)
4. [Architecture](#4-architecture)
5. [Authentication and access control](#5-authentication-and-access-control)
6. [Data model](#6-data-model)
7. [API conventions](#7-api-conventions)
8. [Local development](#8-local-development)
9. [Testing](#9-testing)
10. [Deployment and operations](#10-deployment-and-operations)
11. [Development conventions](#11-development-conventions)
12. [Known limitations](#12-known-limitations)
13. [Troubleshooting](#13-troubleshooting)
14. [Documentation index](#14-documentation-index)

---

## 1. What the application does

Yudea is a web application for administering a church congregation. It keeps the
organisational structure and member records in one place and turns them into the views
the church needs day to day: household lists, ministry-group (Pelkat) breakdowns, a
presbyter list, weekly birthdays, service attendance, and exportable reports.

The data hierarchy is deliberately strict:

```
Wilayah Pelayanan (Branch)
└── Sektor Pelayanan (Region)
    └── Keluarga (Family)
        └── Warga Jemaat (Member)
```

Every family belongs to exactly one region, and every member belongs to exactly one
family. Because of that, records must be created top-down: a branch before its regions,
a region before its families, and a family before its members.

### Who uses it

| Role | Typical user | What they do |
|---|---|---|
| `ADMIN` | System administrator / church office lead | Everything, including user accounts and the role-access matrix |
| `STAFF` | Church office staff | Day-to-day data entry: branches, regions, families, members, attendance, reports |
| `COORDINATOR` | Sector coordinator | Manages families and members inside their assigned region only |
| `MEMBER` | Congregation member or viewer | Read-only access to the member and presbyter lists |

There is no self-registration. Administrators create accounts on the **Users** page.

### Domain glossary

| Term in the UI | Meaning in code | Notes |
|---|---|---|
| Wilayah Pelayanan | `Branch` | Top-level church grouping |
| Sektor Pelayanan | `Region` | Sub-area of a branch; the unit coordinators are assigned to |
| Keluarga | `Family` | Household; holds the family name and address |
| Warga Jemaat | `Member` | Individual person record |
| Pelkat | `MemberPelkat` | Ministry group derived from age, gender, and family role |
| Majelis Jemaat | Presbyter list | Members whose `jabatan` is `DIAKEN` or `PENATUA` |
| Ulang Tahun | Birthday dashboard | Members with a birthday in the selected Sunday–Saturday week |
| Attendance | `Attendance` | Head-count per service date and service type |

The interface mixes Indonesian and English labels. Feature pages that deal with church
structure use Indonesian; tooling pages (Attendance, Users, Settings) use English.

---

## 2. Feature map

| Page | Route | What it provides |
|---|---|---|
| Login | `/public/login` | Credentials sign-in; the only public page |
| Dashboard | `/dashboard` | Totals for members, families, regions, branches; gender, blood-type, and Pelkat distributions; members-per-region table |
| Ulang Tahun | `/dashboard/birthday` | Weekly birthdays with date picker, sortable table, XLS export, print-to-PDF |
| Wilayah Pelayanan | `/dashboard/branches` | Branch CRUD |
| Sektor Pelayanan | `/dashboard/regions` | Region CRUD, members-per-region counts, member data export |
| Keluarga | `/dashboard/families` | Family CRUD with nested member creation, address cascade, status cascade, and family split |
| Warga Jemaat | `/dashboard/members` | Member CRUD, search, region/Pelkat filters, sortable columns, quick-edit status actions |
| Majelis Jemaat | `/dashboard/presbytery` | Presbyters only (`DIAKEN` / `PENATUA`), filterable by region |
| Pelkat Members | `/dashboard/pelkat-members` | Members grouped/filtered by Pelkat, with export |
| Attendance | `/dashboard/attendance` | Attendance CRUD, search, sortable columns, aggregate stat cards |
| Laporan Warga Jemaat | `/dashboard/report` | Filter by Pelkat and region; export to XLSX or PDF |
| Users | `/dashboard/users` | User CRUD, role and coordinator-region assignment (admin only) |
| Settings | `/dashboard/settings` | Role-access matrix: per-page View/Edit permissions (admin only) |

`/dashboard/evets` is a legacy alias that redirects to `/dashboard/attendance`.

> **Destructive cascade:** deleting a branch removes its regions, families, and members
> and unassigns users from those regions. Deleting a region removes its families and
> members and unassigns its users. Deleting a family removes its members. These actions
> are permanent and only available to roles with Edit access.

Cross-cutting behaviour:

- **Server-side pagination and search** for every list endpoint.
- **URL-persisted sorting** (`?sortBy=…&sortOrder=…`) so sort state survives refresh.
- **Coordinator scoping** on list, dashboard, report, birthday, and write operations.
- **Role-aware UI** — edit buttons, action columns, and sidebar entries disappear when the
  signed-in role lacks permission, and the API enforces the same rules independently.
- **Loading, empty, and error states** on data tables, with toast notifications for
  mutations.

---

## 3. Technology stack

Versions are taken from `package.json`.

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router, `proxy.ts` convention) | 16.2.6 |
| UI runtime | React / React DOM | 19.2.4 |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | — |
| ORM | Prisma Client / Prisma CLI | 5.22 |
| Authentication | NextAuth (Auth.js) v5, credentials provider | 5.0.0-beta.31 |
| Data fetching | TanStack Query | 5.100 |
| Forms | React Hook Form + Zod resolver | 7.76 / 5.4 |
| Validation | Zod | 4.4 |
| Styling | Tailwind CSS 4 + shadcn/Radix UI | Tailwind 4 |
| Icons | lucide-react | 1.17 |
| Toasts | Sonner | 2.0 |
| Export | xlsx, jsPDF + jspdf-autotable | 0.18 / 4.2 |
| Indonesian regions | idn-area-data | 4.0 |
| Unit tests | Vitest + Testing Library + jsdom | 4.1 |
| E2E tests | Playwright (Chromium) | 1.62 |

**Runtime requirements:** Node.js 20 or newer, npm, and a reachable PostgreSQL database.
No background worker, queue, or external SaaS is required at runtime. File exports are
generated in the browser.

---

## 4. Architecture

### 4.1 High level

```
┌──────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│  React 19 client components                                  │
│  TanStack Query cache ── localStorage auth/session mirror    │
└───────────────────────────┬──────────────────────────────────┘
                            │ fetch("/api/…")
┌───────────────────────────▼──────────────────────────────────┐
│ Next.js 16 App Router                                        │
│  app/dashboard/*  ── thin server pages (unwrap searchParams)  │
│  app/api/*        ── route handlers (Node.js runtime)         │
│  proxy.ts         ── auth gate for /dashboard and /api       │
└───────────────────────────┬──────────────────────────────────┘
                            │ requireViewAccess / requireEditAccess
                            │ validateBody (Zod)
┌───────────────────────────▼──────────────────────────────────┐
│ Prisma 5 client ── PostgreSQL                                │
│  Branch · Region · Family · Member · Attendance · User ·     │
│  AppSetting · Account · Session                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Rendering and data-fetching model

The dashboard is a **client-rendered data application inside the Next.js App Router**:

- Each `app/dashboard/<page>/page.tsx` is a small server component. It awaits
  `searchParams` (Next.js 16 exposes them as a Promise) and passes initial sort/filter
  values into the client component.
- The client component owns page, search, and filter state and calls a TanStack Query hook.
- Hooks call typed wrappers in `lib/api/`, which perform relative `fetch()` calls against the
  app's own API routes.
- Route handlers run on the Node.js runtime, authenticate the request, validate input,
  query Prisma, and return JSON.
- Mutations invalidate the relevant query keys; the active list refetches and a toast is
  shown.

This separation means there are no server actions and no direct database access from
components. Every read and write goes through an HTTP API route, which is also what makes
the server-side RBAC checks possible.

### 4.3 Layer responsibilities

| Layer | Location | Responsibility |
|---|---|---|
| Pages | `app/dashboard/*/page.tsx`, `app/public/*` | Routing, `searchParams`, composing feature components |
| Layout | `app/dashboard/layout.tsx` | Sidebar, navbar, `RbacGuard` wrapper, scroll container |
| Feature components | `components/<feature>/` | Tables, dialogs, filters, page state, toasts |
| UI primitives | `components/ui/` | shadcn/Radix building blocks, `DataTableControls`, `SortableHeader` |
| Query hooks | `hooks/` | Query keys, caching, invalidation, mutation wiring |
| API client | `lib/api/` | Typed fetch wrappers and error handling |
| API routes | `app/api/**/route.ts` | Auth, validation, Prisma queries, response shaping |
| Domain helpers | `lib/helper.ts`, `lib/client-helper.ts`, `lib/rbac.ts` | Pelkat computation, pagination parsing, formatting, permissions |
| Persistence | `lib/prisma.ts`, `prisma/schema.prisma` | Prisma singleton and schema |
| Security | `proxy.ts`, `lib/server-auth.ts`, `auth.ts`, `auth.config.ts` | Authentication and authorization |
| Tests | `tests/`, `e2e/` | Unit/component and end-to-end coverage |

### 4.4 Directory structure

```
app/
├── api/                      # Route handlers (see §7)
├── dashboard/                # Protected pages + layout
├── public/login/             # Login page
├── error.tsx, not-found.tsx  # Global error and 404 UI
├── layout.tsx                # Fonts, providers, sidebar/tooltip providers, toaster
└── globals.css               # Tailwind 4 and theme tokens

components/
├── ui/                       # Primitives (button, table, dialog, sidebar, …)
├── layout/                   # Sidebar and navbar
├── auth/                     # AuthProvider, SessionSync, RbacGuard
├── dashboard/                # Dashboard stat widgets and birthday view
├── members/, family/, …      # One folder per feature
└── login/                    # Login form

hooks/                        # TanStack Query hooks + UI hooks
lib/
├── api/                      # Client-side API wrappers
├── helper.ts                 # Server/shared domain helpers
├── client-helper.ts          # Formatting and display helpers
├── rbac.ts                   # Permission model and defaults
├── rbac-config.ts            # Client RBAC persistence
├── rbac-settings.ts          # Server RBAC persistence
├── auth-session.ts           # Client session persistence
├── server-auth.ts            # requireAuth/requireAdmin/requireViewAccess/requireEditAccess
├── api-validate.ts           # Zod validation + API error helpers
└── prisma.ts                 # Prisma singleton

prisma/                       # schema.prisma, migrations, seed scripts
schemas/                      # Auth, user, and API Zod schemas
nav/const.ts                  # Sidebar items and their default roles
tests/                        # Vitest suite (22 files; see §9.1 for the current count)
e2e/                          # Playwright specs and helpers
scripts/qa/                   # One-off QA/diagnostic scripts (not part of the app)
docs/                         # This documentation set
```

### 4.5 Request lifecycle (example: member list)

1. The server page reads `?sortBy`/`?sortOrder` and renders `MembersPage`.
2. `MembersPage` keeps `page`, `limit`, `search`, `region`, and `pelkat` state.
3. `useMembers(...)` builds a query key from those values and calls `getMembers(...)`.
4. `lib/api/member.ts` requests `/api/member?page=…&limit=…&search=…`.
5. `proxy.ts` (Next.js 16's middleware replacement) rejects unauthenticated requests with
   `401` before the handler runs.
6. `GET /api/member` calls `requireViewAccess("/dashboard/members")`, which merges the
   persisted RBAC config with defaults and returns `403` if the role lacks view access.
7. The handler runs `prisma.$transaction([findMany, count])`, applies coordinator scoping,
   attaches the computed `pelkat` field, and returns `{ data, meta }`.
8. TanStack Query caches the result under `["member", …params]`. A successful create,
   update, or delete invalidates `member`, `family`, `birthday-members`, and `dashboard`
   keys so dependent views refresh.

### 4.6 Routing and the auth proxy

Next.js 16 replaces `middleware.ts` with `proxy.ts`. The proxy:

- Lets `/public/*` and `/api/auth/*` through.
- Redirects unauthenticated `/dashboard/*` requests to `/public/login?callbackUrl=…`.
- Returns `401 JSON` for unauthenticated `/api/*` requests.
- Skips Next internals, the favicon, and static image files via its matcher.

The proxy only checks **authentication**. Role permissions are enforced inside each route
handler by `requireViewAccess()` / `requireEditAccess()`, because the proxy does not load
the persisted RBAC configuration.

### 4.7 Clientside persistence

Two pieces of client state are mirrored to `localStorage` and cookies so the UI can render
without waiting for the session endpoint:

| State | Module | Storage keys |
|---|---|---|
| Signed-in user | `lib/auth-session.ts` | `auth_user` (+ `user_role`, `user_email`, `user_name`, `user_region_id` cookies) |
| Role-access config | `lib/rbac-config.ts` | `role_access_config` in `localStorage` and a 30-day cookie |

Both modules expose `useSyncExternalStore` hooks (`useStoredUser`,
`useStoredRoleAccessConfig`) and dispatch custom events, with `storage` listeners for
cross-tab updates. `SessionSync` writes the session on login, fetches the RBAC config from
the API, and clears the mirror on logout.

> The client mirror is a convenience for rendering, **not** the security boundary. The
> server re-reads the RBAC config from the database on every guarded API request.

---

## 5. Authentication and access control

### 5.1 Login flow

1. The user submits email and password on `/public/login`.
2. `signIn("credentials", ...)` invokes the `authorize` callback in `auth.ts`.
3. Prisma looks up the user by email; `bcrypt.compare()` checks the password hash.
4. On success, the JWT callback stores `id`, `role` (normalized), and `regionId`.
5. The session callback copies them onto `session.user`; the strategy is JWT, so no
   database session row is used.
6. The client persists the user, fetches the RBAC config, and redirects to the role's
   default page.

| Role | Landing page |
|---|---|
| `ADMIN`, `STAFF` | `/dashboard` |
| `COORDINATOR` | `/dashboard/families` |
| `MEMBER` | `/dashboard/members` |

### 5.2 Guards

| Guard | Where | Behaviour |
|---|---|---|
| `proxy.ts` | Edge of `/dashboard` and `/api` | Redirect / `401` when there is no session |
| `requireAuth()` | API routes | `401` when there is no session |
| `requireAdmin()` | User admin, RBAC writes | `403` unless role is `ADMIN` |
| `requireViewAccess(path)` | Read endpoints | `403` unless the role is in the route's persisted `view` list; a `COORDINATOR` without a region is always `403` |
| `requireEditAccess(path)` | Write endpoints | `403` unless the role is in the route's persisted `edit` list; a `COORDINATOR` without a region is always `403` |
| `RbacGuard` | Dashboard layout | Renders "Access Restricted" instead of the page when view access is missing |
| `usePageAccess()` | Feature components | Returns `{ canView, canEdit, role }` to hide buttons and actions |

Permission checks **deny by default**: an empty or missing allow-list grants nothing. This
prevents a malformed or legacy config from opening a route to everyone.

### 5.3 Default route permissions

Defined in `lib/rbac.ts`:

| Route | View | Edit |
|---|---|---|
| `/dashboard` | ADMIN, STAFF, COORDINATOR | ADMIN, STAFF |
| `/dashboard/branches` | ADMIN, STAFF | ADMIN, STAFF |
| `/dashboard/regions` | ADMIN, STAFF, COORDINATOR | ADMIN, STAFF |
| `/dashboard/birthday` | ADMIN, STAFF, COORDINATOR | ADMIN, STAFF, COORDINATOR |
| `/dashboard/families` | ADMIN, STAFF, COORDINATOR | ADMIN, STAFF, COORDINATOR |
| `/dashboard/members` | ADMIN, STAFF, COORDINATOR, MEMBER | ADMIN, STAFF, COORDINATOR |
| `/dashboard/presbytery` | ADMIN, STAFF, COORDINATOR, MEMBER | ADMIN, STAFF, COORDINATOR |
| `/dashboard/pelkat-members` | ADMIN, STAFF | ADMIN, STAFF |
| `/dashboard/report` | ADMIN, STAFF | ADMIN, STAFF |
| `/dashboard/attendance` | ADMIN, STAFF | ADMIN, STAFF |
| `/dashboard/users` | ADMIN | ADMIN |
| `/dashboard/settings` | ADMIN | ADMIN |

`/dashboard/settings` is hard-coded to admin-only: even a persisted override cannot grant
another role access to it.

### 5.4 Changing permissions

1. An administrator edits the matrix on **Settings**. Edit is only selectable where View is
   enabled.
2. The client sends the config to `PUT /api/settings/rbac` (admin-only, Zod-validated).
3. The server normalizes it (merges defaults, enforces admin-only routes) and upserts the
   JSON into `AppSetting` under `role_access_config`.
4. The response is mirrored to `localStorage` and a cookie, and a
   `role-access-config-updated` event refreshes the sidebar and guards.

### 5.5 Coordinator scoping

A coordinator **must** have a `regionId`. If the field is missing, `requireViewAccess` and
`requireEditAccess` return `403` with `"Coordinator account is not assigned to a region"`.
This is deliberate: handlers previously skipped the region filter when `regionId` was
absent, which silently exposed every region.

When a coordinator has a region:

- Family, member, region, birthday, dashboard, and region-count **reads** are limited to
  that region. Report reads are also scoped if an admin grants the coordinator access to
  the Report page.
- **Single-record reads** — `GET /api/member/:id`, `GET /api/family/:id`, and
  `GET /api/region/:id` — include the region in the query and return `404` for records in
  another region. The `404` avoids revealing whether the record exists.
- **Writes** are checked too: creating or moving a family/member outside the region, or
  changing status, deleting, or splitting a family outside it, returns `403`.
- `requireViewAccess`/`requireEditAccess` return the user's `regionId` so handlers do not
  need a second `auth()` call.
- The region is copied into the JWT at sign-in. After an admin changes a user's region or
  role, that user must sign out and back in for the new scope to apply.

---

## 6. Data model

The full schema reference lives in [DATA_MODEL.md](DATA_MODEL.md). This is the working
summary.

### 6.1 Relationships

```
Branch 1 ──< Region 1 ──< Family 1 ──< Member
                 │                        │
                 ├──< User (regionId)     │
                 └──0..1 Member (coordinatorMemberId, unique)

Attendance   (standalone; unique on serviceDate + serviceType)
AppSetting   (key/value; stores the RBAC JSON)
Account, Session   (NextAuth adapter tables; unused with JWT sessions)
```

### 6.2 Models at a glance

| Model | Key fields | Notes |
|---|---|---|
| `User` | `email` (unique), `password` (bcrypt), `role` (default `ADMIN`), `regionId?` | App login account; `regionId` links a coordinator to a region |
| `Branch` | `name` | Wilayah Pelayanan |
| `Region` | `name`, `branchId`, `coordinatorMemberId?` (unique) | Sektor Pelayanan; one member can coordinate at most one region |
| `Family` | `familyName`, `address?`, `provinsi?`–`kelurahan?`, `regionId` | Household and address |
| `Member` | name, birth data, contact, family role, sacramental status, `jabatan`, `bloodType?`, `isActive`, `isDeceased`, `familyId` | Person record; `pelkat` exists as a column but is normally computed |
| `Attendance` | `serviceDate`, `serviceType`, `maleCount`, `femaleCount`, `totalCount` | `(serviceDate, serviceType)` is unique; total is computed server-side |
| `AppSetting` | `key` (unique), `value` | Currently only `role_access_config` |
| `Account`, `Session` | NextAuth adapter shape | Present but unused because sessions are JWT |

### 6.3 Enums

- `Gender`: `MALE`, `FEMALE`
- `MemberRole`: `FAMILY_HEAD`, `WIFE`, `CHILD`, `OTHER`, `ORANG_TUA`, `CUCU`,
  `KAKAK_ADIK_KANDUNG`, `FAMILI_LAIN`
- `BloodType`: `A`, `B`, `AB`, `O`
- `BaptisStatus` / `SidiStatus`: `SUDAH`, `BELUM`
- `PerkawinanStatus`: `BELUM_MENIKAH`, `JANDA`, `DUDA`, `MENIKAH`
- `Jabatan`: `WARGA_JEMAAT` (default), `DIAKEN`, `PENATUA`, `PENGURUS_PELKAT`,
  `PENGURUS_KOMISI`
- `MemberPelkat`: `PELAYANAN_ANAK`, `PERSEKUTUAN_TARUNA`, `GERAKAN_PEMUDA`,
  `PERSEKUTUAN_KAUM_BAPAK`, `PERSEKUTUAN_KAUM_PEREMPUAN`,
  `PERSEKUTUAN_KAUM_LANJUT_USIA`

### 6.4 How Pelkat is derived

Pelkat is **computed at read time** by `determinePelkat()` in `lib/helper.ts`; the `Member`
column exists but the member create/update handlers do not maintain it. The rules:

| Pelkat | Rule |
|---|---|
| `PERSEKUTUAN_KAUM_BAPAK` | Male and either aged 36–59, or married and under 36 |
| `PERSEKUTUAN_KAUM_PEREMPUAN` | Female and either aged 36–59, or married and under 36 |
| `PELAYANAN_ANAK` | Aged 0–12 and not married |
| `PERSEKUTUAN_TARUNA` | Aged 13–16 and not married |
| `GERAKAN_PEMUDA` | Aged 17–35 and not married |
| `PERSEKUTUAN_KAUM_LANJUT_USIA` | Aged 60+ |

"Married" is inferred from the family role: `FAMILY_HEAD` or `WIFE`. Age is calculated from
`birthDate` against the current date. `buildPelkatWhere()` mirrors these rules as Prisma
date-range filters for dashboard counts; `attachPelkat()` adds the computed value to API
responses.

### 6.5 Other business rules

- **Presbyters** are not a separate table or flag. A member is a presbyter when `jabatan` is
  `DIAKEN` or `PENATUA`; `/api/member/presbyter` filters on that.
- **Family status cascade:** `PATCH /api/family/:id/status` sets `isActive` (and optionally
  `tanggalPindah`) on every member of the family in one `updateMany`.
- **Family split:** `POST /api/family/split` creates a new family inside a transaction,
  moves the selected members, verifies they belonged to the original family, and promotes
  the chosen member to `FAMILY_HEAD`.
- **Deletion cascades:** the coordinator relation has no database-level cascade, so deletes
  run in a transaction that clears `Region.coordinatorMemberId` and user region assignments
  first. Deleting a family removes its members; deleting a region removes its families and
  members and unassigns its users; deleting a branch removes its regions, families, and
  members and unassigns its users.
- **Birthdays:** filter active, living members by `MM-DD` within Sunday–Saturday, wrapping
  correctly across year-end, and sorted by day-of-year.
- **Attendance:** `totalCount = maleCount + femaleCount`; duplicates for the same date and
  service type return `409` (with a race-condition backstop for Prisma `P2002`).

---

## 7. API conventions

All handlers live under `app/api/` and export `runtime = "nodejs"` where they touch Prisma.
The complete endpoint/field reference is [API.md](API.md).

### 7.1 Response shapes

Paginated lists:

```json
{
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 10, "totalPages": 0 }
}
```

Non-paginated endpoints return either the resource directly, `{ data: [...] }`, or
`{ config: ... }` for RBAC settings.

### 7.2 Common query parameters

| Parameter | Default | Notes |
|---|---|---|
| `page` | `1` | 1-indexed; non-numeric/≤0 falls back to 1 |
| `limit` | `10` | Capped at 10,000 by `parsePagination()` |
| `search` | `""` | Case-insensitive across entity-specific fields |
| `sortBy` | entity-specific | Whitelisted by each handler |
| `sortOrder` | `asc` / `desc` | Anything other than `asc` is treated as `desc` in most handlers |

### 7.3 Endpoint groups

| Group | Endpoints |
|---|---|
| Auth | `/api/auth/[...nextauth]` |
| Dashboard | `GET /api/dashboard/counts` |
| Branches | `GET/POST /api/branch`, `GET/PATCH/DELETE /api/branch/:id` |
| Regions | `GET/POST /api/region`, `GET/PATCH/DELETE /api/region/:id`, `GET /api/region/member-count` |
| Families | `GET/POST /api/family`, `GET/PATCH/DELETE /api/family/:id`, `PATCH /api/family/:id/status`, `GET /api/family/count`, `POST /api/family/split` |
| Members | `GET/POST /api/member`, `GET/PATCH/DELETE /api/member/:id`, `GET /api/member/presbyter` |
| Attendance | `GET/POST /api/attendance`, `GET/PATCH/DELETE /api/attendance/:id` |
| Users | `GET/POST /api/user`, `PATCH/DELETE /api/user/:id` (admin only) |
| Settings | `GET /api/settings/rbac`, `PUT /api/settings/rbac` (PUT admin only) |
| Birthday | `GET /api/birthday?date=YYYY-MM-DD` |
| Report | `GET /api/report?pelkat=…&region=…` |
| Indonesian regions | `GET /api/region-indonesia/{provinces,regencies,districts,villages}` |

### 7.4 Validation and errors

Writes parse their body with a Zod schema from `schemas/api.schemas.ts` through
`validateBody()`. Failures return `400` with flattened field errors. All unhandled
exceptions are logged and returned as a generic `500` through `handleApiError()`.

| Status | Meaning |
|---|---|
| `400` | Malformed body or failed schema validation |
| `401` | No authenticated session |
| `403` | Role lacks view/edit access; coordinator tried to cross region boundaries; or coordinator has no region |
| `404` | Record not found, or it belongs to a region outside the coordinator's scope |
| `409` | Duplicate attendance for the same date and service type |
| `500` | Unexpected server/database error |

### 7.5 Client wrappers

`lib/api/*.ts` contains one module per resource. They build query strings, call `fetch`,
throw `Error` on non-OK responses, and are typed with the shared types in `types/`. Hooks in
`hooks/` should use these wrappers rather than calling `fetch` directly, except for a few
page-local queries (dashboard counts, report, birthday export) that are already inside a
feature component.

---

## 8. Local development

### 8.1 Prerequisites

- Node.js 20+
- npm
- PostgreSQL (local Docker instance or a hosted database)
- Docker (only if you want the throwaway e2e database shown below)

### 8.2 Environment variables

Create `.env` in the project root:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="a-long-random-secret"
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Pooled/runtime Prisma connection |
| `DIRECT_URL` | Yes | Direct connection used by migrations; the schema references it |
| `NEXTAUTH_URL` | Yes | Public base URL used by NextAuth |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret; `AUTH_SECRET` is accepted as a fallback |
| `AUTH_SECRET` | No | Alternative name for the same secret |

Do not commit real credentials. The checked-in `.env` may point at a shared development
database; use a separate database for experiments and e2e.

### 8.3 First run

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Open <http://localhost:3000>; the root redirects to `/public/login`.

### 8.4 Seed data and demo accounts

`prisma/seed.ts` is safe to re-run: if branches already exist it only refreshes the demo
users and refuses to wipe data. Pass `--reset` to wipe and reseed.

```bash
npm run prisma:seed             # add demo accounts, keep existing data
npm run prisma:seed -- --reset  # wipe and reseed everything
```

The fresh seed creates 2 branches, 3 regions, 9 families, 90 members, 2 attendance records,
and 5 users:

| Email | Password | Role | Scope |
|---|---|---|---|
| `admin@example.com` | `admin123` | `ADMIN` | Full access |
| `demo@example.com` | `demo1234` | `STAFF` | Most resources |
| `coordinator-a@example.com` | `coordinator123` | `COORDINATOR` | Region A |
| `coordinator-b@example.com` | `coordinator123` | `COORDINATOR` | Region B |
| `coordinator-c@example.com` | `coordinator123` | `COORDINATOR` | Region C |

`prisma/seed-birthday.ts` is a separate helper that inserts members with birthdays in the
current week for manually testing the birthday dashboard.

### 8.5 Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` then production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint 9 (`eslint-config-next`) |
| `npm test` / `npm run test:watch` | Vitest once / watch mode |
| `npm run test:e2e` | Playwright (needs a seeded database) |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Create/apply a development migration |
| `npm run prisma:seed` | Seed demo data |

---

## 9. Testing

### 9.1 Unit and component tests (Vitest)

- Located in `tests/`, 22 files; the suite currently has 407 tests.
- Environment: `jsdom`; setup in `vitest.setup.ts`; Playwright specs are excluded.
- Focus areas: helpers (Pelkat, age, pagination), Zod schemas, API client wrappers, query
  hooks, client/server auth, RBAC merge and persistence, proxy matcher, UI components and
  hook behaviour.
- API modules are mocked with `vi.mock()`; hooks are exercised with `renderHook()` using a
  fresh `QueryClient` per test.

```bash
npm test
npm run test:watch
```

### 9.2 End-to-end tests (Playwright)

- Located in `e2e/`; four specs plus shared helpers. See
  [docs/E2E_TESTING.md](E2E_TESTING.md) for the maintainer's guide.
- `full-app.spec.ts` — real login, dashboard counts, master-data pages, coordinator scoping
  and sidebar RBAC, plus a sort-header click on every sortable page (read-only).
- `authz-api.spec.ts` — direct API calls: unauthenticated `401`, wrong-password login,
  coordinator list/single-record scoping (`404`/`403`), and role guards on attendance and
  users (read-only).
- `dialogs.spec.ts` — family/member create–update–delete dialog flows and validation, with
  most APIs mocked.
- `sort.spec.ts` — URL persistence, asc/desc toggle, and reload restore for every table
  (read-only).
- Playwright starts `npm run dev` automatically on port 3000 and reuses an existing server
  unless `CI` is set.

The suite uses a **real database and a real login**, so point the app at a throwaway local
Postgres. Do not run it against the shared/Neon database:

```bash
docker run -d --name yudea-e2e-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=yudea_e2e \
  -p 5433:5432 postgres:16-alpine

export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/yudea_e2e"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy
npx tsx prisma/seed.ts --reset

npm run test:e2e
docker rm -f yudea-e2e-pg
```

`full-app`, `authz-api`, and `sort` are read-only and can be re-run against the same seed;
`dialogs` mocks API writes but still needs the seeded admin account for login.

---

## 10. Deployment and operations

### 10.1 Build and run

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

`npm run build` already runs `prisma generate`; running it explicitly in CI is harmless and
makes the dependency on a valid schema/env obvious.

### 10.2 Production environment

Set the same variables as local development, with production values:

```bash
DATABASE_URL="postgresql://…"
DIRECT_URL="postgresql://…"
NEXTAUTH_URL="https://your-domain.example"
NEXTAUTH_SECRET="<long random secret>"
```

Notes:

- `NEXTAUTH_SECRET` (or `AUTH_SECRET`) must be stable across instances, otherwise sessions
  will not validate.
- `DIRECT_URL` is required by the Prisma schema even when it equals `DATABASE_URL`.
- Apply migrations with `prisma migrate deploy`, not `migrate dev`, in production.
- Do not run the seed script against production unless you intend to create demo data.

### 10.3 Hosting

The repository contains no platform-specific deployment file (no `vercel.json`,
`netlify.toml`, or Dockerfile). It deploys as a standard Next.js Node.js application with a
PostgreSQL database. `next.config.ts` sets:

- `outputFileTracingIncludes` for `idn-area-data` CSV files — keep this when using
  standalone output, or the Indonesian region endpoints will fail at runtime.
- `optimizePackageImports` for `lucide-react` and `date-fns`.
- AVIF/WebP image formats and response compression.

The app has no server-side file uploads, cron jobs, or external queues. XLSX/PDF generation
runs entirely in the browser.

### 10.4 Operational checks

| Check | How |
|---|---|
| App is up | `GET /public/login` returns 200 |
| Database connectivity | A valid login succeeds, or `npx prisma migrate status` |
| Auth configuration | Login sets a session; API calls without a session return `401` |
| RBAC configuration | Admin can load Settings; restricted roles get `403` on guarded endpoints |
| Region data | `GET /api/region-indonesia/provinces` returns data (verifies CSV tracing) |
| Backup freshness | Newest dump is within schedule, checksum verifies, and the weekly restore rehearsal passed — see [docs/BACKUP_RESTORE.md](BACKUP_RESTORE.md) |

There is no health-check endpoint, metrics exporter, or audit log built in. Database backup,
restore, retention, and rehearsal procedures are in [docs/BACKUP_RESTORE.md](BACKUP_RESTORE.md).

---

## 11. Development conventions

### 11.1 Adding or changing an API endpoint

1. Add or update a Zod schema in `schemas/api.schemas.ts`. Keep create and update schemas
   separate: `.partial()` on a schema with defaults would silently write defaults during a
   PATCH.
2. Guard the handler:
   - reads: `requireViewAccess("/dashboard/<page>")`
   - writes: `requireEditAccess("/dashboard/<page>")`
   - admin-only resources: `requireAdmin()`
   The path must match the key in the RBAC config, or the permission lookup will fail
   closed.
3. Validate the body with `validateBody(schema, body, "label")`.
4. Use `parsePagination()` for list endpoints and return `{ data, meta }`.
5. Apply coordinator scoping when the resource is region-bound.
6. Handle expected conflicts explicitly (for example, `409` on duplicate attendance).
7. Add or update the client wrapper in `lib/api/`, then the hook in `hooks/`.
8. Invalidate every affected query key after mutations, not just the primary one.

### 11.2 Adding a page

1. Create `app/dashboard/<route>/page.tsx` as a thin server component; await `searchParams`
   and pass initial sort/filter values down.
2. Add the route to `defaultProtectedRoutes` in `lib/rbac.ts` with `roles` and `editRoles`.
3. Add a sidebar item in `nav/const.ts` with the same path and default roles.
4. Wrap edit controls in `usePageAccess()` checks for the route path.
5. Add tests for any new helper logic and, where practical, a component test.
6. Update the docs: this file's feature/route tables, `docs/API.md` for new endpoints, and
   `docs/AUTH_RBAC.md` for permission changes.

### 11.3 Query and state conventions

- Query keys are arrays beginning with the resource (`["member", …]`, `["family", …]`);
  mutations invalidate by the leading key with `refetchType: "all"`.
- Default cache policy: `staleTime: 30s`, `gcTime: 5min`, no refetch on window focus,
  one retry (`lib/providers.tsx`).
- Table sort state lives in the URL through `useUrlSort()`; page/search state stays local.
- Dialogs reset through `useDialogForm()` rather than duplicating `useEffect` logic.
- User feedback uses `sonner` toasts; destructive actions ask for confirmation first.

### 11.4 Language and UI

- Church-structure labels are Indonesian; tooling pages are English. Follow the surrounding
  page rather than introducing a third convention.
- Use the shadcn primitives and the `cn()` helper instead of ad-hoc class strings.
- Keep tables horizontally scrollable; the layout is responsive down to mobile, with the
  sidebar collapsing into a sheet.
- Dates displayed to users use `id-ID` formatting.

### 11.5 Next.js 16 specifics

This project uses Next.js 16, which differs from older versions in ways that matter:
`proxy.ts` replaces `middleware.ts`, and page `searchParams` are Promises that must be
awaited. Before writing framework-level code, read the bundled guides in
`node_modules/next/dist/docs/` as required by `AGENTS.md`.

---

## 12. Known limitations

These are current, verified behaviours — not a backlog commitment.

- **The coordinator's region is fixed for the life of the session.** The JWT captures
  `regionId` at sign-in, so assigning a coordinator to a different region (or removing the
  assignment) takes effect only after they sign out and back in. Until then, the old scope
  remains in force. Account creation requires a region, and a coordinator without one is
  denied by the auth guards.
- **The stored `Member.pelkat` column is not maintained.** Pelkat is computed at read time;
  anything that queries the raw column may see `null` or stale values.
- **No self-service account management.** There is no registration, password reset, email
  verification, or OAuth provider enabled; an admin must create or reset accounts.
- **Mixed-language UI without an i18n framework.** Labels are hard-coded, so adding a locale
  means touching components.
- **No CI pipeline or deployment manifest is checked in.** Linting, tests, and E2E must be
  run manually or wired up by the hosting environment.
- **No audit trail or soft-delete for organisation or member records.** Deleting a branch,
  region, family, or member is permanent; parent deletes cascade to everything beneath them.
- **Attendance is a head-count record only.** It does not link individual members to a
  service.
- **The default `.env` may point at a shared hosted database.** Treat it as unsafe for
  destructive tests; use a local database for E2E and seeding experiments.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `@prisma/client` type/runtime errors | Client not generated after install or schema change | `npx prisma generate` |
| Prisma `P1001` / connection refused | Database unreachable or bad `DATABASE_URL` | Check the database, credentials, and network/SSL settings |
| `Environment variable not found: DIRECT_URL` | Schema references `DIRECT_URL` but it is unset | Add it to `.env` (it may equal `DATABASE_URL`) |
| Login always says invalid | No seeded account, wrong password, or data was reset | Run `npm run prisma:seed`; verify the account in the Users page or database |
| Redirect loop at login | `NEXTAUTH_URL`/secret mismatch, or cookies blocked | Set `NEXTAUTH_URL` to the real origin and a stable secret |
| `401` on every API call | No session cookie | Sign in again; check proxy matcher and `NEXTAUTH_URL` |
| `403` for a page that should be allowed | RBAC config in the database is missing the role | Admin checks Settings; note deny-by-default and the admin-only Settings route |
| Coordinator gets `403` on every data request | The account has no `regionId` (for example, its region was deleted) | Reassign a region in Users; the coordinator must then sign out and back in |
| Coordinator sees no data | Their region has no families, or all records are filtered out | Verify the families' `regionId` and the active/search filters |
| Dashboard Pelkat cards look empty | Seeded members all share an age bracket, or none are active/living | Check birth dates and `isActive`/`isDeceased`; reseed with `--reset` |
| Birthday list empty | No members with birthdays in the selected Sunday–Saturday week, or members inactive/deceased | Pick another date; verify `birthDate` and status |
| Province/regency dropdowns fail in production | `idn-area-data` CSVs were not traced into the deployment | Keep `outputFileTracingIncludes` in `next.config.ts` |
| E2E cannot start | Port 3000 occupied, or no seeded database | Stop the other server or let Playwright reuse it; seed the e2e database |
| Tailwind classes not applying | Tailwind 4 content/theme setup broken, or class strings built dynamically | Use static classes and check `app/globals.css` / PostCSS config |

---

## 14. Documentation index

| Document | Contents |
|---|---|
| [README.md](../README.md) | Quick overview, stack summary, and project map |
| [docs/QUICK_START.md](QUICK_START.md) | One-page Indonesian orientation for new staff |
| [docs/USER_MANUAL.md](USER_MANUAL.md) | Indonesian guide for dashboard users, page by page |
| [docs/API.md](API.md) | Endpoint-by-endpoint reference with request fields and response shapes |
| [docs/DATA_MODEL.md](DATA_MODEL.md) | Full Prisma schema, field tables, enums, and seed details |
| [docs/AUTH_RBAC.md](AUTH_RBAC.md) | Authentication flow, guards, RBAC lifecycle, default matrix |
| [docs/PRD.md](PRD.md) | Product requirements, personas, scope, acceptance criteria, and roadmap |
| [docs/E2E_TESTING.md](E2E_TESTING.md) | Playwright suite, local database setup, coverage, writing tests, CI and troubleshooting |
| [docs/BACKUP_RESTORE.md](BACKUP_RESTORE.md) | Backup schedule, restore and cutover procedure, verification queries, rehearsal checklist (NFR-REL-05) |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting, PII handling, secrets management, deployment hardening |
| [AGENTS.md](../AGENTS.md) | Repository instructions, including Next.js 16 documentation rule |

If code and documentation disagree, treat the code as authoritative and update the docs as
part of the change.
