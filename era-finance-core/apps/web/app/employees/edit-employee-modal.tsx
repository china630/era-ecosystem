"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import { parsePaginatedList } from "../../lib/paginated-list";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
} from "../../lib/design-system";
import { EntityAuditHistory } from "../../components/admin/entity-audit-history";
import { Button } from "../../components/ui/button";
import { EmasS2sPanel } from "./emas-s2s-panel";
import { useAuth } from "../../lib/auth-context";
import { useOrgPermissions } from "../../lib/use-org-permissions";
import { CP_PERMISSION } from "../../lib/role-utils";
import { isValidFinCode, normalizeFinInput } from "../../lib/fin-code";

type JobPositionOpt = {
  id: string;
  name: string;
  department: { id: string; name: string };
};

const ORCH_WEB_BASE = (
  process.env.NEXT_PUBLIC_ORCH_WEB_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "");

function cpTerminateUrl(cpEmploymentId: string): string {
  return `${ORCH_WEB_BASE}/workspace/workforce/employments?employmentId=${encodeURIComponent(cpEmploymentId)}`;
}

type EmployeeDetail = {
  id: string;
  kind?: string;
  cpEmploymentId?: string | null;
  globalPersonId: string;
  positionId: string;
  startDate: string;
  salary: unknown;
  internalRate?: unknown | null;
  contractorMonthlySocialAzn?: unknown | null;
  vacationDaysBalance?: unknown | null;
  emasEligible?: boolean;
  voen?: string | null;
  person?: {
    displayName: string | null;
    finMasked: string | null;
    accessDenied: boolean;
  };
};

