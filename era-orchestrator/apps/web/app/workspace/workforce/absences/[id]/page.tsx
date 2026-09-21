"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Absence detail is a ModalShell on the absences index (?id=…).
// Keep this route as a redirect so deep links / refreshes do not 404.
export default function WorkforceAbsenceDetailRedirect() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  useEffect(() => {
    const qs = id ? `?id=${encodeURIComponent(id)}` : "";
    router.replace(`/workspace/workforce/absences${qs}`);
  }, [router, id]);

  return null;
}
