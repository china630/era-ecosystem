import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { cellMoney, cellString, firstCellString, parseDateCell, slugCode } from "@/lib/import/helpers";
import { toDecimal } from "@/lib/decimal";
import type { ImportAdapter } from "@/lib/import/types";

const rowSchema = z.object({
  externalRef: z.string().min(1),
  reservationExternalRef: z.string().min(1),
  agencyLabel: z.string().min(1),
  remaining: z.number(),
  payment: z.number().optional().nullable(),
  cityLedger: z.number().optional().nullable(),
  guestNames: z.string().optional().nullable(),
  roomNo: z.string().optional().nullable(),
  businessDate: z.date(),
});

export const agencyStatementAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: "agency-statement",
  label: "Agency Statement (city ledger)",
  order: 15,
  permission: PERMISSIONS.FOLIO_CHARGE,
  templateHint: "15-Agency-Statement.xlsx — EW Agency Statement (FO city ledger, not 1C)",
  headerAliases: {
    "Res Id": "reservationExternalRef",
    "Agency Code": "agencyLabel",
    Remaining: "remaining",
    Payment: "payment",
    "City Ledger": "cityLedger",
    "City Ledger  ": "cityLedger",
    "Guest Names": "guestNames",
    "Room No": "roomNo",
    "T Date": "businessDate",
  },
  rowSchema,
  mapRow: (raw) => {
    const reservationExternalRef = firstCellString(raw, [
      "reservationExternalRef",
      "Res Id",
    ]);
    if (!reservationExternalRef) return null;
    const remaining = cellMoney(raw.remaining) ?? cellMoney(raw.Remaining);
    if (remaining == null || remaining <= 0) return null;
    const agencyLabel =
      firstCellString(raw, ["agencyLabel", "Agency Code"]) ?? "WALKIN";
    return {
      externalRef: `ew:agency-stmt:${reservationExternalRef}`,
      reservationExternalRef,
      agencyLabel,
      remaining,
      payment: cellMoney(raw.payment),
      cityLedger: cellMoney(raw.cityLedger),
      guestNames: cellString(raw.guestNames),
      roomNo: cellString(raw.roomNo),
      businessDate: parseDateCell(raw.businessDate) ?? new Date("2026-08-31T00:00:00.000Z"),
    };
  },
  upsert: async (tx, row, dryRun) => {
    const reservation = await tx.reservation.findFirst({
      where: { externalRef: row.reservationExternalRef },
      include: { folios: true },
    });
    if (!reservation) {
      throw new Error(`Reservation not found for Res Id ${row.reservationExternalRef}`);
    }

    const orgId = requestOrganizationId();
    const agencyCode = slugCode(row.agencyLabel);
    let agency = await tx.agency.findFirst({
      where: {
        OR: [
          { code: agencyCode },
          { name: { equals: row.agencyLabel, mode: "insensitive" } },
        ],
      },
    });
    if (!agency && !dryRun) {
      agency = await tx.agency.create({
        data: {
          organizationId: orgId,
          code: agencyCode,
          name: row.agencyLabel,
          active: true,
        },
      });
    }
    if (agency && !dryRun && reservation.agencyId !== agency.id) {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { agencyId: agency.id },
      });
    }

    let revenue = await tx.revenueCode.findFirst({
      where: { OR: [{ code: "EW-CL" }, { code: "CL" }, { code: "CITY" }] },
    });
    if (!revenue && !dryRun) {
      revenue = await tx.revenueCode.create({
        data: { organizationId: orgId, code: "EW-CL", name: "City Ledger (EW statement)" },
      });
    }
    if (dryRun) return "created";
    if (!revenue) throw new Error("Revenue code EW-CL missing");

    let folio = reservation.folios.find((f) => f.type === "AGENCY");
    if (!folio) {
      folio = await tx.folio.create({
        data: {
          organizationId: orgId,
          reservationId: reservation.id,
          type: "AGENCY",
          status: "OPEN",
        },
      });
    }
    if (!folio) throw new Error("Could not resolve agency folio");

    const description = [
      "EW Agency Statement remaining",
      row.guestNames,
      row.roomNo,
    ]
      .filter(Boolean)
      .join(" — ");

    const existing = await tx.folioCharge.findFirst({ where: { externalRef: row.externalRef } });
    await tx.folioCharge.upsert({
      where: { externalRef: row.externalRef } as never,
      create: {
        externalRef: row.externalRef,
        folioId: folio.id,
        revenueCodeId: revenue.id,
        amount: toDecimal(row.remaining),
        qty: 1,
        description,
        businessDate: row.businessDate,
      },
      update: {
        amount: toDecimal(row.remaining),
        description,
        businessDate: row.businessDate,
      },
    });
    return existing ? "updated" : "created";
  },
};
