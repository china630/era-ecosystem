import { prisma } from "@/lib/prisma";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";

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
): Promise<PrintProceduresDocument | null> {
  const patient = await prisma.patientRef.findUnique({ where: { id: patientId } });
  if (!patient) return null;

  const branding = await getPrintBranding(lang);
  const episode = await prisma.clinicalEpisode.findFirst({
    where: { patientRefId: patientId },
    orderBy: { openedAt: "desc" },
  });

  const orders = await prisma.procedureOrder.findMany({
    where: {
      patientRefId: patientId,
      status: { notIn: ["CANCELLED"] },
    },
    include: {
      resource: { include: { room: true } },
      allocations: { include: { practitioner: true } },
      resourceBooking: { include: { practitioner: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

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
    const row: PrintProcedureRow = {
      no: no++,
      date,
      name: o.procedureName,
      quantity: o.quantity ?? 1,
      time: `${bakuTime(o.scheduledAt)}${ends}`,
      room,
      doctor,
      price: `${Number(o.amountNet).toFixed(2)} AZN`,
      note: o.note ?? "",
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
