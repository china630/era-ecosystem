import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { updateHotelProfilePolicyJson } from '@/lib/services/report-pack.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { REPORT_CATALOG, upgradeLegacyNightAuditPack } from '@/lib/reports/catalog';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const DEFAULT_NAFTA_SLUGS = [
  'daily-management',
  'trial-balance-period',
  'cash-report',
  'monthly-daily-analysis',
  'in-house',
  'annual-occupancy',
  'folio-transactions',
  'department-revenues',
  'police-list',
] as const;

function allowedSlugsSet(): Set<string> {
  return new Set(REPORT_CATALOG.map((r) => r.slug));
}

function uniquePreserveOrder(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

function tryParsePolicyJson(raw: string | null | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

const putSchema = z.object({
  enabled: z.boolean().optional(),
  slugs: z.array(z.string()).optional(),
  reportIds: z.array(z.string()).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/report-pack", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
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

  
    assertPermission(session, PERMISSIONS.USERS_MANAGE);

    const { ensureHotelProfile } = await import('@/lib/services/hotel.service');
    const profile = await ensureHotelProfile();

    const policy = tryParsePolicyJson(profile.policyJson);
    const pack = (policy as any)?.nightAuditReportPack;

    const allowed = allowedSlugsSet();

    const rawEnabled = typeof pack?.enabled === 'boolean' ? (pack.enabled as boolean) : true;
    const storedSlugs = Array.isArray(pack?.slugs) ? (pack.slugs as string[]) : [...DEFAULT_NAFTA_SLUGS];
    const upgraded = upgradeLegacyNightAuditPack(storedSlugs);
    if (upgraded.changed && pack?.enabled !== false) {
      const nextPolicy = {
        ...(policy as Record<string, unknown>),
        nightAuditReportPack: { enabled: true, slugs: upgraded.slugs },
      };
      await updateHotelProfilePolicyJson(profile.id, JSON.stringify(nextPolicy));
    }

    const nextSlugs = uniquePreserveOrder(upgraded.slugs);
    const unknown = nextSlugs.find((s) => !allowed.has(s));
    if (unknown) {
      return sendJson(httpRes, serialize({ enabled: true, slugs: [...DEFAULT_NAFTA_SLUGS], reportIds: [...DEFAULT_NAFTA_SLUGS] }));
    }

    const enabled = rawEnabled && nextSlugs.length > 0;
    const slugs = enabled ? nextSlugs : [];

    return sendJson(httpRes, serialize({ enabled, slugs, reportIds: slugs }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/admin/report-pack", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
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

  
    assertPermission(session, PERMISSIONS.USERS_MANAGE);

    const body = putSchema.parse(httpReq.body);
    const allowed = allowedSlugsSet();

    const rawSlugs = body.slugs ?? body.reportIds ?? [];
    const slugsUnique = uniquePreserveOrder(rawSlugs);

    const unknown = slugsUnique.find((s) => !allowed.has(s));
    if (unknown) throw new Error(`Unknown report slug: ${unknown}`);

    const enabled = body.enabled ?? slugsUnique.length > 0;
    const nextSlugs = enabled ? slugsUnique : [];

    const { ensureHotelProfile } = await import('@/lib/services/hotel.service');
    const profile = await ensureHotelProfile();

    const policy = tryParsePolicyJson(profile.policyJson);
    const nextPolicy = {
      ...(policy as Record<string, unknown>),
      nightAuditReportPack: {
        enabled,
        slugs: nextSlugs,
      },
    };

    await updateHotelProfilePolicyJson(profile.id, JSON.stringify(nextPolicy));

    return sendJson(httpRes, serialize({ enabled, slugs: nextSlugs, reportIds: nextSlugs }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
