"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CatalogField,
  DatePicker,
  EraDataGrid,
  EraListWorkspace,
  Field,
  FieldRow,
  FORM_STACK_CLASS,
  LIST_PAGE_SHELL_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
  countryOptions,
  showApiError,
  showSuccess,
  type EraDataGridColumn,
} from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@/lib/baku-day";
import { isLabBlockCatalogKind } from "@/domain/sanatorium/program-block-catalog";
import { PatientCardModal } from "@/components/patients/PatientCardModal";
import {
  PhysioSiteChips,
  type PhysioCatalogListItem,
  type PhysioCatalogSite,
  type PhysioChipsValue,
} from "@/components/physio/PhysioSiteChips";
import { buildPhysioChipsLabels } from "@/components/physio/physio-chips-labels";
import { inferPhysioTypeGate, siteCodeForNaftalanFill } from "@/domain/physio/physio-type-gate";
import { formatPhysioFieldsPrint, type PhysioOrderFields } from "@/domain/physio/physio-order-fields";

type PartyListRow = {
  id: string;
  name: string;
  visitDate: string;
  status: "DRAFT" | "SENT_TO_CASHIER" | "PAID";
  receiptRef: string | null;
  guestCount: number;
};

type LineSite = {
  id: string;
  code: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  laterality: string | null;
};

type Line = {
  id: string;
  kind: "procedure" | "lab" | "visit";
  code: string;
  name: string;
  amount: number;
  status: string;
  sent: boolean;
  doctorName?: string;
  note?: string;
  physioFields?: Record<string, unknown> | null;
  siteApplyMode?: string | null;
  sites?: LineSite[];
};

type Guest = {
  id: string;
  sortOrder: number;
  label: string;
  patientRefId: string;
  episodeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  placeholder: boolean;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  nationality: string;
  procedures: Line[];
  labs: Line[];
  visits: Line[];
};

type Party = {
  id: string;
  name: string;
  visitDate: string;
  status: PartyListRow["status"];
  receiptRef: string | null;
  total: number;
  guests: Guest[];
};

type Option = { value: string; label: string };

type GuestDraft = {
  firstName: string;
  lastName: string;
  sex: string;
  nationality: string;
  patientRefId: string;
};

type LineDraft = {
  kind: "" | "procedure" | "lab" | "visit";
  code: string;
  practitionerId: string;
};

type ConfirmState =
  | { type: "removeGuest"; guestId: string; label: string }
  | { type: "removeLine"; guestId: string; lineId: string; kind: string; label: string }
  | null;

const SEX_OPTIONS = [
  { value: "MALE", labelKey: "walkInPartyMale" },
  { value: "FEMALE", labelKey: "walkInPartyFemale" },
] as const;

const EMPTY_GUEST: GuestDraft = {
  firstName: "",
  lastName: "",
  sex: "",
  nationality: "",
  patientRefId: "",
};

const EMPTY_LINE: LineDraft = {
  kind: "",
  code: "",
  practitionerId: "",
};

const EMPTY_PHYSIO: PhysioChipsValue = {
  needsSite: false,
  physioOrderFields: [],
  allowedSiteCodes: [],
  forceSiteTogether: false,
  hideSitePicker: false,
  sitesHintKey: null,
  siteIds: [],
  siteApplyMode: null,
  siteLaterality: {},
  physioFields: {},
  note: null,
};

const NESTED_Z = "z-[220]";

async function readError(res: Response) {
  try {
    return await res.json();
  } catch {
    return { error: res.statusText };
  }
}

function paidLine(line: { status: string }) {
  return (
    line.status === "PAID" ||
    line.status === "COMPLETED" ||
    line.status === "SCHEDULED" ||
    line.status === "CHECKED_IN" ||
    line.status === "PROPOSED"
  );
}

function guestTitle(t: ReturnType<typeof useTranslations<"sanatorium">>, guest: Guest) {
  return guest.placeholder ? t("walkInPartyGuest", { n: guest.sortOrder }) : guest.fullName || guest.label;
}

function money(amount: number) {
  return `${amount.toFixed(2)} AZN`;
}

