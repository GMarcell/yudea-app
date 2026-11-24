import { chromium } from "@playwright/test";
import fs from "node:fs";

const outDir = "docs/images";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1680, height: 1300 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log("captured", name, await page.viewportSize());
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1800);
}

// Login page looks best at a normal desktop size.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://localhost:3000/public/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await shot("login");

await page.setViewportSize({ width: 1680, height: 1300 });
await page.fill("#email", "admin@example.com");
await page.fill("#password", "admin123");
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 30000 });
await settle(page);

const pages = [
  ["dashboard", "/dashboard"],
  ["birthday", "/dashboard/birthday"],
  ["branches", "/dashboard/branches"],
  ["regions", "/dashboard/regions"],
  ["families", "/dashboard/families"],
  ["members", "/dashboard/members"],
  ["presbytery", "/dashboard/presbytery"],
  ["pelkat-members", "/dashboard/pelkat-members"],
  ["attendance", "/dashboard/attendance"],
  ["report", "/dashboard/report"],
  ["users", "/dashboard/users"],
  ["settings", "/dashboard/settings"],
];

for (const [name, path] of pages) {
  await page.setViewportSize({ width: 1680, height: 1300 });
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "domcontentloaded" });
  await settle(page);

  const dims = await page.evaluate(() => {
    const container = document.querySelector("main .container");
    const containerBottom = container
      ? container.getBoundingClientRect().bottom + window.scrollY
      : 900;
    const tables = [...document.querySelectorAll("table")];
    const rows = tables.length
      ? [...tables[tables.length - 1].querySelectorAll("tbody tr")]
      : [];
    const eighth = rows[7] ?? rows[rows.length - 1];
    return {
      containerBottom: Math.round(containerBottom),
      rowBottom: eighth
        ? Math.round(eighth.getBoundingClientRect().bottom + window.scrollY)
        : null,
      rowCount: rows.length,
    };
  });

  let height = Math.min(2400, Math.max(820, dims.containerBottom + 28));
  if ((name === "report" || name === "regions") && dims.rowBottom) {
    height = Math.min(2400, Math.max(820, dims.rowBottom + 1));
  }

  await page.setViewportSize({ width: 1680, height });
  await page.waitForTimeout(700);
  console.log(name, dims, "->", height);
  await shot(name);
}

await browser.close();
console.log("errors:", JSON.stringify(errors, null, 2));
