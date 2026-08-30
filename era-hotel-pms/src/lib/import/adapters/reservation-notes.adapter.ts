import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { cellString, firstCellString } from "@/lib/import/helpers";
import type { ImportAdapter } from "@/lib/import/types";
import { isReservationNoteType } from "@/lib/reservation-note-types";
import { stampMedicalPackagesForReservation } from "@/lib/services/medical-package-stamp.service";

/**
 * FO Notes dump / FO-with-Notes columns → ReservationNote upsert by (reservationId, noteType).
 * After notes write, re-run medical SKU resolver.
 */
const rowSchema = z.object({
  externalRef: z.string().min(1),
  noteType: z.string().min(1),
  text: z.string(),
});

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
  const aliases: Record<string, string> = {
    EXTRA_REQ: "EXTRA_REQ",
    "EXTRA REQUEST": "EXTRA_REQ",
    EXTRAREQ: "EXTRA_REQ",
    RES_NOTE: "RES_NOTE",
    "RES NOTE": "RES_NOTE",
    RESNOTE: "RES_NOTE",
    CIN_NOTE: "CIN_NOTE",
    "CIN NOTE": "CIN_NOTE",
    "CHECK IN NOTE": "CIN_NOTE",
    COUT_NOTE: "COUT_NOTE",
    PRICE_NOTE: "PRICE_NOTE",
    "PRICE NOTE": "PRICE_NOTE",
    ROOM_NOTE: "ROOM_NOTE",
    GENERAL_NOTE: "GENERAL_NOTE",
    CONFIRMATION: "CONFIRMATION",
  };
  const mapped = aliases[t] ?? aliases[raw.trim().toUpperCase()] ?? t;
  return isReservationNoteType(mapped) ? mapped : null;
}

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
    "Res Note": "resNote",
    "CIn Note": "cinNote",
    "Price Note": "priceNote",
  },
  rowSchema,
  mapRow: (raw) => {
    // Wide FO-with-Notes: one row per reservation with typed columns
    const wideExtra = cellString(raw.extraReq);
    const wideRes = cellString(raw.resNote);
    const wideCin = cellString(raw.cinNote);
    const widePrice = cellString(raw.priceNote);
    if (wideExtra || wideRes || wideCin || widePrice) {
      const externalRef =
        cellString(raw.externalRef) ||
        parseResIdFromInfo(cellString(raw.reservationInfo) ?? undefined);
      if (!externalRef) return null;
      // Emit a sentinel row; upsert expands wide columns
      return {
        externalRef,
        noteType: "__WIDE__",
        text: JSON.stringify({
          EXTRA_REQ: wideExtra ?? "",
          RES_NOTE: wideRes ?? "",
          CIN_NOTE: wideCin ?? "",
          PRICE_NOTE: widePrice ?? "",
        }),
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
    // Channel Room Detail — store as ROOM_NOTE if typed that way; parser ignores as SKU
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
