const fs = require("fs");
const http = require("http");

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
  console.log("login", login.status, login.body.slice(0, 200));
  const set = login.headers["set-cookie"] || [];
  const cookie = set.map((c) => c.split(";")[0]).join("; ");
  console.log("cookie", cookie.slice(0, 120));

  const page = await req("GET", "/lab-orders", null, cookie);
  console.log("page", page.status, page.body.length);
  fs.writeFileSync(
    "d:/My Projects/era-ecosystem/era-clinic/scripts/_tmp_utf8/lab-orders.html",
    page.body,
  );
  console.log("app_error", page.body.includes("Application error"));
  console.log("digest", (page.body.match(/digest[^<]{0,120}/i) || [])[0]);

  const api = await req("GET", "/api/lab-orders", null, cookie);
  console.log("api", api.status, api.body.slice(0, 400));

  const cat = await req(
    "GET",
    "/api/diagnostic-catalog?kinds=lab_panel,imaging,functional,endoscopy,package&applyFavorites=false",
    null,
    cookie,
  );
  console.log("catalog", cat.status, cat.body.slice(0, 500));

  const patients = await req("GET", "/api/patients", null, cookie);
  console.log("patients", patients.status, patients.body.slice(0, 400));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
