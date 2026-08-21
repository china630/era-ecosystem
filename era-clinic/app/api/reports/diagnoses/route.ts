import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/lib/api-utils";
import { listDiagnosisReport } from "@/domain/icd/diagnosis-report.service";

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return jsonError("from and to must be YYYY-MM-DD", 400);
    }
    const source = url.searchParams.get("source") ?? "all";
    const chapter = url.searchParams.get("chapter") ?? "";
    const locale = url.searchParams.get("locale") ?? "en";
    return jsonOk(
      await listDiagnosisReport({
        fromYmd: from,
        toYmd: to,
        source:
          source === "episode" || source === "visit" || source === "admission"
            ? source
            : "all",
        chapter: chapter || undefined,
        locale,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
