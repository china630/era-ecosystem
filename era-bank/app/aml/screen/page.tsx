"use client";

import { useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

export default function AmlScreenPage() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<string>("");

  async function submit() {
    const res = await fetch("/api/aml/screen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setResult(await res.text());
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Sanction screening" subtitle="Manual counterparty screening" />
      <div className={CARD_CONTAINER_CLASS}>
        <input
          className="mb-3 w-full rounded border px-3 py-2 text-sm"
          placeholder="Name to screen"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void submit()}>
          Screen
        </button>
        {result && (
          <pre className="mt-4 overflow-auto text-xs">{result}</pre>
        )}
      </div>
    </div>
  );
}
