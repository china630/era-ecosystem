import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getEpisodeSchedule } from '@/lib/services/sanatorium.service';

function parseDayStart(value: string | null): Date {
  const day = value ? new Date(value) : new Date();
  day.setHours(0, 0, 0, 0);
  return day;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const from = parseDayStart(url.searchParams.get('from'));
    const toParam = url.searchParams.get('to');
    const to = toParam
      ? parseDayStart(toParam)
      : (() => {
          const next = new Date(from);
          next.setDate(next.getDate() + 1);
          return next;
        })();

    const orders = await getEpisodeSchedule(
      id,
      from,
      to,
      url.searchParams.get("locale") ?? req.headers.get("x-era-locale") ?? "en",
    );
    return jsonOk(orders);
  } catch (err) {
    return handleRouteError(err);
  }
}
