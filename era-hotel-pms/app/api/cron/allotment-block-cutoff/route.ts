import { releaseAllotmentBlocksPastCutoff } from '@/lib/services/allotment-block-release.service';
import { jsonOk, handleRouteError } from '@/lib/api-utils';

/** Cutoff soft-release. Auth: Bearer HOTEL_CRON_SECRET when set. */
export async function POST(req: Request) {
  try {
    const secret = process.env.HOTEL_CRON_SECRET?.trim();
    if (secret) {
      const auth = req.headers.get('authorization');
      if (auth !== `Bearer ${secret}`) {
        return new Response('Unauthorized', { status: 401 });
      }
    }
    return jsonOk(await releaseAllotmentBlocksPastCutoff(new Date()));
  } catch (err) {
    return handleRouteError(err);
  }
}
