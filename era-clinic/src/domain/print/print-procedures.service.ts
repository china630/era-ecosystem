import { prisma } from "@/lib/prisma";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";
import {
  formatLateralityLabel,
  formatPhysioFieldsPrint,
  readPhysioFields,
} from "@/domain/physio/physio-order-fields";

export type PrintProcedureRow = {
  no: number;
  date: string;
  name: string;
  quantity: number;
  time: string;
  room: string;
  doctor: string;
  price: string;
  note: string;
};

export type PrintProceduresDocument = {
  branding: PrintBranding;
  patient: PrintPatientStrip;
  rowsByDate: { date: string; rows: PrintProcedureRow[] }[];
};

function bakuDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Baku" });
}

function bakuTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Baku",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function buildProceduresPrint(
  patientId: string,
  lang: PrintLang,
  episodeId?: string | null,
): Promise<PrintProceduresDocument | null> {
  const patient = await prisma.patientRef.findUnique({ where: { id: patientId } });
  if (!patient) return null;

  const branding = await getPrintBranding(lang);
  const episode = episodeId
    ? await prisma.clinicalEpisode.findFirst({
        where: { id: episodeId, patientRefId: patientId },
      })
    : await prisma.clinicalEpisode.findFirst({
        where: { patientRefId: patientId },
        orderBy: { openedAt: "desc" },
      });

  const orders = await prisma.procedureOrder.findMany({
    where: {
      patientRefId: patientId,
      status: { notIn: ["CANCELLED"] },
      ...(episode ? { clinicalEpisodeId: episode.id } : {}),
    },
    include: {
      resource: { include: { room: true } },
      allocations: { include: { practitioner: true } },
      resourceBooking: { include: { practitioner: true } },
      sites: { orderBy: { sortOrder: "asc" }, include: { site: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const listIds = [
    ...new Set(
      orders.flatMap((o) => {
        const f = readPhysioFields(o.physioFields);
        return [f.deviceProgramId, f.substanceId].filter((id): id is string => Boolean(id));
      }),
    ),
  ];
  const listItems = listIds.length
    ? await prisma.physioListItem.findMany({ where: { id: { in: listIds } } })
    : [];
  const listById = new Map(listItems.map((r) => [r.id, r]));
  const printLang = lang === "ru" || lang === "az" ? lang : "en";

  let no = 1;
  const map = new Map<string, PrintProcedureRow[]>();
  for (const o of orders) {
    const date = bakuDate(o.scheduledAt);
    const staff = o.allocations.find((a) => a.practitioner)?.practitioner;
    const bookingDoc = o.resourceBooking?.practitioner;
    const doctor = staff?.fullName ?? bookingDoc?.fullName ?? "—";
    const room =
      o.resource?.room?.name ??
      o.resource?.name ??
      o.resource?.code ??
      "—";
    const ends = o.endsAt ? `-${bakuTime(o.endsAt)}` : "";
    const siteBits = o.sites.map((row) => {
      const title =
        lang === "ru"
          ? `${row.site.titleRu} / ${row.site.titleLa}`
          : lang === "az"
            ? `${row.site.titleAz} / ${row.site.titleLa}`
            : `${row.site.titleEn} / ${row.site.titleLa}`;
      const lat = formatLateralityLabel(printLang, row.laterality);
      return lat ? `${title} (${lat})` : title;
    });
    const mode =
      o.siteApplyMode === "TURN" ? (lang === "ru" ? "по очереди" : lang === "az" ? "növbəli" : "in turn") : "";
    const fields = readPhysioFields(o.physioFields);
    const program = fields.deviceProgramId ? listById.get(fields.deviceProgramId) : null;
    const substance = fields.substanceId ? listById.get(fields.substanceId) : null;
    const fieldBits = formatPhysioFieldsPrint(printLang, fields, {
      program: program
        ? lang === "ru"
          ? program.titleRu
          : lang === "az"
            ? program.titleAz
            : program.titleEn
        : null,
      substance: substance
        ? lang === "ru"
          ? substance.titleRu
          : lang === "az"
            ? substance.titleAz
            : substance.titleEn
        : null,
    });
    const noteParts = [...siteBits, mode, ...fieldBits, o.note ?? ""].filter(Boolean);
    const row: PrintProcedureRow = {
      no: no++,
      date,
      name: o.procedureName,
      quantity: o.quantity ?? 1,
      time: `${bakuTime(o.scheduledAt)}${ends}`,
      room,
      doctor,
      price: `${Number(o.amountNet).toFixed(2)} AZN`,
      note: noteParts.join(" · "),
    };
    const list = map.get(date) ?? [];
    list.push(row);
    map.set(date, list);
  }

  return {
    branding,
    patient: {
      fullName: patient.fullName,
      sex: patient.sex,
      birthDate: patient.birthDate ? patient.birthDate.toISOString().slice(0, 10) : null,
      phone: patient.phone,
      nationality: patient.nationality,
      roomNumber: episode?.roomNumber ?? null,
      doctorName: null,
      date: new Date().toISOString().slice(0, 10),
    },
    rowsByDate: [...map.entries()].map(([date, rows]) => ({ date, rows })),
  };
}
