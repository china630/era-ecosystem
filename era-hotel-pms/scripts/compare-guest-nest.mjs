const nextBase = process.env.HOTEL_NEXT_URL ?? "http://127.0.0.1:3201";
const nestBase = process.env.HOTEL_NEST_URL ?? "http://127.0.0.1:4201";
const cookie = process.env.HOTEL_COMPARE_COOKIE ?? "";
const guestId = process.env.HOTEL_COMPARE_GUEST_ID ?? "";

const paths = ["/api/guests"];
if (guestId) {
  paths.push(
    `/api/guests/${guestId}/notes`,
    `/api/guests/${guestId}/stats`,
    `/api/guests/${guestId}/full`,
  );
}

async function hit(base, pathname) {
  const res = await fetch(base + pathname, {
    headers: cookie ? { cookie } : {},
  });
  const text = await res.text();
  return { status: res.status, text };
}

let failed = 0;
for (const pathname of paths) {
  const [a, b] = await Promise.all([hit(nextBase, pathname), hit(nestBase, pathname)]);
  const same = a.status === b.status && a.text === b.text;
  console.log(`${same ? "SAME" : "DIFF"} ${pathname} next=${a.status} nest=${b.status}`);
  if (!same) {
    failed += 1;
    console.log(" next", a.text.slice(0, 300));
    console.log(" nest", b.text.slice(0, 300));
  }
}
if (!cookie) console.log("HOTEL_COMPARE_COOKIE is empty; both sides should be 401.");
process.exit(failed ? 1 : 0);
