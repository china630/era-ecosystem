"use client";

import { useState } from "react";
import { SECONDARY_BUTTON_CLASS } from "./design-system";
import { Field, FieldRow } from "./field";

export type VoenLookupResult = {
  found: boolean;
  voen: string;
  name?: string | null;
  legalAddress?: string | null;
  vatStatus?: boolean;
  source?: string;
};

export function VoenLookupField({
  value,
  onChange,
  onResolved,
  lookupPath = "/api/counterparties/voen-preview",
  labels,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (voen: string) => void;
  onResolved?: (result: VoenLookupResult) => void;
  /** BFF route proxying orchestrator `GET /platform/v1/catalog/companies/:voen` (DH-006). */
  lookupPath?: string;
  labels: {
    voen: string;
    check: string;
    found: string;
    notFound: string;
    invalid: string;
  };
  disabled?: boolean;
  className?: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 10) {
      setStatus(labels.invalid);
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${lookupPath}?voen=${encodeURIComponent(digits)}`);
      const data = (await res.json()) as VoenLookupResult;
      if (!res.ok || !data.found) {
        setStatus(labels.notFound);
        onResolved?.({ found: false, voen: digits });
        return;
      }
      setStatus(`${labels.found}: ${data.name ?? digits}`);
      onResolved?.(data);
    } catch {
      setStatus(labels.notFound);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <FieldRow cols={2} className="items-end">
        <Field
          label={labels.voen}
          preset="voen"
          value={value}
          maxLength={10}
          inputMode="numeric"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        />
        <button
          type="button"
          className={`${SECONDARY_BUTTON_CLASS} self-end`}
          disabled={busy || disabled}
          onClick={() => void check()}
        >
          {labels.check}
        </button>
      </FieldRow>
      {status ? <p className="mt-1 text-xs text-[#7F8C8D]">{status}</p> : null}
    </div>
  );
}
