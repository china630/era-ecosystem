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
  const cookie = (login.headers["set-cookie"] || [])
    .map((c) => c.split(";")[0])
    .join("; ");
  console.log("login", login.status);

  const rot = await req("GET", "/api/admin/procedure-rotation-rules", null, cookie);
  console.log("rotation", rot.status, rot.body.slice(0, 200));

  const sub = await req("GET", "/api/admin/procedure-substitution-rules", null, cookie);
  console.log("substitution", sub.status, sub.body.slice(0, 200));

  const settings = await req("GET", "/api/admin/settings", null, cookie);
  console.log("settings peak", settings.status, /peakModeEnabled|peakDayEndHour/.test(settings.body));

  const oldLab = await req(
    "POST",
    "/api/lab/import",
    {
      patientRefId: "missing",
      testCode: "LAB-CBC",
      resultDate: "2020-01-01",
      results: [{ analyte: "WBC", value: "5" }],
    },
    cookie,
  );
  console.log("external old", oldLab.status, oldLab.body.slice(0, 180));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
