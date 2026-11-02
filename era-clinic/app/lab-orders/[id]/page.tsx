"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { laneForServiceKind } from "@/domain/lab/lab-order-lane";

/** Deep links `/lab-orders/[id]` open the matching lane + workflow modal. */
export default function LabOrderDetailRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (!id) {
      router.replace("/lab-orders?lane=lab");
      return;
    }
    let cancelled = false;
    void fetch(`/api/lab-orders/${encodeURIComponent(id)}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        const row = body?.data ?? body;
        const kind = row?.items?.[0]?.diagnosticService?.modality?.kind as
          | string
          | undefined;
        const lane = laneForServiceKind(kind);
        router.replace(
          `/lab-orders?lane=${lane}&order=${encodeURIComponent(id)}`,
        );
      })
      .catch(() => {
        if (!cancelled) {
          router.replace(`/lab-orders?lane=lab&order=${encodeURIComponent(id)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return null;
}
