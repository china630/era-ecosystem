import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { listImagingPhrases } from "@/domain/catalog/imaging-phrase.service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const organKey = url.searchParams.get("organKey") ?? undefined;
    return jsonOk(await listImagingPhrases({ organKey }));
  } catch (err) {
    return handleRouteError(err);
  }
}
