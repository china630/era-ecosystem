import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { createImportedLabOrder, findLisFileProfileById } from "@/domain/lab/lab-order-write.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  profileId: z.string(),
  patientRefId: z.string(),
  visitId: z.string().optional(),
  csvText: z.string().min(1),
});

function parseCsvLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/lab-orders/import", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_WRITE);
    if (denied) return denied;

    const body = bodySchema.parse(httpReq.body);
    const profile = await findLisFileProfileById(body.profileId);
    if (!profile) return sendJson(httpRes, { error: "LIS profile not found" }, 404);

    const mapping = JSON.parse(profile.columnMapping) as Record<string, string>;
    const lines = body.csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return sendJson(httpRes, { error: "CSV must include header and at least one data row" }, 400);
    }

    const header = parseCsvLine(lines[0], profile.delimiter);
    const colIndex = (key: string): number => {
      const mapped = mapping[key];
      if (mapped) {
        const idx = header.indexOf(mapped);
        if (idx >= 0) return idx;
      }
      return header.indexOf(key);
    };

    const testCodeIdx = colIndex("testCode");
    const analyteIdx = colIndex("analyte");
    const valueIdx = colIndex("value");
    const refMinIdx = colIndex("refMin");
    const refMaxIdx = colIndex("refMax");

    const grouped = new Map<string, Array<Record<string, unknown>>>();
    for (const line of lines.slice(1)) {
      const cells = parseCsvLine(line, profile.delimiter);
      const testCode =
        testCodeIdx >= 0 ? cells[testCodeIdx] : cells[0] ?? "LAB-IMPORT";
      const result = {
        analyte: analyteIdx >= 0 ? cells[analyteIdx] : cells[1] ?? "unknown",
        value: valueIdx >= 0 ? cells[valueIdx] : cells[2] ?? "",
        refMin: refMinIdx >= 0 ? Number(cells[refMinIdx]) : undefined,
        refMax: refMaxIdx >= 0 ? Number(cells[refMaxIdx]) : undefined,
      };
      const bucket = grouped.get(testCode) ?? [];
      bucket.push(result);
      grouped.set(testCode, bucket);
    }

    const orders = [];
    for (const [testCode, results] of grouped) {
      const order = await createImportedLabOrder({
        patientRefId: body.patientRefId,
        visitId: body.visitId,
        code: testCode,
        results: results as Array<{
          analyte?: string;
          value: string;
          refMin?: number;
          refMax?: number;
        }>,
      });
      orders.push(order);
    }

    return sendJson(httpRes, { imported: orders.length, orders }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
