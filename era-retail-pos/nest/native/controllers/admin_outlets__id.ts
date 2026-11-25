/** Lifted from nest/generated/admin_outlets__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getOutletById, updateOutletContacts } from "@/lib/outlet.service";
import { z } from "zod";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const optionalContact = z.string().max(200).nullable().optional();

const patchSchema = z.object({
  revenueCode: z.string().max(32).nullable().optional(),
  phone: optionalContact,
  email: optionalContact,
  address: optionalContact,
  website: optionalContact,
});


@Controller()
export class AdminOutletsIdController {
  @Patch("api/admin/outlets/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const existing = await getOutletById(id);
    if (!existing) return sendJson(httpRes, { error: "Outlet not found" }, 404);
    if (
      body.revenueCode === undefined &&
      body.phone === undefined &&
      body.email === undefined &&
      body.address === undefined &&
      body.website === undefined
    ) {
      return sendJson(httpRes, { error: "No fields to update" }, 400);
    }
    const trimOrNull = (v: string | null | undefined) =>
      v === undefined ? undefined : v === null || !String(v).trim() ? null : String(v).trim();
    const row = await updateOutletContacts(id, {
      ...(body.revenueCode !== undefined
        ? { revenueCode: body.revenueCode?.trim() || null }
        : {}),
      ...(body.phone !== undefined ? { phone: trimOrNull(body.phone) } : {}),
      ...(body.email !== undefined ? { email: trimOrNull(body.email) } : {}),
      ...(body.address !== undefined ? { address: trimOrNull(body.address) } : {}),
      ...(body.website !== undefined ? { website: trimOrNull(body.website) } : {}),
    });
    return sendJson(httpRes, {
      id: row.id,
      code: row.code,
      name: row.name,
      revenueCode: row.revenueCode,
      phone: row.phone,
      email: row.email,
      address: row.address,
      website: row.website,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