function guestSexLabel(t: ReturnType<typeof useTranslations<"sanatorium">>, sex: Guest["sex"]) {
  if (sex === "FEMALE") return t("walkInPartyFemale");
  if (sex === "MALE") return t("walkInPartyMale");
  return t("sexUnknown");
}

function hasSendableLines(party: Party) {
  return party.guests.some((guest) =>
    [...guest.procedures, ...guest.labs, ...guest.visits].some((line) => !line.sent),
  );
}

function gateToPhysio(code: string, name: string): PhysioChipsValue {
  const gate = inferPhysioTypeGate(code, name);
  return {
    ...EMPTY_PHYSIO,
    needsSite: gate.needsSite,
    physioOrderFields: gate.fields,
    allowedSiteCodes: gate.allowedSiteCodes,
    forceSiteTogether: gate.forceSiteTogether,
    hideSitePicker: gate.hideSitePicker,
    sitesHintKey: gate.sitesHintKey,
    siteApplyMode: gate.forceSiteTogether ? "TOGETHER" : null,
    physioFields: gate.hideSitePicker ? { naftalanFill: "TAM" } : {},
  };
}

function lineParamsLabel(line: Line, locale: string): string {
  if (line.kind !== "procedure") return "";
  const parts: string[] = [];
  const siteNames = (line.sites ?? [])
    .map((site) => {
      const local = locale.startsWith("ru")
        ? site.titleRu
        : locale.startsWith("en")
          ? site.titleEn
          : site.titleAz;
      return (local || site.titleEn || site.code).trim();
    })
    .filter(Boolean);
  if (siteNames.length) parts.push(siteNames.join(", "));
  if (line.physioFields && typeof line.physioFields === "object") {
    const lang = locale.startsWith("ru") ? "ru" : locale.startsWith("en") ? "en" : "az";
    parts.push(...formatPhysioFieldsPrint(lang, line.physioFields as PhysioOrderFields));
  }
  if (line.note?.trim()) parts.push(line.note.trim());
  return parts.join(" · ");
}

