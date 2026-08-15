import fs from "fs";
import path from "path";

const root = "d:/My Projects/era-ecosystem";
const dbo = path.join(root, "era-bank-dbo");

function read(p) {
  return fs.readFileSync(p, "utf8");
}
function write(p, c) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", path.relative(root, p));
}

// dboPaths
{
  const p = path.join(dbo, "lib/engine-dbo-client.ts");
  let s = read(p);
  if (!s.includes("standingOrders")) {
    s = s.replace(
      `  cardTemporaryBlock: (id: string) => \`/api/v1/dbo/cards/\${id}/temporary-block\`,
} as const;`,
      `  cardTemporaryBlock: (id: string) => \`/api/v1/dbo/cards/\${id}/temporary-block\`,
  standingOrders: "/api/v1/dbo/standing-orders",
  standingOrderPause: (id: string) => \`/api/v1/dbo/standing-orders/\${id}/pause\`,
  loanApplications: "/api/v1/dbo/loans/applications",
  loanApplication: (id: string) => \`/api/v1/dbo/loans/applications/\${id}\`,
  loanApplicationSubmit: (id: string) => \`/api/v1/dbo/loans/applications/\${id}/submit\`,
  threeDsChallenges: "/api/v1/dbo/cards/3ds/challenges",
  threeDsComplete: (id: string) => \`/api/v1/dbo/cards/3ds/challenges/\${id}/complete\`,
  islamicContracts: "/api/v1/dbo/islamic/contracts",
} as const;`,
    );
    write(p, s);
  }
}

const listRoute = (pathExpr, methodGet = true) => `import { z } from "zod";
import { dboPaths, engineDboFetch, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboFetch(${pathExpr}, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
`;

write(
  path.join(dbo, "app/api/standing-orders/route.ts"),
  `import { z } from "zod";
import { dboPaths, engineDboFetch, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

const createSchema = z.object({
  fromAccountId: z.string().min(1),
  toIban: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.string().optional(),
  nextRunAt: z.string().min(1),
  cronExpr: z.string().optional(),
});

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboFetch(dboPaths.standingOrders, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const idempotencyKey = request.headers.get("idempotency-key") ?? crypto.randomUUID();
    const data = await engineDboJson("POST", dboPaths.standingOrders, body, {
      customerJwt: auth.session.customerJwt ?? undefined,
      idempotencyKey,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
`,
);

write(
  path.join(dbo, "app/api/standing-orders/[id]/pause/route.ts"),
  `import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboJson("POST", dboPaths.standingOrderPause(id), {}, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
`,
);

write(
  path.join(dbo, "app/api/loans/applications/route.ts"),
  `import { z } from "zod";
import { dboPaths, engineDboFetch, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

const createSchema = z.object({
  productTemplateId: z.string().min(1),
  requestedMinor: z.number().int().positive(),
  currency: z.string().optional(),
});

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboFetch(dboPaths.loanApplications, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboJson("POST", dboPaths.loanApplications, body, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
`,
);

write(
  path.join(dbo, "app/api/loans/applications/[id]/submit/route.ts"),
  `import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboJson("POST", dboPaths.loanApplicationSubmit(id), {}, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
`,
);

write(
  path.join(dbo, "app/api/cards/3ds/challenges/route.ts"),
  `import { dboPaths, engineDboFetch } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboFetch(dboPaths.threeDsChallenges, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
`,
);

write(
  path.join(dbo, "app/api/cards/3ds/challenges/[id]/complete/route.ts"),
  `import { z } from "zod";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

const schema = z.object({ success: z.boolean().optional() });

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = schema.parse(await request.json().catch(() => ({})));
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboJson("POST", dboPaths.threeDsComplete(id), body, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
`,
);

write(
  path.join(dbo, "app/api/islamic/contracts/route.ts"),
  `import { dboPaths, engineDboFetch } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboFetch(dboPaths.islamicContracts, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
`,
);

// Pages
write(
  path.join(dbo, "app/(customer)/standing-orders/page.tsx"),
  `"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  status?: string;
  amountMinor?: number;
  toIban?: string;
};

export default function StandingOrdersPage() {
  const t = useTranslations("standingOrders");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fromAccountId: "",
    toIban: "",
    amountMinor: "",
    nextRunAt: new Date(Date.now() + 86400000).toISOString(),
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/standing-orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(Array.isArray(data) ? data : data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/standing-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        ...form,
        amountMinor: Math.round(Number(form.amountMinor) * 100),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? tc("error"));
      return;
    }
    setForm((f) => ({ ...f, toIban: "", amountMinor: "" }));
    await load();
  }

  async function pause(id: string) {
    await fetch(\`/api/standing-orders/\${id}/pause\`, { method: "POST" });
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <form className="space-y-2 rounded-xl bg-white p-3 shadow-sm" onSubmit={create}>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder={t("fromAccount")}
          value={form.fromAccountId}
          onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}
          required
        />
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder={t("toIban")}
          value={form.toIban}
          onChange={(e) => setForm({ ...form, toIban: e.target.value })}
          required
        />
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder={t("amount")}
          value={form.amountMinor}
          onChange={(e) => setForm({ ...form, amountMinor: e.target.value })}
          required
        />
        <button type="submit" className="rounded-lg bg-dbo-primary px-3 py-1.5 text-xs text-white">
          {t("create")}
        </button>
      </form>
      {loading ? <p className="text-sm text-dbo-muted">{tc("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm">{r.toIban}</span>
              <span className="text-xs text-dbo-muted">{r.status}</span>
            </div>
            <p className="text-sm text-dbo-muted">
              {((r.amountMinor ?? 0) / 100).toFixed(2)} AZN
            </p>
            {r.status === "ACTIVE" ? (
              <button
                type="button"
                className="mt-2 text-xs text-dbo-primary"
                onClick={() => void pause(r.id)}
              >
                {t("pause")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
`,
);