function formatVacationDaysBalance(v: unknown): string {
  if (v == null) return "—";
  const s =
    typeof v === "object" && v !== null && "toString" in v
      ? (v as { toString(): string }).toString()
      : String(v);
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function EditEmployeeModal({
  open,
  employeeId,
  token,
  onClose,
  onSaved,
}: {
  open: boolean;
  employeeId: string | null;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const perms = useOrgPermissions();
  const canEditInternalRate = perms.can(CP_PERMISSION.API_BOOK_MGMT);
  const [positions, setPositions] = useState<JobPositionOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"form" | "history">("form");

  const [kind, setKind] = useState<"EMPLOYEE" | "CONTRACTOR">("EMPLOYEE");
  const [personDisplay, setPersonDisplay] = useState<
    NonNullable<EmployeeDetail["person"]> | null
  >(null);
  const [voen, setVoen] = useState("");
  const [contractorSocial, setContractorSocial] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [positionId, setPositionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [salary, setSalary] = useState("");
  const [internalRate, setInternalRate] = useState("");
  const [vacationBalanceLabel, setVacationBalanceLabel] = useState("—");
  const [globalPersonId, setGlobalPersonId] = useState<string | null>(null);
  const [emasEligible, setEmasEligible] = useState(true);
  const [convertFin, setConvertFin] = useState("");
  const [convertBusy, setConvertBusy] = useState(false);
  const [emasMode, setEmasMode] = useState<"OFF" | "SELECTIVE" | "FULL" | null>(
    null,
  );
  const [cpEmploymentId, setCpEmploymentId] = useState<string | null>(null);

  const title = useMemo(() => t("employees.editSection"), [t]);
  const needsFin =
    emasEligible === false ||
    !personDisplay?.finMasked ||
    personDisplay.finMasked === "—";
  const salaryNum = Number(String(salary).replace(",", "."));
  const salaryMissing = Number.isFinite(salaryNum) && salaryNum <= 0;

  const loadPositions = useCallback(async () => {
    if (!open) return;
    try {
      const merged: JobPositionOpt[] = [];
      let p = 1;
      for (;;) {
        const res = await apiFetch(`/api/hr/job-positions?page=${p}&pageSize=200`);
        if (!res.ok) {
          setLoadErr(`${t("hrStructure.loadErr")}: ${res.status}`);
          setPositions([]);
          return;
        }
        const data = parsePaginatedList<JobPositionOpt>(await res.json());
        merged.push(...data.items);
        if (merged.length >= data.total || data.items.length === 0) break;
        p += 1;
      }
      setPositions(merged);
    } catch {
      setLoadErr(t("employees.loadErr"));
      setPositions([]);
    }
  }, [open, t]);

  const loadEmployee = useCallback(async () => {
    if (!open || !employeeId || !token) return;
    setLoadErr(null);
    setLoading(true);
    try {
      const res = await apiFetch(`/api/hr/employees/${employeeId}`);
      if (!res.ok) {
        setLoadErr(`${t("employees.loadErr")}: ${res.status}`);
        return;
      }
      const r = (await res.json()) as EmployeeDetail;
      setKind((r.kind as "EMPLOYEE" | "CONTRACTOR") || "EMPLOYEE");
      setPersonDisplay(r.person ?? null);
      setVoen((r.voen ?? "").replace(/\D/g, ""));
      setMiddleName("");
      setPositionId(r.positionId);
      setStartDate(String(r.startDate).slice(0, 10));
      setSalary(
        typeof r.salary === "object" && r.salary !== null && "toString" in r.salary
          ? (r.salary as { toString(): string }).toString()
          : String(r.salary ?? ""),
      );
      const ir = r.internalRate;
      setInternalRate(
        ir != null && typeof ir === "object" && ir !== null && "toString" in ir
          ? (ir as { toString(): string }).toString()
          : ir != null
            ? String(ir)
            : "",
      );
      const soc = r.contractorMonthlySocialAzn;
      setContractorSocial(
        soc != null && typeof soc === "object" && soc !== null && "toString" in soc
          ? (soc as { toString(): string }).toString()
          : soc != null
            ? String(soc)
            : "",
      );
      setVacationBalanceLabel(formatVacationDaysBalance(r.vacationDaysBalance));
      setGlobalPersonId(r.globalPersonId ?? null);
      setCpEmploymentId(r.cpEmploymentId ?? null);
      setEmasEligible(r.emasEligible !== false);
      setConvertFin("");
    } catch {
      setLoadErr(t("employees.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [employeeId, open, t, token]);

  const loadOrgEmasMode = useCallback(async () => {
    if (!open || !token) return;
    try {
      const res = await apiFetch("/api/organization/settings");
      if (!res.ok) return;
      const o = (await res.json()) as {
        settings?: { hr?: { emasMode?: string } };
      };
      const mode = o.settings?.hr?.emasMode;
      if (mode === "OFF" || mode === "SELECTIVE" || mode === "FULL") {
        setEmasMode(mode);
      } else {
        setEmasMode("OFF");
      }
    } catch {
      /* ignore */
    }
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    setTab("form");
    void loadPositions();
    void loadOrgEmasMode();
  }, [open, loadPositions, loadOrgEmasMode]);

  useEffect(() => {
    if (!open || !employeeId) return;
    void loadEmployee();
  }, [open, employeeId, loadEmployee]);

  async function onConvertToFin() {
    if (!employeeId || !token || convertBusy) return;
    const fin = normalizeFinInput(convertFin);
    if (!isValidFinCode(fin)) {
      toast.error(t("employees.finInvalidStrict"));
      return;
    }
    setConvertBusy(true);
    const res = await apiFetch(`/api/hr/employees/${employeeId}/convert-to-fin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finCode: fin }),
    });
    setConvertBusy(false);
    if (!res.ok) {
      toast.error(t("employees.convertToFinErr"), {
        description: await res.text(),
      });
      return;
    }
    toast.success(t("employees.convertToFinOk"));
    onSaved();
    await loadEmployee();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !token || busy) return;
    if (!startDate || salary === "" || !positionId) {
      toast.error(t("employees.fillRequired"));
      return;
    }
    if (kind === "CONTRACTOR" && !/^\d{10}$/.test(voen.trim())) {
      toast.error(t("counterparties.taxInvalid"));
      return;
    }
    const sal = Number(String(salary).replace(",", "."));
    if (!Number.isFinite(sal) || sal < 0) {
      toast.error(t("employees.fillRequired"));
      return;
    }

    const body: Record<string, unknown> = {
      kind,
      positionId,
      startDate,
      salary: sal,
    };
    if (canEditInternalRate) {
      if (internalRate.trim() !== "") {
        const ir = Number(String(internalRate).replace(",", "."));
        if (!Number.isFinite(ir) || ir < 0) {
          toast.error(t("employees.fillRequired"));
          return;
        }
        body.internalRate = ir;
      } else {
        body.internalRate = null;
      }
    }
    if (kind === "CONTRACTOR") {
      body.voen = voen.trim();
      body.contractorMonthlySocialAzn =
        contractorSocial === "" ? null : Number(String(contractorSocial).replace(",", "."));
    } else {
      body.voen = null;
      body.contractorMonthlySocialAzn = null;
    }

    if (middleName.trim()) {
      body.middleName = middleName.trim();
    }

    setBusy(true);
    const res = await apiFetch(`/api/hr/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const raw = await res.text();
      try {
        const j = JSON.parse(raw) as { code?: string };
        if (j.code === "QUOTA_EXCEEDED") {
          toast.error(t("employees.staffLimitExceeded", { defaultValue: "Штатный лимит исчерпан" }));
          return;
        }
      } catch {
        /* ignore */
      }
      toast.error(t("common.saveErr"), { description: raw });
      return;
    }
    toast.success(t("common.save"));
    onSaved();
    onClose();
  }

  if (!open || !employeeId) return null;

  const tabBtn = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-[13px] font-medium ${
      active
        ? "border-[#2980B9] bg-white text-[#34495E]"
        : "border-transparent text-[#7F8C8D] hover:border-[#D5DADF]"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-2xl`} role="dialog" aria-modal="true">
        <header className="flex shrink-0 items-start justify-between gap-3">
          <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">{title}</h3>
          <Button type="button" variant="ghost" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </header>

        <div className="mt-4 flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => setTab("form")} className={tabBtn(tab === "form")}>
            {t("employees.editTabForm")}
          </button>
          <button type="button" onClick={() => setTab("history")} className={tabBtn(tab === "history")}>
            {t("employees.editTabHistory")}
          </button>
        </div>

        {loadErr ? <p className="mb-0 mt-4 text-[13px] text-red-600">{loadErr}</p> : null}
        {loading ? <p className="mb-0 mt-4 text-[13px] text-[#7F8C8D]">{t("common.loading")}</p> : null}

        {tab === "history" && token ? (
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <EntityAuditHistory entityType="Employee" entityId={employeeId} token={token} />
          </div>
        ) : (
          <form className="mt-4 flex min-h-0 flex-1 flex-col" onSubmit={(e) => void onSubmit(e)}>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                {t("employees.personMdmBanner", {
                  defaultValue: "Personal data lives in MDM; edit payroll fields only.",
                })}
              </p>
              {cpEmploymentId ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                  <p className="m-0 text-[13px] font-semibold text-amber-950">
                    {t("employees.terminateInCp", "Terminate in Control Plane")}
                  </p>
                  <p className="m-0 text-[12px] text-amber-900">
                    {t(
                      "employees.terminateInCpHint",
                      "Saving or deleting here updates the Finance payroll mirror only — labor termination and ƏMAS compliance happen in Control Plane Workforce.",
                    )}
                  </p>
                  <a
                    href={cpTerminateUrl(cpEmploymentId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex"
                  >
                    <Button type="button" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS}>
                      {t("employees.terminateInCp", "Terminate in Control Plane")}
                    </Button>
                  </a>
                </div>
              ) : null}
              {needsFin ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                  <p className="m-0 text-[13px] font-semibold text-amber-950">
                    {t("employees.convertToFinTitle")}
                  </p>
                  <p className="m-0 text-[12px] text-amber-900">
                    {emasMode === "FULL"
                      ? t("employees.convertToFinFullHint")
                      : t("employees.convertToFinHint")}
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className={`${MODAL_FIELD_LABEL_CLASS} min-w-[10rem] flex-1`}>
                      {t("employees.fin")}
                      <input
                        className={`mt-1 block w-full ${MODAL_INPUT_CLASS} font-mono uppercase`}
                        value={convertFin}
                        maxLength={7}
                        onChange={(e) => setConvertFin(normalizeFinInput(e.target.value))}
                        placeholder="XXXXXXX"
                      />
                    </label>
                    <Button
                      type="button"
                      variant="primary"
                      className={MODAL_FOOTER_BUTTON_CLASS}
                      disabled={convertBusy}
                      onClick={() => void onConvertToFin()}
                    >
                      {convertBusy ? "…" : t("employees.convertToFinBtn")}
                    </Button>
                  </div>
                </div>
              ) : null}
              {salaryMissing ? (
                <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  {t("employees.salaryZeroCardWarning")}
                </p>
              ) : null}
              <div className="rounded-lg border border-[#D5DADF] bg-[#F8FAFB] p-3 text-[13px] text-[#34495E] space-y-1">
                <div>
                  <span className="text-[#7F8C8D]">{t("employees.thName")}: </span>
                  {personDisplay?.accessDenied
                    ? t("employees.accessDenied", { defaultValue: "Access restricted" })
                    : personDisplay?.displayName ?? "—"}
                </div>
                <div>
                  <span className="text-[#7F8C8D]">{t("employees.thFin")}: </span>
                  <span className="font-mono">{personDisplay?.finMasked ?? "—"}</span>
                </div>
                {globalPersonId ? (
                  <div className="font-mono text-[11px] text-[#7F8C8D]">{globalPersonId}</div>
                ) : (
                  <span className="text-[11px] text-amber-700">{t("employees.mdmMissing", { defaultValue: "MDM not linked" })}</span>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
                  {t("employees.middleName", { defaultValue: "Ata adı (MDM)" })}
                  <input
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder={t("employees.middleNameOptional", {
                      defaultValue: "Optional — updates MDM middle name",
                    })}
                  />
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("employees.kind")}
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as "EMPLOYEE" | "CONTRACTOR")}
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                  >
                    <option value="EMPLOYEE">{t("employees.kindEmployee")}</option>
                    <option value="CONTRACTOR">{t("employees.kindContractor")}</option>
                  </select>
                </label>
                {kind === "CONTRACTOR" ? (
                  <>
                    <label className={MODAL_FIELD_LABEL_CLASS}>
                      {t("employees.voen")}
                      <input
                        value={voen}
                        maxLength={10}
                        onChange={(e) => setVoen(e.target.value.replace(/\D/g, ""))}
                        className={`mt-1 block w-full ${MODAL_INPUT_CLASS} font-mono tabular-nums`}
                      />
                    </label>
                    <label className={MODAL_FIELD_LABEL_CLASS}>
                      {t("employees.contractorSocial")}
                      <input
                        type="number"
                        step="0.01"
                        value={contractorSocial}
                        onChange={(e) => setContractorSocial(e.target.value)}
                        className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                      />
                    </label>
                  </>
                ) : null}
                <label className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
                  {t("employees.jobPositionSelect")}
                  <select
                    value={positionId}
                    onChange={(e) => setPositionId(e.target.value)}
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                  >
                    {positions.length === 0 ? <option value="">{t("common.loading")}</option> : null}
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.department.name} — {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("employees.startDate")}
                  <input
                    type="date"
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("employees.salaryGross")}
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                  />
                </label>
                {canEditInternalRate ? (
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("employees.internalRate")}
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                      value={internalRate}
                      onChange={(e) => setInternalRate(e.target.value)}
                    />
                    <p className="mb-0 mt-1 text-[11px] leading-snug text-[#7F8C8D]">
                      {t("employees.internalRateHint")}
                    </p>
                  </label>
                ) : null}
                {kind === "EMPLOYEE" && !loading ? (
                  <div className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
                    <span className="text-[#34495E]">{t("employees.vacationDaysAvailable")}</span>
                    <div
                      className="mt-1 w-full rounded-lg border border-[#D5DADF] bg-[#F4F5F7] px-3 py-2 text-[13px] font-medium tabular-nums text-[#34495E]"
                      aria-readonly
                    >
                      {vacationBalanceLabel}
                    </div>
                    <p className="mb-0 mt-1 text-[11px] leading-snug text-[#7F8C8D]">
                      {t("employees.vacationDaysAvailableHint")}
                    </p>
                  </div>
                ) : null}
              </div>
              <EmasS2sPanel employeeId={employeeId} open={open} />
            </div>

            <div className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="outline"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={onClose}
                disabled={busy}
              >
                {t("employees.cancel")}
              </Button>
              <Button type="submit" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} disabled={busy}>
                {busy ? "…" : t("employees.save")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
