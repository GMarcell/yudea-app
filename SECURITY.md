# Security Policy

Yudea App is a church administration dashboard. It stores personal data about congregation
members and their families, so security reports are taken seriously even though this is a
small, pre-1.0 project.

This document covers how to report a vulnerability, what data the application holds, how
authentication and authorisation work, how secrets must be managed, and the hardening steps
that deployment operators are responsible for.

---

## 1. Supported versions

| Version | Supported |
|---|---|
| `0.1.x` (current, `main`) | Yes — fixes land on `main` |
| Older tags/forks | No |

There are no LTS branches or backports. Security fixes are applied to `main` and must be
deployed by the operator; the repository has no CI or release pipeline that ships them
automatically.

---

## 2. Reporting a vulnerability

**Do not open a public issue for a suspected vulnerability.** Public issues are visible to
everyone and may expose member data or a working exploit.

Preferred channel: a private GitHub security advisory on this repository
(`Security` → `Advisories` → `Report a vulnerability`), or the form at
`https://github.com/<owner>/yudea-app/security/advisories/new`.

Alternative: email the maintainer at **<security-contact@example.com>** — replace this with a
real, monitored address before relying on it.

Please include:

- What you found, and the affected route, file, or commit.
- Reproduction steps, or a proof of concept. Use **synthetic data only** — never attach real
  member records, screenshots containing congregation data, or production credentials.
- The impact you believe it has (for example: read another region's members, sign in without
  a password, escalate to `ADMIN`).
- Whether the issue is already public anywhere.

What to expect:

| Stage | Target |
|---|---|
| Acknowledgement | 5 business days |
| Initial assessment and severity | 10 business days |
| Fix or mitigation plan for confirmed issues | 30 days for high/critical, best effort otherwise |

This is a volunteer-maintained project with a single maintainer, so these are targets rather
than contractual commitments. Please allow time for a fix before public disclosure; we will
credit reporters who want it, and will tell you if a report is out of scope.

**Safe harbour:** good-faith research that stays within your own test deployment, avoids real
member data, does not degrade service, and does not attempt persistence or data exfiltration
will not be pursued. Testing against a production instance that holds real congregation data
is not authorised.

Out of scope: missing hardening headers with no demonstrated impact, reports that require a
compromised host or database, volumetric denial of service, social engineering, and
vulnerabilities in third-party services or the hosting platform (report those upstream).

---

## 3. Data the application holds

All persistent state is in one PostgreSQL database (see
[docs/DATA_MODEL.md](docs/DATA_MODEL.md)). Treat it as confidential.

| Data | Where | Notes |
|---|---|---|
| Member names, birth city/date, gender, phone, email | `Member` | Children are included — `PELAYANAN_ANAK` covers minors |
| Home address, kecamatan/kelurahan, region | `Family`, `Member` | Precise location data |
| Sacramental status and dates (baptism, sidi, marriage), church of origin | `Member` | Religious belief data |
| Blood type, occupation, education, church/ organisation experience | `Member` | Optional free-text fields |
| Login name, email, role, region assignment, bcrypt password hash | `User` | Never expose hashes or return them from an API |
| Attendance head counts per service | `Attendance` | Aggregate, not per-person |
| RBAC permission matrix | `AppSetting` (`role_access_config`) | Changing it changes who can edit what |
| Break-glass admin address and last sign-in time | `User` | The password itself is only in the password manager and as a bcrypt hash |

Notes:

- **No financial, payment, or government-ID data** is stored. There are no uploaded files; the
  app has no file storage.
- **Exports leave the server.** XLSX/PDF generation runs entirely in the browser, so exported
  files land on the user's device and are outside any server-side control. Users should treat
  exports as confidential and not email or share them casually.
- **Backups contain all of the above, including password hashes.** See
  [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) for encryption, access, and retention
  requirements.
