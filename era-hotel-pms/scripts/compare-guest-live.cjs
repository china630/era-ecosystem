const { execFileSync } = require("child_process");
const { SignJWT } = require("jose");

const nextBase = process.env.HOTEL_NEXT_URL ?? "http://127.0.0.1:3201";
const nestBase = process.env.HOTEL_NEST_URL ?? "http://127.0.0.1:4201";

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "era-hotel-pg", "psql", "-U", "postgres", "-d", "era_hotel_pms", "-t", "-A", "-c", sql],
    { encoding: "utf8" },
  ).trim();
}

async function cookieForStaff() {
  const row = psql(
    `SELECT u.id || '|' || u.login || '|' || coalesce(u."fullName",'') || '|' || u."organizationId" || '|' || r.code FROM "User" u JOIN "Role" r ON r.id = u."roleId" WHERE u.status = 'ACTIVE' AND r.code = 'Hotel_Admin' ORDER BY u.login LIMIT 1`,
  );
  const [id, login, fullName, organizationId, role] = row.split("|");
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_JWT_SECRET missing");
  const token = await new SignJWT({
    login,
    role,
    fullName,
    organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  const name = process.env.AUTH_COOKIE_NAME || "era_session";
  const guestId = psql(
    `SELECT id FROM "Guest" WHERE "organizationId" = '${organizationId}' LIMIT 1`,
  );
  return { cookie: `${name}=${token}`, guestId, login };
}

async function hit(base, pathname, cookie) {
  const res = await fetch(base + pathname, { headers: cookie ? { cookie } : {} });
  return { status: res.status, text: await res.text() };
}

async function compare(pathname, cookie) {
  const [a, b] = await Promise.all([
    hit(nextBase, pathname, cookie),
    hit(nestBase, pathname, cookie),
  ]);
  const same = a.status === b.status && a.text === b.text;
  console.log(`${same ? "SAME" : "DIFF"} ${pathname} next=${a.status} nest=${b.status} bytes=${a.text.length}/${b.text.length}`);
  if (!same || (a.status !== 200 && a.status !== 401)) {
    console.log(" body", a.text.slice(0, 240));
  }
  return same;
}

async function main() {
  let failed = 0;
  if (!(await compare("/api/guests?page=1&pageSize=2", ""))) failed += 1;
  const { cookie, guestId, login } = await cookieForStaff();
  console.log("staff", login, "guest", guestId ? "yes" : "no");
  const paths = [
    "/api/guests?page=1&pageSize=2",
    `/api/guests/${guestId}/notes`,
    `/api/guests/${guestId}/stats`,
    `/api/guests/${guestId}/full`,
    `/api/guests/${guestId}/contacts`,
    `/api/guests/${guestId}/tasks`,
  ];
  for (const pathname of paths) {
    if (!(await compare(pathname, cookie))) failed += 1;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
