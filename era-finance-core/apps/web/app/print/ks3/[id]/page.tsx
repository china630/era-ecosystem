"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../lib/api-client";
import { useRequireAuth } from "../../../../lib/use-require-auth";

export default function Ks3PrintPage() {
  const { id } = useParams<{ id: string }>();
  const { token, ready } = useRequireAuth();
  const [html, setHtml] = useState("Loading…");

  useEffect(() => {
    if (!ready || !token || !id) return;
    void (async () => {
      const res = await apiFetch(`/api/pay-applications/${id}/print-html?kind=ks3`);
      setHtml(await res.text());
    })();
  }, [ready, token, id]);

  if (!ready || !token) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
