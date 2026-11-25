"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

function OAuthCallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("Completing OAuth…");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const err = params.get("error_description") || params.get("error");
    if (err) {
      setMessage(String(err));
      return;
    }
    if (!code || !state) {
      setMessage("Missing code/state");
      return;
    }
    let provider = "meta";
    try {
      const parsed = JSON.parse(
        atob(state.replace(/-/g, "+").replace(/_/g, "/")),
      ) as { provider?: string };
      if (parsed.provider === "google" || parsed.provider === "microsoft") {
        provider = "google-ms";
      }
    } catch {
      provider = "meta";
    }
    void (async () => {
      const path =
        provider === "google-ms"
          ? "/api/integrations/oauth/google-ms/complete"
          : "/api/integrations/oauth/meta/complete";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "OAuth failed");
        return;
      }
      setMessage(
        data.pageName
          ? `Connected page: ${data.pageName}`
          : data.provider
            ? `${data.provider} OAuth completed`
            : "OAuth completed",
      );
    })();
  }, [params]);

  return (
    <div className="space-y-4 p-4">
      <PageHeader title="Integrations OAuth" subtitle={message} />
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        onClick={() => router.push("/admin/integrations")}
      >
        Back to integrations
      </button>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading OAuth…</div>}>
      <OAuthCallbackInner />
    </Suspense>
  );
}
