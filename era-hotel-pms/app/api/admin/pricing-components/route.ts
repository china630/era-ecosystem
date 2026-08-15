import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead } from '@/lib/auth/master-data-guard';
import {
  listPricingComponents,
  recommendedBoardAddOns,
} from '@/lib/services/pricing-components.service';

export async function GET(request: Request) {
  try {
    assertMasterDataRead(await getSessionFromHeaders());
    const asOfParam = new URL(request.url).searchParams.get('asOf');
    const asOf = asOfParam ? new Date(asOfParam) : undefined;
    const [components, recommended] = await Promise.all([
      listPricingComponents(asOf),
      recommendedBoardAddOns(asOf),
    ]);
    return jsonOk(serialize({ components, recommended }));
  } catch (err) {
    return handleRouteError(err);
  }
}
