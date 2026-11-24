# Product Requirements Document — Yudea App

**Product:** Yudea — Church Member Information System
**Organisation:** GPIB Yudea
**Document version:** 1.0 (as-built baseline)
**Status:** Current release implemented; future sections are proposals
**Date:** 9 November 2026
**Owner:** Church administration / product maintainer
**Related documents:** [Project Documentation](PROJECT_DOCUMENTATION.md) · [User Manual](USER_MANUAL.md) · [API Reference](API.md) · [Data Model](DATA_MODEL.md) · [Auth & RBAC](AUTH_RBAC.md)

---

## 1. Summary

Yudea is a web dashboard that gives a church office one authoritative record of its
congregation and the structure around it. It replaces scattered spreadsheets and
paper lists with a relational system covering branches, sectors, households, members,
ministry groups, presbyters, birthdays, service attendance, and exportable reports,
with role-based access so coordinators see only their own sector.

The current release is a functioning single-church application. This PRD records what
it does today (the baseline requirements), the rules that must remain true, and a
proposed path for the next releases.

---

## 2. Problem and context

### 2.1 Problem

Church administration depends on accurate, current member data. When household lists,
member profiles, ministry-group membership, presbyter lists, birthdays, and attendance
live in separate files:

- Staff re-enter the same data repeatedly and versions diverge.
- Reports take hours to assemble and are error-prone.
- Sector coordinators cannot update their own area without full access to everything.
- Sensitive personal data (birth dates, contact details, sacramental status) is shared
  more widely than necessary.
- Derived views — who is in which Pelkat, who is a presbyter, whose birthday is this
  week — are recalculated by hand.

### 2.2 Context and constraints

- One deployment serves one church organisation with multiple branches and sectors.
- Users are staff, sector coordinators, and read-only members, not external customers.
- The interface is Indonesian-first for church structure, with English tooling pages.
- Accounts are provisioned by an administrator; there is no public sign-up.
- Member data is personal and must only be visible to authenticated, authorised roles.
- The system must run on a standard Node.js host with PostgreSQL; exports must work
  without a document-generation service.

---

## 3. Goals and non-goals

### 3.1 Goals

| ID | Goal |
|---|---|
| G1 | Maintain one authoritative, relational record of branches, sectors, families, and members |
| G2 | Let staff complete routine administration without developer help |
| G3 | Give coordinators scoped access to their own sector |
| G4 | Produce common reports and lists without manual re-keying |
| G5 | Surface derived information (Pelkat, presbyters, birthdays) automatically |
| G6 | Protect member data through authentication and server-enforced permissions |

### 3.2 Non-goals (current release)

- Financial giving, donations, pledges, or accounting.
- Event scheduling beyond service attendance head-counts.
- Email, SMS, WhatsApp, or push notifications.
- A public/member self-service portal or mobile app.
- Sacrament registration workflows, certificates, or document management.
- Multi-tenant operation for unrelated churches.
- Payroll, staffing, or volunteer rosters.
- Offline use.

### 3.3 Success definition

The release is successful when the office can answer “who is in our congregation, where
do they live, which sector and household do they belong to, which ministry group are
they in, and what is coming up?” from the dashboard, and produce the corresponding
export, without consulting another file.

---

## 4. Users and personas

| Persona | Role | Needs | Success looks like |
|---|---|---|---|
| **Administrator** (church office lead / IT) | `ADMIN` | Full data access, account management, control over who can see or edit each page | Sets up the structure, creates coordinator accounts, adjusts permissions without code changes |
| **Office staff** | `STAFF` | Fast entry and correction of families, members, attendance; reports for services and meetings | Adds a household and its members in one flow; exports a filtered report in under a minute |
| **Sector coordinator** | `COORDINATOR` | A focused view of their own sector; ability to keep household and member data current there | Sees only their sector, updates a family, and cannot affect other sectors |
| **Viewer / congregation member** | `MEMBER` | Read-only access to the member and presbyter lists | Finds a member or presbyter without being able to change records |
| **Church leadership** (indirect) | Consumes outputs | Accurate summaries and exports for meetings and visitation | Receives a current report without asking staff to rebuild it |

