import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { listInHouseEpisodes } from '@/lib/services/sanatorium.service';

export async function GET(req: Request) {
  try {
    const orgId = new URL(req.url).searchParams.get('organizationId') ?? undefined;
    const episodes = await listInHouseEpisodes(orgId);
    return jsonOk(episodes);
  } catch (err) {
    return handleRouteError(err);
  }
}
