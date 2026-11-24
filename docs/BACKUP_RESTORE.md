# Backup & Restore Runbook

Operational procedure for backing up and restoring the Yudea App PostgreSQL database.
This document satisfies `NFR-REL-05` in [docs/PRD.md](PRD.md) (§10.3) and closes the gap noted
there in §12.2 item 5.

Everything the application stores lives in one PostgreSQL database. There are no file
uploads, queues, cron jobs, or external state, so a database backup is a complete backup of
the application.

---

## 1. Scope and responsibilities

| Item | Detail |
|---|---|
| In scope | The production PostgreSQL database: all Prisma models, the `_prisma_migrations` history, and the `User` password hashes |
| Out of scope | Application code (in git), environment variables/secrets (in the host's secret store), and `node_modules` |
| Backup owner | Whoever operates the production database — **fill in a name/role** |
| Restore approver | The church administrator or technical lead — **fill in a name/role** |
| Rehearsal cadence | Every 6 months, or after any schema migration that changes the table list |

> The application has no audit log and no soft delete. A restore is the only way to undo a
> mistaken deletion, so the freshness of the most recent backup is the effective boundary of
> what can be recovered.

---

## 2. What must be preserved

Prisma maps model names directly to quoted, PascalCase table names. A full-database dump
covers all of them; the list below is for verification.

| Table | Contents | If lost |
|---|---|---|
| `Branch` | Top-level church branches | All regions, families, and members beneath them are unreachable |
| `Region` | Sectors inside a branch | Families lose their parent; coordinators lose their scope |
| `Family` | Family records | Members become unreachable |
| `Member` | Member records and personal data | — |
| `Attendance` | Per-service head counts | Service history is lost |
| `User` | Login accounts, bcrypt password hashes, roles, `regionId` | Nobody can sign in |
| `AppSetting` | RBAC matrix (`role_access_config`) and other settings | Permissions fall back to deny-by-default; admins must reconfigure |
| `Account`, `Session` | NextAuth adapter tables | Unused (JWT sessions, credentials only) — safe to lose, but they are included in a dump |
| `_prisma_migrations` | Applied migration history | `prisma migrate deploy` cannot tell what has run |

`Session` and `Account` are vestigial: sessions are JWTs signed with `NEXTAUTH_SECRET`, not
database rows. Restoring the database therefore does **not** sign anyone out, and losing these
tables breaks nothing.

---

## 3. Backup procedure

### 3.1 Prerequisites

- `pg_dump` (and `pg_restore`) installed, at the **same major version or newer** than the
  production server. Check both with `pg_dump --version` and `psql "$DIRECT_URL" -c "SHOW server_version;"`.
- The direct (non-pooled) connection string. Use the value of `DIRECT_URL` if it is set,
  otherwise `DATABASE_URL`. **Do not** run `pg_dump` through a transaction-mode pooler such as
  PgBouncer or a Supabase/Neon pooled port — it can fail or return an inconsistent snapshot.
- Write access to the backup destination.

Never put a connection string on the command line in a shared shell history. Export it into
the environment for the duration of the command:

```bash
export BACKUP_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
```

### 3.2 Take a dump

Use the custom format (`-Fc`): it compresses, and `pg_restore` can restore selectively and in
parallel.

```bash
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
pg_dump "$BACKUP_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="yudea-${STAMP}.dump"
```

- `--no-owner --no-privileges` make the dump restorable by a different database role, which is
  what happens when the target is a fresh instance.
- Omit `--clean`; the restore step decides how to handle existing objects.

Record the checksum and size alongside the file so corruption and truncation are detectable:

```bash
sha256sum "yudea-${STAMP}.dump" > "yudea-${STAMP}.dump.sha256"
ls -lh "yudea-${STAMP}.dump"
```

Dump size scales with the number of member, family, and attendance rows, not with application
code. A file far smaller than previous dumps, or one that fails the checksum, is a failed
backup — investigate before relying on it.

### 3.3 Verify the dump without restoring it

`pg_restore --list` parses the archive and lists its table of contents. It catches most
truncation and format problems cheaply:

```bash
pg_restore --list "yudea-${STAMP}.dump" | grep -c "TABLE DATA"
```

The count must equal the number of data-bearing tables in §2 (the nine application tables
plus `_prisma_migrations`; enums and indexes are listed separately). If `pg_restore` exits
non-zero, discard the file and re-run the dump — do not upload it.

Once per week, do a real restore into a scratch database (§4) rather than trusting the list
output alone.

### 3.4 Storage and retention

Store backups encrypted at rest, outside the database host, in a location the database
administrator can read but ordinary application users cannot:

| Age | Keep | Minimum copies |
|---|---|---|
| Last 24 hours | Every backup | 2 (one off-host) |
| 1–30 days | Daily | 1 |
| 31–365 days | Monthly (first backup of the month) | 1 |

Suggested default schedule: a nightly dump plus a weekly restore rehearsal. Adjust the
frequency to the agreed RPO in §7. Encrypt before upload, for example:

```bash
gpg --symmetric --cipher-algo AES256 "yudea-${STAMP}.dump"
```

The passphrase belongs in the secret store, **not** next to the backup. Losing it makes the
backups worthless. Member records contain personal data (names, addresses, birth dates, phone
numbers, baptism/marriage status), so treat every dump as confidential and delete expired
copies rather than leaving them indefinitely.

### 3.5 Managed-database alternatives

If production runs on a managed PostgreSQL service, prefer its built-in automated backups and
point-in-time recovery **in addition to** the dump above:

- Enable automated daily backups and PITR on the database instance.
- Confirm the retention window matches the schedule in §3.4.
- Perform the §5 rehearsal using the provider's restore mechanism, not only `pg_restore`, so
  both paths are known to work.

The logical dump remains the portable copy that can be restored to any PostgreSQL instance.

---

## 4. Restore procedure

Never restore directly over the live database. Restore into a scratch database, verify it,
and only then cut over.

### 4.1 Restore into a scratch database

```bash
DBNAME="yudea_restore_$(date -u +%Y%m%d)"
TARGET_URL="postgresql://USER:PASSWORD@HOST:5432/${DBNAME}"

psql "postgresql://USER:PASSWORD@HOST:5432/postgres" -c "CREATE DATABASE ${DBNAME}"
gpg --decrypt "yudea-${STAMP}.dump.gpg" > "yudea-${STAMP}.dump"
sha256sum -c "yudea-${STAMP}.dump.sha256"

pg_restore \
  --dbname="$TARGET_URL" \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  "yudea-${STAMP}.dump"
```

- `--single-transaction --exit-on-error` make the restore all-or-nothing, so a failure leaves
  an empty database rather than a half-populated one.
- `--no-owner --no-privileges` avoid failures when the original role does not exist on the
  target.
- To restore only some data, use `--data-only` / `--table=...`. To replace objects in an
  existing database, add `--clean --if-exists`; this is destructive, so never use it against
  production without a verified backup.

### 4.2 Verify the restored database

Run the checks in §5 against the scratch database before touching production.

### 4.3 Cut over to production

1. **Announce a maintenance window.** Users will lose in-flight edits; tell them to finish and
   sign out.
2. **Take a fresh backup of the current production database**, even if it is the broken one.
   This is the undo for the restore itself.
3. **Stop application traffic** — put the app behind maintenance mode or stop the platform's
   deployment. Do not leave instances running against the database during the swap.
4. **Point the application at the restored database**, either by restoring into the production
   database itself (after step 2) or by switching `DATABASE_URL`/`DIRECT_URL`.
5. **Apply pending migrations** if the backup predates the deployed code:

   ```bash
   npx prisma migrate status   # expect "Database schema is up to date"
   ```

   Only if migrations are missing: `npx prisma migrate deploy`. Do not run
   `prisma migrate dev` or `prisma db push` against production, and do not run the seed script
   unless demo data is genuinely wanted.
6. **Rotate `NEXTAUTH_SECRET`** if accounts or passwords may have changed since the backup.
   Sessions are JWTs, so old tokens stay valid until they expire; rotating the secret forces a
   clean re-login. All users must sign in again.
7. **Restart the application** so Prisma reconnects, then run the smoke checks in §5.3.
8. **Close the window** and tell users what, if anything, was lost.

### 4.4 After the restore

- Keep the pre-restore backup from step 2 until the restored system is confirmed healthy.
- Drop the scratch database once it is no longer needed.
- Record the incident: what was restored, from which backup, the data-loss window, and the
  checks performed. There is no application audit log to reconstruct this later.

---

## 5. Verification

### 5.1 Row counts

```sql
SELECT 'Branch' AS table_name, count(*) FROM "Branch"
UNION ALL SELECT 'Region', count(*) FROM "Region"
UNION ALL SELECT 'Family', count(*) FROM "Family"
UNION ALL SELECT 'Member', count(*) FROM "Member"
UNION ALL SELECT 'Attendance', count(*) FROM "Attendance"
UNION ALL SELECT 'User', count(*) FROM "User"
UNION ALL SELECT 'AppSetting', count(*) FROM "AppSetting"
UNION ALL SELECT 'Account', count(*) FROM "Account"
UNION ALL SELECT 'Session', count(*) FROM "Session"
ORDER BY table_name;
```

Compare with the counts captured at backup time; they must match exactly. A table that is
empty when it should not be means the restore was incomplete.

### 5.2 Structural and referential checks

```sql
-- Migration history survived and matches the checked-out code
SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;

-- Everyone who can administer the system is present
SELECT email, role, "regionId" FROM "User" WHERE role = 'ADMIN';

-- Coordinators must keep their region, or they are denied by the auth guards
SELECT email, "regionId" FROM "User" WHERE role = 'COORDINATOR' AND "regionId" IS NULL;

-- Settings present; the RBAC matrix must parse as JSON (errors here mean it is corrupt)
SELECT key FROM "AppSetting";
SELECT jsonb_typeof(value::jsonb) AS rbac_type FROM "AppSetting" WHERE key = 'role_access_config';

-- Orphans (all should return 0)
SELECT count(*) FROM "Family" f LEFT JOIN "Region" r ON r.id = f."regionId" WHERE r.id IS NULL;
SELECT count(*) FROM "Member" m LEFT JOIN "Family" f ON f.id = m."familyId" WHERE f.id IS NULL;
SELECT count(*) FROM "Region" rg LEFT JOIN "Branch" b ON b.id = rg."branchId" WHERE b.id IS NULL;
```

Notes on expected values:

- The `User` count must include at least one usable `ADMIN`. If the restore lost every admin,
  see §6.
- The coordinator query returning rows is not automatically an error (a coordinator whose
  region was deleted legitimately has `regionId = NULL`), but it explains any `403`s after the
  restore.
- If `AppSetting` has no `role_access_config` row, permissions fall back to deny-by-default and
  an admin must reconfigure Settings.

### 5.3 Application smoke checks

Run these after pointing the app at the restored database:

1. `GET /public/login` returns 200.
2. An admin account signs in successfully.
3. The dashboard loads and the Pelkat/branch counts are non-zero.
4. Members, Families, Regions, and Branches list pages return data **and pagination totals
   match §5.1** for an unrestricted admin.
5. A coordinator can sign in and sees only their region (they may need to sign out and back in
   if their assignment changed).
6. `GET /api/region-indonesia/provinces` returns data (confirms the CSV tracing, unrelated to
   the database).
7. Creating and deleting a throwaway record succeeds, proving writes work, not just reads.
   Deleting is permanent — use a clearly named test record.

---

## 6. Recovery scenarios

| Scenario | Action |
|---|---|
| Accidental deletion of one family/member | Full restore is the only in-product recovery. Restore to a scratch database, copy the missing rows into production with a targeted query, then verify. Do not restore the whole database over live data just for a few rows. |
| Bad bulk edit or wrong seed | Restore the last pre-change backup into production per §4.3. |
| Corrupted or lost database | Provision a new instance, restore per §4.1, then repoint `DATABASE_URL`/`DIRECT_URL`. |
| No usable admin account | Restore, or have an operator insert/reset an admin row with a bcrypt hash generated outside the app (for example `node -e "console.log(require('bcryptjs').hashSync('newpassword', 10))"`), then change the password and rotate the secret. |
| Deployed code expects newer tables than the backup | Run `npx prisma migrate deploy` after restoring; see §4.3 step 5. |
| Backup file fails checksum/`pg_restore --list` | Treat as no backup. Use the previous verified copy and investigate the backup job immediately. |

---

## 7. Targets and rehearsal

The following are **proposed targets that require sign-off**; record the agreed values here
once approved.

| Metric | Proposed target | Agreed value |
|---|---|---|
| Recovery point objective (RPO) — maximum acceptable data loss | 24 hours | _to be agreed_ |
| Recovery time objective (RTO) — restore plus verification | 2 hours | _to be agreed_ |
| Backup verification | Weekly automated restore to scratch | _to be agreed_ |

### 7.1 Rehearsal checklist

Run every 6 months, and after adding or renaming a table. Rehearse against a scratch database
using a real production dump, never against production itself.

- [ ] Latest backup exists, is off-host, encrypted, and its checksum verifies.
- [ ] `pg_restore --list` reports the expected number of table-data entries.
- [ ] `pg_restore` into a fresh database completes with `--exit-on-error`.
- [ ] Row counts in §5.1 match the source.
- [ ] Referential checks in §5.2 return 0 orphans.
- [ ] `npx prisma migrate status` reports the schema is up to date.
- [ ] The app starts against the restored database and passes §5.3.
- [ ] A coordinator's scoping still works after sign-out/sign-in.
- [ ] Time the whole exercise; compare with the RTO in §7.
- [ ] Record the date, operator, backup timestamp, result, and elapsed time below.

| Date | Operator | Backup timestamp | Result | Elapsed |
|---|---|---|---|---|
| | | | | |

---

## 8. Known gaps and limitations

- **No audit log and no soft delete.** Deletions cascade (branch → region → family → member),
  and the app offers no undo. The backup schedule defines the recoverable window.
- **No automated backup job is checked into this repository** (there is no CI pipeline or
  deployment manifest). Scheduling, monitoring, and alerting on failed backups must be set up
  in the hosting environment or by the database operator.
- **Backups contain personal data.** Member records include names, birth dates, addresses,
  phone numbers, and sacramental status. Encrypt dumps, restrict access, and honour the
  retention limits in §3.4 rather than archiving indefinitely.
- **Password hashes travel with the dump.** A leaked backup exposes bcrypt hashes; the
  encryption passphrase is therefore a production secret.
- **Restoring does not invalidate existing sessions**, because sessions are JWTs in the
  browser, not database rows. Rotate `NEXTAUTH_SECRET` when accounts changed (§4.3 step 6).
- **A restore reintroduces whatever was wrong at backup time.** If the incident was a bad
  import or a bad migration, choose the backup from before it, not simply the newest one.
- **`Member.pelkat` is a derived value.** It is computed at read time, so no restore step is
  needed for it, and any stale raw column values are harmless.

---

## 9. Quick reference

```bash
# Back up
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
pg_dump "$DIRECT_URL" -Fc -Z9 --no-owner --no-privileges -f "yudea-${STAMP}.dump"
sha256sum "yudea-${STAMP}.dump" > "yudea-${STAMP}.dump.sha256"
pg_restore --list "yudea-${STAMP}.dump" | grep -c "TABLE DATA"

# Restore into a scratch database
DBNAME="yudea_restore_$(date -u +%Y%m%d)"
TARGET_URL="postgresql://USER:PASSWORD@HOST:5432/${DBNAME}"
psql "postgresql://USER:PASSWORD@HOST:5432/postgres" -c "CREATE DATABASE ${DBNAME}"
pg_restore -d "$TARGET_URL" --no-owner --no-privileges \
  --single-transaction --exit-on-error "yudea-${STAMP}.dump"

# Confirm the schema matches the deployed code
npx prisma migrate status
```

Run the §5 checks before cutover.
