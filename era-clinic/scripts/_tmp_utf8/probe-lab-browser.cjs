const fs = require("fs");
const http = require("http");
const { chromium } = require("playwright");

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = { "Content-Type": "application/json" };
    if (data) headers["Content-Length"] = String(data.length);
    if (cookie) headers.Cookie = cookie;
    const r = http.request(
      { hostname: "127.0.0.1", port: 3203, path, method, headers },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: b }),
        );
      },
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const login = await req("POST", "/api/auth/login", {
    login: "chingiz@era.com",
    password: "12345678",
  });
  const set = login.headers["set-cookie"] || [];
  const cookiePairs = set.map((c) => c.split(";")[0]);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  for (const pair of cookiePairs) {
    const [name, ...rest] = pair.split("=");
    await context.addCookies([
      {
        name,
        value: rest.join("="),
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("console:" + msg.text());
  });
  await page.goto("http://127.0.0.1:3203/lab-orders", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(4000);
  const bodyText = await page.locator("body").innerText();
  console.log("title-ish", bodyText.slice(0, 300).replace(/\n/g, " | "));
  console.log("ERRORS", JSON.stringify(errors, null, 2));
  fs.writeFileSync(
    "d:/My Projects/era-ecosystem/era-clinic/scripts/_tmp_utf8/lab-console.json",
    JSON.stringify({ errors, bodyText: bodyText.slice(0, 2000) }, null, 2),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
