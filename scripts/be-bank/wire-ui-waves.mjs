import fs from "fs";
import path from "path";

const root = "d:/My Projects/era-ecosystem";
const bank = path.join(root, "era-bank");
const dbo = path.join(root, "era-bank-dbo");

function read(p) {
  return fs.readFileSync(p, "utf8");
}
function write(p, c) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", path.relative(root, p));
}
function patch(p, find, replace) {
  const s = read(p);
  if (!s.includes(find)) {
    if (s.includes(replace.trim().slice(0, 40))) {
      console.log("skip (already)", path.relative(root, p));
      return;
    }
    throw new Error(`patch miss in ${p}: ${find.slice(0, 80)}`);
  }
  write(p, s.replace(find, replace));
}

// --- nav shell ---
{
  const p = path.join(bank, "src/components/BankOpsShell.tsx");
  let s = read(p);
  if (!s.includes('href: "/cash"')) {
    s = s.replace(
      `section("payments", "sectionPayments", Banknote, [
        { id: "payments", href: "/payments", labelKey: "payments", icon: Banknote },
      ]),`,
      `section("payments", "sectionPayments", Banknote, [
        { id: "payments", href: "/payments", labelKey: "payments", icon: Banknote },
        {
          id: "payments-extras",
          href: "/payments/extras",
          labelKey: "paymentsExtras",
          icon: Banknote,
        },
        { id: "cash", href: "/cash", labelKey: "cash", icon: Banknote },
        { id: "fees", href: "/fees", labelKey: "fees", icon: Banknote },
      ]),`,
    );
    s = s.replace(
      `section("products", "sectionProducts", PiggyBank, [
        { id: "deposits", href: "/deposits", labelKey: "deposits", icon: PiggyBank },
        { id: "loans", href: "/loans", labelKey: "loans", icon: Landmark },
        { id: "cards", href: "/cards", labelKey: "cards", icon: CreditCard },
        {
          id: "card-txns",
          href: "/card-txns",
          labelKey: "cardTxns",
          icon: ArrowLeftRight,
        },
      ]),`,
      `section("products", "sectionProducts", PiggyBank, [
        { id: "deposits", href: "/deposits", labelKey: "deposits", icon: PiggyBank },
        { id: "loans", href: "/loans", labelKey: "loans", icon: Landmark },
        {
          id: "loan-apps",
          href: "/loans/applications",
          labelKey: "loanApps",
          icon: Landmark,
        },
        { id: "collections", href: "/collections", labelKey: "collections", icon: Landmark },
        { id: "trade", href: "/trade", labelKey: "trade", icon: Landmark },
        { id: "islamic", href: "/islamic", labelKey: "islamic", icon: Landmark },
        { id: "wealth", href: "/wealth", labelKey: "wealth", icon: PiggyBank },
        { id: "cards", href: "/cards", labelKey: "cards", icon: CreditCard },
        {
          id: "card-txns",
          href: "/card-txns",
          labelKey: "cardTxns",
          icon: ArrowLeftRight,
        },
        {
          id: "card-disputes",
          href: "/cards/disputes",
          labelKey: "cardDisputes",
          icon: CreditCard,
        },
        {
          id: "card-3ds",
          href: "/cards/3ds",
          labelKey: "card3ds",
          icon: CreditCard,
        },
      ]),`,
    );
    s = s.replace(
      `{
          id: "aml-fmn",
          href: "/aml/reports/fmn",
          labelKey: "amlFmn",
          icon: FileBarChart,
        },
      ]),`,
      `{
          id: "aml-fmn",
          href: "/aml/reports/fmn",
          labelKey: "amlFmn",
          icon: FileBarChart,
        },
        {
          id: "aml-cases",
          href: "/aml/cases",
          labelKey: "amlCases",
          icon: ShieldAlert,
        },
      ]),`,
    );
    write(p, s);
  } else {
    console.log("skip BankOpsShell nav");
  }
}

