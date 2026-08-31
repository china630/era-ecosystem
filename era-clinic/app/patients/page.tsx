"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DatePicker,
  EraDataGrid,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldRow,
  FieldSelect,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  NATIONALITY_OPTIONS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  type EraDataGridColumn,
} from "@era/satellite-kit/ui";
import { PatientCardModal } from "@/components/patients/PatientCardModal";
import { useClinicAuth } from "@/hooks/useClinicAuth";

type PatientSex = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
type PatientBloodGroup =
  | "A_POS"
  | "A_NEG"
  | "B_POS"
  | "B_NEG"
  | "AB_POS"
  | "AB_NEG"
  | "O_POS"
  | "O_NEG"
  | "UNKNOWN";

type Patient = {
  id: string;
  refCode: string;
  givenName?: string;
  surname?: string;
  fatherName?: string | null;
  fullName: string;
  phone?: string | null;
  sex?: PatientSex;
  ageYears?: number | null;
  bloodGroup?: PatientBloodGroup;
  globalPersonId?: string | null;
  hasOpenEpisode?: boolean;
};

type ListResponse = {
  items: Patient[];
  total: number;
  page: number;
  pageSize: number;
};

const emptyForm = {
  givenName: "",
  surname: "",
  fatherName: "",
  phone: "",
  nationality: "",
  sex: "UNKNOWN" as PatientSex,
  birthDate: "",
  bloodGroup: "UNKNOWN" as PatientBloodGroup,
  emergencyContactName: "",
  emergencyContactPhone: "",
  finCode: "",
  passportNumber: "",
  issuingCountry: "",
};

