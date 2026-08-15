"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Deep links `/lab-orders/[id]` open the list + workflow modal. */
export default function LabOrderDetailRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (id) router.replace(`/lab-orders?order=${encodeURIComponent(id)}`);
    else router.replace("/lab-orders");
  }, [id, router]);

  return null;
}