// --- entitlements ---
{
  const p = path.join(bank, "src/components/ops/useBankEntitlements.ts");
  let s = read(p);
  if (!s.includes('"/cash"')) {
    s = s.replace(
      `"/payments": "banking_payments",
  "/reports": "banking_regreporting",
  "/cards": "banking_cards",
  "/card-txns": "banking_cards",
  "/treasury": "banking_treasury",
  "/risk": "banking_risk",`,
      `"/payments": "banking_payments",
  "/cash": "banking_cash",
  "/fees": "banking_core",
  "/collections": "banking_collections",
  "/trade": "banking_trade",
  "/islamic": "banking_islamic",
  "/wealth": "banking_wealth",
  "/reports": "banking_regreporting",
  "/cards": "banking_cards",
  "/card-txns": "banking_cards",
  "/treasury": "banking_treasury",
  "/risk": "banking_risk",`,
    );
    write(p, s);
  } else console.log("skip entitlements");
}

// --- role nav ---
{
  const p = path.join(bank, "src/components/ops/bank-role-nav.ts");
  let s = read(p);
  if (!s.includes('"/cash"')) {
    s = s.replace(
      `TELLER: [
    "/dashboard",
    "/cif",
    "/accounts",
    "/postings",
    "/payments",
    "/deposits",
    "/loans",
    "/gl",
  ],`,
      `TELLER: [
    "/dashboard",
    "/cif",
    "/accounts",
    "/postings",
    "/payments",
    "/cash",
    "/fees",
    "/deposits",
    "/loans",
    "/gl",
  ],`,
    );
    s = s.replace(
      `CARDS_OFFICER: [
    "/dashboard",
    "/cif",
    "/accounts",
    "/cards",
    "/card-txns",
  ],`,
      `CARDS_OFFICER: [
    "/dashboard",
    "/cif",
    "/accounts",
    "/cards",
    "/card-txns",
  ],`,
    );
    s = s.replace(
      `SATELLITE_OPERATOR: [
    "/dashboard",
    "/cif",
    "/accounts",
    "/postings",
    "/payments",
    "/deposits",
    "/loans",
    "/reports",
    "/gl",
  ],`,
      `SATELLITE_OPERATOR: [
    "/dashboard",
    "/cif",
    "/accounts",
    "/postings",
    "/payments",
    "/cash",
    "/fees",
    "/collections",
    "/trade",
    "/islamic",
    "/wealth",
    "/deposits",
    "/loans",
    "/reports",
    "/gl",
  ],`,
    );
    write(p, s);
  } else console.log("skip role-nav");
}

// --- i18n helper ---
function mergePageKeys(localeFile, navExtra, pagesExtra) {
  const p = path.join(bank, "messages", localeFile);
  const j = JSON.parse(read(p));
  Object.assign(j.nav, navExtra);
  Object.assign(j.pages, pagesExtra);
  write(p, JSON.stringify(j, null, 2) + "\n");
}

const pageBlock = (title, subtitle, create, extras = {}) => ({
  title,
  subtitle,
  create,
  createTitle: create,
  colId: "ID",
  colStatus: "Status",
  colKind: "Kind",
  colAmountMinor: "Amount (minor)",
  colCode: "Code",
  colName: "Name",
  colReference: "Reference",
  colLoanId: "Loan",
  colOutstandingMinor: "Outstanding",
  colPrincipalMinor: "Principal",
  colAccountNo: "Account",
  colCustomerId: "Customer",
  colCurrency: "CCY",
  colRequestedMinor: "Requested",
  colCardTransactionId: "Card txn",
  colDetail: "Detail",
  post: "Post",
  issue: "Issue",
  activate: "Activate",
  branchId: "Branch",
  kind: "Kind",
  amountMinor: "Amount (minor)",
  idempotencyKey: "Idempotency key",
  reference: "Reference",
  code: "Code",
  name: "Name",
  currency: "Currency",
  loanId: "Loan ID",
  customerId: "Customer ID",
  outstandingMinor: "Outstanding (minor)",
  direction: "Direction",
  beneficiaryName: "Beneficiary",
  productTemplateId: "Product template",
  principalMinor: "Principal (minor)",
  accountNo: "Account no",
  requestedMinor: "Requested (minor)",
  alertId: "Alert ID",
  cardTransactionId: "Card transaction",
  reasonCode: "Reason code",
  ...extras,
});

