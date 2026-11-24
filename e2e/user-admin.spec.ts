import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, login } from "./helpers";

// ─── Notes ─────────────────────────────────────────────────────────────────
// Two rules that protect admin access (PRD USR-05) and the password policy
// (PRD) that unit tests alone could not prove end-to-end.
//
// The last-admin test is the only E2E spec that WRITES to the database. It
// creates a uniquely named probe admin through the API and removes it in
// `finally`, so seeded records are never touched and a failed run still
// cleans up.
//
// Prerequisite: a seeded database (`npm run prisma:seed`) at DATABASE_URL.

type UserRow = { id: string; email: string; role: string };
type ListResponse<T> = { data: T[]; meta: { total: number } };

async function listUsers(page: import("@playwright/test").Page) {
  const res = await page.request.get("/api/user?limit=1000");
  expect(res.status(), "admin can list users").toBe(200);
  return (await res.json()) as ListResponse<UserRow>;
}

test.describe("Last-admin protection (real database, writes cleaned up)", () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  test("blocks demoting the last admin and deleting one's own account", async ({ page }) => {
    await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    // Create a second admin so the guard's "more than one admin" path is
    // exercised too: demoting one of two admins must still be allowed.
    const probeEmail = `e2e-lastadmin-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    const created = await page.request.post("/api/user", {
      data: {
        name: "E2E Last Admin Probe",
        email: probeEmail,
        password: "probe123",
        role: "ADMIN",
      },
    });
    expect(created.status(), "probe admin created").toBe(201);
    const probe = (await created.json()) as UserRow;
    expect(probe.role).toBe("ADMIN");

    try {
      // Two admins exist: demoting the probe is legitimate and must succeed.
      const demoteProbe = await page.request.patch(`/api/user/${probe.id}`, {
        data: { role: "STAFF" },
      });
      expect(demoteProbe.status(), "demoting one of two admins").toBe(200);
      expect(((await demoteProbe.json()) as UserRow).role).toBe("STAFF");

      // The seed admin is now the only admin: demoting it is refused.
      const users = await listUsers(page);
      const self = users.data.find((user) => user.email === ADMIN_EMAIL);
      expect(self, "seeded admin must exist").toBeTruthy();
      expect(
        users.data.filter((user) => user.role === "ADMIN"),
        "exactly one admin remains",
      ).toHaveLength(1);

      const demoteSelf = await page.request.patch(`/api/user/${self!.id}`, {
        data: { role: "STAFF" },
      });
      expect(demoteSelf.status(), "demoting the last admin").toBe(400);
      expect(await demoteSelf.json()).toEqual({
        error: "Cannot demote the last admin",
      });

      // The rejection changed nothing: the account still has ADMIN and admin
      // access to /api/user keeps working.
      const afterDemote = await listUsers(page);
      expect(afterDemote.data.find((user) => user.id === self!.id)?.role).toBe("ADMIN");

      // Deleting the final admin would also lock everyone out; the self-delete
      // rule refuses it before the last-admin backstop is reached.
      const deleteSelf = await page.request.delete(`/api/user/${self!.id}`);
      expect(deleteSelf.status(), "deleting your own account").toBe(400);
      expect(await deleteSelf.json()).toEqual({
        error: "You cannot delete your own account",
      });
      expect((await listUsers(page)).meta.total).toBe(users.meta.total);
    } finally {
      // Remove the probe whether or not the assertions above passed.
      const cleanup = await page.request.delete(`/api/user/${probe.id}`);
      expect([200, 404]).toContain(cleanup.status());
    }
  });
});

test.describe("User password policy (UI, API mocked)", () => {
  // Real login (auth cannot be mocked away), mocked writes so a regression in
  // validation cannot create accounts.
  test.setTimeout(90_000);

  const created: Array<Record<string, unknown>> = [];

  test.beforeEach(async ({ page }) => {
    created.length = 0;
    await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    await page.route("**/api/user", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      created.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "u-new",
          name: "Password Policy Probe",
          email: "password-policy@example.com",
          role: "STAFF",
        }),
      });
    });
  });

  test("rejects a password shorter than six characters before submitting", async ({
    page,
  }) => {
    await page.goto("/dashboard/users");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole("button", { name: "Add User" }).click();
    await expect(page.getByText("Create User").first()).toBeVisible();

    await page.getByLabel("Name").fill("Password Policy Probe");
    await page.getByLabel("Email").fill("password-policy@example.com");
    await page.getByLabel("Password", { exact: true }).fill("12345"); // one short
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(
      page.getByText("Password must be at least 6 characters"),
    ).toBeVisible();
    // The dialog stays open and no request left the browser.
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    expect(created, "invalid password must not be submitted").toHaveLength(0);
  });

  test("accepts a six-character password at the boundary", async ({ page }) => {
    await page.goto("/dashboard/users");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole("button", { name: "Add User" }).click();
    await expect(page.getByText("Create User").first()).toBeVisible();

    await page.getByLabel("Name").fill("Password Policy Probe");
    await page.getByLabel("Email").fill("password-policy@example.com");
    await page.getByLabel("Password", { exact: true }).fill("123456"); // exactly six
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page.getByText("User created")).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    expect(created).toHaveLength(1);
    expect(created[0].password).toBe("123456");
    expect(created[0].role).toBe("STAFF");
  });
});
