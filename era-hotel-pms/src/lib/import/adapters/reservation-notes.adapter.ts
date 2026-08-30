import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { cellString, firstCellString } from "@/lib/import/helpers";
import type { ImportAdapter } from "@/lib/import/types";
import { isReservationNoteType } from "@/lib/reservation-note-types";
import { stampMedicalPackagesForReservation } from "@/lib/services/medical-package-stamp.service";

/**
 * FO Notes dump / FO-with-Notes columns → ReservationNote upsert by (reservationId, noteType).
 * After notes write, re-run medical SKU resolver.
 *
 * EW «Front office with notes» wide columns (2026 dump):
 * Extra Req, Res Note, Price Note, CIn Note, #COut Note#, Room Note,
 * Cancel Note, Payment Note, Invoice Note.
 */
const rowSchema = z.object({
  externalRef: z.string().min(1),
  noteType: z.string().min(1),
  text: z.string(),
});

/** ERA noteType ← EW / alias headers */
export const EW_NOTE_COLUMN_TO_ERA: Record<string, string> = {
  EXTRA_REQ: "EXTRA_REQ",
  "EXTRA REQUEST": "EXTRA_REQ",
  EXTRAREQ: "EXTRA_REQ",
  RES_NOTE: "RES_NOTE",
  "RES NOTE": "RES_NOTE",
  RESNOTE: "RES_NOTE",
  CIN_NOTE: "CIN_NOTE",
  "CIN NOTE": "CIN_NOTE",
  "CHECK IN NOTE": "CIN_NOTE",
  CHECKINNOTE: "CIN_NOTE",
  COUT_NOTE: "COUT_NOTE",
  "COUT NOTE": "COUT_NOTE",
  "#COUT NOTE#": "COUT_NOTE",
  "CHECK OUT NOTE": "COUT_NOTE",
  CHECKOUTNOTE: "COUT_NOTE",
  ROOM_NOTE: "ROOM_NOTE",
  "ROOM NOTE": "ROOM_NOTE",
  ROOMNOTE: "ROOM_NOTE",
  CANCEL_NOTE: "CANCEL_NOTE",
  "CANCEL NOTE": "CANCEL_NOTE",
  CANCELNOTE: "CANCEL_NOTE",
  PAYMENT_NOTE: "PAYMENT_NOTE",
  "PAYMENT NOTE": "PAYMENT_NOTE",
  PAYMENTNOTE: "PAYMENT_NOTE",
  PRICE_NOTE: "PRICE_NOTE",
  "PRICE NOTE": "PRICE_NOTE",
  PRICENOTE: "PRICE_NOTE",
  INVOICE_NOTE: "INVOICE_NOTE",
  "INVOICE NOTE": "INVOICE_NOTE",
  INVOICENOTE: "INVOICE_NOTE",
  CONFIRMATION: "CONFIRMATION",
  GENERAL_NOTE: "GENERAL_NOTE",
  "GENERAL NOTE": "GENERAL_NOTE",
};

function parseResIdFromInfo(info: string | null | undefined): string | null {
  if (!info?.trim()) return null;
  const m =
    info.match(/Res\s*Id\s*[:=]\s*(\S+)/i) ||
    info.match(/\b(\d{5,})\b/) ||
    info.match(/RESID\s*[:=]?\s*(\S+)/i);
  return m?.[1]?.trim() ?? null;
}

function mapNoteType(raw: string): string | null {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "_");
  const stripped = t.replace(/^#+|#+$/g, "");
  const mapped =
    EW_NOTE_COLUMN_TO_ERA[t] ??
    EW_NOTE_COLUMN_TO_ERA[stripped] ??
    EW_NOTE_COLUMN_TO_ERA[raw.trim().toUpperCase()] ??
    stripped;
  return isReservationNoteType(mapped) ? mapped : null;
}

const WIDE_NOTE_KEYS = [
  "EXTRA_REQ",
  "RES_NOTE",
  "CIN_NOTE",
  "COUT_NOTE",
  "ROOM_NOTE",
  "CANCEL_NOTE",
  "PAYMENT_NOTE",
  "PRICE_NOTE",
  "INVOICE_NOTE",
] as const;

