import { test, expect, type APIResponse } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  COORDINATOR_EMAIL,
  COORDINATOR_PASSWORD,
  login,
} from "./helpers";

// ─── Notes ─────────────────────────────────────────────────────────────────
// These tests exercise the SERVER-SIDE authorisation boundary by calling the
// API directly, which is what a malicious or curious user would do. The other
// specs prove the UI hides pages and buttons; this one proves the guards behind
// them, including coordinator region scoping on single-record reads.
//
// The spec is effectively READ-ONLY. It never creates or deletes records, and
// the cross-region PATCH attempts send the record's current value, so even a
// regression that drops a guard cannot corrupt seeded data.
//
// Prerequisite: a seeded database (`npm run prisma:seed`) at DATABASE_URL with
// the coordinator-a account assigned to a region that is not the only region.

type Family = { id: string; familyName: string; regionId: string };
type Member = {
  id: string;
  firstName: string;
  familyId: string;
  family: { regionId: string };
};
type Attendance = {
  id: string;
  serviceDate: string;
  serviceType: string;
  maleCount: number;
  femaleCount: number;
};
type AppUser = { id: string; email: string };
type ListResponse<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number };
};

async function readJson<T>(res: APIResponse, label: string): Promise<T> {
  expect(res.status(), `${label} should succeed`).toBe(200);
  return (await res.json()) as T;
}

