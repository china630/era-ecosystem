import { getRouteSession } from "@/lib/api-utils";
import { sessionMayPrintVisitExam } from "@/lib/auth/visit-exam-print-access";

export type VisitExamPrintAccess = "ok" | "unauthenticated" | "forbidden";

/** Server Components / route handlers — hydrates tenant session then applies print gate. */
export async function assertVisitExamPrintAccess(): Promise<VisitExamPrintAccess> {
  const session = await getRouteSession();
  if (!session) return "unauthenticated";
  return sessionMayPrintVisitExam(session) ? "ok" : "forbidden";
}
