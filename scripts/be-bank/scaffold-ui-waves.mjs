import fs from "fs";
import path from "path";

const bank = "d:/My Projects/era-ecosystem/era-bank";
const w = (rel, content) => {
  const p = path.join(bank, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};

const proxy = (prefix, mod) => `import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "${prefix}",
  entitlementModule: "${mod}",
  logAction: "${prefix.toUpperCase()}_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
`;

for (const [area, mod] of [
  ["cash", "banking_cash"],
  ["fees", "banking_core"],
  ["collections", "banking_collections"],
  ["trade", "banking_trade"],
  ["islamic", "banking_islamic"],
  ["wealth", "banking_wealth"],
]) {
  w(`app/api/${area}/[[...path]]/route.ts`, proxy(area, mod));
}

function simplePage({
  ns,
  apiList,
  apiCreate,
  colKeys,
  fields,
  extraAction,
}) {
  const colRenders = colKeys
    .map((c) => {
      if (c === "status") {
        return `          {
            key: "status",
            header: t("colStatus"),
            render: (r: Row) => <StatusBadge status={String(r.status ?? "")} />,
          }`;
      }
      if (c === "id") {
        return `          {
            key: "id",
            header: t("colId"),
            render: (r: Row) => String(r.id ?? "").slice(0, 8),
          }`;
      }
      return `          {
            key: "${c}",
            header: t("col${c[0].toUpperCase()}${c.slice(1)}"),
            render: (r: Row) => String(r.${c} ?? ""),
          }`;
    })
    .join(",\n");

  const fieldJsx = fields
    .map(
      (f) =>
        `          <Field name="${f.name}" label={t("${f.name}")} preset="${f.preset}" ${f.required ? "required" : ""} ${f.defaultValue ? `defaultValue="${f.defaultValue}"` : ""} />`,
    )
    .join("\n");

  return `"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { OpsModalShell, useOpsModal } from "@/components/ops";
import { StatusBadge } from "@/components/ops-ui";

type Row = Record<string, unknown>;

export default function Page() {
  const t = useTranslations("${ns}");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("${apiList}", { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const [k, v] of form.entries()) body[k] = String(v);
    if (!body.idempotencyKey) body.idempotencyKey = \`ui-\${Date.now()}\`;
    try {
      const res = await fetch("${apiCreate}", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        showApiError(tCommon("error"));
        return;
      }
      close();
      await load();
    } catch {
      showApiError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => open("create")}>
            {t("create")}
          </button>
        }
      />
      <BankDataGrid
        rows={rows}
        loading={loading}
        emptyMessage={tCommon("empty")}
        columns={[
${colRenders}${extraAction ? `,\n${extraAction}` : ""}
        ]}
      />
      <OpsModalShell open={mode === "create"} onClose={close} title={t("createTitle")}>
        <form className="space-y-3" onSubmit={onCreate}>
${fieldJsx}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={close}>
              {tCommon("cancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {tCommon("save")}
            </button>
          </div>
        </form>
      </OpsModalShell>
    </div>
  );
}
`;
}

w(
  "app/cash/page.tsx",
  simplePage({
    ns: "pages.cash",
    apiList: "/api/cash/movements",
    apiCreate: "/api/cash/movements",
    colKeys: ["id", "kind", "amountMinor", "status"],
    fields: [
      { name: "branchId", preset: "code", required: true },
      { name: "kind", preset: "code", required: true, defaultValue: "TILL_TO_VAULT" },
      { name: "amountMinor", preset: "code", required: true },
      { name: "idempotencyKey", preset: "code" },
      { name: "reference", preset: "shortText" },
    ],
    extraAction: `          {
            key: "actions",
            header: tCommon("actions"),
            render: (r: Row) =>
              r.status === "DRAFT" ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    void fetch(\`/api/cash/movements/\${String(r.id)}/post\`, { method: "POST" }).then(() => load());
                  }}
                >
                  {t("post")}
                </button>
              ) : null,
          }`,
  }),
);

w(
  "app/fees/page.tsx",
  simplePage({
    ns: "pages.fees",
    apiList: "/api/fees/tariffs",
    apiCreate: "/api/fees/tariffs",
    colKeys: ["code", "name", "amountMinor", "status"],
    fields: [
      { name: "code", preset: "code", required: true },
      { name: "name", preset: "shortText", required: true },
      { name: "amountMinor", preset: "code", required: true },
      { name: "currency", preset: "code", defaultValue: "AZN" },
    ],
  }),
);

w(
  "app/collections/page.tsx",
  simplePage({
    ns: "pages.collections",
    apiList: "/api/collections/cases",
    apiCreate: "/api/collections/cases",
    colKeys: ["id", "loanId", "outstandingMinor", "status"],
    fields: [
      { name: "loanId", preset: "code", required: true },
      { name: "customerId", preset: "code", required: true },
      { name: "outstandingMinor", preset: "code", required: true },
    ],
  }),
);

w(
  "app/trade/page.tsx",
  simplePage({
    ns: "pages.trade",
    apiList: "/api/trade/lc",
    apiCreate: "/api/trade/lc",
    colKeys: ["id", "reference", "amountMinor", "status"],
    fields: [
      { name: "customerId", preset: "code", required: true },
      { name: "reference", preset: "code", required: true },
      { name: "amountMinor", preset: "code", required: true },
      { name: "direction", preset: "code", defaultValue: "IMPORT" },
      { name: "beneficiaryName", preset: "shortText" },
    ],
    extraAction: `          {
            key: "actions",
            header: tCommon("actions"),
            render: (r: Row) =>
              r.status === "DRAFT" ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    void fetch(\`/api/trade/lc/\${String(r.id)}/issue\`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        branchId: "HQ",
                        idempotencyKey: \`lc-issue-\${Date.now()}\`,
                      }),
                    }).then(() => load());
                  }}
                >
                  {t("issue")}
                </button>
              ) : null,
          }`,
  }),
);

w(
  "app/islamic/page.tsx",
  simplePage({
    ns: "pages.islamic",
    apiList: "/api/islamic/contracts",
    apiCreate: "/api/islamic/contracts",
    colKeys: ["id", "kind", "principalMinor", "status"],
    fields: [
      { name: "customerId", preset: "code", required: true },
      { name: "productTemplateId", preset: "code", required: true },
      { name: "kind", preset: "code", required: true, defaultValue: "MURABAHA" },
      { name: "principalMinor", preset: "code", required: true },
    ],
    extraAction: `          {
            key: "actions",
            header: tCommon("actions"),
            render: (r: Row) =>
              r.status === "DRAFT" ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    void fetch(\`/api/islamic/contracts/\${String(r.id)}/activate\`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        branchId: "HQ",
                        idempotencyKey: \`isl-\${Date.now()}\`,
                      }),
                    }).then(() => load());
                  }}
                >
                  {t("activate")}
                </button>
              ) : null,
          }`,
  }),
);

w(
  "app/wealth/page.tsx",
  simplePage({
    ns: "pages.wealth",
    apiList: "/api/wealth/safekeeping",
    apiCreate: "/api/wealth/safekeeping",
    colKeys: ["id", "accountNo", "customerId", "currency"],
    fields: [
      { name: "customerId", preset: "code", required: true },
      { name: "accountNo", preset: "code", required: true },
      { name: "currency", preset: "code", defaultValue: "AZN" },
    ],
  }),
);

// Payments extras page
w(
  "app/payments/extras/page.tsx",
  `"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { OpsModalShell, useOpsModal } from "@/components/ops";
import { StatusBadge } from "@/components/ops-ui";

type Row = Record<string, unknown>;
type Tab = "so" | "va" | "cheques" | "sweep";

export default function PaymentsExtrasPage() {
  const t = useTranslations("pages.paymentsExtras");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [tab, setTab] = useState<Tab>("so");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const endpoint =
    tab === "so"
      ? "/api/payments/standing-orders"
      : tab === "va"
        ? "/api/payments/virtual-accounts"
        : tab === "cheques"
          ? "/api/payments/cheques"
          : "/api/payments/sweep-rules";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      setRows(await res.json());
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const [k, v] of form.entries()) body[k] = String(v);
    if (!body.idempotencyKey) body.idempotencyKey = \`ui-so-\${Date.now()}\`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        showApiError(tCommon("error"));
        return;
      }
      close();
      await load();
    } catch {
      showApiError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => open("create")}>
            {t("create")}
          </button>
        }
      />
      <div className="flex gap-2">
        {(["so", "va", "cheques", "sweep"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            className={tab === k ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(k)}
          >
            {t(\`tab_\${k}\`)}
          </button>
        ))}
      </div>
      <BankDataGrid
        rows={rows}
        loading={loading}
        emptyMessage={tCommon("empty")}
        columns={[
          {
            key: "id",
            header: t("colId"),
            render: (r: Row) => String(r.id ?? "").slice(0, 8),
          },
          {
            key: "status",
            header: t("colStatus"),
            render: (r: Row) => <StatusBadge status={String(r.status ?? "")} />,
          },
          {
            key: "detail",
            header: t("colDetail"),
            render: (r: Row) =>
              String(r.toIban ?? r.virtualIban ?? r.chequeNumber ?? r.masterAccountId ?? ""),
          },
        ]}
      />
      <OpsModalShell open={mode === "create"} onClose={close} title={t("createTitle")}>
        <form className="space-y-3" onSubmit={onCreate}>
          {tab === "so" && (
            <>
              <Field name="customerId" label={t("customerId")} preset="code" required />
              <Field name="fromAccountId" label={t("fromAccountId")} preset="code" required />
              <Field name="toIban" label={t("toIban")} preset="code" required />
              <Field name="amountMinor" label={t("amountMinor")} preset="code" required />
              <Field name="nextRunAt" label={t("nextRunAt")} preset="code" required />
              <Field name="idempotencyKey" label={t("idempotencyKey")} preset="code" />
            </>
          )}
          {tab === "va" && (
            <>
              <Field name="customerId" label={t("customerId")} preset="code" required />
              <Field name="parentAccountId" label={t("parentAccountId")} preset="code" required />
              <Field name="virtualIban" label={t("virtualIban")} preset="code" required />
            </>
          )}
          {tab === "cheques" && (
            <>
              <Field name="accountId" label={t("accountId")} preset="code" required />
              <Field name="chequeNumber" label={t("chequeNumber")} preset="code" required />
              <Field name="amountMinor" label={t("amountMinor")} preset="code" required />
              <Field name="payeeName" label={t("payeeName")} preset="shortText" required />
            </>
          )}
          {tab === "sweep" && (
            <>
              <Field name="masterAccountId" label={t("masterAccountId")} preset="code" required />
              <Field name="childAccountId" label={t("childAccountId")} preset="code" required />
              <Field name="targetMinor" label={t("targetMinor")} preset="code" />
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={close}>
              {tCommon("cancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {tCommon("save")}
            </button>
          </div>
        </form>
      </OpsModalShell>
    </div>
  );
}
`,
);

// Loans deep page
w(
  "app/loans/applications/page.tsx",
  simplePage({
    ns: "pages.loanApps",
    apiList: "/api/loans/applications",
    apiCreate: "/api/loans/applications",
    colKeys: ["id", "customerId", "requestedMinor", "status"],
    fields: [
      { name: "customerId", preset: "code", required: true },
      { name: "productTemplateId", preset: "code", required: true },
      { name: "requestedMinor", preset: "code", required: true },
      { name: "currency", preset: "code", defaultValue: "AZN" },
    ],
  }),
);

w(
  "app/aml/cases/page.tsx",
  simplePage({
    ns: "pages.amlCases",
    apiList: "/api/aml/cases",
    apiCreate: "/api/aml/cases",
    colKeys: ["id", "customerId", "status"],
    fields: [
      { name: "alertId", preset: "code" },
      { name: "customerId", preset: "code" },
    ],
  }),
);

w(
  "app/cards/disputes/page.tsx",
  simplePage({
    ns: "pages.cardDisputes",
    apiList: "/api/cards/disputes/list",
    apiCreate: "/api/cards/disputes",
    colKeys: ["id", "cardTransactionId", "amountMinor", "status"],
    fields: [
      { name: "cardTransactionId", preset: "code", required: true },
      { name: "amountMinor", preset: "code", required: true },
      { name: "reasonCode", preset: "code", required: true },
    ],
  }),
);

console.log("scaffold ui pages done");