export default function PatientsPage() {
  const t = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const { auth } = useClinicAuth();
  const isSuperAdmin = Boolean(auth?.isPlatformSuperAdmin);
  const [rows, setRows] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [filters, setFilters] = useState({
    sex: "" as "" | PatientSex,
    bloodGroup: "" as "" | PatientBloodGroup,
    hasMdm: "" as "" | "0" | "1",
    ageMin: "",
    ageMax: "",
  });
  const [open, setOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        episodeStatus: "ALL",
      });
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      if (filters.sex) params.set("sex", filters.sex);
      if (filters.bloodGroup) params.set("bloodGroup", filters.bloodGroup);
      if (isSuperAdmin && filters.hasMdm) params.set("hasMdm", filters.hasMdm);
      if (filters.ageMin.trim()) params.set("ageMin", filters.ageMin.trim());
      if (filters.ageMax.trim()) params.set("ageMax", filters.ageMax.trim());
      const res = await fetch(`/api/patients?${params}`);
      const d = await res.json();
      const payload = (d.data ?? d) as ListResponse;
      setRows(payload.items ?? []);
      setTotal(typeof payload.total === "number" ? payload.total : 0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, filters, isSuperAdmin, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filters]);

  const columns = useMemo<EraDataGridColumn<Patient>[]>(
    () => [
      { key: "fullName", header: t("name") },
      { key: "refCode", header: t("refCode") },
      {
        key: "sex",
        header: t("sex"),
        render: (p) =>
          p.sex === "MALE"
            ? t("sexShortMale")
            : p.sex === "FEMALE"
              ? t("sexShortFemale")
              : "—",
      },
      {
        key: "ageYears",
        header: t("birthDate"),
        render: (p) => (p.ageYears != null ? t("ageYears", { age: p.ageYears }) : "—"),
      },
      { key: "phone", header: t("phone"), render: (p) => p.phone ?? "—" },
      {
        key: "course",
        header: t("colOpenCourse"),
        render: (p) =>
          p.hasOpenEpisode ? (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
              {t("badgeOpenCourse")}
            </span>
          ) : (
            "—"
          ),
      },
      ...(isSuperAdmin
        ? [
            {
              key: "mdm",
              header: t("mdmBadge"),
              render: (p: Patient) =>
                p.globalPersonId ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs">
                    {p.globalPersonId.slice(0, 4)}…
                  </span>
                ) : (
                  <span className="text-red-600">{t("mdmMissing")}</span>
                ),
            } satisfies EraDataGridColumn<Patient>,
          ]
        : []),
      {
        key: "actions",
        header: tc("actions"),
        render: (p) => (
          <button
            type="button"
            className={TABLE_ROW_ICON_BTN_CLASS}
            aria-label={t("openCard")}
            onClick={() => setCardId(p.id)}
          >
            <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
          </button>
        ),
      },
    ],
    [t, tc, isSuperAdmin],
  );

  async function save() {
    setError(null);
    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        givenName: form.givenName.trim(),
        surname: form.surname.trim(),
        fatherName: form.fatherName.trim() || null,
        phone: form.phone.trim() || undefined,
        nationality: form.nationality.trim() || null,
        sex: form.sex,
        birthDate: form.birthDate.trim() || null,
        bloodGroup: form.bloodGroup,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        finCode: form.finCode.trim() || undefined,
        passportNumber: form.passportNumber.trim() || undefined,
        issuingCountry: form.issuingCountry.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? tc("saveFailed"));
      return;
    }
    setOpen(false);
    setForm(emptyForm);
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
            {tc("add")}
          </button>
        }
      />
      <EraListFilterBar
        resetLabel={tc("filterReset")}
        onReset={() => {
          setQ("");
          setFilters({
            sex: "" as const,
            bloodGroup: "" as const,
            hasMdm: "" as const,
            ageMin: "",
            ageMax: "",
          });
          setPage(1);
        }}
      >
        <Field
          label={t("search")}
          preset="shortText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FieldSelect
          label={t("filterSex")}
          preset="shortText"
          value={filters.sex}
          onChange={(e) => {
            setFilters({ ...filters, sex: e.target.value as "" | PatientSex });
            setPage(1);
          }}
        >
          <option value="">{tc("all")}</option>
          <option value="MALE">{t("sexMale")}</option>
          <option value="FEMALE">{t("sexFemale")}</option>
          <option value="UNKNOWN">{t("sexUnknown")}</option>
        </FieldSelect>
        <FieldSelect
          label={t("filterBlood")}
          preset="shortText"
          value={filters.bloodGroup}
          onChange={(e) => {
            setFilters({
              ...filters,
              bloodGroup: e.target.value as "" | PatientBloodGroup,
            });
            setPage(1);
          }}
        >
          <option value="">{tc("all")}</option>
          <option value="A_POS">A+</option>
          <option value="A_NEG">A-</option>
          <option value="B_POS">B+</option>
          <option value="B_NEG">B-</option>
          <option value="AB_POS">AB+</option>
          <option value="AB_NEG">AB-</option>
          <option value="O_POS">O+</option>
          <option value="O_NEG">O-</option>
          <option value="UNKNOWN">{t("sexUnknown")}</option>
        </FieldSelect>
        {isSuperAdmin ? (
          <FieldSelect
            label={t("filterMdm")}
            preset="shortText"
            value={filters.hasMdm}
            onChange={(e) => {
              setFilters({ ...filters, hasMdm: e.target.value as "" | "0" | "1" });
              setPage(1);
            }}
          >
            <option value="">{tc("all")}</option>
            <option value="1">{t("filterMdmLinked")}</option>
            <option value="0">{t("filterMdmMissing")}</option>
          </FieldSelect>
        ) : null}
        <FieldRow cols={2}>
          <Field
            label={t("filterAgeMin")}
            preset="count"
            type="number"
            min={0}
            value={filters.ageMin}
            onChange={(e) => {
              setFilters({ ...filters, ageMin: e.target.value });
              setPage(1);
            }}
          />
          <Field
            label={t("filterAgeMax")}
            preset="count"
            type="number"
            min={0}
            value={filters.ageMax}
            onChange={(e) => {
              setFilters({ ...filters, ageMax: e.target.value });
              setPage(1);
            }}
          />
        </FieldRow>
      </EraListFilterBar>
      <div className={`${CARD_CONTAINER_CLASS} overflow-hidden`}>
        <EraDataGrid
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          emptyMessage={loading ? tc("loading") : t("emptyList")}
          pagination={false}
        />
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          labels={{
            rowsPerPage: tc("rowsPerPage"),
            pageOf: tc("pageOf"),
            prev: tc("prev"),
            next: tc("next"),
          }}
        />
      </div>

      <PatientCardModal
        patientId={cardId}
        open={Boolean(cardId)}
        onClose={() => setCardId(null)}
      />

      <ModalShell open={open} title={t("createTitle")} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("demographicsHint")}</p>
          <FieldRow cols={3}>
            <Field
              label={t("givenName")}
              preset="shortText"
              value={form.givenName}
              onChange={(e) => setForm({ ...form, givenName: e.target.value })}
              required
            />
            <Field
              label={t("surname")}
              preset="shortText"
              value={form.surname}
              onChange={(e) => setForm({ ...form, surname: e.target.value })}
              required
            />
            <Field
              label={t("fatherName")}
              preset="shortText"
              value={form.fatherName}
              onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
            />
          </FieldRow>
          <FieldRow cols={2}>
            <Field
              label={t("phone")}
              preset="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <CatalogField
              kind="SEARCHABLE"
              label={t("nationality")}
              value={form.nationality}
              onChange={(v) =>
                setForm({ ...form, nationality: String(v ?? "").toUpperCase() })
              }
              options={[...NATIONALITY_OPTIONS]}
              emptyLabel={t("sexUnknown")}
            />
          </FieldRow>
          <FieldRow cols={2}>
            <FieldSelect
              label={t("sex")}
              preset="select"
              value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value as PatientSex })}
            >
              <option value="UNKNOWN">{t("sexUnknown")}</option>
              <option value="MALE">{t("sexMale")}</option>
              <option value="FEMALE">{t("sexFemale")}</option>
            </FieldSelect>
            <CatalogField
              kind="CLOSED_MEDIUM"
              label={t("bloodGroup")}
              value={form.bloodGroup}
              onChange={(v) =>
                setForm({ ...form, bloodGroup: String(v) as PatientBloodGroup })
              }
              options={[
                { value: "UNKNOWN", label: t("sexUnknown") },
                { value: "A_POS", label: "A+" },
                { value: "A_NEG", label: "A-" },
                { value: "B_POS", label: "B+" },
                { value: "B_NEG", label: "B-" },
                { value: "AB_POS", label: "AB+" },
                { value: "AB_NEG", label: "AB-" },
                { value: "O_POS", label: "O+" },
                { value: "O_NEG", label: "O-" },
              ]}
            />
            <DatePicker
              label={t("birthDate")}
              value={form.birthDate}
              onChange={(isoDate) => setForm({ ...form, birthDate: isoDate })}
              placeholder={tc("datePlaceholder")}
              openCalendarLabel={tc("openCalendar")}
            />
          </FieldRow>
          <Field
            label={t("finCode")}
            preset="fin"
            value={form.finCode}
            onChange={(e) => setForm({ ...form, finCode: e.target.value.toUpperCase() })}
          />
          {error ? <p className={`text-xs ${TEXT_DANGER_CLASS}`}>{error}</p> : null}
        </div>
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => void save()} submitLabel={tc("save")} />
      </ModalShell>
    </>
  );
}