write(
  path.join(dbo, "app/(customer)/loans/apply/page.tsx"),
  `"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  status?: string;
  requestedMinor?: number;
  productTemplateId?: string;
};

export default function LoanApplyPage() {
  const t = useTranslations("loanApply");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    productTemplateId: "",
    requestedMinor: "",
  });

  async function load() {
    const res = await fetch("/api/loans/applications");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? tc("error"));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/loans/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTemplateId: form.productTemplateId,
        requestedMinor: Math.round(Number(form.requestedMinor) * 100),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? tc("error"));
      return;
    }
    setForm({ productTemplateId: "", requestedMinor: "" });
    await load();
  }

  async function submit(id: string) {
    const res = await fetch(\`/api/loans/applications/\${id}/submit\`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? tc("error"));
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <form className="space-y-2 rounded-xl bg-white p-3 shadow-sm" onSubmit={create}>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder={t("product")}
          value={form.productTemplateId}
          onChange={(e) => setForm({ ...form, productTemplateId: e.target.value })}
          required
        />
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder={t("amount")}
          value={form.requestedMinor}
          onChange={(e) => setForm({ ...form, requestedMinor: e.target.value })}
          required
        />
        <button type="submit" className="rounded-lg bg-dbo-primary px-3 py-1.5 text-xs text-white">
          {t("create")}
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex justify-between text-sm">
              <span>{r.productTemplateId}</span>
              <span className="text-dbo-muted">{r.status}</span>
            </div>
            <p className="text-sm text-dbo-muted">
              {((r.requestedMinor ?? 0) / 100).toFixed(2)} AZN
            </p>
            {r.status === "DRAFT" ? (
              <button
                type="button"
                className="mt-2 text-xs text-dbo-primary"
                onClick={() => void submit(r.id)}
              >
                {t("submit")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
`,
);

write(
  path.join(dbo, "app/(customer)/cards/3ds/page.tsx"),
  `"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  status?: string;
  amountMinor?: number;
  cardId?: string;
};

export default function ThreeDsPage() {
  const t = useTranslations("threeDs");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/cards/3ds/challenges");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? tc("error"));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function complete(id: string, success: boolean) {
    const res = await fetch(\`/api/cards/3ds/challenges/\${id}/complete\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? tc("error"));
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-sm text-dbo-muted">{t("subtitle")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex justify-between text-sm">
              <span>{String(r.cardId ?? "").slice(0, 8)}</span>
              <span className="text-dbo-muted">{r.status}</span>
            </div>
            <p className="text-sm text-dbo-muted">
              {((r.amountMinor ?? 0) / 100).toFixed(2)} AZN
            </p>
            {r.status === "PENDING" ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded bg-dbo-primary px-2 py-1 text-xs text-white"
                  onClick={() => void complete(r.id, true)}
                >
                  {t("approve")}
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => void complete(r.id, false)}
                >
                  {t("deny")}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
`,
);

write(
  path.join(dbo, "app/(customer)/islamic/page.tsx"),
  `"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  kind?: string;
  status?: string;
  principalMinor?: number;
};

export default function IslamicPage() {
  const t = useTranslations("islamic");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/islamic/contracts")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : tc("error")));
  }, [tc]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-sm text-dbo-muted">{t("subtitle")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex justify-between text-sm">
              <span>{r.kind}</span>
              <span className="text-dbo-muted">{r.status}</span>
            </div>
            <p className="text-sm text-dbo-muted">
              {((r.principalMinor ?? 0) / 100).toFixed(2)} AZN
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
`,
);

// Shell nav + i18n
{
  const p = path.join(dbo, "src/components/DboShell.tsx");
  let s = read(p);
  if (!s.includes("/standing-orders")) {
    s = s.replace(
      `import { Building2, CreditCard, Home, LogOut, Send, ShieldCheck, Wallet } from "lucide-react";`,
      `import { Building2, CreditCard, Home, LogOut, Repeat, Send, ShieldCheck, Wallet } from "lucide-react";`,
    );
    s = s.replace(
      `const retailItems = [
  { href: "/dashboard", labelKey: "home" as const, icon: Home },
  { href: "/accounts", labelKey: "accounts" as const, icon: CreditCard },
  { href: "/cards", labelKey: "cards" as const, icon: Wallet },
  { href: "/payments", labelKey: "pay" as const, icon: Send },
  { href: "/transfers", labelKey: "transfers" as const, icon: Building2 },
];`,
      `const retailItems = [
  { href: "/dashboard", labelKey: "home" as const, icon: Home },
  { href: "/accounts", labelKey: "accounts" as const, icon: CreditCard },
  { href: "/cards", labelKey: "cards" as const, icon: Wallet },
  { href: "/payments", labelKey: "pay" as const, icon: Send },
  { href: "/standing-orders", labelKey: "standingOrders" as const, icon: Repeat },
];`,
    );
    // grid cols stay 5
    write(p, s);
  }
}

