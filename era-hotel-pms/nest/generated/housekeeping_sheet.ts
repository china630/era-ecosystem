import { todayBakuYmd } from '@era/satellite-kit/time';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { generateFloorSheet, generateAllFloorSheets, generateFloorSheetPdf } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/housekeeping/sheet", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const sp = new URL(request.url).searchParams;
    const date = sp.get('date') ?? todayBakuYmd();
    if (sp.get('format') === 'pdf') {
      const rawLang = sp.get('lang');
      const lang = rawLang === 'en' || rawLang === 'ru' ? rawLang : 'az';
      const floorRaw = sp.get('floor');
      const floorNum = floorRaw == null || floorRaw === '' ? undefined : Number(floorRaw);
      const buf = await generateFloorSheetPdf(date, lang, Number.isFinite(floorNum) ? floorNum : undefined);
      return new Response(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="floor-sheet-${date}.pdf"`,
        },
      });
    }
    if (sp.get('all') === '1') {
      return sendJson(httpRes, serialize(await generateAllFloorSheets(date)));
    }
    const floor = Number(sp.get('floor') ?? '2');
    return sendJson(httpRes, serialize(await generateFloorSheet(date, floor)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
