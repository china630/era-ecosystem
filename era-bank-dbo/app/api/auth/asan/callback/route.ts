import { z } from "zod";
import { completeAsanChallenge } from "@/lib/asan-stub.adapter";
import { createCustomerSession } from "@/lib/customer-session";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, setSessionCookie } from "@/lib/api-utils";

const schema = z.object({
  transactionId: z.string().min(1),
  identifier: z.string().min(1),
  channel: z.enum(["RETAIL", "CORPORATE"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const stub = completeAsanChallenge(body.transactionId, body.identifier, body.channel);
    if (!stub.verified) {
      return handleRouteError(new Error("ASAN verification failed"));
    }

    const auth = await engineDboJson<{
      customerJwt: string;
      customerId: string;
      globalPersonId?: string;
    }>("POST", dboPaths.authAsanCallback, {
      transactionId: body.transactionId,
      identifier: body.identifier,
      channel: body.channel,
    });

    const { session, cookieToken, maxAge } = await createCustomerSession({
      customerId: auth.customerId,
      globalPersonId: auth.globalPersonId,
      channel: body.channel,
      customerJwt: auth.customerJwt,
    });

    const res = jsonOk({
      customerId: session.customerId,
      channel: session.channel,
      kycUpgraded: true,
    });
    setSessionCookie(res, cookieToken, maxAge);
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
