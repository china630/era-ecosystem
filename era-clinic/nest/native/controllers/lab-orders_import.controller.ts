import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { createImportedLabOrder, findLisFileProfileById } from "@/domain/lab/lab-order-write.service";


const bodySchema = z.object({
  profileId: z.string(),
  patientRefId: z.string(),
  visitId: z.string().optional(),
  csvText: z.string().min(1),
});

function parseCsvLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

@Controller()
export class LabOrdersImportController {

  @UseGuards(ClinicApiGuard)
  @Post("api/lab-orders/import")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_WRITE);
    if (denied) return clinicBody(denied);

    const body = bodySchema.parse(httpReq.body);
    const profile = await findLisFileProfileById(body.profileId);
    if (!profile) throw new HttpException({ error: "LIS profile not found" }, 404);

    const mapping = JSON.parse(profile.columnMapping) as Record<string, string>;
    const lines = body.csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new HttpException({ error: "CSV must include header and at least one data row" }, 400);
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

    throw new HttpException({ imported: orders.length, orders }, 201);
  
        });
  }
}
