import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = path.join(dir, "ERA-Workforce-Evrostar-AZ.html");
const pdf = path.join(dir, "ERA-Workforce-Evrostar-AZ.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
await page.pdf({
  path: pdf,
  format: "A4",
  printBackground: true,
  margin: { top: "10mm", bottom: "12mm", left: "11mm", right: "11mm" },
});
await browser.close();
console.log("wrote", pdf);
