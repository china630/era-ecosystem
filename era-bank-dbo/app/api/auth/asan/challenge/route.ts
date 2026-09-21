import { z } from "zod";
import { startAsanChallenge } from "@/lib/asan-stub.adapter";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import {
  enterDboTenant,
  readDboAuthJson,
  resolveDboChannelTenant,
} from "@/lib/dbo-channel-tenant";

const schema = z.object({
  identifier: z.string().min(1),
  channel: z.enum(["RETAIL", "CORPORATE"]),
});

export async function POST(request: Request) {
  try {
    const parsed = await readDboAuthJson(request);
    if (!parsed.ok) {
      return jsonError(parsed.error, parsed.status);
    }
    const tenant = await resolveDboChannelTenant(request, parsed.orgNo);
    if (!tenant.ok) {
      return jsonError(tenant.error, tenant.status);
    }
    enterDboTenant(tenant.organizationId);
    const body = schema.parse(parsed.raw);
    const challenge = startAsanChallenge(body.identifier, body.channel);
    return jsonOk(challenge);
  } catch (err) {
    return handleRouteError(err);
  }
}
