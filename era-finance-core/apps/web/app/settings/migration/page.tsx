"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, Upload, X } from "lucide-react";
import { CP_PERMISSION } from "@era/contracts";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";
import { PageHeader } from "../../../components/layout/page-header";
import { DatePicker } from "../../../components/ui/date-picker";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { apiFetch } from "../../../lib/api-client";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  LINK_ACCENT_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useOrgPermissions } from "../../../lib/use-org-permissions";
import { useRequireAuth } from "../../../lib/use-require-auth";

type KindDef = {
  id: string;
  master: boolean;
  titleKey: string;
  subtitleKey: string;
  badge?: "partial" | "evidence";
};

const MASTER_KINDS: KindDef[] = [
  {
    id: "counterparties",
    master: true,
    titleKey: "migrationMachine.kinds.counterparties",
    subtitleKey: "migrationMachine.kinds.counterpartiesHint",
  },
  {
    id: "products",
    master: true,
    titleKey: "migrationMachine.kinds.products",
    subtitleKey: "migrationMachine.kinds.productsHint",
  },
  {
    id: "warehouses",
    master: true,
    titleKey: "migrationMachine.kinds.warehouses",
    subtitleKey: "migrationMachine.kinds.warehousesHint",
  },
  {
    id: "recipes",
    master: true,
    titleKey: "migrationMachine.kinds.recipes",
    subtitleKey: "migrationMachine.kinds.recipesHint",
  },
];

const DRAFT_KINDS: KindDef[] = [
  {
    id: "cash-bank",
    master: false,
    titleKey: "migrationMachine.kinds.cashBank",
    subtitleKey: "migrationMachine.kinds.cashBankHint",
  },
  {
    id: "stock",
    master: false,
    titleKey: "migrationMachine.kinds.stock",
    subtitleKey: "migrationMachine.kinds.stockHint",
  },
  {
    id: "capital",
    master: false,
    titleKey: "migrationMachine.kinds.capital",
    subtitleKey: "migrationMachine.kinds.capitalHint",
  },
  {
    id: "open-items",
    master: false,
    titleKey: "migrationMachine.kinds.openItems",
    subtitleKey: "migrationMachine.kinds.openItemsHint",
  },
  {
    id: "advances",
    master: false,
    titleKey: "migrationMachine.kinds.advances",
    subtitleKey: "migrationMachine.kinds.advancesHint",
    badge: "partial",
  },
  {
    id: "hr-balances",
    master: false,
    titleKey: "migrationMachine.kinds.hrBalances",
    subtitleKey: "migrationMachine.kinds.hrBalancesHint",
  },
  {
    id: "payroll-liabilities",
    master: false,
    titleKey: "migrationMachine.kinds.payrollLiabilities",
    subtitleKey: "migrationMachine.kinds.payrollLiabilitiesHint",
  },
  {
    id: "fixed-assets",
    master: false,
    titleKey: "migrationMachine.kinds.fixedAssets",
    subtitleKey: "migrationMachine.kinds.fixedAssetsHint",
  },
  {
    id: "vat-register",
    master: false,
    titleKey: "migrationMachine.kinds.vatRegister",
    subtitleKey: "migrationMachine.kinds.vatRegisterHint",
    badge: "evidence",
  },
];

type DraftStatus = {
  id: string;
  kind: string;
  createdCount: number;
  errorCount: number;
  updatedAt: string;
};

type StatusPayload = {
  cutoverDate: string | null;
  assembledAt: string | null;
  drafts: DraftStatus[];
  logs: Array<{
    id: string;
    kind: string;
    createdCount: number;
    errorCount: number;
    createdAt: string;
    fileName: string | null;
  }>;
  checklist: {
    hasTaxId: boolean;
    hasBankAccount: boolean;
    hasCutoverDate: boolean;
    assembled: boolean;
  };
};

