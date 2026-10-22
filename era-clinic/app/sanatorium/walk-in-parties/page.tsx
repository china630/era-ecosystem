"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CatalogField,
  DatePicker,
  EraDataGrid,
  Field,
  FieldRow,
  LIST_PAGE_SHELL_CLASS,
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

const SEX_OPTIONS = [
  { value: "MALE", labelKey: "walkInPartyMale" },
  { value: "FEMALE", labelKey: "walkInPartyFemale" },
] as const;

async function readError(res: Response) {
  try {
    return await res.json();
  } catch {
    return { error: res.statusText };
  }
}

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

function journalAction(t: ReturnType<typeof useTranslations<"sanatorium">>, action: string) {
  const known = JOURNAL_ACTIONS.find((item) => item === action);
  return known ? t(`walkInPartyAct_${known}`) : action;
}

function localizeGuest(t: ReturnType<typeof useTranslations<"sanatorium">>, summary: string) {
  return summary.replace(/Guest (\d+)/g, (_match, n: string) => t("walkInPartyGuest", { n: Number(n) }));
}

function paidLine(line: { status: string }) {
  return line.status === "PAID" || line.status === "COMPLETED" || line.status === "SCHEDULED" || line.status === "CHECKED_IN" || line.status === "PROPOSED";
}

export default function WalkInPartiesPage() {
  const t = useTranslations("sanatorium");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [rows, setRows] = useState<PartyListRow[]>([]);
  const [party, setParty] = useState<Party | null>(null);
  const [journal, setJournal] = useState<JournalRow[]>([]);
  const [openJournal, setOpenJournal] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [visitDate, setVisitDate] = useState(todayBakuYmd());
  const [busy, setBusy] = useState(false);
  const [procedures, setProcedures] = useState<Option[]>([]);
  const [labs, setLabs] = useState<Option[]>([]);
  const [visits, setVisits] = useState<Option[]>([]);
  const [doctors, setDoctors] = useState<Option[]>([]);
  const [patientHits, setPatientHits] = useState<Option[]>([]);

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
        const body = (await typesRes.json()) as { items?: Array<{ code: string; name: string }> } | Array<{ code: string; name: string }>;
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
        const labelOf = (item: { code: string; serviceCode?: string; title?: { en?: string; ru?: string; az?: string } }) => {
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
        const body = (await doctorsRes.json()) as { items?: Array<{ id: string; fullName?: string; code?: string }> } | Array<{ id: string; fullName?: string; code?: string }>;
        const items = Array.isArray(body) ? body : body.items ?? [];
        setDoctors(items.map((item) => ({ value: item.id, label: item.fullName || item.code || item.id })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [party?.id]);

  async function createParty() {
    setBusy(true);
    try {
      const res = await fetch("/api/sanatorium/walk-in-parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, visitDate }),
      });
      if (!res.ok) {
        showApiError(await readError(res));
        return;
      }
      const created = (await res.json()) as Party;
      setName("");
      await loadList();
      await loadParty(created.id);
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

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader
        title={t("walkInPartyTitle")}
        actions={
          <Link href="/sanatorium" className={SECONDARY_BUTTON_CLASS}>
            {t("walkInPartyBack")}
          </Link>
        }
      />

      {!party ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <FieldRow cols={3}>
              <Field
                label={t("walkInPartyName")}
                preset="shortText"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <DatePicker
                label={t("walkInPartyDate")}
                value={visitDate}
                onChange={setVisitDate}
                placeholder={tc("datePlaceholder")}
                openCalendarLabel={tc("openCalendar")}
              />
              <div className="flex items-end">
                <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy || !name.trim()} onClick={() => void createParty()}>
                  {t("walkInPartyCreate")}
                </button>
              </div>
            </FieldRow>
          </div>
          <EraDataGrid
            columns={columns as unknown as EraDataGridColumn<PartyListRow & Record<string, unknown>>[]}
            rows={rows as (PartyListRow & Record<string, unknown>)[]}
            rowKey={(row) => row.id}
            onRowClick={(row) => void loadParty(String(row.id))}
            emptyMessage={t("walkInPartyEmpty")}
          />
        </div>
      ) : (
        <PartyEditor
          party={party}
          journal={journal}
          openJournal={openJournal}
          setOpenJournal={setOpenJournal}
          busy={busy}
          locale={locale}
          procedures={procedures}
          labs={labs}
          visits={visits}
          doctors={doctors}
          patientHits={patientHits}
          sexOptions={sexOptions}
          onSearchPatients={async (q) => {
            const res = await fetch(`/api/patients?q=${encodeURIComponent(q)}`);
            if (!res.ok) return;
            const body = (await res.json()) as { items?: Array<{ id: string; fullName?: string; refCode?: string }> };
            setPatientHits((body.items ?? []).map((item) => ({ value: item.id, label: item.fullName || item.refCode || item.id })));
          }}
          onAddGuest={(input) => patch({ action: "addGuest", ...input })}
          onUpdateGuest={(guestId, input) => patch({ action: "updateGuest", guestId, ...input })}
          onRemoveGuest={(guestId) => patch({ action: "removeGuest", guestId })}
          onAddLine={(guestId, input) => patch({ action: "addLine", guestId, ...input })}
          onRemoveLine={(guestId, lineId, kind) => patch({ action: "removeLine", guestId, lineId, kind })}
          onSend={async () => {
            const result = await patch({ action: "send" });
            if (!result) return;
            if (result.rejected?.length) {
              showApiError({ error: result.rejected.map((row) => `${row.code}: ${row.reason}`).join("; ") });
            } else {
              showSuccess(t("walkInPartySent"));
            }
          }}
          onBack={() => setParty(null)}
          t={t}
        />
      )}
    </div>
  );
}

