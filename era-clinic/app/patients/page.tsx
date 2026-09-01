"use client";

import { useCallback, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DatePicker,
  EraDataGrid,
  EraListFilterBar,
  EraListWorkspace,
  Field,
  FieldRow,
  FieldSelect,
  LIST_PAGE_SHELL_CLASS,
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
  usePaginatedList,
} from "@era/satellite-kit/ui";
import { PatientCardModal } from "@/components/patients/PatientCardModal";
import { useClinicAuth } from "@/hooks/useClinicAuth";

type PatientSex = "MALE" | "FEMALE" | "UNKNOWN";
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
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  fullName: string;
  phone?: string | null;
  sex?: PatientSex;
  ageYears?: number | null;
  bloodGroup?: PatientBloodGroup;
  globalPersonId?: string | null;
  hasOpenEpisode?: boolean;
};

type ListFilters = {
  q: string;
  sex: "" | PatientSex;
  bloodGroup: "" | PatientBloodGroup;
  hasMdm: "" | "0" | "1";
  ageMin: string;
  ageMax: string;
};

const emptyForm = {
  firstName: "",
  middleName: "",
  lastName: "",
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

const emptyListFilters = (): ListFilters => ({
  q: "",
  sex: "",
  bloodGroup: "",
  hasMdm: "",
  ageMin: "",
  ageMax: "",
});

export default function PatientsPage() {
  const t = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const { auth } = useClinicAuth();
  const isSuperAdmin = Boolean(auth?.isPlatformSuperAdmin);
  const [filterState, setFilterState] = useState(emptyListFilters);
  const [open, setOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filters = useMemo(() => filterState, [filterState]);

  const fetcher = useCallback(
    async ({
      page,
      pageSize,
      filters: f,
    }: {
      page: number;
      pageSize: number;
      filters: ListFilters;
    }) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        episodeStatus: "ALL",
      });
      if (f.q.trim()) params.set("q", f.q.trim());
      if (f.sex) params.set("sex", f.sex);
      if (f.bloodGroup) params.set("bloodGroup", f.bloodGroup);
      if (isSuperAdmin && f.hasMdm) params.set("hasMdm", f.hasMdm);
      if (f.ageMin.trim()) params.set("ageMin", f.ageMin.trim());
      if (f.ageMax.trim()) params.set("ageMax", f.ageMax.trim());
      const res = await fetch(`/api/patients?${params}`);
      if (!res.ok) throw new Error(tc("loadingFailed"));
      return res.json();
    },
    [isSuperAdmin, tc],
  );

  const {
    items: rows,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    loading,
    reload: load,
  } = usePaginatedList<Patient, ListFilters>({ fetcher, filters });

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
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || null,
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
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
              {tc("add")}
            </button>
          }
        />
      </div>
      <EraListWorkspace
        filter={
          <EraListFilterBar
            className="!mb-0"
            resetLabel={tc("filterReset")}
            onReset={() => setFilterState(emptyListFilters())}
          >
            <Field
              label={t("search")}
              preset="shortText"
              value={filterState.q}
              onChange={(e) => setFilterState({ ...filterState, q: e.target.value })}
            />
            <FieldSelect
              label={t("filterSex")}
              preset="shortText"
              value={filterState.sex}
              onChange={(e) => {
                setFilterState({ ...filterState, sex: e.target.value as "" | PatientSex });
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
              value={filterState.bloodGroup}
              onChange={(e) => {
                setFilterState({
                  ...filterState,
                  bloodGroup: e.target.value as "" | PatientBloodGroup,
                });
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
                value={filterState.hasMdm}
                onChange={(e) => {
                  setFilterState({ ...filterState, hasMdm: e.target.value as "" | "0" | "1" });
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
                value={filterState.ageMin}
                onChange={(e) => {
                  setFilterState({ ...filterState, ageMin: e.target.value });
                }}
              />
              <Field
                label={t("filterAgeMax")}
                preset="count"
                type="number"
                min={0}
                value={filterState.ageMax}
                onChange={(e) => {
                  setFilterState({ ...filterState, ageMax: e.target.value });
                }}
              />
            </FieldRow>
          </EraListFilterBar>
        }
        table={
          <EraDataGrid
            columns={columns}
            rows={rows}
            rowKey={(p) => p.id}
            emptyMessage={loading ? tc("loading") : t("emptyList")}
            pagination={false}
            paginationMode="server"
            embedded
          />
        }
        footer={
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: tc("rowsPerPage"),
              pageOf: tc("pageOf"),
              prev: tc("prev"),
              next: tc("next"),
            }}
          />
        }
      />

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
              label={t("firstName")}
              preset="shortText"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
            <Field
              label={t("lastName")}
              preset="shortText"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
            <Field
              label={t("middleName")}
              preset="shortText"
              value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value })}
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
    </div>
  );
}
