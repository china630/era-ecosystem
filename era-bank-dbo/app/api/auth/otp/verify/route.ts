import { z } from "zod";
import { createCustomerSession } from "@/lib/customer-session";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonError, jsonOk, setSessionCookie } from "@/lib/api-utils";
import {
  enterDboTenant,
  readDboAuthJson,
  resolveDboChannelTenant,
} from "@/lib/dbo-channel-tenant";

const schema = z.object({
  identifier: z.string().min(1),
  channel: z.enum(["RETAIL", "CORPORATE"]),
  code: z.string().min(4).max(8),
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
    const auth = await engineDboJson<{
      customerJwt: string;
      customerId: string;
      globalPersonId?: string;
    }>("POST", dboPaths.authOtpVerify, body);

    const { session, cookieToken, maxAge } = await createCustomerSession({
      customerId: auth.customerId,
      globalPersonId: auth.globalPersonId,
      channel: body.channel,
      customerJwt: auth.customerJwt,
    });

    const res = jsonOk({
      customerId: session.customerId,
      channel: session.channel,
    });
    setSessionCookie(res, cookieToken, maxAge);
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
