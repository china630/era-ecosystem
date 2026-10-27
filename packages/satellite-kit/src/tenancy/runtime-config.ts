import { z } from "zod";
import { NextResponse } from "next/server";
import { assertEnvServiceToken } from "../auth/assert-service-token";
import {
  applySatelliteRuntimeConfig,
  hydrateRuntimeConfigFromDb,
  publicRuntimeConfigView,
  satelliteRuntimeConfig,
  type SatelliteRuntimeConfig,
} from "./runtime-config-core";
import {
  applyOrganizationBind,
  clearProcessOrganizationBind,
  type OrgBindPrisma,
} from "./organization-bind-core";
import {
  hydrateLoginOrgNoMapFromDisk,
  mergeLoginOrgNoPersistent,
  pruneLoginOrgNoPersistent,
} from "./login-org-no-persist";
import {
  hydrateLoginHostnameMapFromDisk,
  mergeLoginHostnamesForOrg,
  type LoginHostnameSyncRow,
} from "./login-hostname-persist";
import { enterSatelliteTenant } from "./satellite-tenant-context";

const elektrawebBridgeSchema = z.object({
  inboundEnabled: z.boolean(),
  writeEnabled: z.boolean(),
  elektrawebHotelId: z.number().int().positive().nullable().optional(),
  spaDepId: z.number().int().positive().nullable().optional(),
  spaCurrencyId: z.number().int().positive().nullable().optional(),
  walkinResId: z.string().max(64).nullable().optional(),
  walkinResNameId: z.string().max(64).nullable().optional(),
});

const clinicCutoverSchema = z.object({
  elektrawebDualRun: z.boolean(),
  hotelOrganizationId: z.string().uuid().nullable().optional(),
});

const fiscalDeviceSyncSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  kind: z.enum(["FISCAL_KKM", "BANK_POS"]),
  providerId: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  outletCode: z.string().max(64).nullable().optional(),
  registerCode: z.string().max(64).nullable().optional(),
  serial: z.string().max(128).nullable().optional(),
  externalIds: z.record(z.string()).nullable().optional(),
  endpoint: z.string().max(512).nullable().optional(),
  secretsCipher: z.string().nullable().optional(),
  secrets: z.record(z.string()).nullable().optional(),
  status: z.enum(["active", "retired"]),
  isOrgDefault: z.boolean().optional(),
  isOutletDefault: z.boolean().optional(),
  isRegisterDefault: z.boolean().optional(),
});

const runtimeBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  /** Public ERA ID — merge into satellite login orgNo map (A4). */
  publicOrgNumber: z.number().int().min(100000).max(999999).optional(),
  /** Soft-delete / revoke: drop this org from the satellite orgNo map. */
  revokePublicOrgNumber: z.boolean().optional(),
  orchestratorEventUrl: z.string().url().optional(),
  publicBaseUrl: z.string().url().optional(),
  platformSuperAdminEmails: z.array(z.string().email()).max(50).optional(),
  ssoSharedSecret: z.string().min(16).max(512).optional(),
  satelliteEventServiceToken: z.string().min(8).max(512).optional(),
  /** Process-wide Elektraweb (and later other vendor) bridge kill. */
  vendorBridgesEnabled: z.boolean().optional(),
  activeModules: z.array(z.string().min(1).max(120)).max(500).optional(),
  hotelModules: z.record(z.boolean()).optional(),
  deploymentTopology: z.enum(["SHARED", "DEDICATED", "ONPREM"]).optional(),
  edition: z.string().min(1).max(120).optional(),
  updatedBy: z.string().max(200).optional(),
  /** Per-org Elektraweb dual-run policy — upserted by satellite handler, not process-wide memory. */
  elektrawebBridge: elektrawebBridgeSchema.optional(),
  /** Per-org clinic cutover — upserted by clinic satellite handler. */
  clinicCutover: clinicCutoverSchema.optional(),
  /** Per-org fiscal KKM / bank POS devices — hydrate @era/fiscal directory. */
  fiscalDevices: z.array(fiscalDeviceSyncSchema).max(200).optional(),
  /** ACTIVE white-label satellite login hosts for this org (B2 Sync). */
  loginHostnames: z
    .array(
      z.object({
        hostname: z.string().min(1).max(253),
        organizationId: z.string().uuid(),
        satelliteKey: z.string().min(1).max(64).nullable().optional(),
        kind: z.enum(["portal", "satellite_login"]).optional(),
        status: z.enum(["ACTIVE", "PENDING_DNS", "DISABLED"]).optional(),
      }),
    )
    .max(64)
    .optional(),
  /** Org branding snapshot (validated loosely; full Zod lives in @era/contracts). */
  orgProfile: z
    .object({
      organizationId: z.string().uuid(),
      legalName: z.string(),
      etag: z.string().optional(),
      updatedAt: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export type ElektrawebBridgeSyncPayload = z.infer<typeof elektrawebBridgeSchema>;
export type ClinicCutoverSyncPayload = z.infer<typeof clinicCutoverSchema>;
export type RuntimeConfigBody = z.infer<typeof runtimeBodySchema>;

export type RuntimeConfigHandlerOptions = {
  getPrisma?: () => OrgBindPrisma | null | undefined;
  /** Hotel: upsert ElektrawebBridgePolicy for body.organizationId. */
  onElektrawebBridge?: (
    organizationId: string,
    policy: ElektrawebBridgeSyncPayload,
  ) => Promise<void>;
  /** Clinic: upsert ClinicCutoverPolicy for body.organizationId. */
  onClinicCutover?: (
    organizationId: string,
    policy: ClinicCutoverSyncPayload,
  ) => Promise<void>;
  /** Persist KKM / bank POS rows for this organization (hotel cashier list). */
  onFiscalDevices?: (
    organizationId: string,
    devices: import("../integration/fiscal-device-hydrate").FiscalDeviceSyncRow[],
  ) => Promise<void>;
  /** Per-org snapshot on SHARED (edition / modules). Process-wide memory stays unstamped. */
  onSharedOrgSnapshot?: (
    organizationId: string,
    snap: {
      edition?: string;
      activeModules?: string[];
      hotelModules?: Record<string, boolean>;
      orgProfile?: import("@era/contracts").OrganizationProfileSnapshot;
    },
  ) => Promise<void>;
};

export function createRuntimeConfigHandlers(opts: RuntimeConfigHandlerOptions = {}) {
  async function authorize(request: Request) {
    return assertEnvServiceToken({
      expectedEnvKeys: [
        "SATELLITE_EVENT_SERVICE_TOKEN",
        "CLINIC_INTERNAL_SERVICE_TOKEN",
        "CONTROL_PLANE_SERVICE_TOKEN",
      ],
      authorization: request.headers.get("authorization"),
      xServiceToken: request.headers.get("x-service-token"),
    });
  }

  async function GET(request: Request) {
    const auth = await authorize(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const prisma = opts.getPrisma?.() ?? null;
    if (prisma) {
      await hydrateRuntimeConfigFromDb(prisma);
    }
    hydrateLoginOrgNoMapFromDisk();
    hydrateLoginHostnameMapFromDisk();
    if (satelliteRuntimeConfig().deploymentTopology === "SHARED") {
      clearProcessOrganizationBind();
    }
    return NextResponse.json({
      ok: true,
      config: publicRuntimeConfigView(satelliteRuntimeConfig()),
    });
  }

  async function POST(request: Request) {
    const auth = await authorize(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    let body: z.infer<typeof runtimeBodySchema>;
    try {
      body = runtimeBodySchema.parse(await request.json());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    // Service-token caller: the body org is the config subject. Without it the
    // tenant Prisma extension rejects every query inside this request.
    const subjectOrgId = body.organizationId?.trim();
    if (subjectOrgId) enterSatelliteTenant({ organizationId: subjectOrgId });
    const prisma = opts.getPrisma?.() ?? null;
    const topology =
      body.deploymentTopology ?? satelliteRuntimeConfig().deploymentTopology;
    const isShared = topology === "SHARED";
    const orgProfile = body.orgProfile
      ? (body.orgProfile as import("@era/contracts").OrganizationProfileSnapshot)
      : undefined;
    const patch: SatelliteRuntimeConfig = {
      // SHARED: do not stamp process-wide blob with last Sync org id.
      organizationId: isShared ? undefined : body.organizationId,
      orchestratorEventUrl: body.orchestratorEventUrl,
      publicBaseUrl: body.publicBaseUrl,
      platformSuperAdminEmails: body.platformSuperAdminEmails,
      ssoSharedSecret: body.ssoSharedSecret,
      satelliteEventServiceToken: body.satelliteEventServiceToken,
      vendorBridgesEnabled: body.vendorBridgesEnabled,
      activeModules: body.activeModules,
      hotelModules: body.hotelModules,
      deploymentTopology: body.deploymentTopology,
      edition: isShared ? undefined : body.edition,
      // DEDICATED/ONPREM: keep on process memory. SHARED uses per-org cache below.
      orgProfile: isShared ? undefined : orgProfile,
    };
    if (body.organizationId && orgProfile) {
      const { setCachedOrgProfile } = await import("../organization/org-profile-cache");
      setCachedOrgProfile(body.organizationId, orgProfile);
    }
    if (body.organizationId && !isShared) {
      await applyOrganizationBind({
        organizationId: body.organizationId,
        boundBy: body.updatedBy ?? "runtime-config",
        prisma,
      });
    }
    // A4: merge orgNo → UUID (never replace the whole map with one org).
    if (body.revokePublicOrgNumber && body.organizationId) {
      pruneLoginOrgNoPersistent(body.organizationId);
    } else if (
      body.organizationId &&
      body.publicOrgNumber != null &&
      Number.isInteger(body.publicOrgNumber)
    ) {
      mergeLoginOrgNoPersistent(body.publicOrgNumber, body.organizationId);
    }
    if (body.organizationId && body.loginHostnames !== undefined) {
      mergeLoginHostnamesForOrg(
        body.organizationId,
        body.loginHostnames as LoginHostnameSyncRow[],
      );
    }
    // SHARED: skip process bind — per-org vendor/cutover policies still upsert below.
    if (body.organizationId && body.elektrawebBridge && opts.onElektrawebBridge) {
      await opts.onElektrawebBridge(body.organizationId, body.elektrawebBridge);
    }
    if (body.organizationId && body.clinicCutover && opts.onClinicCutover) {
      await opts.onClinicCutover(body.organizationId, body.clinicCutover);
    }
    if (body.organizationId && body.fiscalDevices !== undefined) {
      const { hydrateFiscalDevicesFromSync } = await import(
        "../integration/fiscal-device-hydrate"
      );
      hydrateFiscalDevicesFromSync(body.organizationId, body.fiscalDevices);
      if (opts.onFiscalDevices) {
        await opts.onFiscalDevices(body.organizationId, body.fiscalDevices);
      }
    }
    if (body.organizationId && opts.onSharedOrgSnapshot) {
      await opts.onSharedOrgSnapshot(body.organizationId, {
        edition: body.edition,
        activeModules: body.activeModules,
        hotelModules: body.hotelModules,
        orgProfile,
      });
    }
    const cfg = await applySatelliteRuntimeConfig({
      config: patch,
      updatedBy: body.updatedBy,
      prisma,
    });
    if (isShared) clearProcessOrganizationBind();
    return NextResponse.json({
      ok: true,
      config: publicRuntimeConfigView(cfg),
    });
  }

  return { GET, POST };
}
