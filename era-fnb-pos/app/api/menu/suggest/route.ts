import { z } from "zod";
import { handleRouteError, jsonOk } from "@/lib/api-utils";
import { suggestDishes } from "@/lib/dish-lexicon";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

const q = z.object({ q: z.string().optional() });

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;
    const parsed = q.parse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    });
    return jsonOk({ suggestions: suggestDishes(parsed.q ?? "") });
  } catch (err) {
    return handleRouteError(err);
  }
}