type Issue = {
  severity: "red" | "yellow";
  code: string;
  message: string;
  kind?: string;
  row?: number;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function downloadBase64Xlsx(base64: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ChecklistStatus({ ok, readyLabel, missingLabel }: {
  ok: boolean;
  readyLabel: string;
  missingLabel: string;
}) {
  return (
    <Badge variant={ok ? "success" : "neutral"}>
      {ok ? readyLabel : missingLabel}
    </Badge>
  );
}

export default function MigrationSettingsPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();
  const perms = useOrgPermissions();
  const canUse =
    perms.can(CP_PERMISSION.API_MIGRATION_UPLOAD) ||
    perms.can(CP_PERMISSION.API_MIGRATION_ASSEMBLE);

  const cutoverRef = useRef<HTMLDivElement | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const confirmPanelRef = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [cutoverInput, setCutoverInput] = useState("");
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [validateOk, setValidateOk] = useState<boolean | null>(null);
  const [trial000, setTrial000] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [workforceErrors, setWorkforceErrors] = useState<string[]>([]);

  const closeConfirm = useCallback(() => setConfirmOpen(false), []);

  const draftByKind = useMemo(() => {
    const map = new Map<string, DraftStatus>();
    for (const d of status?.drafts ?? []) map.set(d.kind, d);
    return map;
  }, [status?.drafts]);

  const lastLogByKind = useMemo(() => {
    const map = new Map<string, StatusPayload["logs"][number]>();
    for (const log of status?.logs ?? []) {
      if (!map.has(log.kind)) map.set(log.kind, log);
    }
    return map;
  }, [status?.logs]);

  const draftLineCount = useMemo(
    () =>
      (status?.drafts ?? []).reduce(
        (sum, d) => sum + (d.createdCount || 0),
        0,
      ),
    [status?.drafts],
  );

  const loadStatus = useCallback(async () => {
    const res = await apiFetch("/api/migration/status");
    if (!res.ok) {
      toast.error(t("migrationMachine.errors.status", { code: res.status }));
      return;
    }
    const data = (await res.json()) as StatusPayload;
    setStatus(data);
    setCutoverInput(data.cutoverDate ?? "");
  }, [t]);

  useEffect(() => {
    if (!ready || !token || !canUse) return;
    void loadStatus();
  }, [ready, token, canUse, loadStatus]);

  useEffect(() => {
    if (!confirmOpen) return;
    const panel = confirmPanelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () => {
      if (!panel) return [] as HTMLElement[];
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
    };

    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeConfirm();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusables();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [confirmOpen, closeConfirm]);

  async function downloadTemplate(kind: string) {
    const res = await apiFetch(`/api/migration/templates/${kind}.xlsx`);
    if (!res.ok) {
      toast.error(t("migrationMachine.errors.template"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration-${kind}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadKind(kind: string, file: File) {
    setBusyKind(kind);
    setValidateOk(null);
    setTrial000(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await apiFetch(`/api/migration/uploads/${kind}`, {
        method: "POST",
        body,
      });
      const data = (await res.json().catch(() => ({}))) as {
        created?: number;
        errors?: number;
        errorFileBase64?: string;
        message?: string;
      };
      if (!res.ok) {
        toast.error(data.message ?? t("migrationMachine.errors.upload"));
        return;
      }
      toast.success(
        t("migrationMachine.uploadDone", {
          created: data.created ?? 0,
          errors: data.errors ?? 0,
        }),
      );
      if (data.errorFileBase64) {
        downloadBase64Xlsx(data.errorFileBase64, `migration-${kind}-errors.xlsx`);
      }
      await loadStatus();
    } finally {
      setBusyKind(null);
    }
  }

  async function saveCutover() {
    const res = await apiFetch("/api/migration/cutover-date", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cutoverDate: cutoverInput }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("migrationMachine.cutoverSaved"));
    setValidateOk(null);
    await loadStatus();
  }

  async function runValidate() {
    const res = await apiFetch("/api/migration/validate", { method: "POST" });
    const data = (await res.json()) as {
      ok?: boolean;
      issues?: Issue[];
      trial000?: string;
    };
    setIssues(data.issues ?? []);
    setTrial000(data.trial000 ?? null);
    setValidateOk(Boolean(data.ok));
    if (data.ok) toast.success(t("migrationMachine.validateOk"));
    else toast.error(t("migrationMachine.validateFail"));
  }

  async function runAssemble() {
    setBusyKind("assemble");
    setConfirmOpen(false);
    try {
      const res = await apiFetch("/api/migration/assemble", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        posted?: number;
        message?: string;
        issues?: Issue[];
      };
      if (!res.ok) {
        if (data.issues) setIssues(data.issues);
        toast.error(data.message ?? t("migrationMachine.errors.assemble"));
        return;
      }
      toast.success(t("migrationMachine.assembleDone", { posted: data.posted ?? 0 }));
      setValidateOk(true);
      await loadStatus();
    } finally {
      setBusyKind(null);
    }
  }

  async function pullWorkforce() {
    setBusyKind("workforce");
    try {
      const res = await apiFetch("/api/migration/workforce/pull", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        pulled?: number;
        skipped?: number;
        errors?: string[];
        message?: string;
      };
      if (!res.ok) {
        toast.error(data.message ?? t("migrationMachine.errors.workforce"));
        return;
      }
      toast.success(
        t("migrationMachine.workforceDone", {
          pulled: data.pulled ?? 0,
          skipped: data.skipped ?? 0,
        }),
      );
      setWorkforceErrors(data.errors ?? []);
    } finally {
      setBusyKind(null);
    }
  }

  function tile(kind: KindDef) {
    const lockedDraft = Boolean(status?.assembledAt) && !kind.master;
    const draft = draftByKind.get(kind.id);
    const log = lastLogByKind.get(kind.id);
    const staged = Boolean(draft && draft.createdCount > 0);
    const empty = !draft && !log;
    return (
      <div key={kind.id} className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[#34495E] m-0">{t(kind.titleKey)}</h3>
            {kind.badge === "partial" ? (
              <Badge variant="accountant">{t("migrationMachine.badgePartial")}</Badge>
            ) : null}
            {kind.badge === "evidence" ? (
              <Badge variant="neutral">{t("migrationMachine.badgeEvidence")}</Badge>
            ) : null}
          </div>
          <p className="text-sm text-[#7F8C8D] mt-1">{t(kind.subtitleKey)}</p>
          <p className="text-xs text-[#7F8C8D] mt-1">
            {lockedDraft
              ? t("migrationMachine.tileLocked")
              : staged
                ? t("migrationMachine.tileStaged", {
                    created: draft?.createdCount ?? 0,
                    errors: draft?.errorCount ?? 0,
                  })
                : empty
                  ? t("migrationMachine.tileEmpty")
                  : t("migrationMachine.tileUploaded", {
                      created: log?.createdCount ?? 0,
                      errors: log?.errorCount ?? 0,
                    })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void downloadTemplate(kind.id)}
            disabled={busyKind !== null}
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("migrationMachine.downloadTemplate")}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={lockedDraft || busyKind !== null}
            aria-label={t("migrationMachine.upload")}
            onClick={() => fileRefs.current[kind.id]?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {busyKind === kind.id ? t("common.loading") : t("migrationMachine.upload")}
          </Button>
          <input
            ref={(el) => {
              fileRefs.current[kind.id] = el;
            }}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={lockedDraft || busyKind !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadKind(kind.id, f);
            }}
          />
        </div>
        {lockedDraft ? (
          <p className="text-xs text-[#7F8C8D]">{t("migrationMachine.draftLocked")}</p>
        ) : null}
      </div>
    );
  }

  const redIssues = issues.filter((i) => i.severity === "red");
  const yellowIssues = issues.filter((i) => i.severity === "yellow");
  const cutoverDirty = cutoverInput !== (status?.cutoverDate ?? "");
  const assembleBlocked =
    busyKind !== null ||
    Boolean(status?.assembledAt) ||
    validateOk !== true ||
    redIssues.length > 0 ||
    cutoverDirty ||
    !status?.checklist.hasCutoverDate;

  const readyLabel = t("migrationMachine.check.ready");
  const missingLabel = t("migrationMachine.check.missing");

  if (!ready || !token) {
    return <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>;
  }

  if (!canUse) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t("migrationMachine.title")}
          subtitle={t("migrationMachine.noAccess")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("migrationMachine.title")}
        subtitle={t("migrationMachine.subtitle")}
      />

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-lg font-semibold text-[#34495E] m-0">
          {t("migrationMachine.checklistTitle")}
        </h2>
        <ul className="text-sm text-[#34495E] space-y-2 list-none p-0 m-0">
          <li className="flex flex-wrap items-center gap-2">
            <span>{t("migrationMachine.check.voen")}</span>
            <ChecklistStatus
              ok={Boolean(status?.checklist.hasTaxId)}
              readyLabel={readyLabel}
              missingLabel={missingLabel}
            />
            {!status?.checklist.hasTaxId ? (
              <Link href="/settings/organization" className={`${LINK_ACCENT_CLASS} text-sm`}>
                {t("migrationMachine.check.fixVoen")}
              </Link>
            ) : null}
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span>{t("migrationMachine.check.bank")}</span>
            <ChecklistStatus
              ok={Boolean(status?.checklist.hasBankAccount)}
              readyLabel={readyLabel}
              missingLabel={missingLabel}
            />
            {!status?.checklist.hasBankAccount ? (
              <Link href="/settings/bank-accounts" className={`${LINK_ACCENT_CLASS} text-sm`}>
                {t("migrationMachine.check.fixBank")}
              </Link>
            ) : null}
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span>{t("migrationMachine.check.cutover")}</span>
            <ChecklistStatus
              ok={Boolean(status?.checklist.hasCutoverDate)}
              readyLabel={readyLabel}
              missingLabel={missingLabel}
            />
            {!status?.checklist.hasCutoverDate ? (
              <Button
                type="button"
                variant="ghost"
                className={`${LINK_ACCENT_CLASS} !h-auto !min-h-0 !px-0 !shadow-none underline`}
                onClick={() => cutoverRef.current?.scrollIntoView({ behavior: "smooth" })}
              >
                {t("migrationMachine.check.setCutover")}
              </Button>
            ) : null}
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#34495E]">
          {t("migrationMachine.mastersTitle")}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{MASTER_KINDS.map(tile)}</div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#34495E] m-0">
            {t("migrationMachine.draftsTitle")}
          </h2>
          <Button
            type="button"
            variant="secondary"
            disabled={busyKind !== null || Boolean(status?.assembledAt)}
            onClick={() => void pullWorkforce()}
          >
            {busyKind === "workforce"
              ? t("common.loading")
              : t("migrationMachine.pullWorkforce")}
          </Button>
        </div>
        <p className="text-sm text-[#7F8C8D] m-0">{t("migrationMachine.hrPullHint")}</p>
        {workforceErrors.length > 0 ? (
          <ul className="text-sm text-amber-800 space-y-1 m-0 pl-5">
            {workforceErrors.slice(0, 8).map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{DRAFT_KINDS.map(tile)}</div>
      </section>

      <section ref={cutoverRef} className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <h2 className="text-lg font-semibold text-[#34495E]">
          {t("migrationMachine.assembleTitle")}
        </h2>
        <p className="text-sm text-[#7F8C8D]">{t("migrationMachine.assembleHint")}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem]">
            <label className="block text-sm text-[#34495E] mb-1">
              {t("migrationMachine.cutoverDate")}
            </label>
            <DatePicker
              respectPeriodLock={false}
              triggerClassName={`block w-full max-w-xs ${INPUT_BORDERED_CLASS}`}
              value={cutoverInput}
              onChange={(next) => {
                setCutoverInput(next);
                setValidateOk(null);
              }}
              disabled={Boolean(status?.assembledAt)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={Boolean(status?.assembledAt) || !cutoverInput || !cutoverDirty}
            onClick={() => void saveCutover()}
          >
            {t("migrationMachine.saveCutover")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busyKind !== null || cutoverDirty || !status?.checklist.hasCutoverDate}
            onClick={() => void runValidate()}
          >
            {t("migrationMachine.validate")}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={assembleBlocked}
            onClick={() => setConfirmOpen(true)}
          >
            {busyKind === "assemble"
              ? t("common.loading")
              : t("migrationMachine.assemble")}
          </Button>
        </div>
        {trial000 != null ? (
          <p className="text-sm text-[#34495E]">
            {t("migrationMachine.trial000", { amount: trial000 })}
            {Math.abs(Number(trial000)) >= 0.01 ? (
              <span className="text-amber-800"> {t("migrationMachine.trial000Hint")}</span>
            ) : null}
          </p>
        ) : null}
        {status?.assembledAt ? (
          <p className="text-sm text-emerald-700">
            {t("migrationMachine.assembledAt", {
              at: bakuDateTimeDisplay(status.assembledAt),
            })}
          </p>
        ) : null}
        {issues.length > 0 ? (
          <div className="rounded border border-[#D5DADF] p-3 space-y-2 max-h-64 overflow-auto">
            <p className="text-sm font-medium text-[#34495E] m-0">
              {t("migrationMachine.issuesTitle", {
                red: redIssues.length,
                yellow: yellowIssues.length,
              })}
            </p>
            {redIssues.map((issue, idx) => (
              <p key={`r-${issue.code}-${idx}`} className="text-sm text-red-700 m-0">
                {issue.message}
                {issue.kind ? ` (${issue.kind}` : ""}
                {issue.row ? ` #${issue.row}` : ""}
                {issue.kind ? ")" : ""}
              </p>
            ))}
            {yellowIssues.map((issue, idx) => (
              <p key={`y-${issue.code}-${idx}`} className="text-sm text-amber-700 m-0">
                {issue.message}
                {issue.kind ? ` (${issue.kind}` : ""}
                {issue.row ? ` #${issue.row}` : ""}
                {issue.kind ? ")" : ""}
              </p>
            ))}
          </div>
        ) : null}
      </section>

      {status?.logs?.length ? (
        <section className={`${CARD_CONTAINER_CLASS} p-4 space-y-2`}>
          <h2 className="font-semibold text-[#34495E]">
            {t("migrationMachine.logTitle")}
          </h2>
          <ul className="text-sm text-[#34495E] space-y-1">
            {status.logs.map((log) => (
              <li key={log.id}>
                {bakuDateTimeDisplay(log.createdAt)} · {log.kind} · +
                {log.createdCount} / err {log.errorCount}
                {log.fileName ? ` · ${log.fileName}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeConfirm();
          }}
        >
          <div
            ref={confirmPanelRef}
            className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="migration-assemble-confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h3
                id="migration-assemble-confirm-title"
                className="m-0 text-lg font-semibold leading-snug text-[#34495E]"
              >
                {t("migrationMachine.confirmTitle")}
              </h3>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={closeConfirm}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </header>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
              <p className="text-sm text-[#34495E] m-0">
                {t("migrationMachine.confirmBody", {
                  cutover: status?.cutoverDate || "—",
                  batches: status?.drafts?.length ?? 0,
                  lines: draftLineCount,
                })}
              </p>
              {cutoverDirty ? (
                <p className="text-sm text-amber-800 m-0">
                  {t("migrationMachine.cutoverDirty")}
                </p>
              ) : null}
              <p className="text-sm text-amber-800 m-0">
                {t("migrationMachine.confirmIrreversible")}
              </p>
            </div>
            <footer className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="secondary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={closeConfirm}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={busyKind !== null || cutoverDirty}
                onClick={() => void runAssemble()}
              >
                {t("migrationMachine.confirmAssemble")}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
