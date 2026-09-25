"use client";

import { useParams, useSearchParams } from "next/navigation";
import { GroupPersonCard } from "../../group-person-card";

export default function WorkforceGroupPersonPage() {
  const params = useParams();
  const search = useSearchParams();
  return (
    <GroupPersonCard
      globalPersonId={String(params.globalPersonId ?? "")}
      holdingId={search.get("holdingId") ?? ""}
    />
  );
}