test.describe("API authorisation (real database, read-only)", () => {
  // Live database + first-compile of the API routes: give requests room, and
  // run serially like the other real-database specs so the connection pool is
  // not exhausted by concurrent logins.
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  test("rejects unauthenticated API requests", async ({ request }) => {
    for (const path of [
      "/api/member?limit=1",
      "/api/family?limit=1",
      "/api/user",
      "/api/attendance?limit=1",
      "/api/region-indonesia/provinces",
    ]) {
      const res = await request.get(path);
      expect(res.status(), `${path} without a session`).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    }
  });

  test("rejects a wrong password without creating a session", async ({ page }) => {
    await page.goto("/public/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", "not-the-admin-password");
    await page.click('button[type="submit"]');

    await expect(page.getByText("Invalid email or password")).toBeVisible({
      timeout: 30000,
    });
    await expect(page).toHaveURL(/\/public\/login/);

    // No session cookie was issued, so protected APIs still refuse the caller.
    const res = await page.request.get("/api/member?limit=1");
    expect(res.status()).toBe(401);
  });

  test("rejects duplicate attendance for the same date and service type", async ({ page }) => {
    await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const before = await readJson<ListResponse<Attendance>>(
      await page.request.get("/api/attendance?limit=1000"),
      "attendance list",
    );
    expect(before.data.length, "need seeded attendance rows").toBeGreaterThan(0);
    const existing = before.data[0];

    // Re-posting an existing (serviceDate, serviceType) pair must be rejected by
    // the uniqueness pre-check rather than surfacing as a 500 from Prisma.
    const duplicate = await page.request.post("/api/attendance", {
      data: {
        serviceDate: existing.serviceDate,
        serviceType: existing.serviceType,
        maleCount: existing.maleCount,
        femaleCount: existing.femaleCount,
      },
    });
    expect(duplicate.status(), "duplicate attendance").toBe(409);
    expect(await duplicate.json()).toEqual({
      error: "Attendance already exists for this date and service type",
    });

    // Nothing was written: the total is unchanged.
    const after = await readJson<ListResponse<Attendance>>(
      await page.request.get("/api/attendance?limit=1000"),
      "attendance list after duplicate",
    );
    expect(after.meta.total).toBe(before.meta.total);
  });

  test("rejects a duplicate user email", async ({ page }) => {
    await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const before = await readJson<ListResponse<AppUser>>(
      await page.request.get("/api/user?limit=1000"),
      "user list",
    );
    const existing = before.data.find((user) => user.email === ADMIN_EMAIL);
    expect(existing, "seeded admin must exist").toBeTruthy();

    const duplicate = await page.request.post("/api/user", {
      data: {
        name: "Duplicate Probe",
        email: existing!.email,
        password: "duplicate123",
        role: "STAFF",
      },
    });
    expect(duplicate.status(), "duplicate user email").toBe(409);
    expect(await duplicate.json()).toEqual({ error: "Email is already registered" });

    // No second account was created for the address.
    const after = await readJson<ListResponse<AppUser>>(
      await page.request.get("/api/user?limit=1000"),
      "user list after duplicate",
    );
    expect(after.meta.total).toBe(before.meta.total);
    expect(
      after.data.filter((user) => user.email === existing!.email),
      "exactly one account keeps the email",
    ).toHaveLength(1);
  });

  test("scopes a coordinator to their region and enforces role guards", async ({ page }) => {
    // 1. As admin, capture records from more than one region.
    await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const adminUsers = await page.request.get("/api/user?limit=1");
    expect(adminUsers.status(), "admin can read the user list").toBe(200);

    const allFamilies = await readJson<ListResponse<Family>>(
      await page.request.get("/api/family?limit=1000"),
      "admin family list",
    );
    const allMembers = await readJson<ListResponse<Member>>(
      await page.request.get("/api/member?limit=1000"),
      "admin member list",
    );

    expect(allFamilies.data.length, "need seeded families").toBeGreaterThan(0);
    expect(allMembers.data.length, "need seeded members").toBeGreaterThan(0);
    expect(
      new Set(allFamilies.data.map((family) => family.regionId)).size,
      "need at least two regions to prove scoping",
    ).toBeGreaterThan(1);

    // 2. Switch to the coordinator account.
    await page.context().clearCookies();
    await login(page, {
      email: COORDINATOR_EMAIL,
      password: COORDINATOR_PASSWORD,
    });
    await expect(page).toHaveURL(/\/dashboard\/families/);

    const scopedFamilies = await readJson<ListResponse<Family>>(
      await page.request.get("/api/family?limit=1000"),
      "coordinator family list",
    );
    const scopedMembers = await readJson<ListResponse<Member>>(
      await page.request.get("/api/member?limit=1000"),
      "coordinator member list",
    );

    expect(scopedFamilies.data.length, "coordinator sees their region's families").toBeGreaterThan(0);
    expect(scopedMembers.data.length, "coordinator sees their region's members").toBeGreaterThan(0);

    const regionId = scopedFamilies.data[0].regionId;
    expect(regionId, "coordinator has a region").toBeTruthy();
    expect(scopedFamilies.meta.total).toBeLessThanOrEqual(allFamilies.meta.total);

    // Every returned row belongs to the coordinator's region — the list is
    // filtered in the query, not hidden in the UI.
    for (const family of scopedFamilies.data) {
      expect(family.regionId, `family ${family.id} leaked another region`).toBe(regionId);
    }
    for (const member of scopedMembers.data) {
      expect(
        member.family.regionId,
        `member ${member.id} leaked another region`,
      ).toBe(regionId);
    }

    // Pick a real record from a different region for the negative tests.
    const otherFamily = allFamilies.data.find(
      (family) => family.regionId !== regionId,
    );
    const otherMember = allMembers.data.find(
      (member) => member.family.regionId !== regionId,
    );
    expect(otherFamily, "need a family outside the coordinator's region").toBeTruthy();
    expect(otherMember, "need a member outside the coordinator's region").toBeTruthy();

    expect(
      scopedFamilies.data.some((family) => family.id === otherFamily!.id),
      "another region's family must not appear in the scoped list",
    ).toBe(false);

    // 3. Single-record reads are scoped too: other regions' records are
    // indistinguishable from records that do not exist.
    const foreignFamilyRead = await page.request.get(`/api/family/${otherFamily!.id}`);
    expect(foreignFamilyRead.status(), "cross-region family read").toBe(404);

    const foreignMemberRead = await page.request.get(`/api/member/${otherMember!.id}`);
    expect(foreignMemberRead.status(), "cross-region member read").toBe(404);

    // 4. Writes against another region are rejected. The payloads repeat the
    // current values, so a regression cannot alter the seeded records.
    const foreignFamilyWrite = await page.request.patch(`/api/family/${otherFamily!.id}`, {
      data: { familyName: otherFamily!.familyName },
    });
    expect(foreignFamilyWrite.status(), "cross-region family write").toBe(403);

    const foreignMemberWrite = await page.request.patch(`/api/member/${otherMember!.id}`, {
      data: { firstName: otherMember!.firstName },
    });
    expect(foreignMemberWrite.status(), "cross-region member write").toBe(403);

    // 5. Routes the coordinator's role cannot view at all are denied, not just
    // hidden in the sidebar.
    const attendance = await page.request.get("/api/attendance?limit=1");
    expect(attendance.status(), "coordinator attendance access").toBe(403);

    const users = await page.request.get("/api/user?limit=1");
    expect(users.status(), "coordinator user-management access").toBe(403);
  });
});
