import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { translateNextRouteModule } from "./route-translate";

const GUEST_ROUTE = `
export async function GET(request: Request) {
  const session = await getSatelliteSession();
  assertPermission(session, PERMISSIONS.GUESTS_READ);
  const result = await listGuests({ q: "a" });
  return jsonOk(result);
}

export async function POST(request: Request) {
  const session = await getSatelliteSession();
  assertPermission(session, PERMISSIONS.GUESTS_WRITE);
  const body = createGuestSchema.parse(await request.json());
  const guest = await createGuest(body);
  await dispatchSatelliteEvent({ type: "guest.created" });
  return jsonOk(guest, 201);
}
`;

const FILE_ROUTE = `
export async function POST(request: Request) {
  const session = await getSatelliteSession();
  assertPermission(session, PERMISSIONS.GUESTS_WRITE);
  const form = await request.formData();
  const saved = await saveGuestAttachment(form);
  return jsonOk(saved);
}
`;

describe("next route translator", () => {
  it("keeps permission, zod, the service call, and the event", () => {
    const [get, post] = translateNextRouteModule(GUEST_ROUTE);
    assert.equal(get?.ready, true);
    assert.ok(get?.kept.includes("assertPermission(session, PERMISSIONS.GUESTS_READ)"));
    assert.ok(get?.kept.includes("await listGuests("));
    assert.equal(post?.ready, true);
    assert.ok(post?.kept.some((call) => call.startsWith("createGuestSchema.parse")));
    assert.ok(post?.kept.includes("await createGuest("));
    assert.ok(post?.kept.includes("dispatchSatelliteEvent("));
    assert.match(post?.nestMethod ?? "", /dispatchSatelliteEvent\(/);
  });

  it("lists a file upload and does not mark that handler ready", () => {
    const [post] = translateNextRouteModule(FILE_ROUTE);
    assert.equal(post?.ready, false);
    assert.deepEqual(post?.blockedBy, ["formData"]);
    assert.ok(post?.kept.includes("formData()"));
    assert.ok(post?.kept.includes("await saveGuestAttachment("));
    assert.ok(post?.kept.includes("assertPermission(session, PERMISSIONS.GUESTS_WRITE)"));
  });
});
