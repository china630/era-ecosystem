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

function writesBySegment() {
  const dir = path.join("nest", "generated");
  const by = new Map();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".ts") || name === "register.ts") continue;
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    for (const match of text.matchAll(/http\.(post|patch)\("([^"]+)"/g)) {
      const method = match[1].toUpperCase();
      const url = match[2];
      const seg = url.split("/")[2] || "root";
      if (!by.has(seg)) by.set(seg, []);
      by.get(seg).push({ method, url });
    }
  }
  return by;
}

function sameSegments() {
  const text = fs.readFileSync("nest-domain-report.txt", "utf8");
  const segs = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^SAME (\S+) /);
    if (m) segs.push(m[1]);
  }
  return segs;
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

function pick(rows) {
  const plain = rows.filter((r) => !r.url.includes(":")).sort((a, b) => a.url.length - b.url.length);
  const pool = plain.length ? plain : rows.slice().sort((a, b) => a.url.length - b.url.length);
  const post = pool.find((r) => r.method === "POST");
  return post ?? pool[0];
}

async function hit(base, method, pathname, cookie) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(base + pathname, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: "{}",
      signal: ctrl.signal,
    });
    return { status: res.status, text: await res.text() };
  } catch (err) {
    return { status: 0, text: err.name === "AbortError" ? "timeout" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const { cookie, login } = await cookieForStaff();
  console.log("staff", login);
  const only = process.argv[2];
  const segments = only ? [only] : sameSegments();
  const writes = writesBySegment();
  const report = path.join(only ? "nest-write-recheck.txt" : "nest-write-report.txt");
  for (const seg of segments) {
    const rows = writes.get(seg);
    if (!rows) {
      const line = `SKIP ${seg} no POST or PATCH\n`;
      fs.appendFileSync(report, line);
      console.log(line.trim());
      continue;
    }
    const chosen = pick(rows);
    const pathname = chosen.url.replace(/:[A-Za-z0-9_]+/g, nil);
    const [a, b] = await Promise.all([
      hit(nextBase, chosen.method, pathname, cookie),
      hit(nestBase, chosen.method, pathname, cookie),
    ]);
    const wrote = a.status >= 200 && a.status < 300 || b.status >= 200 && b.status < 300;
    const same = a.status === b.status && a.text === b.text;
    const tag = wrote ? "WROTE" : same ? "SAME" : "DIFF";
    const line = `${tag} ${seg} ${chosen.method} ${pathname} next=${a.status} nest=${b.status}\n`;
    fs.appendFileSync(report, line);
    console.log(line.trim());
    if (!same && a.status === b.status) {
      console.log("NEXT", a.text.slice(0, 240));
      console.log("NEST", b.text.slice(0, 240));
    }
  }
  const text = fs.readFileSync(report, "utf8");
  console.log(`PASSED ${text.split("\n").filter((l) => l.startsWith("SAME")).length}`);
  console.log(`FAILED ${text.split("\n").filter((l) => l.startsWith("DIFF")).length}`);
  console.log(`WROTE ${text.split("\n").filter((l) => l.startsWith("WROTE")).length}`);
  console.log(`SKIP ${text.split("\n").filter((l) => l.startsWith("SKIP")).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
