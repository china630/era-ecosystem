"use client";

import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  POSTED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  REVERSED: "bg-slate-100 text-slate-700",
  DRAFT: "bg-slate-100 text-slate-700",
  SETTLED: "bg-emerald-100 text-emerald-800",
  VERIFIED: "bg-emerald-100 text-emerald-800",
  RUNNING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function formatAznMinor(minor: unknown): string {
  const n = typeof minor === "bigint" ? Number(minor) : Number(minor ?? 0);
  if (Number.isNaN(n)) return "—";
  return `${(n / 100).toFixed(2)} AZN`;
}

export function maskIban(iban: string): string {
  if (iban.length <= 8) return iban;
  return `${iban.slice(0, 4)}…${iban.slice(-4)}`;
}

type AmountInputProps = {
  name: string;
  label: string;
  defaultMinor?: number;
  className?: string;
};

export function AmountInput({ name, label, defaultMinor, className }: AmountInputProps) {
  return (
    <label className={className ?? "block"}>
      <span className="mb-1 block text-[12px] text-muted-foreground">{label}</span>
      <input
        name={name}
        type="number"
        min={1}
        defaultValue={defaultMinor ?? 10000}
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder="Amount in qepik (minor units)"
      />
    </label>
  );
}

export function OpsField({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded border px-3 py-2 text-sm"
      />
    </label>
  );
}

export function OpsCard({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className={`${CARD_CONTAINER_CLASS} space-y-4`}>
      {title ? <h3 className="font-medium">{title}</h3> : null}
      {children}
    </div>
  );
}

export function OpsError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function OpsResult({ text }: { text: string }) {
  if (!text) return null;
  return <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{text}</pre>;
}