- Depending on jurisdiction, this data falls under data-protection law (for example
  Indonesia's UU PDP No. 27/2022). The operator is the data controller and is responsible for
  lawful basis, retention limits, subject requests, and breach notification.

### 3.1 Handling rules for contributors and operators

- Use **synthetic or seeded data** in development, tests, screenshots, bug reports, and demos.
  The seed script creates fictional records; never copy a production dump into a dev machine.
- Do not log member data, request bodies, credentials, or session tokens. Error handling logs a
  route label and the error object (`handleApiError`); keep it that way.
- Do not place PII in issue titles, commit messages, analytics, or error-tracker breadcrumbs.
- Prefer the minimum data needed: do not add new personal fields without a stated purpose, and
  do not widen what an existing endpoint returns.
- Delete exported files and scratch databases when finished.

---

## 4. Authentication and authorisation

### 4.1 Authentication

- **NextAuth v5 (Auth.js), credentials provider only.** No OAuth providers are enabled, and
  `Account`/`Session` tables are unused.
- Passwords are hashed with **bcrypt, cost 10** (`bcryptjs`). `authorize()` returns `null` for
  unknown email, missing hash, or a failed compare, so the response does not reveal which part
  was wrong.
- **JWT sessions**, signed with `NEXTAUTH_SECRET` (falling back to `AUTH_SECRET`). Session
  cookies are `httpOnly` and `SameSite=Lax`, and are marked `Secure` on HTTPS by Auth.js. The
  proxy layer (`proxy.ts`) redirects unauthenticated page requests to the login page and
  returns `401` JSON for unauthenticated `/api/*` requests.
- There is **no registration, self-service password reset, email verification, MFA, account
  lockout, or login rate limiting**. An admin creates accounts and resets passwords. If the app
  is internet-facing, put rate limiting and bot protection in front of `/public/login` and
  `/api/auth/*` at the edge or reverse proxy.
- **One break-glass `ADMIN` account** can be provisioned for lockout recovery with
  `scripts/break-glass.ts`. It is a normal credentials account (generated 256-bit password,
  bcrypt-hashed), hidden from user management and immutable through the API. The password is
  shown once and belongs in the church password manager. See
  [docs/AUTH_RBAC.md](docs/AUTH_RBAC.md#break-glass-admin).
- Password policy is enforced only by the API schema: **minimum 6 characters**, no complexity
  or breach-list check. Encourage longer passwords; consider raising the minimum if you fork
  this project.

### 4.2 Authorisation

- Roles are `ADMIN`, `STAFF`, `COORDINATOR`, `MEMBER`, with defaults persisted in
  `AppSetting.role_access_config` and merged with `lib/rbac.ts`. Settings is hardcoded
  admin-only regardless of stored overrides.
- Reads use `requireViewAccess(path)`, writes use `requireEditAccess(path)`, and admin
  resources use `requireAdmin()`. Permission lookup is **deny-by-default**: an unknown path or
  missing role gets `403`.
- `COORDINATOR` accounts are scoped to their `regionId`; an unassigned coordinator is rejected
  with `403` rather than falling back to unscoped data. Single-record reads and writes outside
  that region return `404`/`403`.
- **Client-side role checks are UX only.** They hide buttons and pages; they are not a security
  boundary. Every mutation and every data read must also be guarded server-side. When adding an
  endpoint, follow [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) §11.1.

### 4.3 Session and account caveats

- The JWT captures `role` and `regionId` at sign-in. Demoting a user, moving a coordinator to
  another region, or deleting their assignment takes effect only after they sign out and back
  in. Until then the old permissions remain valid.
- Sessions **cannot be revoked individually**: there is no session table to delete. The only
  global revocation is rotating `NEXTAUTH_SECRET`, which signs everyone out.
- `trustHost: true` means Auth.js trusts the incoming `Host`/`X-Forwarded-Host` headers. Only
  deploy behind a proxy that sets these correctly, and set `NEXTAUTH_URL` to the canonical
  origin.

---

## 5. Secrets management

### 5.1 What is secret

| Variable | Why it matters |
|---|---|
| `NEXTAUTH_SECRET` (or `AUTH_SECRET`) | Signs session JWTs. Leaking it allows forging sessions for any role, including `ADMIN`. |
| `DATABASE_URL` / `DIRECT_URL` | Full read/write access to all member data. |
| `NEXTAUTH_URL` | Not secret, but must be the real origin or redirects and cookies break. |
| Backup encryption passphrase | Decrypts every member record and password hash. |
| Hosting/platform API tokens | Deployment and environment access. |

There are **no `NEXT_PUBLIC_*` secrets** in this project, and none should be added: anything
prefixed `NEXT_PUBLIC_` is embedded in the client bundle. Never import server-only modules
(`lib/prisma`, `lib/server-auth`, `auth.ts`) into a client component.

### 5.2 Rules

- **Never commit secrets.** `.gitignore` ignores `.env*`. Use your host's environment/secret
  store for production and a local, untracked `.env` for development. If a secret is committed,
  rotate it immediately — removing it from `HEAD` does not remove it from history or forks.
- **Use different secrets per environment.** A dev `NEXTAUTH_SECRET` must not be reused in
  production, and the production database credentials must not be usable from laptops.
- **Generate strong values**, for example `openssl rand -base64 32` for `NEXTAUTH_SECRET`.
  Store them where the runtime can read them but developers and CI logs cannot.
- **Restrict database roles.** The application needs `SELECT/INSERT/UPDATE/DELETE` on its
  tables; it does not need `SUPERUSER`, `CREATEDB`, or ownership of other databases. Use a
  separate, more privileged role for migrations and backups.
- **Require TLS to the database** (`sslmode=require` or stricter) and to the app.
- **Rotate on exposure or staff change.** Rotating `NEXTAUTH_SECRET` invalidates every session;
  rotating database credentials requires updating the app and any backup jobs together.
- **Keep the default `.env` away from real data.** The repository's documented default may
  point at a shared hosted database; the docs already warn that it is unsafe for destructive
  tests.

### 5.3 Never ship these to production

`prisma/seed.ts` and `prisma/seed-birthday.ts` create demo accounts with fixed, documented
passwords (`admin@example.com` / `admin123`, `demo@example.com` / `demo1234`,
`coordinator-{a,b,c}@example.com` / `coordinator123`). They exist for development and E2E only.
On a production deployment:

- Do not run the seed script against production.
- If demo users exist, delete them or change their passwords before exposing the app.
- Do not reuse those emails in real accounts, and do not let the demo data reach a public
  instance.

---

## 6. Deployment hardening checklist

The repository ships no deployment manifest or CI pipeline, so these controls are the
operator's responsibility.

- [ ] Serve the app over **HTTPS only**; redirect HTTP and enable HSTS at the proxy/CDN.
- [ ] Set `NEXTAUTH_URL` to the canonical HTTPS origin and a unique, strong
      `NEXTAUTH_SECRET`.
- [ ] Add security headers at the proxy or in `next.config.ts`: `Content-Security-Policy`
      (start from `default-src 'self'` and allow what the app needs), `X-Content-Type-Options:
      nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` or
      `frame-ancestors 'none'`, and `Permissions-Policy`. **The application currently sets
      none of these itself.**
- [ ] Put rate limiting on `/public/login`, `/api/auth/*`, and ideally all `/api/*` routes.
- [ ] Remove or rotate all seeded/demo accounts.
- [ ] Restrict database network access to the app and backup hosts only, with TLS required.
- [ ] Use a least-privilege database role; keep migration and backup credentials separate.
- [ ] Enable automated, encrypted database backups with tested restores
      ([docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)).
- [ ] Keep `npm audit`/Dependabot alerts on — there is no CI to catch vulnerable dependencies.
- [ ] Keep the build and dependency lockfile reproducible; do not deploy untested `main`.
- [ ] Decide and document a retention period for member records and exports, and a process for
      correction/deletion requests.
- [ ] Ensure error pages and API errors do not return stack traces or database details
      (`handleApiError` returns generic messages; keep that behaviour).

---

## 7. Known security limitations

These are current, verified behaviours — not unfixed bugs being hidden. Operators must
compensate where the risk matters.

- **No rate limiting, CAPTCHA, account lockout, or MFA.** Credential stuffing against a weak
  6-character password is feasible if the login is exposed without edge protection.
- **No audit trail.** There is no record of who viewed, edited, or deleted a member, family,
  region, or user. This limits both incident investigation and insider-threat detection. The
  only access record is `User.breakGlassLastUsedAt`, updated when the emergency admin signs in;
  its sign-ins are also written to the server log, so keep those logs.
- **Hard deletes with cascades.** Deleting a branch/region/family/member is permanent and
  cascades to children. There is no recycle bin; recovery depends on backups.
- **No fine-grained per-record permissions.** Access is role- and region-based only; any
  `STAFF` or `MEMBER` account granted edit access to a page can edit every record on it.
- **Session permissions are stale until re-login**, and sessions cannot be revoked
  individually except by rotating the signing secret.
- **No security headers or CSP** are configured by the app (see §6).
- **No CI or secret scanning.** Nothing prevents a committed secret from reaching `main` except
  review and `.gitignore`.
- **The app has no server-side logging, monitoring, or alerting** beyond Prisma error logs;
  suspicious activity is unlikely to be noticed.
- **Backups and exports are high-risk copies of the same data.** See §3 and the backup
  runbook.

---

## 8. If you suspect a breach

1. **Contain:** take the instance offline or rotate database and hosting credentials; rotate
   `NEXTAUTH_SECRET` to invalidate all sessions.
2. **Preserve:** snapshot logs and the database before changing data. The app has no audit log,
   so host/proxy/ database logs are the only evidence — collect them early.
3. **Assess:** determine which member records and account types were exposed, and the time
   window. Restores and backups may reveal what changed.
4. **Notify:** inform the church leadership and, where required by law, affected individuals and
   the supervisory authority within the statutory deadline.
5. **Remediate:** patch the cause, rotate every credential that could have been exposed, and
   review role assignments and RBAC settings.
6. **Learn:** record what happened; if the gap is structural, add it to §7 and the PRD rather
   than leaving it undocumented.

---

## 9. For contributors

- Read [AGENTS.md](AGENTS.md) and
  [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) §11 before changing API
  routes; guards are easy to omit and the failure is silent.
- Add or update tests for any authorisation change, including the negative case (wrong role,
  wrong region, no session).
- Never weaken a guard, validation schema, or test assertion to make a check pass. If a change
  requires it, explain why in the pull request.
- Do not add dependencies without checking their maintenance status and licence, and run
  `npm audit` before proposing one.
- Keep personal data out of fixtures; extend `prisma/seed.ts` with fictional records instead.
