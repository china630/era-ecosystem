"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "../../lib/use-require-auth";

// The settings hub was just two redirect cards; the sidebar Settings section
// already links Subscription and Team directly, so land straight on Subscription.
export default function SettingsRedirect() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready) router.replace("/settings/subscription");
  }, [ready, router]);
  return null;
}