function PartyEditor({
  party,
  journal,
  openJournal,
  setOpenJournal,
  busy,
  locale,
  procedures,
  labs,
  visits,
  doctors,
  patientHits,
  sexOptions,
  onSearchPatients,
  onAddGuest,
  onUpdateGuest,
  onRemoveGuest,
  onAddLine,
  onRemoveLine,
  onSend,
  onBack,
  t,
}: {
  party: Party;
  journal: JournalRow[];
  openJournal: string | null;
  setOpenJournal: (id: string | null) => void;
  busy: boolean;
  locale: string;
  procedures: Option[];
  labs: Option[];
  visits: Option[];
  doctors: Option[];
  patientHits: Option[];
  sexOptions: Option[];
  onSearchPatients: (q: string) => Promise<void>;
  onAddGuest: (input: { sex: string; nationality: string; firstName?: string; lastName?: string; patientRefId?: string | null }) => Promise<unknown>;
  onUpdateGuest: (guestId: string, input: { sex: string; nationality: string; firstName?: string; lastName?: string }) => Promise<unknown>;
  onRemoveGuest: (guestId: string) => Promise<unknown>;
  onAddLine: (guestId: string, input: { kind: string; code: string; qty?: number; practitionerId?: string | null }) => Promise<unknown>;
  onRemoveLine: (guestId: string, lineId: string, kind: string) => Promise<unknown>;
  onSend: () => Promise<void>;
  onBack: () => void;
  t: ReturnType<typeof useTranslations<"sanatorium">>;
}) {
  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    sex: "MALE",
    nationality: "",
    patientRefId: "",
  });
  const money = (amount: number) => `${amount.toFixed(2)} AZN`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{party.name}</h2>
          <p className={TEXT_MUTED_CLASS}>
            {party.visitDate} · {t(`walkInPartyStatus_${party.status}`)}
            {party.receiptRef ? ` · ${party.receiptRef}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold">{t("walkInPartyTotal")}: {money(party.total)}</span>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onBack}>{t("walkInPartyList")}</button>
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void onSend()}>
            {t("walkInPartySend")}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-3 font-medium">{t("walkInPartyAddGuest")}</h3>
        <FieldRow cols={3}>
          <Field label={t("walkInPartyFirst")} preset="shortText" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
          <Field label={t("walkInPartyLast")} preset="shortText" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("walkInPartySex")}
            value={draft.sex}
            onChange={(value) => setDraft({ ...draft, sex: String(value) })}
            options={sexOptions}
          />
          <CatalogField
            kind="SEARCHABLE"
            label={t("walkInPartyCountry")}
            value={draft.nationality}
            onChange={(value) => setDraft({ ...draft, nationality: String(value ?? "").toUpperCase() })}
            options={countryOptions(locale, draft.nationality)}
          />
          <CatalogField
            kind="SEARCHABLE"
            label={t("walkInPartyPatient")}
            value={draft.patientRefId}
            onChange={(value) => setDraft({ ...draft, patientRefId: String(value ?? "") })}
            options={patientHits}
            serverSearch
            onQueryChange={(q) => void onSearchPatients(q)}
          />
        </FieldRow>
        <button
          type="button"
          className={`${PRIMARY_BUTTON_CLASS} mt-3`}
          disabled={busy || !draft.nationality}
          onClick={() =>
            void onAddGuest({
              sex: draft.sex,
              nationality: draft.nationality,
              firstName: draft.firstName,
              lastName: draft.lastName,
              patientRefId: draft.patientRefId || null,
            }).then(() => setDraft({ firstName: "", lastName: "", sex: "MALE", nationality: "", patientRefId: "" }))
          }
        >
          {t("walkInPartySaveGuest")}
        </button>
      </div>

      {party.guests.map((guest) => (
        <GuestCard
          key={guest.id}
          guest={guest}
          busy={busy}
          locale={locale}
          procedures={procedures}
          labs={labs}
          visits={visits}
          doctors={doctors}
          sexOptions={sexOptions}
          money={money}
          onUpdate={(input) => onUpdateGuest(guest.id, input)}
          onRemove={() => onRemoveGuest(guest.id)}
          onAddLine={(input) => onAddLine(guest.id, input)}
          onRemoveLine={(lineId, kind) => onRemoveLine(guest.id, lineId, kind)}
          t={t}
        />
      ))}

      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-3 font-medium">{t("walkInPartyJournal")}</h3>
        {journal.length === 0 ? <p className={TEXT_MUTED_CLASS}>{t("walkInPartyEmpty")}</p> : null}
        <ul className="space-y-2">
          {journal.map((row) => (
            <li key={row.id} className="rounded border border-border px-3 py-2 text-sm">
              <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpenJournal(openJournal === row.id ? null : row.id)}>
                <span>{bakuDateTimeDisplay(row.createdAt)} · {journalAction(t, row.action)} · {localizeGuest(t, row.summary)}</span>
                <span className={TEXT_MUTED_CLASS}>{row.actor ?? "—"}</span>
              </button>
              {openJournal === row.id && row.fields.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {row.fields.map((field) => (
                    <li key={field.key}>{field.key}: {field.from ?? "—"} → {field.to ?? "—"}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GuestCard({
  guest,
  busy,
  locale,
  procedures,
  labs,
  visits,
  doctors,
  sexOptions,
  money,
  onUpdate,
  onRemove,
  onAddLine,
  onRemoveLine,
  t,
}: {
  guest: Guest;
  busy: boolean;
  locale: string;
  procedures: Option[];
  labs: Option[];
  visits: Option[];
  doctors: Option[];
  sexOptions: Option[];
  money: (amount: number) => string;
  onUpdate: (input: { sex: string; nationality: string; firstName?: string; lastName?: string }) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
  onAddLine: (input: { kind: string; code: string; qty?: number; practitionerId?: string | null }) => Promise<unknown>;
  onRemoveLine: (lineId: string, kind: string) => Promise<unknown>;
  t: ReturnType<typeof useTranslations<"sanatorium">>;
}) {
  const [form, setForm] = useState({
    firstName: guest.firstName,
    lastName: guest.lastName,
    sex: guest.sex === "FEMALE" ? "FEMALE" : "MALE",
    nationality: guest.nationality,
  });
  const [procedureCode, setProcedureCode] = useState("");
  const [labCode, setLabCode] = useState("");
  const [visitCode, setVisitCode] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const lines = [...guest.procedures, ...guest.labs, ...guest.visits];
  const title = guest.placeholder ? t("walkInPartyGuest", { n: guest.sortOrder }) : guest.fullName || guest.label;

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void onRemove()}>
          {t("walkInPartyRemoveGuest")}
        </button>
      </div>
      <FieldRow cols={4}>
        <Field label={t("walkInPartyFirst")} preset="shortText" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <Field label={t("walkInPartyLast")} preset="shortText" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        <CatalogField kind="CLOSED_SMALL" label={t("walkInPartySex")} value={form.sex} onChange={(value) => setForm({ ...form, sex: String(value) })} options={sexOptions} />
        <CatalogField
          kind="SEARCHABLE"
          label={t("walkInPartyCountry")}
          value={form.nationality}
          onChange={(value) => setForm({ ...form, nationality: String(value ?? "").toUpperCase() })}
          options={countryOptions(locale, form.nationality)}
        />
      </FieldRow>
      <button
        type="button"
        className={`${SECONDARY_BUTTON_CLASS} mt-3`}
        disabled={busy || !form.nationality}
        onClick={() => void onUpdate(form)}
      >
        {t("walkInPartySaveGuest")}
      </button>

      <ul className="my-3 space-y-1 text-sm">
        {lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3">
            <span>
              {line.name} · {money(line.amount)} · {paidLine(line) ? t("walkInPartyPaid") : line.sent ? t("walkInPartySent") : t("statusUnpaid")}
              {line.doctorName ? ` · ${line.doctorName}` : ""}
            </span>
            {!line.sent ? (
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void onRemoveLine(line.id, line.kind)}>
                {t("walkInPartyRemoveLine")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <FieldRow cols={3}>
        <CatalogField kind="SEARCHABLE" label={t("walkInPartyProcedure")} value={procedureCode} onChange={(value) => setProcedureCode(String(value ?? ""))} options={procedures} />
        <CatalogField kind="SEARCHABLE" label={t("walkInPartyLab")} value={labCode} onChange={(value) => setLabCode(String(value ?? ""))} options={labs} />
        <CatalogField kind="SEARCHABLE" label={t("walkInPartyVisit")} value={visitCode} onChange={(value) => setVisitCode(String(value ?? ""))} options={visits} />
        <CatalogField kind="SEARCHABLE" label={t("walkInPartyDoctor")} value={doctorId} onChange={(value) => setDoctorId(String(value ?? ""))} options={doctors} />
      </FieldRow>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy || !procedureCode || !doctorId} onClick={() => void onAddLine({ kind: "procedure", code: procedureCode, practitionerId: doctorId })}>
          {t("walkInPartyAdd")} · {t("walkInPartyProcedure")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy || !labCode} onClick={() => void onAddLine({ kind: "lab", code: labCode })}>
          {t("walkInPartyAdd")} · {t("walkInPartyLab")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy || !visitCode || !doctorId} onClick={() => void onAddLine({ kind: "visit", code: visitCode, practitionerId: doctorId })}>
          {t("walkInPartyAdd")} · {t("walkInPartyVisit")}
        </button>
      </div>
    </section>
  );
}