const navExtraEn = {
  paymentsExtras: "SO / VA / Cheques",
  cash: "Cash desk",
  fees: "Fees / SDB",
  collections: "Collections",
  trade: "Trade finance",
  islamic: "Islamic",
  wealth: "Wealth",
  loanApps: "Loan applications",
  cardDisputes: "Card disputes",
  card3ds: "3DS challenges",
  amlCases: "AML cases",
};

mergePageKeys("en.json", navExtraEn, {
  cash: pageBlock("Cash desk", "Till / vault movements and inventory", "New movement"),
  fees: pageBlock("Fees & SDB", "Tariffs, packages, safe deposit boxes", "New tariff"),
  collections: pageBlock("Collections", "Delinquency cases, PTP, recovery", "Open case"),
  trade: pageBlock("Trade finance", "LC / guarantees / DC / SCF / SWIFT stub", "New LC"),
  islamic: pageBlock("Islamic banking", "Murabaha / Ijara contracts", "New contract"),
  wealth: pageBlock("Wealth / custody", "Safekeeping accounts", "New safekeeping"),
  paymentsExtras: {
    ...pageBlock("Payment tails", "Standing orders, VA, cheques, sweep", "Create"),
    tab_so: "Standing orders",
    tab_va: "Virtual accounts",
    tab_cheques: "Cheques",
    tab_sweep: "Sweep rules",
    fromAccountId: "From account",
    toIban: "To IBAN",
    nextRunAt: "Next run (ISO)",
    parentAccountId: "Parent account",
    virtualIban: "Virtual IBAN",
    accountId: "Account",
    chequeNumber: "Cheque number",
    payeeName: "Payee",
    masterAccountId: "Master account",
    childAccountId: "Child account",
    targetMinor: "Target (minor)",
  },
  loanApps: pageBlock("Loan applications", "Origination queue (SoD book in ops)", "New application"),
  amlCases: pageBlock("AML cases", "Case file / SAR draft", "Open case"),
  cardDisputes: pageBlock("Card disputes", "Chargeback / dispute cases", "File dispute"),
  card3ds: pageBlock("3DS challenges", "Ops view of customer 3DS challenges", "Create challenge"),
});

mergePageKeys(
  "az.json",
  {
    paymentsExtras: "SO / VA / Çeklər",
    cash: "Kassa",
    fees: "Komissiyalar / SDB",
    collections: "Kolleksiya",
    trade: "Ticarət maliyyəsi",
    islamic: "İslami",
    wealth: "Sərvət",
    loanApps: "Kredit müraciətləri",
    cardDisputes: "Kart mübahisələri",
    card3ds: "3DS çağırışları",
    amlCases: "AML işləri",
  },
  {
    cash: pageBlock("Kassa", "Kassa / seyflər hərəkətləri", "Yeni hərəkət"),
    fees: pageBlock("Komissiyalar və SDB", "Tariflər və seyflər", "Yeni tarif"),
    collections: pageBlock("Kolleksiya", "Hallar, PTP, bərpa", "Yeni hal"),
    trade: pageBlock("Ticarət maliyyəsi", "LC / zəmanət / DC / SCF", "Yeni LC"),
    islamic: pageBlock("İslami bankçılıq", "Müqavilələr", "Yeni müqavilə"),
    wealth: pageBlock("Sərvət / saklama", "Saklama hesabları", "Yeni hesab"),
    paymentsExtras: {
      ...pageBlock("Ödəniş əlavələri", "SO, VA, çeklər, sweep", "Yarat"),
      tab_so: "Daimi tapşırıqlar",
      tab_va: "Virtual hesablar",
      tab_cheques: "Çeklər",
      tab_sweep: "Sweep",
      fromAccountId: "Hesabdan",
      toIban: "IBAN",
      nextRunAt: "Növbəti (ISO)",
      parentAccountId: "Ana hesab",
      virtualIban: "Virtual IBAN",
      accountId: "Hesab",
      chequeNumber: "Çek №",
      payeeName: "Alan",
      masterAccountId: "Master",
      childAccountId: "Child",
      targetMinor: "Hədəf",
    },
    loanApps: pageBlock("Kredit müraciətləri", "Müraciət növbəsi", "Yeni müraciət"),
    amlCases: pageBlock("AML işləri", "İş faylı / SAR", "Yeni iş"),
    cardDisputes: pageBlock("Kart mübahisələri", "Dispute halları", "Yeni dispute"),
    card3ds: pageBlock("3DS çağırışları", "Ops 3DS görünüşü", "Yarat"),
  },
);

