import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1300 } });
await page.goto("http://localhost:3000/public/login");
await page.fill("#email", "admin@example.com");
await page.fill("#password", "admin123");
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard");
await page.waitForTimeout(2000);
for (const path of ["/dashboard/members", "/dashboard/report"]) {
  await page.goto("http://localhost:3000"+path);
  await page.waitForTimeout(1800);
  const tree = await page.evaluate(() => {
    function walk(el, depth) {
      if (depth > 3) return null;
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        cls: String(el.className).slice(0,60),
        h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom),
        kids: [...el.children].map(c => walk(c, depth+1)).filter(Boolean).slice(0,4)
      };
    }
    const main = document.querySelector("main");
    return walk(main, 0);
  });
  console.log(path, JSON.stringify(tree, null, 1));
}
await browser.close();
