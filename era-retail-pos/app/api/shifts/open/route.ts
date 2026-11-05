import { z } from "zod";
import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  outletCode: z.string().default("MAIN"),
  registerCode: z.string().default("R1"),
  preset: z.enum(["grocery", "apparel", "electronics", "pharmacy"]).optional(),
  fiscalDeviceId: z.string().min(1).max(64).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function POST(req: Request) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const body = bodySchema.parse(await req.json());

    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { code: "demo", name: "Demo Tenant" },
      });
    }
    if (!tenant) throw new Error("tenant unavailable");

    let outlet = await prisma.outlet.findFirst({
      where: { tenantId: tenant.id, code: body.outletCode },
    });
    let outletCreated = false;
    if (!outlet) {
      outlet = await prisma.outlet.create({
        data: {
          tenantId: tenant.id,
          code: body.outletCode,
          name: body.outletCode,
          preset: body.preset ?? "grocery",
        },
      });
      outletCreated = true;
    } else if (body.preset) {
      outlet = await prisma.outlet.update({
        where: { id: outlet.id },
        data: { preset: body.preset },
      });
    }
    if (!outlet) throw new Error("outlet unavailable");

    let register = await prisma.register.findFirst({
      where: { outletId: outlet.id, code: body.registerCode },
    });
    if (!register) {
      register = await prisma.register.create({
        data: {
          outletId: outlet.id,
          code: body.registerCode,
          name: `Register ${body.registerCode}`,
        },
      });
    }
    if (!register) throw new Error("register unavailable");

    const { resolveDefaultDevicesForSatellite, assertLiveFiscalReady } =
      await import("@era/satellite-kit");
    const { requestOrganizationId } = await import("@/lib/request-organization");
    const organizationId = requestOrganizationId();
    if (outletCreated) {
      const base =
        process.env.ORCHESTRATOR_URL?.trim() ||
        process.env.CONTROL_PLANE_URL?.trim() ||
        "";
      const token =
        process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
        process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
        "";
      if (base && token && organizationId) {
        await fetch(
          `${base.replace(/\/$/, "")}/v1/internal/structure/outlets/upsert`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              "x-service-token": token,
            },
            body: JSON.stringify({
              organizationId,
              satelliteKey: "industry_retail",
              code: outlet.code,
              name: outlet.name,
            }),
          },
        ).catch(() => null);
      }
    }
    const defaults = resolveDefaultDevicesForSatellite({
      organizationId,
      outletCode: outlet.code,
      registerRef: register.code,
    });
    const fiscalDeviceId =
      body.fiscalDeviceId ?? defaults.fiscalDeviceId ?? undefined;
    const bankTerminalId =
      body.bankTerminalId ?? defaults.bankTerminalId ?? undefined;
    if (process.env.ERA_FISCAL_LIVE === "true") {
      assertLiveFiscalReady({
        organizationId,
        outletCode: outlet.code,
        registerRef: register.code,
      });
    }

    const existing = await prisma.shift.findFirst({
      where: { registerId: register.id, status: "OPEN" },
    });
    if (existing) {
      return jsonOk(existing);
    }

    const shift = await prisma.shift.create({
      data: {
        registerId: register.id,
        fiscalDeviceId: fiscalDeviceId ?? null,
        bankTerminalId: bankTerminalId ?? null,
      },
    });
    const { reportRetailPosStationCapacity } = await import(
      "@/lib/report-pos-capacity"
    );
    void reportRetailPosStationCapacity(prisma).catch(() => undefined);
    const { syncRetailChannelPrices } = await import("@/lib/channel-price-sync");
    void syncRetailChannelPrices(organizationId).catch(() => undefined);
    return jsonOk(shift, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
