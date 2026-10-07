import { z } from "zod";
import { enterSatelliteTenant } from "../tenancy/satellite-tenant-context";
import {
  findUserByCredential,
  verifySatelliteUserPassword,
  type SatelliteUserRecord,
} from "./login-user";
import { ORG_NO_RE } from "./resolve-login-org";
import { readStaffLoginJson, resolveStaffLoginTenant } from "./staff-login-org";

const bodySchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  /** Required unless the host already names the organization. */
  orgNo: z.string().regex(ORG_NO_RE).optional(),
});

export type OpenedStaffLogin =
  | { ok: true; login: string; password: string; organizationId: string }
  | { ok: false; status: 400 | 401 | 429; error: string };

export type IndustryStaffLoginResult =
  | { ok: true; user: SatelliteUserRecord; organizationId: string }
  | { ok: false; status: 400 | 401 | 429; error: string };

/**
 * Shared staff-login prefix: JSON, then orgNo → UUID.
 * Does not enter the tenant. `enterWith` does not survive the return to the
 * caller, so the function that queries Prisma must call `enterSatelliteTenant`
 * itself immediately before that query.
 */
export async function openStaffLogin(input: {
  request: Request;
  isShared: boolean;
  satelliteKey?: string;
}): Promise<OpenedStaffLogin> {
  const rawBody = await readStaffLoginJson(input.request);
  if (!rawBody.ok) {
    return { ok: false, status: rawBody.status, error: rawBody.error };
  }
  const body = bodySchema.parse(rawBody.raw);
  const tenant = await resolveStaffLoginTenant({
    orgNo: body.orgNo,
    isShared: input.isShared,
    request: input.request,
    satelliteKey: input.satelliteKey,
  });
  if (!tenant.ok) {
    return { ok: false, status: tenant.status, error: tenant.error };
  }
  const organizationId = tenant.organizationId?.trim() || "";
  if (!organizationId) {
    return { ok: false, status: 400, error: "orgNo is required" };
  }
  return { ok: true, login: body.login, password: body.password, organizationId };
}

/**
 * Industry `User` login. Enters the tenant in this function, then finds the
 * credential inside that org and checks the password. The satellite route
 * keeps session, roles, and cookies.
 */
export async function authenticateIndustryStaffLogin(input: {
  request: Request;
  prisma: unknown;
  isShared: boolean;
  satelliteKey?: string;
}): Promise<IndustryStaffLoginResult> {
  const opened = await openStaffLogin(input);
  if (!opened.ok) return opened;
  enterSatelliteTenant({ organizationId: opened.organizationId });
  const user = await findUserByCredential(input.prisma, opened.login, opened.organizationId);
  if (!(await verifySatelliteUserPassword(opened.password, user)) || !user) {
    return { ok: false, status: 401, error: "Invalid credentials" };
  }
  return { ok: true, user, organizationId: user.organizationId };
}
