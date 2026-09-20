"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "../../../../lib/api-client";
import { useRequireAuth } from "../../../../lib/use-require-auth";

/**
 * Staff commercial invoice print blank (W3).
 * Vendor HTML from Nest; window.print() — no Puppeteer.
 */
function PrintInvoiceInner() {
  const params = useParams();
  const search = useSearchParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const lang = search.get("lang") ?? "az";
  const autoprint = search.get("autoprint") === "1";
  const { token, ready } = useRequireAuth();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token || !id) return;
    let cancelled = false;
    void (async () => {
      const res = await apiFetch(
        `/api/invoices/${encodeURIComponent(id)}/print-html?lang=${encodeURIComponent(lang)}`,
      );
      if (!res.ok) {
        if (!cancelled) setError(`Print failed: ${res.status}`);
        return;
      }
      const data = (await res.json()) as { html?: string };
      if (!cancelled) setHtml(typeof data.html === "string" ? data.html : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, id, lang]);

  useEffect(() => {
    const normalized = lang.toLowerCase().startsWith("ru")
      ? "ru"
      : lang.toLowerCase().startsWith("en")
        ? "en"
        : "az";
    document.documentElement.lang = normalized;
  }, [lang]);

  useEffect(() => {
    if (!html || !autoprint) return;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [html, autoprint]);

  if (!ready || !token) {
    return <p style={{ padding: 24 }}>Loading…</p>;
  }
  if (error) {
    return <p style={{ padding: 24, color: "#c0392b" }}>{error}</p>;
  }
  if (!html) {
    return <p style={{ padding: 24 }}>Loading…</p>;
  }

  return (
    <div
      className="print-invoice-root"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function PrintInvoicePage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <PrintInvoiceInner />
    </Suspense>
  );
}
