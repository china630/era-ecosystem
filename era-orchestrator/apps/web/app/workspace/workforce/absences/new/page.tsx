"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Absence creation moved into a modal on the absences index (CRUD modal standard).
// Keep this route as a redirect so old links / refreshes do not 404.
export default function NewWorkforceAbsenceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/workspace/workforce/absences");
  }, [router]);
  return null;
}
