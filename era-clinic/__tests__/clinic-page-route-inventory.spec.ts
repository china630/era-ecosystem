import fs from "node:fs";
import path from "node:path";
import {
  isAuthOnlyStaffPage,
  isPublicStaffPage,
  routePermission,
  routePermissions,
  CLINIC_PERMISSION,
} from "@/lib/auth/clinic-permissions";

function walkPages(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkPages(p, out);
    else if (ent.name === "page.tsx") out.push(p);
  }
  return out;
}

/** Convert app/foo/[id]/page.tsx → /foo/x (dynamic segments collapsed). */
function pageToPathname(appRoot: string, file: string): string {
  const dir = path.dirname(file);
  let rel = path.relative(appRoot, dir).replace(/\\/g, "/");
  if (!rel || rel === ".") return "/";
  rel = rel.replace(/\[[^\]]+\]/g, "x");
  return `/${rel}`;
}

describe("clinic page route inventory (Wave 3 fail-closed)", () => {
  it("every app/**/page.tsx is public, auth-only, visit-exam, or mapped", () => {
    const appRoot = path.join(__dirname, "..", "app");
    const missing: string[] = [];
    for (const file of walkPages(appRoot)) {
      const pathname = pageToPathname(appRoot, file);
      if (isPublicStaffPage(pathname)) continue;
      if (isAuthOnlyStaffPage(pathname)) continue;
      if (
        pathname === "/print/visit-exam" ||
        pathname.startsWith("/print/visit-exam/")
      ) {
        continue;
      }
      if (routePermissions(pathname) == null) {
        missing.push(pathname);
      }
    }
    expect(missing).toEqual([]);
  });

  it("maps visits, lab-orders detail, and print forms", () => {
    expect(routePermission("/visits/x")).toBe(CLINIC_PERMISSION.SCREEN_DOCTOR);
    expect(routePermission("/lab-orders/x")).toBe(
      CLINIC_PERMISSION.SCREEN_LAB_ORDERS,
    );
    expect(routePermission("/print/extra-ticket/x")).toBe(
      CLINIC_PERMISSION.SCREEN_RECEPTION_EXTRA_TICKETS,
    );
    expect(routePermission("/print/lab-order/x")).toBe(
      CLINIC_PERMISSION.SCREEN_LAB_ORDERS,
    );
    expect(routePermission("/print/checkup/x")).toBe(
      CLINIC_PERMISSION.SCREEN_DOCTOR,
    );
    expect(routePermissions("/print/procedures/x")).toEqual([
      CLINIC_PERMISSION.SCREEN_DOCTOR,
      CLINIC_PERMISSION.SCREEN_REPORTS_PROCEDURES,
    ]);
    expect(routePermissions("/print/usm/x")).toEqual([
      CLINIC_PERMISSION.SCREEN_DOCTOR,
      CLINIC_PERMISSION.SCREEN_LAB_ORDERS,
    ]);
  });

  it("account/password is auth-only (null permission, allowlisted)", () => {
    expect(isAuthOnlyStaffPage("/account/password")).toBe(true);
    expect(routePermission("/account/password")).toBeNull();
    expect(routePermissions("/account/password")).toBeNull();
  });

  it("public staff prefixes cover login/help/portal/booking", () => {
    expect(isPublicStaffPage("/login")).toBe(true);
    expect(isPublicStaffPage("/help/x")).toBe(true);
    expect(isPublicStaffPage("/portal")).toBe(true);
    expect(isPublicStaffPage("/booking/x")).toBe(true);
    expect(isPublicStaffPage("/images/logo.png")).toBe(true);
    expect(isPublicStaffPage("/doctor")).toBe(false);
  });
});
