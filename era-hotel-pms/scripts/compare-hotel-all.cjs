const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { SignJWT } = require("jose");

const nextBase = process.env.HOTEL_NEXT_URL ?? "http://127.0.0.1:3201";
const nestBase = process.env.HOTEL_NEST_URL ?? "http://127.0.0.1:4201";
const nil = "00000000-0000-4000-8000-000000000000";
const reportPath = path.join("nest-all-routes.txt");

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "era-hotel-pg", "psql", "-U", "postgres", "-d", "era_hotel_pms", "-t", "-A", "-c", sql],
    { encoding: "utf8" },
  ).trim();
}

function calls() {
  const dir = path.join("nest", "generated");
  const seen = new Set();
  const rows = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".ts") || name === "register.ts") continue;
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    for (const match of text.matchAll(/http\.(get|post|put|patch|delete)\("([^"]+)"/g)) {
      const method = match[1].toUpperCase();
      const pathname = match[2].replace(/:[A-Za-z0-9_]+/g, nil);
      const key = `${method} ${pathname}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ method, pathname, key });
    }
  }
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows;
}

function done() {
  if (!fs.existsSync(reportPath)) return new Set();
  const keys = new Set();
  for (const line of fs.readFileSync(reportPath, "utf8").split("\n")) {
    const match = line.match(/^(?:SAME|DIFF|WROTE) ([A-Z]+ \S+)/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

async function cookieForStaff() {
  const row = psql(
    `SELECT u.id || '|' || u.login || '|' || coalesce(u."fullName",'') || '|' || u."organizationId" || '|' || r.code FROM "User" u JOIN "Role" r ON r.id = u."roleId" WHERE u.status = 'ACTIVE' AND r.code = 'Hotel_Admin' ORDER BY u.login LIMIT 1`,
  );
  const [id, login, fullName, organizationId, role] = row.split("|");
  const token = await new SignJWT({ login, role, fullName, organizationId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_JWT_SECRET));
  const name = process.env.AUTH_COOKIE_NAME || "era_session";
  return { cookie: `${name}=${token}`, login };
}

async function hit(base, method, pathname, cookie) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(base + pathname, {
      method,
      headers: { cookie, ...(method === "GET" ? {} : { "content-type": "application/json" }) },
      body: method === "GET" ? undefined : "{}",
      signal: ctrl.signal,
    });
    const text = await res.text();
    return { status: res.status, text };
  } catch (err) {
    return { status: 0, text: err.name === "AbortError" ? "timeout" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function recheckDiffs(cookie) {
  const lines = fs.readFileSync(reportPath, "utf8").split("\n").filter((line) => line.startsWith("DIFF "));
  const out = path.join("nest-diff-recheck.txt");
  fs.writeFileSync(out, "");
  let same = 0;
  let diff = 0;
  let skipped = 0;
  for (const line of lines) {
    const match = line.match(/^DIFF ([A-Z]+) (\S+) next=(\d+) nest=(\d+)/);
    if (!match) continue;
    const method = match[1];
    const pathname = match[2];
    const nextStatus = Number(match[3]);
    const nestStatus = Number(match[4]);
    const wrote = method !== "GET" && ((nextStatus >= 200 && nextStatus < 300) || (nestStatus >= 200 && nestStatus < 300));
    if (wrote) {
      skipped += 1;
      fs.appendFileSync(out, `SKIP ${method} ${pathname} already wrote\n`);
      console.log("SKIP", method, pathname);
      continue;
    }
    const [a, b] = await Promise.all([
      hit(nextBase, method, pathname, cookie),
      hit(nestBase, method, pathname, cookie),
    ]);
    const ok = a.status === b.status && a.text === b.text;
    if (ok) same += 1;
    else diff += 1;
    const row = `${ok ? "SAME" : "DIFF"} ${method} ${pathname} next=${a.status} nest=${b.status}\n`;
    fs.appendFileSync(out, row);
    console.log(row.trim());
  }
  console.log(`SAME ${same}`);
  console.log(`DIFF ${diff}`);
  console.log(`SKIP ${skipped}`);
}

async function main() {
  const { cookie, login } = await cookieForStaff();
  console.log("staff", login);
  if (process.argv[2] === "--diffs") {
    await recheckDiffs(cookie);
    return;
  }
  if (process.argv[2] === "--status") {
    const lines = fs.readFileSync("nest-diff-recheck.txt", "utf8").split("\n");
    const rows = [];
    for (const line of lines) {
      const match = line.match(/^DIFF ([A-Z]+) (\S+) next=(\d+) nest=(\d+)/);
      if (!match) continue;
      if (match[3] === match[4]) continue;
      rows.push([match[1], match[2]]);
    }
    rows.push(["POST", "/api/public/v1/bookings"], ["POST", "/api/public/v1/holds"]);
    for (const [method, pathname] of rows) {
      const [a, b] = await Promise.all([
        hit(nextBase, method, pathname, cookie),
        hit(nestBase, method, pathname, cookie),
      ]);
      console.log(`${a.status === b.status ? "SAME" : "DIFF"} ${method} ${pathname} next=${a.status} nest=${b.status}`);
    }
    return;
  }
  const finished = done();
  const pending = calls().filter((row) => !finished.has(row.key));
  console.log("todo", pending.length, "done", finished.size);
  for (const row of pending) {
    const [a, b] = await Promise.all([
      hit(nextBase, row.method, row.pathname, cookie),
      hit(nestBase, row.method, row.pathname, cookie),
    ]);
    const wrote = (a.status >= 200 && a.status < 300) || (b.status >= 200 && b.status < 300);
    const same = a.status === b.status && a.text === b.text;
    const tag = !same ? "DIFF" : wrote && row.method !== "GET" ? "WROTE" : "SAME";
    const line = `${tag} ${row.key} next=${a.status} nest=${b.status}\n`;
    fs.appendFileSync(reportPath, line);
    console.log(line.trim());
  }
  const text = fs.readFileSync(reportPath, "utf8");
  console.log(`SAME ${text.split("\n").filter((l) => l.startsWith("SAME")).length}`);
  console.log(`WROTE ${text.split("\n").filter((l) => l.startsWith("WROTE")).length}`);
  console.log(`DIFF ${text.split("\n").filter((l) => l.startsWith("DIFF")).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