mergePageKeys(
  "ru.json",
  {
    paymentsExtras: "SO / VA / Чеки",
    cash: "Касса",
    fees: "Комиссии / SDB",
    collections: "Взыскание",
    trade: "Торговое финансирование",
    islamic: "Исламский банкинг",
    wealth: "Wealth",
    loanApps: "Заявки на кредит",
    cardDisputes: "Спорные операции",
    card3ds: "3DS challenges",
    amlCases: "AML кейсы",
  },
  {
    cash: pageBlock("Касса", "Движения кассы / хранилища", "Новое движение"),
    fees: pageBlock("Комиссии и SDB", "Тарифы и сейфы", "Новый тариф"),
    collections: pageBlock("Взыскание", "Кейсы, PTP, recovery", "Открыть кейс"),
    trade: pageBlock("Торговое финансирование", "LC / гарантии / DC / SCF", "Новый LC"),
    islamic: pageBlock("Исламский банкинг", "Контракты", "Новый контракт"),
    wealth: pageBlock("Wealth / custody", "Safekeeping", "Новый счёт"),
    paymentsExtras: {
      ...pageBlock("Хвосты платежей", "SO, VA, чеки, sweep", "Создать"),
      tab_so: "Постоянные поручения",
      tab_va: "Виртуальные счета",
      tab_cheques: "Чеки",
      tab_sweep: "Sweep",
      fromAccountId: "Со счёта",
      toIban: "IBAN",
      nextRunAt: "След. дата (ISO)",
      parentAccountId: "Родительский счёт",
      virtualIban: "Virtual IBAN",
      accountId: "Счёт",
      chequeNumber: "Номер чека",
      payeeName: "Получатель",
      masterAccountId: "Master",
      childAccountId: "Child",
      targetMinor: "Цель",
    },
    loanApps: pageBlock("Заявки на кредит", "Очередь ориджинэйшн", "Новая заявка"),
    amlCases: pageBlock("AML кейсы", "Дело / SAR draft", "Открыть кейс"),
    cardDisputes: pageBlock("Спорные операции", "Dispute cases", "Создать"),
    card3ds: pageBlock("3DS challenges", "Ops view 3DS", "Создать"),
  },
);

