/** Lifted from nest/generated/tables.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { createPosTable, findPosHallInOutlet, listOpenHeldTicketsWithTables, listPosTablesForFloor } from "@/lib/hall.service";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { requestOrganizationId } from "@/lib/request-organization";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_TABLES } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  outletCode: z.string().min(1).optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  seats: z.number().int().positive().optional(),
  zone: z.string().nullable().optional(),
  hallId: z.string().nullable().optional(),
});


@Controller()
export class TablesController {
  @Get("api/tables")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_TABLES);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const tables = await listPosTablesForFloor();
    const openTickets = await listOpenHeldTicketsWithTables();
    const ticketIdByTable = new Map(
      openTickets
        .filter((row) => row.tableId)
        .map((row) => [row.tableId as string, row.id]),
    );
    const totalByTicket = new Map(openTickets.map((row) => [row.id, Number(row.totalAzn)]));
    const openedByTicket = new Map(openTickets.map((row) => [row.id, row.openedAt.toISOString()]));
    const totalByTable = new Map(
      openTickets
        .filter((row) => row.tableId)
        .map((row) => [row.tableId as string, Number(row.totalAzn)]),
    );
    const openedByTable = new Map(
      openTickets
        .filter((row) => row.tableId)
        .map((row) => [row.tableId as string, row.openedAt.toISOString()]),
    );
    const waiterByTable = new Map(
      openTickets
        .filter((row) => row.tableId)
        .map((row) => [row.tableId as string, row.waiterLabel || row.openedByName]),
    );
    const coversByTable = new Map(
      openTickets
        .filter((row) => row.tableId)
        .map((row) => [row.tableId as string, row.covers]),
    );
    return sendJson(httpRes, 
      tables.map((table) => ({
        ...table,
        currentTicketId: table.currentTicketId ?? ticketIdByTable.get(table.id) ?? null,
        status:
          table.status === "OCCUPIED" || table.currentTicketId || totalByTable.has(table.id)
            ? "OCCUPIED"
            : table.status,
        openTotalAzn:
          (table.currentTicketId ? totalByTicket.get(table.currentTicketId) : undefined) ??
          totalByTable.get(table.id) ??
          null,
        openedAt:
          (table.currentTicketId ? openedByTicket.get(table.currentTicketId) : undefined) ??
          openedByTable.get(table.id) ??
          null,
        waiterLabel: waiterByTable.get(table.id) ?? null,
        covers: coversByTable.get(table.id) ?? null,
      })),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/tables")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TABLES_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const body = createSchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const outlet = await resolveOpsOutlet(body.outletCode);
    if (body.hallId) {
      const hall = await findPosHallInOutlet(body.hallId, outlet.id);
      if (!hall) return sendJson(httpRes, { error: "Hall not found" }, 404);
    }
    const table = await createPosTable({
      organizationId,
      outletId: outlet.id,
      code: body.code,
      name: body.name,
      seats: body.seats ?? 4,
      zone: body.zone ?? null,
      hallId: body.hallId ?? null,
    });
    return sendJson(httpRes, table, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
