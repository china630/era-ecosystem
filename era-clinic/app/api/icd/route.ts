import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  getTenantIcdFavorites,
  listIcdChapters,
  searchSelectableIcd,
} from "@/domain/icd/icd-search.service";

export async function GET(request: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_ICD_READ);
    if (denied) return denied;

        const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const chapter = url.searchParams.get("chapter") ?? "";
    const locale = url.searchParams.get("locale") ?? "en";
    const take = Number(url.searchParams.get("take") ?? "20");
    const favorites = await getTenantIcdFavorites();
    if (url.searchParams.get("chapters") === "1") {
      return jsonOk({ chapters: await listIcdChapters(locale) });
    }
    return jsonOk(
      await searchSelectableIcd({
        q,
        chapter: chapter || undefined,
        locale,
        take: Number.isFinite(take) ? take : 20,
        favoriteCodes: favorites,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