export default function WalkInPartiesPage() {
  const t = useTranslations("sanatorium");
  const tc = useTranslations("common");
  const tPhysio = useTranslations("patientCard");
  const locale = useLocale();
  const physioLabels = useMemo(() => buildPhysioChipsLabels(tPhysio), [tPhysio]);

  const [rows, setRows] = useState<PartyListRow[]>([]);
  const [party, setParty] = useState<Party | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDate, setCreateDate] = useState(todayBakuYmd());
  const [guestModal, setGuestModal] = useState<{ mode: "add" } | { mode: "edit"; guest: Guest } | null>(null);
  const [guestDraft, setGuestDraft] = useState<GuestDraft>(EMPTY_GUEST);
  const [lineGuestId, setLineGuestId] = useState<string | null>(null);
  const [lineDraft, setLineDraft] = useState<LineDraft>(EMPTY_LINE);
  const [formPhysio, setFormPhysio] = useState<PhysioChipsValue>(EMPTY_PHYSIO);
  const [doctorByGuest, setDoctorByGuest] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [lineDetail, setLineDetail] = useState<Line | null>(null);
  const [cardPatientId, setCardPatientId] = useState<string | null>(null);
  const [cardEpisodeId, setCardEpisodeId] = useState<string | null>(null);
  const [procedures, setProcedures] = useState<Option[]>([]);
  const [labs, setLabs] = useState<Option[]>([]);
  const [visits, setVisits] = useState<Option[]>([]);
  const [doctors, setDoctors] = useState<Option[]>([]);
  const [patientHits, setPatientHits] = useState<Option[]>([]);
  const [physioCatalog, setPhysioCatalog] = useState<PhysioCatalogSite[]>([]);
  const [programs, setPrograms] = useState<PhysioCatalogListItem[]>([]);
  const [substances, setSubstances] = useState<PhysioCatalogListItem[]>([]);

  const editable = party?.status === "DRAFT";

  const loadList = useCallback(async () => {
    const res = await fetch("/api/sanatorium/walk-in-parties");
    if (!res.ok) {
      showApiError(await readError(res));
      return;
    }
    setRows((await res.json()) as PartyListRow[]);
  }, []);

  const loadParty = useCallback(async (id: string) => {
    const detailRes = await fetch(`/api/sanatorium/walk-in-parties/${id}`);
    if (!detailRes.ok) {
      showApiError(await readError(detailRes));
      return;
    }
    setParty((await detailRes.json()) as Party);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!party) return;
    let cancelled = false;
    void (async () => {
      const [typesRes, catalogRes, doctorsRes, physioRes] = await Promise.all([
        fetch("/api/procedure-types"),
        fetch("/api/diagnostic-catalog"),
        fetch("/api/admin/practitioners?staffKind=DOCTOR"),
        fetch("/api/physio-catalog"),
      ]);
      if (cancelled) return;
      if (typesRes.ok) {
        const body = (await typesRes.json()) as
          | { items?: Array<{ code: string; name: string }> }
          | Array<{ code: string; name: string }>;
        const items = Array.isArray(body) ? body : body.items ?? [];
        setProcedures(items.map((item) => ({ value: item.code, label: item.name || item.code })));
      }
      if (catalogRes.ok) {
        const body = (await catalogRes.json()) as {
          items?: Array<{
            code: string;
            serviceCode?: string;
            kind: string;
            title?: { en?: string; ru?: string; az?: string };
          }>;
        };
        const labelOf = (item: {
          code: string;
          serviceCode?: string;
          title?: { en?: string; ru?: string; az?: string };
        }) => {
          const title = item.title;
          const localized = locale === "ru" ? title?.ru : locale === "az" ? title?.az : title?.en;
          return localized || item.code;
        };
        const items = body.items ?? [];
        setLabs(
          items
            .filter((item) => isLabBlockCatalogKind(item.kind))
            .map((item) => ({ value: item.code, label: labelOf(item) })),
        );
        setVisits(
          items
            .filter((item) => item.kind === "visit")
            .map((item) => ({ value: item.serviceCode || item.code, label: labelOf(item) })),
        );
      }
      if (doctorsRes.ok) {
        const body = (await doctorsRes.json()) as
          | { items?: Array<{ id: string; fullName?: string; code?: string }> }
          | Array<{ id: string; fullName?: string; code?: string }>;
        const items = Array.isArray(body) ? body : body.items ?? [];
        setDoctors(items.map((item) => ({ value: item.id, label: item.fullName || item.code || item.id })));
      }
      if (physioRes.ok) {
        const data = await physioRes.json();
        setPhysioCatalog((data.sites ?? data.data?.sites ?? []) as PhysioCatalogSite[]);
        setPrograms((data.programs ?? data.data?.programs ?? []) as PhysioCatalogListItem[]);
        setSubstances((data.substances ?? data.data?.substances ?? []) as PhysioCatalogListItem[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [party?.id, locale]);

  async function createParty() {
    setBusy(true);
    try {
      const res = await fetch("/api/sanatorium/walk-in-parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, visitDate: createDate }),
      });
      if (!res.ok) {
        showApiError(await readError(res));
        return;
      }
      const created = (await res.json()) as Party;
      setCreateOpen(false);
      setCreateName("");
      setCreateDate(todayBakuYmd());
      await loadList();
      await loadParty(created.id);
      showSuccess(t("walkInPartyCreated"));
    } finally {
      setBusy(false);
    }
  }

  async function patch(action: Record<string, unknown>) {
    if (!party) return null;
    setBusy(true);
    try {
      const res = await fetch(`/api/sanatorium/walk-in-parties/${party.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      if (!res.ok) {
        showApiError(await readError(res));
        return null;
      }
      const body = await res.json();
      await loadParty(party.id);
      await loadList();
      return body as { rejected?: Array<{ code: string; reason: string }>; receiptRef?: string | null };
    } finally {
      setBusy(false);
    }
  }

  function openAddGuest() {
    setGuestDraft(EMPTY_GUEST);
    setPatientHits([]);
    setGuestModal({ mode: "add" });
  }

  function openEditGuest(guest: Guest) {
    setGuestDraft({
      firstName: guest.firstName,
      lastName: guest.lastName,
      sex: guest.sex === "FEMALE" || guest.sex === "MALE" ? guest.sex : "",
      nationality: guest.nationality,
      patientRefId: "",
    });
    setPatientHits([]);
    setGuestModal({ mode: "edit", guest });
  }

  function openAddLine(guestId: string) {
    setLineDraft({
      kind: "",
      code: "",
      practitionerId: doctorByGuest[guestId] ?? "",
    });
    setFormPhysio(EMPTY_PHYSIO);
    setLineGuestId(guestId);
  }

  async function saveGuest() {
    if (!guestDraft.nationality || !guestDraft.sex) return;
    if (guestModal?.mode === "edit") {
      const ok = await patch({
        action: "updateGuest",
        guestId: guestModal.guest.id,
        sex: guestDraft.sex,
        nationality: guestDraft.nationality,
        firstName: guestDraft.firstName,
        lastName: guestDraft.lastName,
      });
      if (ok) setGuestModal(null);
      return;
    }
    const ok = await patch({
      action: "addGuest",
      sex: guestDraft.sex,
      nationality: guestDraft.nationality,
      firstName: guestDraft.firstName,
      lastName: guestDraft.lastName,
      patientRefId: guestDraft.patientRefId || null,
    });
    if (ok) setGuestModal(null);
  }

  async function saveLine() {
    if (!lineGuestId || !lineDraft.kind || !lineDraft.code) return;
    if ((lineDraft.kind === "procedure" || lineDraft.kind === "visit") && !lineDraft.practitionerId) return;

    let payload: Record<string, unknown> = {
      action: "addLine",
      guestId: lineGuestId,
      kind: lineDraft.kind,
      code: lineDraft.code,
      practitionerId: lineDraft.practitionerId || null,
    };

    if (lineDraft.kind === "procedure") {
      const fill = formPhysio.physioFields?.naftalanFill;
      const fillCode = fill === "OTURAQ" || fill === "QURSAQ" || fill === "TAM" ? fill : "TAM";
      const occupancy =
        formPhysio.hideSitePicker && formPhysio.siteIds.length === 0
          ? (() => {
              const row = physioCatalog.find((s) => s.code === siteCodeForNaftalanFill(fillCode));
              return row ? [row.id] : [];
            })()
          : formPhysio.siteIds;
      payload = {
        ...payload,
        note: formPhysio.note ?? null,
        physioFields: formPhysio.physioFields ?? null,
        siteIds: occupancy,
        siteApplyMode: formPhysio.hideSitePicker ? "TOGETHER" : formPhysio.siteApplyMode,
        siteLaterality: formPhysio.siteLaterality ?? {},
      };
    }

    const ok = await patch(payload);
    if (!ok) return;
    if (lineDraft.practitionerId) {
      setDoctorByGuest((prev) => ({ ...prev, [lineGuestId]: lineDraft.practitionerId }));
    }
    setLineDraft((prev) => ({
      kind: prev.kind,
      code: "",
      practitionerId: prev.practitionerId,
    }));
    setFormPhysio(EMPTY_PHYSIO);
    showSuccess(t("walkInPartyLineAdded"));
  }

  async function runConfirm() {
    if (!confirm) return;
    if (confirm.type === "removeGuest") {
      const ok = await patch({ action: "removeGuest", guestId: confirm.guestId });
      if (ok) setConfirm(null);
      return;
    }
    const ok = await patch({
      action: "removeLine",
      guestId: confirm.guestId,
      lineId: confirm.lineId,
      kind: confirm.kind,
    });
    if (ok) setConfirm(null);
  }

  async function searchPatients(q: string) {
    const res = await fetch(`/api/patients?q=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    const body = (await res.json()) as { items?: Array<{ id: string; fullName?: string; refCode?: string }> };
    setPatientHits((body.items ?? []).map((item) => ({ value: item.id, label: item.fullName || item.refCode || item.id })));
  }

  const columns = useMemo<EraDataGridColumn<PartyListRow>[]>(
    () => [
      { key: "name", header: t("walkInPartyName") },
      { key: "visitDate", header: t("walkInPartyDate") },
      {
        key: "status",
        header: t("walkInPartyStatus"),
        render: (row) => t(`walkInPartyStatus_${row.status}`),
      },
      { key: "guestCount", header: t("walkInPartyGuests") },
      { key: "receiptRef", header: t("walkInPartyReceipt"), render: (row) => row.receiptRef ?? "—" },
    ],
    [t],
  );

  const sexOptions = SEX_OPTIONS.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const kindOptions = [
    { value: "procedure", label: t("walkInPartyProcedure") },
    { value: "lab", label: t("walkInPartyLab") },
    { value: "visit", label: t("walkInPartyVisit") },
  ];
  const lineCodeOptions =
    lineDraft.kind === "lab" ? labs : lineDraft.kind === "visit" ? visits : procedures;
  const lineNeedsDoctor = lineDraft.kind === "procedure" || lineDraft.kind === "visit";

  function closeParty() {
    setParty(null);
    setGuestModal(null);
    setLineGuestId(null);
    setConfirm(null);
    setLineDetail(null);
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader
        title={t("walkInPartyTitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/sanatorium" className={SECONDARY_BUTTON_CLASS}>
              {t("walkInPartyBack")}
            </Link>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setCreateName("");
                setCreateDate(todayBakuYmd());
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("walkInPartyCreate")}
            </button>
          </div>
        }
      />

      <EraListWorkspace
        table={
          <EraDataGrid
            columns={columns as unknown as EraDataGridColumn<PartyListRow & Record<string, unknown>>[]}
            rows={rows as (PartyListRow & Record<string, unknown>)[]}
            rowKey={(row) => row.id}
            onRowClick={(row) => void loadParty(String(row.id))}
            emptyMessage={t("walkInPartyEmpty")}
            embedded
            pagination={false}
          />
        }
      />

      <ModalShell
        open={createOpen}
        title={t("walkInPartyCreate")}
        onClose={() => setCreateOpen(false)}
        closeLabel={tc("close")}
        maxWidthClass="max-w-lg"
        footer={
          <ModalFooter
            onCancel={() => setCreateOpen(false)}
            onSubmit={() => void createParty()}
            busy={busy}
            submitDisabled={!createName.trim()}
            submitLabel={t("walkInPartyCreate")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <Field
              label={t("walkInPartyName")}
              preset="shortText"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
            />
            <DatePicker
              label={t("walkInPartyDate")}
              value={createDate}
              onChange={setCreateDate}
              placeholder={tc("datePlaceholder")}
              openCalendarLabel={tc("openCalendar")}
            />
          </FieldRow>
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(party)}
        title={party?.name ?? t("walkInPartyTitle")}
        subtitle={
          party
            ? `${party.visitDate} · ${t(`walkInPartyStatus_${party.status}`)}${
                party.receiptRef ? ` · ${party.receiptRef}` : ""
              }`
            : undefined
        }
        onClose={closeParty}
        closeLabel={tc("close")}
        maxWidthClass="max-w-4xl"
        footer={
          party ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="font-semibold">
                {t("walkInPartyTotal")}: {money(party.total)}
              </span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={closeParty}>
                  {tc("close")}
                </button>
                {editable && hasSendableLines(party) ? (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        const result = await patch({ action: "send" });
                        if (!result) return;
                        if (result.rejected?.length) {
                          showApiError({
                            error: result.rejected.map((row) => `${row.code}: ${row.reason}`).join("; "),
                          });
                        } else {
                          showSuccess(t("walkInPartySent"));
                        }
                      })()
                    }
                  >
                    {t("walkInPartySend")}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null
        }
      >
        {party ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{t("walkInPartyGuests")}</h3>
              {editable ? (
                <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={openAddGuest}>
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("walkInPartyAddGuest")}
                </button>
              ) : null}
            </div>

            {party.guests.length === 0 ? <p className={TEXT_MUTED_CLASS}>{t("walkInPartyNoGuests")}</p> : null}

            {party.guests.map((guest) => {
              const lines = [...guest.procedures, ...guest.labs, ...guest.visits];
              const title = guestTitle(t, guest);
              return (
                <section key={guest.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        aria-label={t("patientCard")}
                        title={t("patientCard")}
                        onClick={() => {
                          setGuestModal(null);
                          setLineGuestId(null);
                          setConfirm(null);
                          setLineDetail(null);
                          setCardPatientId(guest.patientRefId);
                          setCardEpisodeId(guest.episodeId);
                        }}
                      >
                        <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                      </button>
                      <div>
                        <p className="font-medium">{title}</p>
                        <p className={`text-sm ${TEXT_MUTED_CLASS}`}>
                          {guestSexLabel(t, guest.sex)}
                          {guest.nationality ? ` · ${guest.nationality}` : ""}
                        </p>
                      </div>
                    </div>
                    {editable ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={busy}
                          onClick={() => openEditGuest(guest)}
                        >
                          {t("walkInPartyEditGuest")}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={busy}
                          onClick={() => openAddLine(guest.id)}
                        >
                          {t("walkInPartyAddLine")}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={busy}
                          onClick={() => setConfirm({ type: "removeGuest", guestId: guest.id, label: title })}
                        >
                          {t("walkInPartyRemoveGuest")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {lines.length === 0 ? (
                    <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("walkInPartyNoLines")}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[36rem] text-left text-sm">
                        <thead>
                          <tr className={`border-b border-border ${TEXT_MUTED_CLASS}`}>
                            <th className="py-1 pr-2 font-medium">{t("walkInPartyLineKind")}</th>
                            <th className="py-1 pr-2 font-medium">{t("walkInPartyService")}</th>
                            <th className="py-1 pr-2 font-medium">{t("walkInPartyParams")}</th>
                            <th className="py-1 pr-2 font-medium">{t("walkInPartyDoctor")}</th>
                            <th className="py-1 pr-2 font-medium">{t("walkInPartyAmount")}</th>
                            <th className="py-1 pr-2 font-medium">{t("walkInPartyStatus")}</th>
                            <th className="py-1 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line) => {
                            const params = lineParamsLabel(line, locale);
                            return (
                              <tr key={line.id} className="border-b border-border/60">
                                <td className="py-1.5 pr-2">
                                  {line.kind === "lab"
                                    ? t("walkInPartyLab")
                                    : line.kind === "visit"
                                      ? t("walkInPartyVisit")
                                      : t("walkInPartyProcedure")}
                                </td>
                                <td className="py-1.5 pr-2">{line.name}</td>
                                <td className={`py-1.5 pr-2 ${TEXT_MUTED_CLASS}`}>{params || "—"}</td>
                                <td className="py-1.5 pr-2">{line.doctorName || "—"}</td>
                                <td className="py-1.5 pr-2">{money(line.amount)}</td>
                                <td className="py-1.5 pr-2">
                                  {paidLine(line)
                                    ? t("walkInPartyPaid")
                                    : line.sent
                                      ? t("walkInPartySent")
                                      : t("statusUnpaid")}
                                </td>
                                <td className="py-1.5">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      className={TABLE_ROW_ICON_BTN_CLASS}
                                      aria-label={t("walkInPartyLineDetail")}
                                      title={t("walkInPartyLineDetail")}
                                      onClick={() => setLineDetail(line)}
                                    >
                                      <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                                    </button>
                                    {editable && !line.sent ? (
                                      <button
                                        type="button"
                                        className={SECONDARY_BUTTON_CLASS}
                                        disabled={busy}
                                        onClick={() =>
                                          setConfirm({
                                            type: "removeLine",
                                            guestId: guest.id,
                                            lineId: line.id,
                                            kind: line.kind,
                                            label: line.name,
                                          })
                                        }
                                      >
                                        {t("walkInPartyRemoveLine")}
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={Boolean(guestModal)}
        title={guestModal?.mode === "edit" ? t("walkInPartyEditGuest") : t("walkInPartyAddGuest")}
        onClose={() => setGuestModal(null)}
        closeLabel={tc("close")}
        overlayZClass={NESTED_Z}
        maxWidthClass="max-w-2xl"
        footer={
          <ModalFooter
            onCancel={() => setGuestModal(null)}
            onSubmit={() => void saveGuest()}
            busy={busy}
            submitDisabled={!guestDraft.nationality || !guestDraft.sex}
            submitLabel={t("walkInPartySaveGuest")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <Field
              label={t("walkInPartyFirst")}
              preset="shortText"
              value={guestDraft.firstName}
              onChange={(e) => setGuestDraft({ ...guestDraft, firstName: e.target.value })}
            />
            <Field
              label={t("walkInPartyLast")}
              preset="shortText"
              value={guestDraft.lastName}
              onChange={(e) => setGuestDraft({ ...guestDraft, lastName: e.target.value })}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("walkInPartySex")}
              value={guestDraft.sex}
              onChange={(value) => setGuestDraft({ ...guestDraft, sex: String(value ?? "") })}
              options={sexOptions}
              emptyLabel={t("walkInSexEmpty")}
            />
            <CatalogField
              kind="SEARCHABLE"
              label={t("walkInPartyCountry")}
              value={guestDraft.nationality}
              onChange={(value) => setGuestDraft({ ...guestDraft, nationality: String(value ?? "").toUpperCase() })}
              options={countryOptions(locale, guestDraft.nationality)}
              emptyLabel={t("walkInSexEmpty")}
            />
            {guestModal?.mode === "add" ? (
              <CatalogField
                kind="SEARCHABLE"
                label={t("walkInPartyPatient")}
                value={guestDraft.patientRefId}
                onChange={(value) => setGuestDraft({ ...guestDraft, patientRefId: String(value ?? "") })}
                options={patientHits}
                serverSearch
                onQueryChange={(q) => void searchPatients(q)}
              />
            ) : null}
          </FieldRow>
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(lineGuestId)}
        title={t("walkInPartyAddLine")}
        onClose={() => setLineGuestId(null)}
        closeLabel={tc("close")}
        overlayZClass={NESTED_Z}
        maxWidthClass="max-w-2xl"
        footer={
          <ModalFooter
            onCancel={() => setLineGuestId(null)}
            onSubmit={() => void saveLine()}
            busy={busy}
            submitDisabled={
              !lineDraft.kind ||
              !lineDraft.code ||
              ((lineDraft.kind === "procedure" || lineDraft.kind === "visit") && !lineDraft.practitionerId)
            }
            submitLabel={t("walkInPartyAdd")}
            cancelLabel={tc("close")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("walkInPartyLineKind")}
              value={lineDraft.kind}
              onChange={(value) => {
                const kind = String(value ?? "") as LineDraft["kind"];
                setLineDraft({
                  kind,
                  code: "",
                  practitionerId: lineDraft.practitionerId,
                });
                setFormPhysio(EMPTY_PHYSIO);
              }}
              options={kindOptions}
              emptyLabel={t("walkInPartyPickKind")}
            />
            {lineDraft.kind ? (
              <CatalogField
                kind="SEARCHABLE"
                label={
                  lineDraft.kind === "lab"
                    ? t("walkInPartyLab")
                    : lineDraft.kind === "visit"
                      ? t("walkInPartyVisit")
                      : t("walkInPartyProcedure")
                }
                value={lineDraft.code}
                onChange={(value) => {
                  const code = String(value ?? "");
                  setLineDraft({ ...lineDraft, code });
                  if (lineDraft.kind === "procedure" && code) {
                    const opt = procedures.find((p) => p.value === code);
                    setFormPhysio(gateToPhysio(code, opt?.label ?? code));
                  } else {
                    setFormPhysio(EMPTY_PHYSIO);
                  }
                }}
                options={lineCodeOptions}
              />
            ) : null}
            {lineNeedsDoctor ? (
              <CatalogField
                kind="SEARCHABLE"
                label={t("walkInPartyDoctor")}
                value={lineDraft.practitionerId}
                onChange={(value) => setLineDraft({ ...lineDraft, practitionerId: String(value ?? "") })}
                options={doctors}
              />
            ) : null}
          </FieldRow>
          {lineDraft.kind === "procedure" && lineDraft.code ? (
            <PhysioSiteChips
              value={formPhysio}
              hideFields={
                /NAFTALAN|VANN|BATH/i.test(lineDraft.code) ? ["DAY_BLOCK", "BATH_SEQUENCE"] : []
              }
              catalog={physioCatalog}
              programs={programs}
              substances={substances}
              locale={locale}
              editable
              compact
              labels={physioLabels}
              onSitesChange={(siteIds) => setFormPhysio((prev) => ({ ...prev, siteIds }))}
              onModeChange={(siteApplyMode) => setFormPhysio((prev) => ({ ...prev, siteApplyMode }))}
              onNoteBlur={(note) => setFormPhysio((prev) => ({ ...prev, note }))}
              onLateralityChange={(siteId, laterality) =>
                setFormPhysio((prev) => ({
                  ...prev,
                  siteLaterality: { ...prev.siteLaterality, [siteId]: laterality },
                }))
              }
              onFieldsChange={(physioFields) =>
                setFormPhysio((prev) => ({ ...prev, physioFields }))
              }
            />
          ) : null}
          <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("walkInPartyAddLineHint")}</p>
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(confirm)}
        title={confirm?.type === "removeGuest" ? t("walkInPartyRemoveGuest") : t("walkInPartyRemoveLine")}
        onClose={() => setConfirm(null)}
        closeLabel={tc("close")}
        overlayZClass={NESTED_Z}
        maxWidthClass="max-w-md"
        footer={
          <ModalFooter
            onCancel={() => setConfirm(null)}
            onSubmit={() => void runConfirm()}
            busy={busy}
            submitLabel={confirm?.type === "removeGuest" ? t("walkInPartyRemoveGuest") : t("walkInPartyRemoveLine")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <p className={`text-sm ${TEXT_MUTED_CLASS}`}>
          {confirm?.type === "removeGuest"
            ? t("walkInPartyConfirmRemoveGuest", { name: confirm.label })
            : confirm
              ? t("walkInPartyConfirmRemoveLine", { name: confirm.label })
              : null}
        </p>
      </ModalShell>

      <ModalShell
        open={Boolean(lineDetail)}
        title={lineDetail?.name ?? t("walkInPartyLineDetail")}
        onClose={() => setLineDetail(null)}
        closeLabel={tc("close")}
        overlayZClass={NESTED_Z}
        maxWidthClass="max-w-lg"
        footer={
          <div className="flex justify-end">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setLineDetail(null)}>
              {tc("close")}
            </button>
          </div>
        }
      >
        {lineDetail ? (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className={`font-medium ${TEXT_MUTED_CLASS}`}>{t("walkInPartyLineKind")}</dt>
              <dd>
                {lineDetail.kind === "lab"
                  ? t("walkInPartyLab")
                  : lineDetail.kind === "visit"
                    ? t("walkInPartyVisit")
                    : t("walkInPartyProcedure")}
              </dd>
            </div>
            <div>
              <dt className={`font-medium ${TEXT_MUTED_CLASS}`}>{t("walkInPartyService")}</dt>
              <dd>
                {lineDetail.name} ({lineDetail.code})
              </dd>
            </div>
            <div>
              <dt className={`font-medium ${TEXT_MUTED_CLASS}`}>{t("walkInPartyParams")}</dt>
              <dd>{lineParamsLabel(lineDetail, locale) || "—"}</dd>
            </div>
            <div>
              <dt className={`font-medium ${TEXT_MUTED_CLASS}`}>{t("walkInPartyDoctor")}</dt>
              <dd>{lineDetail.doctorName || "—"}</dd>
            </div>
            <div>
              <dt className={`font-medium ${TEXT_MUTED_CLASS}`}>{t("walkInPartyAmount")}</dt>
              <dd>{money(lineDetail.amount)}</dd>
            </div>
            <div>
              <dt className={`font-medium ${TEXT_MUTED_CLASS}`}>{t("walkInPartyStatus")}</dt>
              <dd>
                {paidLine(lineDetail)
                  ? t("walkInPartyPaid")
                  : lineDetail.sent
                    ? t("walkInPartySent")
                    : t("statusUnpaid")}
              </dd>
            </div>
          </dl>
        ) : null}
      </ModalShell>

      <PatientCardModal
        patientId={cardPatientId}
        open={Boolean(cardPatientId)}
        onClose={() => {
          setCardPatientId(null);
          setCardEpisodeId(null);
        }}
        initialEpisodeId={cardEpisodeId}
        panel="plan"
        overlayZClass={NESTED_Z}
      />
    </div>
  );
}
