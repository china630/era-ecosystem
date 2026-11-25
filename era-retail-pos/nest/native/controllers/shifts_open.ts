/** Lifted from nest/generated/shifts_open.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createDemoTenant, createOutlet, createRegister, createShiftOnRegister, findFirstTenant, findOpenShiftOnRegister, findOutletByTenantAndCode, findRegisterByOutletAndCode, updateOutletPreset } from "@/lib/shift.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  outletCode: z.string().default("MAIN"),
  registerCode: z.string().default("R1"),
  preset: z.enum(["grocery", "apparel", "electronics", "pharmacy"]).optional(),
  fiscalDeviceId: z.string().min(1).max(64).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});


@Controller()
export class ShiftsOpenController {
  @Post("api/shifts/open")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);

    let tenant = await findFirstTenant();
    if (!tenant) {
      tenant = await createDemoTenant();
    }
    if (!tenant) throw new Error("tenant unavailable");

    let outlet = await findOutletByTenantAndCode(tenant.id, body.outletCode);
    let outletCreated = false;
    if (!outlet) {
      outlet = await createOutlet({
        tenantId: tenant.id,
        code: body.outletCode,
        name: body.outletCode,
        preset: body.preset ?? "grocery",
      });
      outletCreated = true;
    } else if (body.preset) {
      outlet = await updateOutletPreset(outlet.id, body.preset);
    }
    if (!outlet) throw new Error("outlet unavailable");

    let register = await findRegisterByOutletAndCode(outlet.id, body.registerCode);
    if (!register) {
      register = await createRegister(
        outlet.id,
        body.registerCode,
        `Register ${body.registerCode}`,
      );
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

    const existing = await findOpenShiftOnRegister(register.id);
    if (existing) {
      return sendJson(httpRes, existing);
    }

    const shift = await createShiftOnRegister({
      registerId: register.id,
      fiscalDeviceId: fiscalDeviceId ?? null,
      bankTerminalId: bankTerminalId ?? null,
    });
    const { reportRetailPosStationCapacity } = await import(
      "@/lib/report-pos-capacity"
    );
    void reportRetailPosStationCapacity(prisma).catch(() => undefined);
    const { syncRetailChannelPrices } = await import("@/lib/channel-price-sync");
    void syncRetailChannelPrices(organizationId).catch(() => undefined);
    return sendJson(httpRes, shift, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
