"use client";

import Link from "next/link";
import { CARD_CONTAINER_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { ShellHeader } from "../../../components/shell-header";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";

export default function SubscriptionPage() {
  const { ready } = useRequireAuth();
  const { snapshot, loading } = useSubscription();

  if (!ready) return null;

  return (
    <>
      <ShellHeader />
      <Link href="/" className={SECONDARY_BUTTON_CLASS}>
        ← Home
      </Link>
      <h1 className="mt-4 text-xl font-semibold">Subscription</h1>
      <pre className={`${CARD_CONTAINER_CLASS} mt-4 overflow-auto p-4 text-xs`}>
        {loading ? "Loading…" : JSON.stringify(snapshot, null, 2)}
      </pre>
    </>
  );
}
