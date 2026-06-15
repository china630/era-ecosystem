import { z } from "zod";
import { markSignRequestSigned } from "@/lib/customer-session";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  asanTransactionId: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = schema.parse(await request.json().catch(() => ({})));
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const data = await engineDboJson("POST", dboPaths.paymentOrderSign(id), body, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });

    const signRequest = await prisma.paymentSignRequest.findUnique({
      where: { engineOrderId: id },
    });
    if (signRequest && signRequest.status === "PENDING") {
      await markSignRequestSigned({
        id: signRequest.id,
        signedBySessionId: auth.session.id,
        asanTransactionId: body.asanTransactionId,
      });
    }

    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
