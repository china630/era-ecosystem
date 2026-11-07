import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Fail-closed inventory: every assertClinicAdmin* admin route must be in
 * ADMIN_API_PREFIX_PERMISSIONS (or the audit allowlist).
 */
describe("admin API prefix inventory", () => {
  it("audit-admin-api-map exits 0", () => {
    const script = path.join(__dirname, "..", "scripts", "audit-admin-api-map.mjs");
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      cwd: path.join(__dirname, ".."),
    });
    if (result.status !== 0) {
      // eslint-disable-next-line no-console
      console.error(result.stdout, result.stderr);
    }
    expect(result.status).toBe(0);
  });
});
