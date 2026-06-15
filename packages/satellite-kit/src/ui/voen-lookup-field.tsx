"use client";

import { useState } from "react";
import {
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "./design-system";

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
  /** BFF route proxying Finance `GET /counterparties/voen-preview` (DH-006 handoff). */
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
    <div className={`space-y-1 ${className ?? ""}`.trim()}>
      <label className={MODAL_FIELD_LABEL_CLASS}>{labels.voen}</label>
      <div className="flex gap-2">
        <input
          className={MODAL_INPUT_CLASS}
          value={value}
          maxLength={10}
          inputMode="numeric"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        />
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy || disabled}
          onClick={() => void check()}
        >
          {labels.check}
        </button>
      </div>
      {status ? <p className="text-xs text-[#7F8C8D]">{status}</p> : null}
    </div>
  );
}