for (const locale of ["en.json", "az.json", "ru.json"]) {
  const p = path.join(dbo, "messages", locale);
  const j = JSON.parse(read(p));
  const isEn = locale === "en.json";
  const isAz = locale === "az.json";
  j.nav.standingOrders = isEn ? "SO" : isAz ? "SO" : "ПО";
  j.standingOrders = {
    title: isEn ? "Standing orders" : isAz ? "Daimi tapşırıqlar" : "Постоянные поручения",
    fromAccount: isEn ? "From account" : isAz ? "Hesabdan" : "Со счёта",
    toIban: "IBAN",
    amount: isEn ? "Amount (AZN)" : isAz ? "Məbləğ (AZN)" : "Сумма (AZN)",
    create: isEn ? "Create" : isAz ? "Yarat" : "Создать",
    pause: isEn ? "Pause" : isAz ? "Dayandır" : "Пауза",
  };
  j.loanApply = {
    title: isEn ? "Loan application" : isAz ? "Kredit müraciəti" : "Заявка на кредит",
    product: isEn ? "Product template ID" : isAz ? "Məhsul ID" : "ID продукта",
    amount: isEn ? "Amount (AZN)" : isAz ? "Məbləğ (AZN)" : "Сумма (AZN)",
    create: isEn ? "Save draft" : isAz ? "Qaralama" : "Черновик",
    submit: isEn ? "Submit" : isAz ? "Göndər" : "Отправить",
  };
  j.threeDs = {
    title: "3DS",
    subtitle: isEn
      ? "Approve or deny pending card authentication challenges"
      : isAz
        ? "Kart 3DS çağırışlarını təsdiqləyin"
        : "Подтвердите 3DS challenge",
    approve: isEn ? "Approve" : isAz ? "Təsdiq" : "Одобрить",
    deny: isEn ? "Deny" : isAz ? "Rədd" : "Отклонить",
  };
  j.islamic = {
    title: isEn ? "Islamic products" : isAz ? "İslami məhsullar" : "Исламские продукты",
    subtitle: isEn
      ? "Read-only contract status (activate in ops)"
      : isAz
        ? "Yalnız oxuma (aktivasiya ops-da)"
        : "Только просмотр (активация в ops)",
  };
  write(p, JSON.stringify(j, null, 2) + "\n");
}

// Link from payments + cards pages
{
  const p = path.join(dbo, "app/(customer)/payments/page.tsx");
  let s = read(p);
  if (!s.includes("/standing-orders")) {
    s = s.replace(
      `<div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <Link
          href="/payments/new"
          className="rounded-lg bg-dbo-primary px-3 py-1.5 text-xs font-medium text-white"
        >
          {t("new")}
        </Link>
      </div>`,
      `<div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <div className="flex gap-2">
          <Link
            href="/standing-orders"
            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
          >
            SO
          </Link>
          <Link
            href="/loans/apply"
            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
          >
            Loan
          </Link>
          <Link
            href="/payments/new"
            className="rounded-lg bg-dbo-primary px-3 py-1.5 text-xs font-medium text-white"
          >
            {t("new")}
          </Link>
        </div>
      </div>`,
    );
    write(p, s);
  }
}

{
  const p = path.join(dbo, "app/(customer)/cards/page.tsx");
  let s = read(p);
  if (!s.includes("/cards/3ds")) {
    s = s.replace(
      `<h1 className="text-lg font-semibold">{t("title")}</h1>`,
      `<div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <Link href="/cards/3ds" className="text-xs text-dbo-primary">
          3DS
        </Link>
      </div>`,
    );
    if (!s.includes('import Link')) {
      s = `import Link from "next/link";\n` + s;
    }
    write(p, s);
  }
}

// module map dbo
{
  const p = path.join(dbo, ".cursor/rules/era-bank-dbo-module-map.mdc");
  if (fs.existsSync(p)) {
    let s = read(p);
    if (!s.includes("standing-orders")) {
      s += `\n\n## UI waves (customer)\n\n| Path | BFF | Engine |\n|------|-----|--------|\n| \`/standing-orders\` | \`/api/standing-orders\` | \`dbo/standing-orders\` |\n| \`/loans/apply\` | \`/api/loans/applications\` | \`dbo/loans/applications\` |\n| \`/cards/3ds\` | \`/api/cards/3ds/challenges\` | \`dbo/cards/3ds/challenges\` |\n| \`/islamic\` | \`/api/islamic/contracts\` | \`dbo/islamic/contracts\` (read-only) |\n`;
      write(p, s);
    }
  }
}

console.log("dbo ui wire done");
