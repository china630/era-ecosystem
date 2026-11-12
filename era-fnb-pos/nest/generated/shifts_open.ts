import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { reportPosShiftStatus } from "@/lib/pms-bridge-client";
import { closedTicketsForShiftDrawer, countOpenHeldTickets, createPosShift, findLatestOpenPosShift, findOpenPosShiftForOutlet, reportFnbPosStationCapacityFireAndForget } from "@/lib/shift.service";
import { sessionActorName } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { isShiftStale } from "@/lib/business-day";
import { cashDrawerForShift } from "@/lib/cash-drawer";
import { recordFbAudit } from "@/lib/satellite-audit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const openSchema = z.object({
  outletCode: z.string().min(1).optional(),
  openingCash: z.number().nonnegative().default(0),
  fiscalDeviceId: z.string().min(1).max(64).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/shifts/open", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_OPEN);
    if (denied) return denied;
    const shift = await findLatestOpenPosShift();
    const profile = await getFnbOrgProfile();
    const mayClose = session
      ? sessionHasFnbPermission(session, PERMISSIONS.SHIFTS_CLOSE)
      : false;
    const mayPay = session
      ? sessionHasFnbPermission(session, PERMISSIONS.TICKETS_PAY)
      : false;
    const mayDiscount = session
      ? sessionHasFnbPermission(session, PERMISSIONS.TICKETS_DISCOUNT)
      : false;
    const maySales = session
      ? sessionHasFnbPermission(session, PERMISSIONS.SCREEN_SALES)
      : false;
    if (!shift) {
      return sendJson(httpRes, {
        status: "NONE",
        stale: false,
        businessDayStart: profile.businessDayStart,
        mayClose,
        mayPay,
        mayDiscount,
        maySales,
      });
    }
    const closed = await closedTicketsForShiftDrawer(
      shift.outletId,
      shift.openedAt,
      new Date(),
    );
    const till = { cash: 0, card: 0, transfer: 0, openChecks: 0 };
    for (const row of closed) {
      const amount = Number(row.totalAzn);
      const method = (row.paymentMethod ?? "").toUpperCase();
      if (method === "CASH") till.cash += amount;
      else if (method === "CARD") till.card += amount;
      else if (method === "TRANSFER") till.transfer += amount;
    }
    till.cash = Math.round(till.cash * 100) / 100;
    till.card = Math.round(till.card * 100) / 100;
    till.transfer = Math.round(till.transfer * 100) / 100;
    till.openChecks = await countOpenHeldTickets(shift.outletId);
    return sendJson(httpRes, {
      ...shift,
      stale: isShiftStale(shift.openedAt, new Date(), profile.businessDayStart),
      businessDayStart: profile.businessDayStart,
      drawer: await cashDrawerForShift(shift),
      till,
      mayClose,
      mayPay,
      mayDiscount,
      maySales,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/shifts/open", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_OPEN);
    if (denied) return denied;
    const body = openSchema.parse(httpReq.body);

    const outlet = await resolveOpsOutlet(body.outletCode);
    const { outletAllowsTill } = await import("@/lib/outlet-capabilities");
    if (!outletAllowsTill(outlet)) {
      return sendJson(httpRes, 
        {
          error: "Outlet has no till capability — cannot open POS shift",
          code: "OUTLET_NO_TILL",
        }, 400);
    }

    const { resolveDefaultDevicesForSatellite } = await import("@era/satellite-kit");
    const { requestOrganizationId } = await import("@/lib/request-organization");
    const organizationId = requestOrganizationId();
    const defaults = resolveDefaultDevicesForSatellite({
      organizationId,
      outletCode: outlet.code,
    });
    const fiscalDeviceId =
      body.fiscalDeviceId ?? defaults.fiscalDeviceId ?? undefined;
    const bankTerminalId =
      body.bankTerminalId ?? defaults.bankTerminalId ?? undefined;

    // Live mode: empty catalog or unresolved KKM cannot open a till
    const live = process.env.ERA_FISCAL_LIVE === "true";
    if (live) {
      const { assertLiveFiscalReady } = await import("@era/satellite-kit");
      assertLiveFiscalReady({ organizationId, outletCode: outlet.code });
      if (!fiscalDeviceId) {
        return sendJson(httpRes, 
          {
            error: "Select a fiscal cash register (KKM) before opening the shift",
            code: "DEVICE_SELECTION_REQUIRED",
          }, 400);
      }
    }

    const existing = await findOpenPosShiftForOutlet(outlet.id);
    if (existing) {
      return sendJson(httpRes, existing);
    }

    const shift = await createPosShift({
      outletId: outlet.id,
      openingCash: body.openingCash,
      openedBy: sessionActorName(session),
      fiscalDeviceId: fiscalDeviceId ?? null,
      bankTerminalId: bankTerminalId ?? null,
    });

    await reportPosShiftStatus({
      outletCode: outlet.code,
      status: "OPEN",
      shiftId: shift.id,
    });

    await recordFbAudit(
      { userId: session?.sub, request },
      "PosShift",
      shift.id,
      "OPEN",
      {
        outletId: outlet.id,
        outletCode: outlet.code,
        openingCash: body.openingCash,
        fiscalDeviceId: fiscalDeviceId ?? null,
        bankTerminalId: bankTerminalId ?? null,
      },
    );

    const { syncFnbChannelPrices } = await import("@/lib/channel-price-sync");
    void syncFnbChannelPrices(organizationId).catch(() => undefined);

    reportFnbPosStationCapacityFireAndForget();

    return sendJson(httpRes, shift, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
