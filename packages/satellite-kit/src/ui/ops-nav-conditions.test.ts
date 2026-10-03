import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  opsNavProfileFromMe,
  visibleOpsNavItems,
  visibleOpsNavSections,
  type OpsNavProfile,
} from "./ops-nav-conditions";

function profile(extra: Record<string, unknown> = {}): OpsNavProfile {
  const p = opsNavProfileFromMe({
    login: "w1",
    role: "FB_WAITER",
    permissions: ["screen:floor"],
    edition: "kafe",
    enabledPresets: ["cafe"],
    activeModules: ["industry_fnb_pos"],
    ...extra,
  });
  assert.ok(p);
  return p;
}

describe("ops nav row conditions", () => {
  const rows = [
    { href: "/floor", permission: "screen:floor", preset: ["cafe", "restaurant"] },
    { href: "/kds", module: "fnb_kitchen_kds" },
    { href: "/banquet", preset: "banquet" },
    { href: "/upgrade", edition: "fnb" },
    { href: "/import", when: false },
    { href: "/help" },
  ];

  it("shows a row only when every set condition holds", () => {
    const hrefs = visibleOpsNavItems(rows, "ready", profile()).map((r) => r.href);
    assert.deepEqual(hrefs, ["/floor", "/help"]);
  });

  it("keeps a gated catalog empty while loading and after a failed read", () => {
    assert.deepEqual(visibleOpsNavItems(rows, "loading", null), []);
    assert.deepEqual(visibleOpsNavItems(rows, "error", null), []);
  });

  it("returns an ungated catalog at once", () => {
    const plain = [{ href: "/a" }, { href: "/b" }];
    assert.equal(visibleOpsNavItems(plain, "loading", null).length, 2);
  });

  it("matches anyPermission against the allow callback", () => {
    const list = [{ href: "/x", anyPermission: ["a", "screen:floor"] }];
    assert.equal(visibleOpsNavItems(list, "ready", profile()).length, 1);
    assert.equal(visibleOpsNavItems(list, "ready", profile(), () => false).length, 0);
  });

  it("drops sections left without rows and keeps headers", () => {
    const sections = [
      { id: "core", items: [{ href: "/floor", permission: "screen:floor" }] },
      { id: "admin", items: [{ href: "/access", permission: "screen:admin.access" }] },
      { id: "kitchen", module: "fnb_kitchen_kds", items: [{ href: "/kds" }] },
      { id: "header", items: [] },
    ];
    const ids = visibleOpsNavSections(sections, "ready", profile()).map((s) => s.id);
    assert.deepEqual(ids, ["core", "header"]);
  });

  it("unwraps a data envelope and reads super admin", () => {
    const p = opsNavProfileFromMe({ data: { displayName: "Ali", isSuperAdmin: true } });
    assert.equal(p?.displayName, "Ali");
    assert.equal(p?.isPlatformSuperAdmin, true);
    assert.deepEqual(p?.presets, []);
    assert.equal(p?.edition, null);
  });
});
