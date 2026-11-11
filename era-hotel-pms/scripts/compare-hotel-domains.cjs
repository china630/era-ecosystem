const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { SignJWT } = require("jose");

const nextBase = process.env.HOTEL_NEXT_URL ?? "http://127.0.0.1:3201";
const nestBase = process.env.HOTEL_NEST_URL ?? "http://127.0.0.1:4201";
const nil = "00000000-0000-4000-8000-000000000000";

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "era-hotel-pg", "psql", "-U", "postgres", "-d", "era_hotel_pms", "-t", "-A", "-c", sql],
    { encoding: "utf8" },
  ).trim();
}

function getsBySegment() {
  const dir = path.join("nest", "generated");
  const by = new Map();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".ts") || name === "register.ts") continue;
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    for (const match of text.matchAll(/http\.get\("([^"]+)"/g)) {
      const url = match[1];
      const seg = url.split("/")[2] || "root";
      if (!by.has(seg)) by.set(seg, []);
      by.get(seg).push(url);
    }
  }
  return by;
}

async function cookieForStaff() {
  const row = psql(
    `SELECT u.id || '|' || u.login || '|' || coalesce(u."fullName",'') || '|' || u."organizationId" || '|' || r.code FROM "User" u JOIN "Role" r ON r.id = u."roleId" WHERE u.status = 'ACTIVE' AND r.code = 'Hotel_Admin' ORDER BY u.login LIMIT 1`,
  );
  const [id, login, fullName, organizationId, role] = row.split("|");
  const secret = process.env.AUTH_JWT_SECRET;
  const token = await new SignJWT({ login, role, fullName, organizationId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  const name = process.env.AUTH_COOKIE_NAME || "era_session";
  return { cookie: `${name}=${token}`, login };
}

async function hitMethod(base, method, pathname, cookie) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(base + pathname, {
      method,
      headers: { cookie, ...(method === "GET" ? {} : { "content-type": "application/json" }) },
      body: method === "GET" ? undefined : "{}",
      signal: ctrl.signal,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const text = buf.length > 200 && !buf.slice(0, 1).toString().startsWith("{") ? `bytes:${buf.length}` : buf.toString("utf8");
    return { status: res.status, text };
  } catch (err) {
    return { status: 0, text: err.name === "AbortError" ? "timeout" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function hit(base, pathname, cookie) {
  return hitMethod(base, "GET", pathname, cookie);
}

function pick(urls) {
  const plain = urls.filter((u) => !u.includes(":")).sort((a, b) => a.length - b.length);
  return plain[0] ?? urls.slice().sort((a, b) => a.length - b.length)[0];
}

async function main() {
  if (process.argv[2] === "--left") {
    const { cookie, login } = await cookieForStaff();
    console.log("staff", login);
    const calls = [
      ["GET", "/api/hotel/profile/logo"],
      ["POST", "/api/hotel/profile/logo"],
      ["POST", `/api/agency/reservations/${nil}/attachments`],
      ["GET", `/api/reservations/${nil}/attachments`],
      ["POST", `/api/reservations/${nil}/attachments`],
      ["POST", "/api/import/not-an-entity"],
      ["GET", "/api/reports/occupancy"],
    ];
    let failed = 0;
    for (const [method, pathname] of calls) {
      const [a, b] = await Promise.all([
        hitMethod(nextBase, method, pathname, cookie),
        hitMethod(nestBase, method, pathname, cookie),
      ]);
      const same = a.status === b.status && a.text === b.text;
      if (!same) failed += 1;
      console.log(`${same ? "SAME" : "DIFF"} ${method} ${pathname} next=${a.status} nest=${b.status}`);
      if (!same) {
        console.log("NEXT", a.text.slice(0, 180));
        console.log("NEST", b.text.slice(0, 180));
      }
    }
    process.exit(failed ? 1 : 0);
  }
  const { cookie, login } = await cookieForStaff();
  console.log("staff", login);
  const only = process.argv[2];
  const segments = only ? [only] : [...getsBySegment().keys()].sort();
  const report = path.join(only ? "nest-get-recheck.txt" : "nest-domain-report.txt");
  for (const seg of segments) {
    const urls = getsBySegment().get(seg);
    if (!urls) {
      fs.appendFileSync(report, `SKIP ${seg} no generated GET\n`);
      console.log("SKIP", seg);
      continue;
    }
    const raw = pick(urls);
    const pathname = raw.replace(/:[A-Za-z0-9_]+/g, nil);
    const [a, b] = await Promise.all([hit(nextBase, pathname, cookie), hit(nestBase, pathname, cookie)]);
    const same = a.status === b.status && a.text === b.text;
    const line = `${same ? "SAME" : "DIFF"} ${seg} ${pathname} next=${a.status} nest=${b.status}\n`;
    fs.appendFileSync(report, line);
    console.log(line.trim());
    if (!same && a.status === b.status) {
      let i = 0;
      while (i < a.text.length && i < b.text.length && a.text[i] === b.text[i]) i += 1;
      console.log("NEXT", a.text.slice(Math.max(0, i - 40), i + 80));
      console.log("NEST", b.text.slice(Math.max(0, i - 40), i + 80));
    }
  }
  if (!only) {
    const text = fs.readFileSync(report, "utf8");
    const same = text.split("\n").filter((l) => l.startsWith("SAME")).length;
    const diff = text.split("\n").filter((l) => l.startsWith("DIFF")).length;
    console.log(`PASSED ${same}`);
    console.log(`FAILED ${diff}`);
    process.exit(diff ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
