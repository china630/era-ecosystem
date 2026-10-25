import { prisma } from "@/lib/prisma";
import { getClinicSettings } from "@/domain/settings/settings.service";
import {
  printsProcedureClock,
  showsUnpaidExtraOnPlan,
} from "@/domain/sanatorium/extra-procedure-route";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import { printLabel } from "@/domain/print/print-labels";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";
import {
  composePrintPatientStrip,
  loadPrintEpisodeStay,
} from "@/domain/print/print-patient-strip";
import {
  formatLateralityLabel,
  formatPhysioFieldsPrint,
  readPhysioFields,
} from "@/domain/physio/physio-order-fields";
import { todayBakuYmd } from "@/lib/baku-day";
import {
  loadCatalogDisplayNameMap,
  resolveOrderDisplayName,
} from "@/domain/catalog/catalog-display-name.service";

export { episodeCareTeamPrintName } from "@/domain/print/print-patient-strip";

/**
 * Guest sheet lists seated rows. PLAN_BEFORE_PAY also lists unpaid extras with their
 * real time, room, and an unpaid mark. HOLD_UNTIL_PAY omits them. A hold-until-pay
 * row has no cabin, so its placeholder clock is not printed.
 */
export const PRINT_PROCEDURE_STATUSES = [
  "SCHEDULED",
  "CHECKED_IN",
  "COMPLETED",
  "NO_SHOW",
] as const;

export type PrintProcedureRow = {
  no: number;
  date: string;
  name: string;
  /** Body sites in the print language, with the Latin name. */
  zones: string;
  /** Device program, mode, and intensity. Not the body sites. */
  settings: string;
  quantity: number;
  time: string;
  room: string;
  price: string;
  note: string;
  /** Closing marker for the checkout day. Not a procedure. */
  checkout?: boolean;
};

export function printDateFromYmd(ymd: string): string {
  const [year, month, day] = ymd.split("-");
  if (!year || !month || !day) return ymd;
  return `${day}/${month}/${year}`;
}

export function appendCheckoutMarker(
  groups: { date: string; rows: PrintProcedureRow[] }[],
  departureYmd: string | null | undefined,
  label: string,
): { date: string; rows: PrintProcedureRow[] }[] {
  if (!departureYmd || !/^\d{4}-\d{2}-\d{2}$/.test(departureYmd)) return groups;
  const date = printDateFromYmd(departureYmd);
  const marker: PrintProcedureRow = {
    no: 0,
    date,
    name: label,
    zones: "",
    settings: "",
    quantity: 0,
    time: "12:00",
    room: "",
    price: "",
    note: "",
    checkout: true,
  };
  const next = groups.map((group) => ({ ...group, rows: [...group.rows] }));
  const found = next.find((group) => group.date === date);
  if (found) found.rows.push(marker);
  else next.push({ date, rows: [marker] });
  next.sort((a, b) => {
    const key = (value: string) => {
      const [day, month, year] = value.split("/");
      return `${year ?? ""}-${month ?? ""}-${day ?? ""}`;
    };
    return key(a.date).localeCompare(key(b.date));
  });
  return next;
}

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

  const [branding, clinicSettings] = await Promise.all([
    getPrintBranding(lang),
    getClinicSettings(),
  ]);
  const episode = episodeId
    ? await prisma.clinicalEpisode.findFirst({
        where: { id: episodeId, patientRefId: patientId },
      })
    : await prisma.clinicalEpisode.findFirst({
        where: { patientRefId: patientId },
        orderBy: { openedAt: "desc" },
      });

  const showUnpaid = showsUnpaidExtraOnPlan(clinicSettings.extraProcedureRoute);
  const orders = await prisma.procedureOrder.findMany({
    where: {
      patientRefId: patientId,
      ...(episode ? { clinicalEpisodeId: episode.id } : {}),
      ...(showUnpaid
        ? {
            OR: [
              { status: { in: [...PRINT_PROCEDURE_STATUSES] } },
              { status: "PENDING_PAY" as const, inPackage: false },
            ],
          }
        : { status: { in: [...PRINT_PROCEDURE_STATUSES] } }),
    },
    include: {
      resource: { include: { room: true } },
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
  const catalogNames = await loadCatalogDisplayNameMap(
    orders.map((row) => row.procedureCode),
    lang,
  );
  const listItems = listIds.length
    ? await prisma.physioListItem.findMany({ where: { id: { in: listIds } } })
    : [];
  const listById = new Map(listItems.map((r) => [r.id, r]));
  const printLang = lang === "ru" || lang === "az" ? lang : "en";
  const stay = await loadPrintEpisodeStay({
    episodeId: episode?.id,
    patientRefId: patientId,
  });

  let no = 1;
  const map = new Map<string, PrintProcedureRow[]>();
  for (const o of orders) {
    const seated = printsProcedureClock(o.status, o.resourceId);
    const date = seated ? bakuDate(o.scheduledAt) : printDateFromYmd(todayBakuYmd());
    const room = seated
      ? (o.resource?.room?.name ?? o.resource?.name ?? o.resource?.code ?? "—")
      : "";
    const ends = seated && o.endsAt ? `-${bakuTime(o.endsAt)}` : "";
    const siteBits = o.sites.map((row) => {
      const local =
        lang === "ru" ? row.site.titleRu : lang === "az" ? row.site.titleAz : row.site.titleEn;
      const latin = row.site.titleLa?.trim() ?? "";
      const title = [local?.trim(), latin].filter(Boolean).join(" / ");
      const lat = formatLateralityLabel(printLang, row.laterality);
      return lat ? `${title} (${lat})` : title;
    });
    const mode =
      o.siteApplyMode === "TURN"
        ? lang === "ru"
          ? "по очереди"
          : lang === "az"
            ? "növbəli"
            : "in turn"
        : o.siteApplyMode === "TOGETHER"
          ? lang === "ru"
            ? "вместе"
            : lang === "az"
              ? "birlikdə"
              : "together"
          : "";
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
    const zones = siteBits.join(", ");
    const settings = [mode, ...fieldBits].filter(Boolean).join(" · ");
    const row: PrintProcedureRow = {
      no: no++,
      date,
      name: resolveOrderDisplayName(o, catalogNames),
      zones,
      settings,
      quantity: o.quantity ?? 1,
      time: seated ? `${bakuTime(o.scheduledAt)}${ends}` : "",
      room,
      price: `${Number(o.amountNet).toFixed(2)} AZN`,
      note: [
        o.status === "PENDING_PAY" ? printLabel(lang, "unpaidExtra") : "",
        (o.note ?? "").trim(),
      ]
        .filter(Boolean)
        .join(" · "),
    };
    const list = map.get(date) ?? [];
    list.push(row);
    map.set(date, list);
  }

  return {
    branding,
    patient: composePrintPatientStrip({
      fullName: patient.fullName,
      sex: patient.sex,
      birthDate: patient.birthDate,
      phone: patient.phone,
      nationality: patient.nationality,
      date: todayBakuYmd(),
      stay,
    }),
    rowsByDate: appendCheckoutMarker(
      [...map.entries()].map(([date, rows]) => ({ date, rows })),
      stay.departure,
      printLabel(lang, "checkout"),
    ),
  };
}