export const reservationNotesAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: "reservation-notes",
  label: "Reservation notes",
  order: 55,
  permission: PERMISSIONS.RESERVATIONS_WRITE,
  templateHint: "Notes.xlsx / FO-with-Notes",
  headerAliases: {
    "Note Type": "noteType",
    Notes: "text",
    "Res Id": "externalRef",
    "Reservation Info": "reservationInfo",
    EXTRA_REQ: "extraReq",
    "Extra Request": "extraReq",
    "Extra Req": "extraReq",
    "Res Note": "resNote",
    "CIn Note": "cinNote",
    "COut Note": "coutNote",
    "#COut Note#": "coutNote",
    "Room Note": "roomNote",
    "Cancel Note": "cancelNote",
    "Payment Note": "paymentNote",
    "Price Note": "priceNote",
    "Invoice Note": "invoiceNote",
  },
  rowSchema,
  mapRow: (raw) => {
    const wideBag: Record<string, string> = {
      EXTRA_REQ: cellString(raw.extraReq) ?? "",
      RES_NOTE: cellString(raw.resNote) ?? "",
      CIN_NOTE: cellString(raw.cinNote) ?? "",
      COUT_NOTE: cellString(raw.coutNote) ?? "",
      ROOM_NOTE: cellString(raw.roomNote) ?? "",
      CANCEL_NOTE: cellString(raw.cancelNote) ?? "",
      PAYMENT_NOTE: cellString(raw.paymentNote) ?? "",
      PRICE_NOTE: cellString(raw.priceNote) ?? "",
      INVOICE_NOTE: cellString(raw.invoiceNote) ?? "",
    };
    const hasWide = WIDE_NOTE_KEYS.some((k) => wideBag[k]?.trim());
    if (hasWide) {
      const externalRef =
        cellString(raw.externalRef) ||
        parseResIdFromInfo(cellString(raw.reservationInfo) ?? undefined);
      if (!externalRef) return null;
      return {
        externalRef,
        noteType: "__WIDE__",
        text: JSON.stringify(wideBag),
      };
    }

    const noteTypeRaw =
      cellString(raw.noteType) ||
      firstCellString(raw as Record<string, unknown>, ["Note Type"]);
    const text = cellString(raw.text) ?? "";
    let externalRef =
      cellString(raw.externalRef) ||
      parseResIdFromInfo(cellString(raw.reservationInfo) ?? undefined);
    if (!externalRef || !noteTypeRaw) return null;
    const noteType = mapNoteType(noteTypeRaw);
    if (!noteType) return null;
    return { externalRef, noteType, text };
  },
  upsert: async (tx, row, dryRun) => {
    const reservation = await tx.reservation.findFirst({
      where: { externalRef: row.externalRef },
      select: { id: true },
    });
    if (!reservation) {
      throw new Error(`Unknown Res Id ${row.externalRef}`);
    }
    if (dryRun) return "skipped";

    if (row.noteType === "__WIDE__") {
      const bag = JSON.parse(row.text) as Record<string, string>;
      let outcome: "created" | "updated" = "updated";
      for (const [noteType, text] of Object.entries(bag)) {
        if (!text?.trim()) continue;
        if (!isReservationNoteType(noteType)) continue;
        const existing = await tx.reservationNote.findUnique({
          where: {
            reservationId_noteType: {
              reservationId: reservation.id,
              noteType,
            },
          },
        });
        if (!existing) outcome = "created";
        await tx.reservationNote.upsert({
          where: {
            reservationId_noteType: {
              reservationId: reservation.id,
              noteType,
            },
          },
          create: {
            reservationId: reservation.id,
            noteType,
            text,
          },
          update: { text },
        });
      }
      await stampMedicalPackagesForReservation(tx, reservation.id);
      return outcome;
    }

    const existing = await tx.reservationNote.findUnique({
      where: {
        reservationId_noteType: {
          reservationId: reservation.id,
          noteType: row.noteType,
        },
      },
    });
    await tx.reservationNote.upsert({
      where: {
        reservationId_noteType: {
          reservationId: reservation.id,
          noteType: row.noteType,
        },
      },
      create: {
        reservationId: reservation.id,
        noteType: row.noteType,
        text: row.text,
      },
      update: { text: row.text },
    });
    await stampMedicalPackagesForReservation(tx, reservation.id);
    return existing ? "updated" : "created";
  },
};
