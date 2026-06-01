import { jsonOk } from '@/lib/api-utils';

/** In-app notifications stub — integrate with orchestrator CP when available. */
export async function GET() {
  return jsonOk({ count: 0 });
}
