"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field, FieldRow, FieldSelect } from "@era/satellite-kit/ui";
import { apiFetch } from "../../lib/api-client";
import { parsePaginatedList } from "../../lib/paginated-list";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
} from "../../lib/design-system";
import { isValidFinCode, normalizeFinInput } from "../../lib/fin-code";
import { Button } from "../../components/ui/button";

type JobPositionOpt = {
  id: string;
  name: string;
  department: { id: string; name: string };
};

type ResolvedPerson = {
  globalPersonId: string;
  displayName: string | null;
  finMasked: string | null;
  accessDenied: boolean;
};

export function CreateEmployeeModal({
  open,
  onClose,
  onCreated,
  quotaAtLimit,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  quotaAtLimit: boolean;
}) {
  const { t } = useTranslation();
  const [positions, setPositions] = useState<JobPositionOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolveBusy, setResolveBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [kind, setKind] = useState<"EMPLOYEE" | "CONTRACTOR">("EMPLOYEE");
  const [resolveFin, setResolveFin] = useState("");
  const [resolveNameHint, setResolveNameHint] = useState("");
  const [globalPersonId, setGlobalPersonId] = useState("");
  const [resolvedPerson, setResolvedPerson] = useState<ResolvedPerson | null>(null);
  const [voen, setVoen] = useState("");
  const [contractorSocial, setContractorSocial] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [positionId, setPositionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [salary, setSalary] = useState("");

  const title = useMemo(() => t("employees.newTitle"), [t]);

  useEffect(() => {
    if (!open) return;
    setLoadErr(null);
    setLoading(true);
    void (async () => {
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
        setPositionId((prev) =>
          prev && merged.some((x) => x.id === prev) ? prev : merged[0]?.id ?? "",
        );
      } catch {
        setLoadErr(t("employees.loadErr"));
        setPositions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, t]);

  useEffect(() => {
    if (!open) return;
    setKind("EMPLOYEE");
    setResolveFin("");
    setResolveNameHint("");
    setGlobalPersonId("");
    setResolvedPerson(null);
    setVoen("");
    setContractorSocial("");
    setPatronymic("");
    setStartDate("");
    setSalary("");
  }, [open]);

  async function resolvePerson() {
    if (resolveBusy) return;
    if (!isValidFinCode(resolveFin)) {
      toast.error(t("employees.finInvalidStrict"));
      return;
    }
    if (!resolveNameHint.trim()) {
      toast.error(t("employees.resolveNameRequired", { defaultValue: "Enter full name hint for MDM lookup" }));
      return;
    }
    setResolveBusy(true);
    const res = await apiFetch("/api/hr/employees/resolve-person", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fin: resolveFin.trim(),
        fullName: resolveNameHint.trim(),
      }),
    });
    setResolveBusy(false);
    if (!res.ok) {
      toast.error(t("employees.resolveFailed", { defaultValue: "MDM person resolve failed" }));
      return;
    }
    const data = (await res.json()) as {
      globalPersonId: string;
      person: ResolvedPerson;
    };
    setGlobalPersonId(data.globalPersonId);
    setResolvedPerson(data.person);
    toast.success(t("employees.resolveOk", { defaultValue: "Person resolved in MDM" }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (loading) return;
    if (quotaAtLimit) {
      toast.error(t("employees.createEmployeeQuotaFull"));
      return;
    }
    setLoadErr(null);

    if (!globalPersonId || !patronymic.trim() || !startDate || salary === "" || !positionId) {
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
      globalPersonId,
      patronymic: patronymic.trim(),
      positionId,
      startDate,
      hireDate: startDate,
      salary: sal,
    };
    if (kind === "CONTRACTOR") {
      body.voen = voen.trim();
      if (contractorSocial !== "") {
        const s = Number(String(contractorSocial).replace(",", "."));
        if (Number.isFinite(s) && s >= 0) body.contractorMonthlySocialAzn = s;
      }
    }

    setBusy(true);
    const res = await apiFetch("/api/hr/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);

    if (!res.ok) {
      const raw = await res.text();
      try {
        const j = JSON.parse(raw) as { code?: string; message?: unknown };
        if (j.code === "QUOTA_EXCEEDED") {
          toast.error(
            t("employees.staffLimitExceeded", { defaultValue: "Штатный лимит по этой должности исчерпан" }),
          );
          return;
        }
      } catch {
        /* ignore */
      }
      toast.error(t("common.saveErr"), { description: raw });
      return;
    }

    toast.success(t("common.save"));
    onCreated();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-2xl`} role="dialog" aria-modal="true">
        <header className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="m-0 text-lg font-semibold leading-snug text-[#34495E]">{title}</h3>
            <p className="mb-0 mt-1 text-[13px] leading-snug text-[#7F8C8D]">{t("employees.newSection")}</p>
            <p className="mb-0 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              {t("employees.personMdmBanner", {
                defaultValue: "Personal data lives in MDM; this form creates a payroll extension only.",
              })}
            </p>
          </div>
          <Button type="button" variant="ghost" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </header>

        <div className="mt-4 flex min-h-0 flex-1 flex-col space-y-4">
        {loadErr ? <p className="m-0 text-[13px] text-red-600">{loadErr}</p> : null}
        {loading ? <p className="m-0 text-[13px] text-[#7F8C8D]">{t("common.loading")}</p> : null}

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void onSubmit(e)}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div className="rounded-lg border border-[#D5DADF] bg-[#F8FAFB] p-3 space-y-3">
              <p className="m-0 text-[12px] font-semibold text-[#34495E]">
                {t("employees.personSection", { defaultValue: "Person (MDM)" })}
              </p>
              <FieldRow cols={2}>
                <Field
                  label={t("employees.fin")}
                  preset="fin"
                  value={resolveFin}
                  maxLength={7}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  onChange={(e) => setResolveFin(normalizeFinInput(e.target.value))}
                  inputClassName="font-mono uppercase"
                />
                <Field
                  label={t("employees.resolveNameHint", { defaultValue: "Full name (lookup hint)" })}
                  preset="shortText"
                  value={resolveNameHint}
                  onChange={(e) => setResolveNameHint(e.target.value)}
                />
              </FieldRow>
              <Button
                type="button"
                variant="outline"
                disabled={resolveBusy || !resolveFin.trim() || !resolveNameHint.trim()}
                onClick={() => void resolvePerson()}
              >
                {resolveBusy ? "…" : t("employees.resolvePerson", { defaultValue: "Resolve in MDM" })}
              </Button>
              {resolvedPerson ? (
                <div className="text-[13px] text-[#34495E] space-y-1">
                  <div>
                    <span className="text-[#7F8C8D]">{t("employees.thName")}: </span>
                    {resolvedPerson.accessDenied
                      ? t("employees.accessDenied", { defaultValue: "Access restricted" })
                      : resolvedPerson.displayName ?? "—"}
                  </div>
                  <div>
                    <span className="text-[#7F8C8D]">{t("employees.thFin")}: </span>
                    <span className="font-mono">{resolvedPerson.finMasked ?? "—"}</span>
                  </div>
                  <div className="font-mono text-[11px] text-[#7F8C8D]">{globalPersonId}</div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label={t("employees.patronymic")}
                preset="shortText"
                className="md:col-span-2"
                value={patronymic}
                onChange={(e) => setPatronymic(e.target.value)}
              />

              <FieldSelect
                label={t("employees.kind")}
                preset="selectWide"
                value={kind}
                onChange={(e) => setKind(e.target.value as "EMPLOYEE" | "CONTRACTOR")}
              >
                <option value="EMPLOYEE">{t("employees.kindEmployee")}</option>
                <option value="CONTRACTOR">{t("employees.kindContractor")}</option>
              </FieldSelect>

              {kind === "CONTRACTOR" ? (
                <>
                  <Field
                    label={t("employees.voen")}
                    preset="voen"
                    value={voen}
                    maxLength={10}
                    onChange={(e) => setVoen(e.target.value.replace(/\D/g, ""))}
                    inputClassName="font-mono tabular-nums"
                  />
                  <Field
                    label={t("employees.contractorSocial")}
                    preset="amount"
                    type="number"
                    step="0.01"
                    value={contractorSocial}
                    onChange={(e) => setContractorSocial(e.target.value)}
                  />
                </>
              ) : null}

              <FieldSelect
                label={t("employees.jobPositionSelect")}
                preset="selectWide"
                className="md:col-span-2"
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
              >
                {positions.length === 0 ? <option value="">{t("common.loading")}</option> : null}
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.department.name} — {p.name}
                  </option>
                ))}
              </FieldSelect>

              <Field
                label={t("employees.startDate")}
                preset="date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Field
                label={t("employees.salaryGross")}
                preset="amount"
                type="number"
                step="0.01"
                min={0}
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
          </div>

          <div className={MODAL_FOOTER_ACTIONS_CLASS}>
            <Button
              type="button"
              variant="outline"
              className={MODAL_FOOTER_BUTTON_CLASS}
              onClick={onClose}
              disabled={busy}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              className={MODAL_FOOTER_BUTTON_CLASS}
              disabled={busy || !globalPersonId}
            >
              {busy ? "…" : t("employees.save")}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
