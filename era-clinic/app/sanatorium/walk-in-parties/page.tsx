"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
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
  TEXT_MUTED_CLASS,
  countryOptions,
  showApiError,
  showSuccess,
  type EraDataGridColumn,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay, todayBakuYmd } from "@/lib/baku-day";
import { isLabBlockCatalogKind } from "@/domain/sanatorium/program-block-catalog";

type PartyListRow = {
  id: string;
  name: string;
  visitDate: string;
  status: "DRAFT" | "SENT_TO_CASHIER" | "PAID";
  receiptRef: string | null;
  guestCount: number;
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
};

type Guest = {
  id: string;
  sortOrder: number;
  label: string;
  patientRefId: string;
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

type JournalRow = {
  id: string;
  action: string;
  createdAt: string;
  actor: string | null;
  summary: string;
  fields: Array<{ key: string; from: string | null; to: string | null }>;
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
  kind: "procedure" | "lab" | "visit";
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

const JOURNAL_ACTIONS = [
  "PARTY_CREATE",
  "GUEST_ADD",
  "GUEST_UPDATE",
  "GUEST_REMOVE",
  "LINE_ADD",
  "LINE_REMOVE",
  "SENT_TO_CASHIER",
  "HOTEL_PAID",
] as const;

const EMPTY_GUEST: GuestDraft = {
  firstName: "",
  lastName: "",
  sex: "MALE",
  nationality: "",
  patientRefId: "",
};

const EMPTY_LINE: LineDraft = {
  kind: "procedure",
  code: "",
  practitionerId: "",
};

async function readError(res: Response) {
  try {
    return await res.json();
  } catch {
    return { error: res.statusText };
  }
}

function journalAction(t: ReturnType<typeof useTranslations<"sanatorium">>, action: string) {
  const known = JOURNAL_ACTIONS.find((item) => item === action);
  return known ? t(`walkInPartyAct_${known}`) : action;
}

function localizeGuest(t: ReturnType<typeof useTranslations<"sanatorium">>, summary: string) {
  return summary.replace(/Guest (\d+)/g, (_match, n: string) => t("walkInPartyGuest", { n: Number(n) }));
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

export default function WalkInPartiesPage() {
  const t = useTranslations("sanatorium");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [rows, setRows] = useState<PartyListRow[]>([]);
  const [party, setParty] = useState<Party | null>(null);
  const [journal, setJournal] = useState<JournalRow[]>([]);
  const [openJournal, setOpenJournal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDate, setCreateDate] = useState(todayBakuYmd());
  const [guestModal, setGuestModal] = useState<{ mode: "add" } | { mode: "edit"; guest: Guest } | null>(null);
  const [guestDraft, setGuestDraft] = useState<GuestDraft>(EMPTY_GUEST);
  const [lineGuestId, setLineGuestId] = useState<string | null>(null);
  const [lineDraft, setLineDraft] = useState<LineDraft>(EMPTY_LINE);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [procedures, setProcedures] = useState<Option[]>([]);
  const [labs, setLabs] = useState<Option[]>([]);
  const [visits, setVisits] = useState<Option[]>([]);
  const [doctors, setDoctors] = useState<Option[]>([]);
  const [patientHits, setPatientHits] = useState<Option[]>([]);

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
    const [detailRes, journalRes] = await Promise.all([
      fetch(`/api/sanatorium/walk-in-parties/${id}`),
      fetch(`/api/sanatorium/walk-in-parties/${id}?journal=1`),
    ]);
    if (!detailRes.ok) {
      showApiError(await readError(detailRes));
      return;
    }
    setParty((await detailRes.json()) as Party);
    setJournal(journalRes.ok ? ((await journalRes.json()) as JournalRow[]) : []);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!party) return;
    let cancelled = false;
    void (async () => {
      const [typesRes, catalogRes, doctorsRes] = await Promise.all([
        fetch("/api/procedure-types"),
        fetch("/api/diagnostic-catalog"),
        fetch("/api/admin/practitioners?staffKind=DOCTOR"),
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
      sex: guest.sex === "FEMALE" ? "FEMALE" : "MALE",
      nationality: guest.nationality,
      patientRefId: "",
    });
    setPatientHits([]);
    setGuestModal({ mode: "edit", guest });
  }

  function openAddLine(guestId: string) {
    setLineDraft(EMPTY_LINE);
    setLineGuestId(guestId);
  }

  async function saveGuest() {
    if (!guestDraft.nationality) return;
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
    if (!lineGuestId || !lineDraft.code) return;
    if ((lineDraft.kind === "procedure" || lineDraft.kind === "visit") && !lineDraft.practitionerId) return;
    const ok = await patch({
      action: "addLine",
      guestId: lineGuestId,
      kind: lineDraft.kind,
      code: lineDraft.code,
      practitionerId: lineDraft.practitionerId || null,
    });
    if (ok) setLineGuestId(null);
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
        onClose={() => {
          setParty(null);
          setGuestModal(null);
          setLineGuestId(null);
          setConfirm(null);
        }}
        closeLabel={tc("close")}
        maxWidthClass="max-w-4xl"
        footer={
          party ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="font-semibold">
                {t("walkInPartyTotal")}: {money(party.total)}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    setParty(null);
                    setGuestModal(null);
                    setLineGuestId(null);
                    setConfirm(null);
                  }}
                >
                  {tc("close")}
                </button>
                {editable ? (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy || !hasSendableLines(party)}
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
                    <div>
                      <p className="font-medium">{title}</p>
                      <p className={`text-sm ${TEXT_MUTED_CLASS}`}>
                        {guestSexLabel(t, guest.sex)}
                        {guest.nationality ? ` · ${guest.nationality}` : ""}
                      </p>
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
                    <ul className="space-y-1 text-sm">
                      {lines.map((line) => (
                        <li key={line.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {line.name} · {money(line.amount)} ·{" "}
                            {paidLine(line)
                              ? t("walkInPartyPaid")
                              : line.sent
                                ? t("walkInPartySent")
                                : t("statusUnpaid")}
                            {line.doctorName ? ` · ${line.doctorName}` : ""}
                          </span>
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
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}

            <div className="rounded-lg border border-border p-3">
              <h3 className="mb-2 font-medium">{t("walkInPartyJournal")}</h3>
              {journal.length === 0 ? <p className={TEXT_MUTED_CLASS}>{t("walkInPartyJournalEmpty")}</p> : null}
              <ul className="space-y-2">
                {journal.map((row) => (
                  <li key={row.id} className="rounded border border-border px-3 py-2 text-sm">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-left"
                      onClick={() => setOpenJournal(openJournal === row.id ? null : row.id)}
                    >
                      <span>
                        {bakuDateTimeDisplay(row.createdAt)} · {journalAction(t, row.action)} ·{" "}
                        {localizeGuest(t, row.summary)}
                      </span>
                      <span className={TEXT_MUTED_CLASS}>{row.actor ?? "—"}</span>
                    </button>
                    {openJournal === row.id && row.fields.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs">
                        {row.fields.map((field) => (
                          <li key={field.key}>
                            {field.key}: {field.from ?? "—"} → {field.to ?? "—"}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={Boolean(guestModal)}
        title={guestModal?.mode === "edit" ? t("walkInPartyEditGuest") : t("walkInPartyAddGuest")}
        onClose={() => setGuestModal(null)}
        closeLabel={tc("close")}
        maxWidthClass="max-w-2xl"
        footer={
          <ModalFooter
            onCancel={() => setGuestModal(null)}
            onSubmit={() => void saveGuest()}
            busy={busy}
            submitDisabled={!guestDraft.nationality}
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
              onChange={(value) => setGuestDraft({ ...guestDraft, sex: String(value) })}
              options={sexOptions}
            />
            <CatalogField
              kind="SEARCHABLE"
              label={t("walkInPartyCountry")}
              value={guestDraft.nationality}
              onChange={(value) => setGuestDraft({ ...guestDraft, nationality: String(value ?? "").toUpperCase() })}
              options={countryOptions(locale, guestDraft.nationality)}
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
        maxWidthClass="max-w-lg"
        footer={
          <ModalFooter
            onCancel={() => setLineGuestId(null)}
            onSubmit={() => void saveLine()}
            busy={busy}
            submitDisabled={
              !lineDraft.code || ((lineDraft.kind === "procedure" || lineDraft.kind === "visit") && !lineDraft.practitionerId)
            }
            submitLabel={t("walkInPartyAdd")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("walkInPartyLineKind")}
              value={lineDraft.kind}
              onChange={(value) =>
                setLineDraft({
                  kind: String(value) as LineDraft["kind"],
                  code: "",
                  practitionerId: lineDraft.practitionerId,
                })
              }
              options={kindOptions}
            />
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
              onChange={(value) => setLineDraft({ ...lineDraft, code: String(value ?? "") })}
              options={lineCodeOptions}
            />
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
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(confirm)}
        title={confirm?.type === "removeGuest" ? t("walkInPartyRemoveGuest") : t("walkInPartyRemoveLine")}
        onClose={() => setConfirm(null)}
        closeLabel={tc("close")}
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
    </div>
  );
}
