import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { login } from "./helpers";

// ─── Notes ─────────────────────────────────────────────────────────────────
// Exports are generated in the browser (SheetJS + jsPDF) and handed to the
// user through an anchor with a `download` attribute, so there is no API
// response to assert. These tests catch the real download event, read the
// saved file from disk, and validate its contents: an XLSX must open as a
// workbook with the expected sheet/columns, a PDF must be a real PDF document.
//
// READ-ONLY: every export downloads data that is already in the seeded
// database; nothing is written.
//
// Prerequisite: a seeded database (`npm run prisma:seed`) at DATABASE_URL.

/** Waits for a blob download and returns its saved path plus filename. */
async function captureDownload(page: Page, buttonName: string) {
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path, "download must produce a file on disk").toBeTruthy();
  return { download, path: path! };
}

/** Reads an exported workbook and returns its first sheet as objects. */
async function readWorkbook(path: string) {
  const buffer = await readFile(path);
  // XLSX files are ZIP containers — a truncated/HTML error response fails here.
  expect(buffer.subarray(0, 2).toString("latin1"), "xlsx zip signature").toBe("PK");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  expect(sheetName, "workbook has a sheet").toBeTruthy();
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName]);
  return { sheetName, rows };
}

test.describe("Export downloads (real database, read-only)", () => {
  // Real login + live API data; keep serial like the other real-database specs.
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  test("report page downloads a populated XLSX workbook", async ({ page }) => {
    await login(page);

    // The export buttons stay disabled until /api/report has loaded rows.
    const reportResponse = page.waitForResponse(
      (res) => res.url().includes("/api/report?") && res.status() === 200,
      { timeout: 60000 },
    );
    await page.goto("/dashboard/report");
    await expect(page.getByRole("heading", { name: "Laporan Warga Jemaat" })).toBeVisible({
      timeout: 30000,
    });
    const report = (await (await reportResponse).json()) as { data: unknown[] };
    expect(report.data.length, "seed must provide report rows").toBeGreaterThan(0);

    const { download, path } = await captureDownload(page, "Export XLS");
    expect(download.suggestedFilename()).toBe("laporan-jemaat.xlsx");

    const { sheetName, rows } = await readWorkbook(path);
    expect(sheetName).toBe("Laporan Jemaat");
    expect(rows.length, "one row per report record").toBe(report.data.length);
    expect(Object.keys(rows[0])).toEqual([
      "Nama Keluarga",
      "Nama Jemaat",
      "Alamat",
      "Tanggal Lahir",
      "Sektor Pelayanan",
    ]);
    // Every row carries seeded content, not empty placeholders.
    expect(rows[0]["Nama Keluarga"]).toBeTruthy();
    expect(rows[0]["Nama Jemaat"]).toBeTruthy();
  });

  test("report page downloads a valid PDF document", async ({ page }) => {
    await login(page);

    const reportResponse = page.waitForResponse(
      (res) => res.url().includes("/api/report?") && res.status() === 200,
      { timeout: 60000 },
    );
    await page.goto("/dashboard/report");
    await expect(page.getByRole("heading", { name: "Laporan Warga Jemaat" })).toBeVisible({
      timeout: 30000,
    });
    await reportResponse;

    const { download, path } = await captureDownload(page, "Cetak PDF");
    expect(download.suggestedFilename()).toBe("laporan-jemaat.pdf");

    const pdf = await readFile(path);
    // Header + EOF trailer prove jsPDF finished writing a complete document.
    expect(pdf.subarray(0, 5).toString("latin1"), "PDF header").toBe("%PDF-");
    expect(
      pdf.subarray(-1024).toString("latin1"),
      "PDF must end with an EOF marker",
    ).toContain("%%EOF");
    expect(pdf.length, "PDF has real content").toBeGreaterThan(1000);
  });

  test("birthday page downloads the selected week as XLSX", async ({ page }) => {
    await login(page);

    // Use a real seeded member's birthday so the chosen week is never empty.
    const memberRes = await page.request.get("/api/member?limit=1");
    expect(memberRes.status()).toBe(200);
    const memberIso = ((await memberRes.json()) as {
      data: Array<{ birthDate: string }>;
    }).data[0].birthDate;
    const isoDay = memberIso.slice(0, 10);
    const dayAfter = new Date(`${isoDay}T00:00:00Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

    // The API matches on local month/day, so the UTC day or the day after may
    // own the birthday; pick whichever week actually has rows.
    let selectedDate = "";
    for (const candidate of [isoDay, dayAfter.toISOString().slice(0, 10)]) {
      const res = await page.request.get(`/api/birthday?date=${candidate}`);
      expect(res.status()).toBe(200);
      if (((await res.json()) as { data: unknown[] }).data.length > 0) {
        selectedDate = candidate;
        break;
      }
    }
    expect(selectedDate, "a seeded birthday week must have members").toBeTruthy();

    await page.goto("/dashboard/birthday");
    await expect(
      page.getByRole("heading", { name: "Dashboard Ulang Tahun" }),
    ).toBeVisible({ timeout: 30000 });

    const refetched = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/birthday?date=${selectedDate}`) &&
        res.status() === 200,
      { timeout: 60000 },
    );
    await page.locator('input[type="date"]').fill(selectedDate);
    const birthday = (await (await refetched).json()) as { data: unknown[] };
    expect(birthday.data.length).toBeGreaterThan(0);

    const { download, path } = await captureDownload(page, "Export XLS");
    expect(download.suggestedFilename()).toBe(`ulang-tahun-${selectedDate}.xlsx`);

    const { sheetName, rows } = await readWorkbook(path);
    expect(sheetName).toBe("Ulang Tahun");
    expect(rows.length).toBe(birthday.data.length);
    expect(Object.keys(rows[0])).toEqual([
      "Nama Keluarga",
      "Nama Jemaat",
      "Alamat",
      "Tanggal Lahir",
      "Sektor Pelayanan",
    ]);
    expect(rows[0]["Nama Jemaat"]).toBeTruthy();
  });

  test("pelkat page downloads the member list as XLSX", async ({ page }) => {
    await login(page);

    const membersResponse = page.waitForResponse(
      (res) => res.url().includes("/api/member?") && res.status() === 200,
      { timeout: 60000 },
    );
    await page.goto("/dashboard/pelkat-members");
    await expect(page.getByRole("heading", { name: "Pelkat Members" })).toBeVisible({
      timeout: 30000,
    });
    const members = (await (await membersResponse).json()) as { data: unknown[] };
    expect(members.data.length, "seed must provide members").toBeGreaterThan(0);

    const exportButton = page.getByRole("button", { name: "Export XLS", exact: true });
    await expect(exportButton).toBeEnabled({ timeout: 30000 });

    const { download, path } = await captureDownload(page, "Export XLS");
    // Default PELKAT filter is every group.
    expect(download.suggestedFilename()).toBe("pelkat-members-all.xlsx");

    const { sheetName, rows } = await readWorkbook(path);
    expect(sheetName).toBe("Pelkat Members");
    expect(rows.length).toBe(members.data.length);
    expect(Object.keys(rows[0])).toEqual([
      "Nama Keluarga",
      "Nama Jemaat",
      "Alamat",
      "Tanggal Lahir",
      "Sektor Pelayanan",
    ]);
    expect(rows[0]["Nama Jemaat"]).toBeTruthy();
  });

  test("region page downloads the member list as XLSX", async ({ page }) => {
    await login(page);

    // The export section loads every member separately from the region table.
    const membersResponse = page.waitForResponse(
      (res) => res.url().includes("/api/member?") && res.status() === 200,
      { timeout: 60000 },
    );
    await page.goto("/dashboard/regions");
    await expect(
      page.getByRole("heading", { name: "Sektor Pelayanan Management" }),
    ).toBeVisible({ timeout: 30000 });
    const members = (await (await membersResponse).json()) as { data: unknown[] };
    expect(members.data.length, "seed must provide members").toBeGreaterThan(0);

    const exportButton = page.getByRole("button", { name: "Export XLS", exact: true });
    await expect(exportButton).toBeEnabled({ timeout: 30000 });

    const { download, path } = await captureDownload(page, "Export XLS");
    // Default filter is every region.
    expect(download.suggestedFilename()).toBe("warga-jemaat-all-sektor.xlsx");

    const { sheetName, rows } = await readWorkbook(path);
    expect(sheetName).toBe("Warga Jemaat");
    expect(rows.length).toBe(members.data.length);
    expect(Object.keys(rows[0])).toEqual([
      "Nama Keluarga",
      "Nama Jemaat",
      "Alamat",
      "Tanggal Lahir",
      "Sektor Pelayanan",
    ]);
    expect(rows[0]["Nama Jemaat"]).toBeTruthy();
  });
});
