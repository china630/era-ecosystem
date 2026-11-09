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
  asPhysioLaterality,
  formatLateralityLabel,
  formatPhysioFieldsPrint,
  readPhysioFields,
} from "@/domain/physio/physio-order-fields";
import { bakuDateDisplay, bakuDateKey, bakuTimeLabel, todayBakuYmd } from "@/lib/baku-day";
import {
  loadCatalogDisplayNameMap,
  resolveOrderDisplayName,
} from "@/domain/catalog/catalog-display-name.service";
import {
  compareOpenUnseatedFirst,
  isOpenUnseatedOrder,
} from "@/domain/procedure/open-attendance-order";

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
  /** Catalog name in the extra print language. Omitted when it matches the sheet. */
  nameAlt?: string;
  zonesAlt?: string;
  settingsAlt?: string;
  /** Closing marker for the checkout day. Not a procedure. */
  checkout?: boolean;
};

export function printDateFromYmd(ymd: string): string {
  const [year, month, day] = ymd.split("-");
  if (!year || !month || !day) return ymd;
  return `${day}.${month}.${year}`;
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
      const parts = value.includes(".")
        ? value.split(".")
        : value.includes("/")
          ? value.split("/")
          : null;
      if (!parts || parts.length !== 3) return value;
      const [day, month, year] = parts;
      if (!day || !month || !year) return value;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
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

type PrintLangCode = "az" | "ru" | "en";

function procedureBits(
  lang: PrintLangCode,
  order: {
    siteApplyMode: string | null;
    physioFields: unknown;
    sites: Array<{
      laterality: string | null;
      site: { titleAz: string; titleRu: string; titleEn: string; titleLa?: string | null };
    }>;
  },
  listById: Map<string, { titleAz: string; titleRu: string; titleEn: string }>,
  translatedOnly = false,
): { zones: string; settings: string } {
  const siteBits = order.sites.map((row) => {
    const local = (
      lang === "ru" ? row.site.titleRu : lang === "az" ? row.site.titleAz : row.site.titleEn
    )?.trim();
    if (translatedOnly && !local) return "";
    const latin = row.site.titleLa?.trim() ?? "";
    const title = [local, latin].filter(Boolean).join(" / ");
    const lat = formatLateralityLabel(lang, asPhysioLaterality(row.laterality));
    return lat && title ? `${title} (${lat})` : title;
  });
  const mode =
    order.siteApplyMode === "TURN"
      ? lang === "ru"
        ? "по очереди"
        : lang === "az"
          ? "növbəli"
          : "in turn"
      : order.siteApplyMode === "TOGETHER"
        ? lang === "ru"
          ? "вместе"
          : lang === "az"
            ? "birlikdə"
            : "together"
        : "";
  const fields = readPhysioFields(order.physioFields);
  const program = fields.deviceProgramId ? listById.get(fields.deviceProgramId) : null;
  const substance = fields.substanceId ? listById.get(fields.substanceId) : null;
  const titleOf = (row: { titleAz: string; titleRu: string; titleEn: string } | null | undefined) => {
    const title = row
      ? (lang === "ru" ? row.titleRu : lang === "az" ? row.titleAz : row.titleEn)?.trim()
      : "";
    return title || null;
  };
  const fieldBits = formatPhysioFieldsPrint(lang, fields, {
    program: titleOf(program),
    substance: titleOf(substance),
  });
  return {
    zones: siteBits.filter(Boolean).join(", "),
    settings: [mode, ...fieldBits].filter(Boolean).join(" · "),
  };
}

function bakuDate(d: Date): string {
  return bakuDateDisplay(d);
}

function bakuTime(d: Date): string {
  return bakuTimeLabel(d);
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
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
  });
  // OPEN unseated (free attendance) first within each calendar day, then timed rows.
  orders.sort((a, b) => {
    const da = bakuDate(a.scheduledAt);
    const db = bakuDate(b.scheduledAt);
    if (da !== db) return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    return compareOpenUnseatedFirst(
      {
        openUnseated: isOpenUnseatedOrder(a),
        atMs: a.scheduledAt.getTime(),
      },
      {
        openUnseated: isOpenUnseatedOrder(b),
        atMs: b.scheduledAt.getTime(),
      },
    );
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
  const sheetLang: PrintLangCode = lang === "ru" || lang === "az" ? lang : "en";
  const configured = clinicSettings.procedurePrintExtraLang;
  const extraLang: PrintLangCode | null =
    configured === "az" || configured === "ru" || configured === "en"
      ? configured === sheetLang
        ? null
        : configured
      : null;
  const catalogAlt = extraLang
    ? await loadCatalogDisplayNameMap(
        orders.map((row) => row.procedureCode),
        extraLang,
      )
    : null;
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
    const openUnseated = o.schedulingMode === "OPEN" && !o.resourceId;
    const seated = !openUnseated && printsProcedureClock(o.status, o.resourceId);
    const ymd = bakuDateKey(o.scheduledAt);
    if (stay.departure && ymd > stay.departure) continue;
    const date = bakuDate(o.scheduledAt);
    const room = seated
      ? (o.resource?.room?.name ?? o.resource?.name ?? o.resource?.code ?? "—")
      : "";
    const ends = seated && o.endsAt ? `-${bakuTime(o.endsAt)}` : "";
    const bits = procedureBits(printLang, o, listById);
    const row: PrintProcedureRow = {
      no: no++,
      date,
      name: resolveOrderDisplayName(o, catalogNames),
      zones: bits.zones,
      settings: bits.settings,
      quantity: o.quantity ?? 1,
      time: openUnseated
        ? printLabel(lang, "openAttendance")
        : seated
          ? `${bakuTime(o.scheduledAt)}${ends}`
          : "",
      room,
      price: `${Number(o.amountNet).toFixed(2)} AZN`,
      note: [
        o.status === "PENDING_PAY" ? printLabel(lang, "unpaidExtra") : "",
        openUnseated ? printLabel(lang, "openAttendance") : "",
        (o.note ?? "").trim(),
      ]
        .filter(Boolean)
        .join(" · "),
    };
    if (extraLang && catalogAlt && !row.checkout) {
      const alt = procedureBits(extraLang, o, listById, true);
      const nameAlt = resolveOrderDisplayName(o, catalogAlt).trim();
      if (nameAlt && nameAlt !== row.name) row.nameAlt = nameAlt;
      if (alt.zones && alt.zones !== row.zones) row.zonesAlt = alt.zones;
      if (alt.settings && alt.settings !== row.settings) row.settingsAlt = alt.settings;
    }
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
