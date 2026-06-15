import { z } from "zod";
import { createCustomerSession } from "@/lib/customer-session";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, setSessionCookie } from "@/lib/api-utils";

const schema = z.object({
  identifier: z.string().min(1),
  channel: z.enum(["RETAIL", "CORPORATE"]),
  code: z.string().min(4).max(8),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
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