// --- 3DS ops page ---
write(
  path.join(bank, "app/cards/3ds/page.tsx"),
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

export default function Card3dsPage() {
  const t = useTranslations("pages.card3ds");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cards/3ds/challenges", { cache: "no-store" });
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
    const body = {
      cardId: String(form.get("cardId") ?? ""),
      amountMinor: Number(form.get("amountMinor") ?? 0),
      currency: String(form.get("currency") ?? "AZN"),
    };
    try {
      const res = await fetch("/api/cards/3ds/challenges", {
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
            key: "amountMinor",
            header: t("colAmountMinor"),
            render: (r: Row) => String(r.amountMinor ?? ""),
          },
        ]}
      />
      <OpsModalShell open={mode === "create"} onClose={close} title={t("createTitle")}>
        <form className="space-y-3" onSubmit={onCreate}>
          <Field name="cardId" label="cardId" preset="code" required />
          <Field name="amountMinor" label={t("amountMinor")} preset="code" required />
          <Field name="currency" label={t("currency")} preset="code" defaultValue="AZN" />
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

// Enhance collections with recover/write-off actions
write(
  path.join(bank, "app/collections/page.tsx"),
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

export default function CollectionsPage() {
  const t = useTranslations("pages.collections");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/collections/cases", { cache: "no-store" });
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
    try {
      const res = await fetch("/api/collections/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          outstandingMinor: Number(body.outstandingMinor),
        }),
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

  async function act(id: string, action: string, body?: Record<string, unknown>) {
    const res = await fetch(\`/api/collections/cases/\${id}/\${action}\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) showApiError(tCommon("error"));
    await load();
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
          {
            key: "id",
            header: t("colId"),
            render: (r: Row) => String(r.id ?? "").slice(0, 8),
          },
          {
            key: "loanId",
            header: t("colLoanId"),
            render: (r: Row) => String(r.loanId ?? ""),
          },
          {
            key: "outstandingMinor",
            header: t("colOutstandingMinor"),
            render: (r: Row) => String(r.outstandingMinor ?? ""),
          },
          {
            key: "status",
            header: t("colStatus"),
            render: (r: Row) => <StatusBadge status={String(r.status ?? "")} />,
          },
          {
            key: "actions",
            header: tCommon("actions"),
            render: (r: Row) => (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    void act(String(r.id), "assign", { assigneeUserId: "collector-1" })
                  }
                >
                  Assign
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    void act(String(r.id), "ptp", {
                      promiseAmountMinor: Number(r.outstandingMinor ?? 0),
                      promiseDate: new Date().toISOString(),
                    })
                  }
                >
                  PTP
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    void act(String(r.id), "recover", {
                      amountMinor: Number(r.outstandingMinor ?? 0),
                      checkerUserId: "checker-1",
                      idempotencyKey: \`rec-\${Date.now()}\`,
                      branchId: "HQ",
                    })
                  }
                >
                  Recover
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    void act(String(r.id), "write-off", {
                      checkerUserId: "checker-1",
                      idempotencyKey: \`wo-\${Date.now()}\`,
                      branchId: "HQ",
                    })
                  }
                >
                  Write-off
                </button>
              </div>
            ),
          },
        ]}
      />
      <OpsModalShell open={mode === "create"} onClose={close} title={t("createTitle")}>
        <form className="space-y-3" onSubmit={onCreate}>
          <Field name="loanId" label={t("loanId")} preset="code" required />
          <Field name="customerId" label={t("customerId")} preset="code" required />
          <Field name="outstandingMinor" label={t("outstandingMinor")} preset="code" required />
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

// Trade multi-tab page
write(
  path.join(bank, "app/trade/page.tsx"),
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
type Tab = "lc" | "guarantees" | "dc" | "scf" | "swift";

export default function TradePage() {
  const t = useTranslations("pages.trade");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [tab, setTab] = useState<Tab>("lc");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const endpoint =
    tab === "lc"
      ? "/api/trade/lc"
      : tab === "guarantees"
        ? "/api/trade/guarantees"
        : tab === "dc"
          ? "/api/trade/dc"
          : tab === "scf"
            ? "/api/trade/scf"
            : "/api/trade/swift";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "swift") {
        setRows([]);
        return;
      }
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
  }, [endpoint, tCommon, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const body: Record<string, string | number> = {};
    for (const [k, v] of form.entries()) body[k] = String(v);
    if (body.amountMinor) body.amountMinor = Number(body.amountMinor);
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
      <div className="flex flex-wrap gap-2">
        {(["lc", "guarantees", "dc", "scf", "swift"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            className={tab === k ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(k)}
          >
            {k.toUpperCase()}
            {k === "swift" ? " (stub)" : ""}
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
            key: "reference",
            header: t("colReference"),
            render: (r: Row) => String(r.reference ?? r.messageType ?? ""),
          },
          {
            key: "amountMinor",
            header: t("colAmountMinor"),
            render: (r: Row) => String(r.amountMinor ?? ""),
          },
          {
            key: "status",
            header: t("colStatus"),
            render: (r: Row) => <StatusBadge status={String(r.status ?? "")} />,
          },
          {
            key: "actions",
            header: tCommon("actions"),
            render: (r: Row) =>
              tab === "lc" && r.status === "DRAFT" ? (
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
              ) : tab === "swift" && r.status === "DRAFT" ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    void fetch(\`/api/trade/swift/\${String(r.id)}/submit\`, {
                      method: "POST",
                    }).then(() => load());
                  }}
                >
                  Submit stub
                </button>
              ) : null,
          },
        ]}
      />
      <OpsModalShell open={mode === "create"} onClose={close} title={t("createTitle")}>
        <form className="space-y-3" onSubmit={onCreate}>
          {tab === "swift" ? (
            <>
              <Field name="messageType" label="MT type" preset="code" defaultValue="MT700" required />
              <Field name="payload" label="Payload" preset="shortText" required />
            </>
          ) : (
            <>
              <Field name="customerId" label={t("customerId")} preset="code" required />
              <Field name="reference" label={t("reference")} preset="code" required />
              <Field name="amountMinor" label={t("amountMinor")} preset="code" required />
              {tab === "lc" ? (
                <Field name="direction" label={t("direction")} preset="code" defaultValue="IMPORT" />
              ) : null}
              <Field name="beneficiaryName" label={t("beneficiaryName")} preset="shortText" />
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

// Fees with SDB tab
write(
  path.join(bank, "app/fees/page.tsx"),
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
type Tab = "tariffs" | "sdb" | "packages";

export default function FeesPage() {
  const t = useTranslations("pages.fees");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [tab, setTab] = useState<Tab>("tariffs");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const endpoint =
    tab === "tariffs"
      ? "/api/fees/tariffs"
      : tab === "sdb"
        ? "/api/fees/safe-deposit-boxes"
        : "/api/fees/packages";

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
    const body: Record<string, string | number> = {};
    for (const [k, v] of form.entries()) body[k] = String(v);
    if (body.amountMinor) body.amountMinor = Number(body.amountMinor);
    if (body.rentMinor) body.rentMinor = Number(body.rentMinor);
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
        {(["tariffs", "sdb", "packages"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            className={tab === k ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(k)}
          >
            {k}
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
            render: (r: Row) => String(r.id ?? r.code ?? "").slice(0, 12),
          },
          {
            key: "name",
            header: t("colName"),
            render: (r: Row) => String(r.name ?? r.boxNumber ?? ""),
          },
          {
            key: "amountMinor",
            header: t("colAmountMinor"),
            render: (r: Row) => String(r.amountMinor ?? r.rentMinor ?? ""),
          },
          {
            key: "status",
            header: t("colStatus"),
            render: (r: Row) => <StatusBadge status={String(r.status ?? "ACTIVE")} />,
          },
        ]}
      />
      <OpsModalShell open={mode === "create"} onClose={close} title={t("createTitle")}>
        <form className="space-y-3" onSubmit={onCreate}>
          {tab === "tariffs" && (
            <>
              <Field name="code" label={t("code")} preset="code" required />
              <Field name="name" label={t("name")} preset="shortText" required />
              <Field name="amountMinor" label={t("amountMinor")} preset="code" required />
              <Field name="currency" label={t("currency")} preset="code" defaultValue="AZN" />
            </>
          )}
          {tab === "sdb" && (
            <>
              <Field name="branchId" label={t("branchId")} preset="code" required />
              <Field name="boxNumber" label="boxNumber" preset="code" required />
              <Field name="rentMinor" label="rentMinor" preset="code" required />
            </>
          )}
          {tab === "packages" && (
            <>
              <Field name="code" label={t("code")} preset="code" required />
              <Field name="name" label={t("name")} preset="shortText" required />
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

// Module map
{
  const p = path.join(bank, ".cursor/rules/era-bank-module-map.mdc");
  let s = read(p);
  if (!s.includes("`/cash`")) {
    s = s.replace(
      `| \`/admin/branches\`, \`/admin/product-factory\`, \`/admin/eod\` | admin proxies |

Entitlement gate:`,
      `| \`/admin/branches\`, \`/admin/product-factory\`, \`/admin/eod\` | admin proxies |
| \`/cash\` | \`/api/cash/*\` (\`banking_cash\`) |
| \`/fees\` | \`/api/fees/*\` (tariffs / SDB / packages) |
| \`/payments/extras\` | \`/api/payments/standing-orders|virtual-accounts|cheques|sweep-rules\` |
| \`/collections\` | \`/api/collections/*\` (\`banking_collections\`) |
| \`/trade\` | \`/api/trade/*\` (\`banking_trade\`) |
| \`/islamic\` | \`/api/islamic/*\` (\`banking_islamic\`) |
| \`/wealth\` | \`/api/wealth/*\` (\`banking_wealth\`) |
| \`/loans/applications\` | \`/api/loans/applications\` |
| \`/aml/cases\` | \`/api/aml/cases\` |
| \`/cards/disputes\`, \`/cards/3ds\` | \`/api/cards/disputes*\`, \`/api/cards/3ds/*\` |

Entitlement gate:`,
    );
    write(p, s);
  }
}

console.log("ops wire done");