---

## 5. Scope

### 5.1 In scope (implemented)

1. Credentials authentication with JWT sessions.
2. Four-role permission model, configurable per page and enforced by the API.
3. Branch, region, family, and member management.
4. Pelkat derivation and Pelkat-based views.
5. Presbyter list derived from church position.
6. Weekly birthday dashboard with export.
7. Service attendance head-counts with statistics.
8. Dashboard totals and distributions.
9. Filtered member report with XLSX and PDF output.
10. User administration, including coordinator-to-region assignment.
11. Cascading Indonesian administrative-region data for addresses.
12. Responsive UI with pagination, search, and URL-persisted sorting.

### 5.2 Out of scope (current release)

See [§3.2](#32-non-goals-current-release). Requests in these areas are candidates for a
future release, not defects in the current one.

---

## 6. Key user journeys

### J1 — Set up the organisation (Administrator)

1. Create a **Wilayah Pelayanan** (branch).
2. Create **Sektor Pelayanan** (regions) under it.
3. Create **Keluarga** (families) in each region, optionally adding members inline.
4. Add or complete **Warga Jemaat** (members) in each family.
5. Create a `COORDINATOR` user and assign their region.
6. Optionally adjust the role-access matrix on **Settings**.

**Outcome:** the structure is complete, coordinators can work, and no records are orphaned.

### J2 — Record a new household (Staff)

1. Open **Keluarga** → create.
2. Enter family name, address (province → regency → district → village), and sector.
3. Add the family head, spouse, and children inline.
4. Save; open **Warga Jemaat** to review or complete sacramental details.

**Outcome:** the household and its members exist with correct sector and address data.

### J3 — Prepare a service report (Staff)

1. Open **Laporan Warga Jemaat**.
2. Filter by Pelkat and/or sector.
3. Review the count and sortable table.
4. Export XLSX or PDF (or print).

**Outcome:** a shareable report reflecting current data, with no manual transcription.

### J4 — Update a family in one sector (Coordinator)

1. Sign in; land on **Keluarga**.
2. Only families in the assigned sector are listed.
3. Edit the family or member; mark a family inactive when it transfers out.

**Outcome:** the change is saved, and out-of-sector records are neither visible nor
writable.

### J5 — Check this week's birthdays (Staff / Coordinator)

1. Open **Ulang Tahun**.
2. The current Sunday–Saturday week loads by default; choose another date to shift weeks.
3. Review, sort, export XLS, or print.

**Outcome:** an accurate visitation list for the week.

---

## 7. Functional requirements

Priority key: **P0** = required and present in the current release; **P1** = proposed next;
**P2** = later candidate.

### 7.1 Authentication and session (`AUTH`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| AUTH-01 | P0 | A user can sign in with email and password | Valid credentials create a session and redirect to the role's landing page; invalid credentials show a generic error and no session |
| AUTH-02 | P0 | Passwords are stored as bcrypt hashes and never returned by the API | No endpoint returns a password field; comparison uses bcrypt |
| AUTH-03 | P0 | Sessions are JWT-based and survive page reloads until logout or expiry | Reload keeps the user signed in; the token carries id, role, and regionId |
| AUTH-04 | P0 | Unauthenticated dashboard requests redirect to login; unauthenticated API requests return 401 | `/dashboard/*` redirects with `callbackUrl`; `/api/*` returns JSON `401` |
| AUTH-05 | P0 | A user can sign out | Sign-out clears the session and client-side mirrors and returns to login |
| AUTH-06 | P0 | There is no public registration or self-service password reset | No sign-up route exists; only an admin can create or reset an account |
| AUTH-07 | P1 | An administrator can trigger a password reset | A reset flow exists and invalidates the old password |

### 7.2 Roles and permissions (`RBAC`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| RBAC-01 | P0 | Four roles exist: `ADMIN`, `STAFF`, `COORDINATOR`, `MEMBER` | Each role can be assigned to a user; role values are validated |
| RBAC-02 | P0 | Each page has a View list and an Edit list of roles, with defaults | Defaults match the published matrix; Edit is a subset of View |
| RBAC-03 | P0 | An administrator can change permissions in the UI and persist them | Save updates `AppSetting`, the client mirror, sidebar, and guards |
| RBAC-04 | P0 | The server enforces View and Edit independently of the UI | A direct API call by a role without permission returns `403` |
| RBAC-05 | P0 | Permission checks deny by default | A missing or empty allow-list grants no access |
| RBAC-06 | P0 | Settings is always admin-only, regardless of persisted overrides | Non-admin users cannot view or save the matrix |
| RBAC-07 | P0 | Coordinators are scoped to their assigned region | With a region assigned, list reads and writes outside it return no data or `403`, and out-of-region single records return `404`; a coordinator without a region receives `403` on every guarded API |
| RBAC-08 | P0 | Unauthorised UI actions are hidden, not just disabled | Edit buttons, action columns, and create controls are absent without Edit permission |

### 7.3 Branches — Wilayah Pelayanan (`BR`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| BR-01 | P0 | Authorised users can list branches with search and pagination | List returns `{ data, meta }`; search matches branch name |
| BR-02 | P0 | Authorised users can create, rename, and delete a branch | Name is required; deleting a branch cascades to its regions, families, and members and unassigns users from those regions, after confirmation |
| BR-03 | P0 | Branch data appears in dashboard totals and region forms | Dashboard branch total updates; region form lists branches |

### 7.4 Regions — Sektor Pelayanan (`REG`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| REG-01 | P0 | Authorised users can list, create, edit, and delete regions | Name and parent branch are required |
| REG-02 | P0 | A region stores an optional coordinator-member relation | `coordinatorMemberId` is unique, so one member coordinates at most one region; the relation is returned by the region API |
| REG-03 | P0 | An administrator can assign a coordinator user to a region | Creating or promoting a `COORDINATOR` requires a region; scoping applies after the next sign-in |
| REG-04 | P0 | Members-per-region counts are available | Counts reflect all members in each region's families; a coordinator sees only their region |
| REG-05 | P0 | Coordinators see only their own region in region views | Other regions are absent from lists and counts |
| REG-06 | P1 | The coordinator member can be chosen or changed from the Regions UI | Saving the region updates the relation and is reflected in later reads |

### 7.5 Families — Keluarga (`FAM`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| FAM-01 | P0 | Authorised users can list families with region and members included | List is paginated, searchable by family/region, and sortable |
| FAM-02 | P0 | A family can be created with an optional set of members in one submission | Family and members are persisted together; validation errors identify the field |
| FAM-03 | P0 | A family stores a structured Indonesian address | Province, regency, district, and village can be selected in cascade; saved values persist |
| FAM-04 | P0 | A family can be edited, including moving it to another region (subject to role scope) | Updates persist; coordinators cannot move a family out of their region |
| FAM-05 | P0 | Family status can be changed for all members at once | `isActive` and optional `tanggalPindah` apply to every member; response reports the count |
| FAM-06 | P0 | A family can be split into a new family | Selected members move, the chosen head becomes `FAMILY_HEAD`, and only original-family members can be moved |
| FAM-07 | P0 | Deleting a family removes its members and clears coordinator references | No orphaned members or dangling coordinator links remain |
| FAM-08 | P0 | Family views support search, sorting, and pagination | Sort state survives reload via the URL |

### 7.6 Members — Warga Jemaat (`MEM`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| MEM-01 | P0 | Authorised users can list members with family and region context | List is paginated and includes family and region names |
| MEM-02 | P0 | A member can be created and edited with the full profile | Required identity, birth, gender, family role, and family are enforced; optional sacramental, position, contact, and education fields persist |
| MEM-03 | P0 | Members can be searched by name, email, phone, or family name | Search is case-insensitive and paginated |
| MEM-04 | P0 | Members can be filtered by region and Pelkat | Filters combine correctly with search and role scoping |
| MEM-05 | P0 | Members can be sorted by name, role, region, Pelkat, and active status | Sorting persists in the URL; Pelkat sorting is computed correctly |
| MEM-06 | P0 | Pelkat is derived from birth date, gender, and family role | Computed value matches the published rules for every member response |
| MEM-07 | P0 | Presbyters are members with `jabatan` = `DIAKEN` or `PENATUA` | The presbyter list contains exactly those members and supports region filtering |
| MEM-08 | P0 | A member can record active/deceased status and transfer date | Inactive/deceased members are excluded from birthday results and reflected in the UI |
| MEM-09 | P0 | A member may use the family address or an individual address | Choosing an individual address persists the override; choosing family address clears it |
| MEM-10 | P0 | A member can be deleted, including when they coordinate a region | The deletion clears `Region.coordinatorMemberId` first |
| MEM-11 | P1 | Duplicate member detection by name + birth date | Creating a likely duplicate prompts confirmation |

### 7.7 Attendance (`ATT`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| ATT-01 | P0 | Authorised users can list attendance records with search and sorting | Search matches service type; columns sort; pagination works |
| ATT-02 | P0 | A record stores date, service type, male and female counts | Total is computed server-side as the sum |
| ATT-03 | P0 | One record exists per date and service type | A duplicate submission returns `409` with a clear message |
| ATT-04 | P0 | Records can be edited and deleted | Updates recompute the total; deletion requires confirmation |
| ATT-05 | P0 | The page shows aggregate statistics | Total, average, male, and female figures reflect the records in view |

### 7.8 Birthdays — Ulang Tahun (`BDAY`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| BDAY-01 | P0 | The page shows birthdays for a Sunday–Saturday week | Default is the current week; choosing a date selects its week |
| BDAY-02 | P0 | Only active, living members are included | Inactive or deceased members never appear |
| BDAY-03 | P0 | Week ranges crossing year-end work | A late-December week includes early-January birthdays |
| BDAY-04 | P0 | Coordinators see only their region's birthdays | Members from other regions are absent |
| BDAY-05 | P0 | The list can be sorted, exported to XLS, and printed | Export contains the same rows as the table |

### 7.9 Reports — Laporan Warga Jemaat (`RPT`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| RPT-01 | P0 | A report can be filtered by Pelkat and sector | Filters combine; “all” returns the full permitted set |
| RPT-02 | P0 | The report shows family, member, address, birth date, and sector | Address respects the member's address override |
| RPT-03 | P0 | The report exports to XLSX and PDF | Files download with readable columns and the current filter context |
| RPT-04 | P0 | The report is scoped for coordinators when Report view is granted | Only their region's members are included |
| RPT-05 | P0 | The displayed row count matches the filter | Count updates with the applied filters |

### 7.10 Dashboard (`DASH`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| DASH-01 | P0 | Show totals for members, families, regions, and branches | Numbers match the database for the permitted scope |
| DASH-02 | P0 | Show gender and blood-type distributions | Counts reconcile with member records |
| DASH-03 | P0 | Show Pelkat distribution | Every Pelkat category appears, including zero-count groups |
| DASH-04 | P0 | Show members per region and link to the filtered member list | Clicking a region opens members filtered to it |
| DASH-05 | P0 | Coordinator totals are scoped to their region | Other regions' numbers are excluded |

### 7.11 Users and administration (`USR`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| USR-01 | P0 | An admin can list, create, edit, and delete users | List exposes name, email, and role only |
| USR-02 | P0 | A user has a validated role; coordinators must be assigned a region | Invalid roles are rejected; a `COORDINATOR` without a region is rejected; region assignment affects scoping after next sign-in |
| USR-03 | P0 | Passwords meet a minimum length and are hashed | Passwords shorter than 6 characters are rejected; no plaintext is stored or returned |
| USR-04 | P0 | An admin cannot delete their own account | Attempting it returns a clear error; the session remains valid |
| USR-05 | P1 | An admin cannot lock the organisation out by deleting the last admin | The last remaining admin account is protected |

### 7.12 Indonesian administrative regions (`GEO`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| GEO-01 | P0 | Province, regency, district, and village lists are available in cascade | Selecting a parent loads the correct children; stable data is cached |
| GEO-02 | P0 | Address data is stored on families and optional member overrides | Values round-trip through create/edit forms |

### 7.13 Cross-cutting UX (`UX`)

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| UX-01 | P0 | Lists paginate, search, and sort consistently | Controls reset to page 1 appropriately; sort persists in the URL |
| UX-02 | P0 | Loading, empty, and error states are visible | No blank screen during fetch; failures are explained |
| UX-03 | P0 | Mutations give feedback and destructive actions confirm | Success/error toast appears; delete asks first |
| UX-04 | P0 | The layout works on desktop and mobile | Sidebar collapses to a sheet; tables scroll horizontally |
| UX-05 | P0 | Access-restricted users see an explanation, not a broken page | A restricted card offers a link to the user's default page |

---

## 8. Business rules and data requirements

### 8.1 Structural integrity

1. A family belongs to exactly one region; a region belongs to exactly one branch.
2. A member belongs to exactly one family.
3. Deleting a family deletes its members and clears any coordinator reference to them.
4. Deleting a region deletes its families and members and unassigns users from that region.
5. Deleting a branch cascades to its regions, families, and members and unassigns users from
   those regions.
6. Deleting a region unassigns its coordinator users. Because a coordinator without a
   region is denied by the auth guards, those accounts cannot read or write data until an
   admin reassigns a region.
7. One member may coordinate at most one region (`coordinatorMemberId` is unique).
8. A user may be assigned to at most one region as coordinator.

### 8.2 Derived data

1. **Pelkat** is computed from age, gender, and family role at read time:
   - 0–12, not married → `PELAYANAN_ANAK`
   - 13–16, not married → `PERSEKUTUAN_TARUNA`
   - 17–35, not married → `GERAKAN_PEMUDA`
   - 36–59 → `PERSEKUTUAN_KAUM_BAPAK` (male) / `PERSEKUTUAN_KAUM_PEREMPUAN` (female)
   - Married and under 36 → `PERSEKUTUAN_KAUM_BAPAK` (male) / `PERSEKUTUAN_KAUM_PEREMPUAN` (female)
   - 60+ → `PERSEKUTUAN_KAUM_LANJUT_USIA`
2. **Married** means the family role is `FAMILY_HEAD` or `WIFE`.
3. **Presbyter** means `jabatan` is `DIAKEN` or `PENATUA`; there is no separate flag.
4. The stored `pelkat` column is not authoritative; computed values are.

### 8.3 Status rules

1. `isActive` defaults to true; `isDeceased` defaults to false.
2. Family status changes cascade to every member in that family.
3. Inactive and deceased members are excluded from birthday results.
4. Attendance requires a date, service type, and non-negative counts.
5. Duplicate attendance for the same date and service type is rejected.

### 8.4 Data quality

1. Required identity fields: first name, gender, birth date, family role, family.
2. Birth city and phone are collected by the form; the API tolerates empty optional values.
3. Blood type is optional and may be “not specified”.
4. Addresses support a family default plus an optional per-member override.
5. Names and family names are searchable case-insensitively.

### 8.5 Retention

No retention or archival policy is implemented. Deletion is permanent. A future release
should define retention, export-before-delete, and backup expectations with the church.

---

## 9. Permissions matrix (defaults)

| Page | View | Edit |
|---|---|---|
| Dashboard | Admin, Staff, Coordinator | Admin, Staff |
| Ulang Tahun | Admin, Staff, Coordinator | Admin, Staff, Coordinator |
| Wilayah Pelayanan | Admin, Staff | Admin, Staff |
| Sektor Pelayanan | Admin, Staff, Coordinator | Admin, Staff |
| Keluarga | Admin, Staff, Coordinator | Admin, Staff, Coordinator |
| Warga Jemaat | Admin, Staff, Coordinator, Member | Admin, Staff, Coordinator |
| Majelis Jemaat | Admin, Staff, Coordinator, Member | Admin, Staff, Coordinator |
| Pelkat Members | Admin, Staff | Admin, Staff |
| Laporan Warga Jemaat | Admin, Staff | Admin, Staff |
| Attendance | Admin, Staff | Admin, Staff |
| Users | Admin | Admin |
| Settings | Admin | Admin (hard-coded) |

Rules:

- Edit requires View.
- The matrix is a starting point, not a fixed policy; admins may narrow or widen it except
  for Settings.
- Server enforcement uses the same persisted matrix as the UI.

---

## 10. Non-functional requirements

### 10.1 Security and privacy

| ID | Priority | Requirement |
|---|---|---|
| NFR-SEC-01 | P0 | All data access requires an authenticated session; there are no public data endpoints |
| NFR-SEC-02 | P0 | Every read and write is authorised server-side against the persisted View/Edit lists |
| NFR-SEC-03 | P0 | Passwords use bcrypt; secrets are read from environment variables and never shipped to the client |
| NFR-SEC-04 | P0 | Write bodies are schema-validated; invalid input is rejected with field errors |
| NFR-SEC-05 | P0 | A coordinator can read and write only within their assigned region; a coordinator without a region is denied |
| NFR-SEC-06 | P0 | The client-side session/RBAC mirror is treated as a rendering cache, never as the security boundary |
| NFR-SEC-07 | P1 | An audit log records security-relevant changes (role, permission, and user-account changes) |
| NFR-SEC-08 | P0 | Single-record reads (`/api/member/:id`, `/api/family/:id`, `/api/region/:id`) are region-scoped for coordinators |
| NFR-SEC-09 | P1 | Session cookies and client mirrors have a documented, reviewed lifetime and clearing policy |

### 10.2 Performance

| ID | Priority | Requirement |
|---|---|---|
| NFR-PERF-01 | P0 | List endpoints paginate on the server; `limit` is capped at 10,000 |
| NFR-PERF-02 | P0 | Frequently filtered columns are indexed (family, name, status, gender, Pelkat, birth date, region, service date/type) |
| NFR-PERF-03 | P0 | The client caches queries for 30 seconds and avoids refetch on window focus |
| NFR-PERF-04 | P0 | Dashboard aggregates run in parallel rather than serially |
| NFR-PERF-05 | P1 | Define and monitor a latency target (proposed: P95 < 2 s for first page load on a typical dataset) |

### 10.3 Reliability and data safety

| ID | Priority | Requirement |
|---|---|---|
| NFR-REL-01 | P0 | Multi-step family/member operations run in transactions |
| NFR-REL-02 | P0 | Expected conflicts (duplicate attendance, missing record) return specific 4xx responses, not 500 |
| NFR-REL-03 | P0 | Migration history is versioned in `prisma/migrations`; production uses `migrate deploy` |
| NFR-REL-04 | P0 | The seed script refuses to wipe populated data unless explicitly reset |
| NFR-REL-05 | P1 | Database backup, restore, and retention procedures are documented and rehearsed |

### 10.4 Usability and compatibility

| ID | Priority | Requirement |
|---|---|---|
| NFR-UX-01 | P0 | Modern evergreen browsers (Chrome, Edge, Firefox, Safari) are supported |
| NFR-UX-02 | P0 | The UI is usable at mobile widths; navigation collapses and tables scroll |
| NFR-UX-03 | P0 | Common table operations (search, sort, paginate) behave consistently across pages |
| NFR-UX-04 | P0 | Form validation messages identify the field and the problem |
| NFR-UX-05 | P1 | A basic accessibility review (keyboard, focus, labels, contrast) is completed and issues fixed |
| NFR-UX-06 | P1 | Localisation is centralised so the UI can be delivered consistently in Indonesian and English |

### 10.5 Maintainability and observability

| ID | Priority | Requirement |
|---|---|---|
| NFR-MNT-01 | P0 | TypeScript across the app; shared domain types and Zod schemas |
| NFR-MNT-02 | P0 | Unit/component tests (Vitest, 407 tests) and E2E tests (Playwright, 3 specs) exist and pass |
| NFR-MNT-03 | P0 | Every new API write uses the shared auth, validation, and error helpers |
| NFR-MNT-04 | P0 | Documentation is updated with feature, API, permission, or schema changes |
| NFR-MNT-05 | P1 | CI runs lint, unit tests, and build on every change |
| NFR-MNT-06 | P1 | Structured logging, error tracking, and a health endpoint are added |

---

## 11. Success metrics

No analytics or telemetry is currently instrumented. The following are **proposed**
measures for the next release, to be collected manually or through server logs until a
monitoring tool is added.

| Metric | Proposed target | Measurement |
|---|---|---|
| Record completeness | ≥ 95% of active members linked to a family with a region and birth date | Database query |
| Report preparation time | < 5 minutes from filter to exported file | Staff observation / survey |
| Weekly birthday use | Birthday list reviewed before each week's visitation | Usage check or staff confirmation |
| Attendance coverage | A record for every scheduled service | Attendance table vs service calendar |
| Unauthorised changes | Zero successful writes by roles without Edit permission | API 403 logs + spot checks |
| Access-review currency | Permission matrix reviewed each quarter | Admin checklist |
| Page performance | P95 < 2 s for the member list at 10 rows | Server/browser timing once instrumented |
| Data incidents | Zero reported cross-region exposures | Incident log |

---

## 12. Release plan

### 12.1 Current release — v0.1 (baseline, implemented)

All P0 requirements in §7 and §10 are present. The application supports the full
branch → region → family → member model, role-based access with server enforcement,
Pelkat and presbyter views, birthday and attendance dashboards, reports, user
administration, and responsive UI.

### 12.2 Proposed next release — v0.2 (hardening and operations)

Candidate P1 scope, in suggested order:

1. **Audit log** for permission, role, and account changes (NFR-SEC-07).
2. **Password reset** by an administrator (AUTH-07).
3. **CI pipeline** for lint, Vitest, and build (NFR-MNT-05).
4. **Observability**: structured logging, error tracking, health endpoint (NFR-MNT-06).
5. **Backup and restore runbook** (NFR-REL-05).
6. **Accessibility review** (NFR-UX-05).
7. **Duplicate member warning** (MEM-11) and **last-admin protection** (USR-05).

### 12.3 Later candidates — v0.3+

- Centralised localisation / full bilingual UI (NFR-UX-06).
- Bulk member import from spreadsheet with validation and preview.
- Member-linked attendance rather than head-counts only.
- Notifications for birthdays and follow-ups.
- Read-only member self-service portal.
- Multi-church/multi-tenant support, only if the organisation requires it.

Priorities should be confirmed with church leadership; this list is a proposal, not a
commitment.

---

## 13. Risks, assumptions, and dependencies

### 13.1 Assumptions

1. One deployment serves one church organisation; branches are internal structure, not
   separate tenants.
2. The member population is in the low thousands, so a single PostgreSQL instance and
   indexed pagination are sufficient.
3. An administrator is available to create accounts and maintain the permission matrix.
4. Staff have modern browsers and a reliable network connection.
5. Indonesian administrative-region data from `idn-area-data` is acceptable as the
   address reference.

### 13.2 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Member PII exposed through misconfigured permissions | High | Deny-by-default checks; server-side enforcement; review matrix regularly; proposed audit log |
| Coordinator's region changes take effect only after re-login | Low | JWT captures `regionId` at sign-in; document the re-login step when reassigning accounts |
| Permission matrix becomes inconsistent with operational roles | Medium | Quarterly access review; reset-to-defaults control; clear View/Edit labels |
| Derived Pelkat drifts from expectations | Medium | Documented rules and unit tests; computed consistently at read time |
| Accidental deletion of a branch, region, family, or member | High | Confirmation dialogs and transactional cleanup; parent deletes cascade, so proposed soft-delete/audit and backups are important |
| No backup or restore procedure | High | Define and rehearse before relying on the system as the sole record |
| Demo/seed data used in production | Medium | Seed guard and explicit `--reset`; separate environments |
| Exports containing PII are shared too broadly | Medium | Role-restricted export access; treat downloaded files as sensitive |
| Shared development database used for destructive tests | Medium | Use a local e2e database; do not run `--reset` against shared data |
| Single administrator bottleneck | Medium | Document admin tasks; plan a second admin account |

### 13.3 Dependencies

- PostgreSQL availability and performance.
- Next.js 16 and NextAuth v5 beta compatibility.
- `idn-area-data` CSV availability at runtime (traced into deployments).
- Browser support for client-side XLSX/PDF generation.
- Correct environment configuration (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`,
  `NEXTAUTH_SECRET`).

---

## 14. Open questions

1. What is the expected maximum number of members and families over the next three years?
2. Who is the data controller, and what retention period applies to former members?
3. Should `MEMBER` role users see the full member list, or only their own household?
4. Should attendance eventually link to individual members, or remain head-counts?
5. Are notifications (birthdays, follow-ups) required, and through which channel?
6. Is a member self-service portal planned, and would it change the role model?
7. Is multi-church/multi-tenant support required, or will each church get a deployment?
8. What password policy and session lifetime should apply?
9. Are audit logs or regulatory reporting required by the organisation?
10. Which UI language should be canonical — Indonesian, English, or both?

---

## 15. Release acceptance checklist (current baseline)

- [x] A seeded admin can sign in and reach the dashboard.
- [x] A staff user can manage branches, regions, families, members, and attendance.
- [x] A coordinator with an assigned region sees only that region, is blocked from
      cross-region writes, and gets `404` for out-of-region single records.
- [x] A coordinator without a region is denied (`403`) on all guarded data APIs.
- [x] A member-role user can view members and presbyters but cannot edit.
- [x] Direct API calls by unauthorised roles return `403`.
- [x] Pelkat values match the documented rules.
- [x] The presbyter list contains only `DIAKEN` and `PENATUA`.
- [x] The birthday week, including year-end wrap, is correct.
- [x] Duplicate attendance returns `409`.
- [x] Reports export to XLSX and PDF with filters applied.
- [x] Permission changes persist and take effect in the sidebar and API.
- [x] The UI works at desktop and mobile widths.
- [x] `npm test` passes (407 tests) and the Playwright specs pass against a seeded local
      database.

---

## Appendix A — Glossary

| Term | Meaning |
|---|---|
| Warga Jemaat | Church member |
| Keluarga | Family/household |
| Sektor Pelayanan | Service sector; the region coordinators manage |
| Wilayah Pelayanan | Service area/branch above sectors |
| Pelkat | Ministry group derived from age, gender, and family role |
| Majelis Jemaat | Church council; in this system, members with `DIAKEN`/`PENATUA` position |
| Presbyter | Deacon or elder (`DIAKEN` / `PENATUA`) |
| Ulang Tahun | Birthday |
| Jabatan | Church position |
| Baptis / Sidi / Perkawinan | Baptism / confirmation / marriage status |

## Appendix B — Requirement priority summary

| Area | P0 (current) | P1 (proposed next) |
|---|---|---|
| Auth | Login, JWT session, guards, logout, no self-registration | Admin-triggered password reset |
| RBAC | Four roles, editable matrix, server enforcement, coordinator scoping (including single records and unassigned accounts) | Audit log |
| Organisation | Branch, region, family, member CRUD and rules | Duplicate detection; last-admin protection |
| Views | Dashboard, Pelkat, presbyters, birthdays, attendance | — |
| Reports | Filtered XLSX/PDF export | — |
| Operations | Tests, migrations, seed guard | CI, observability, backups, accessibility review |
