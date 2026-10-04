import { jsonOk, jsonError, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { receiptVoidDenied } from "@/lib/receipt-status-gates";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    assertPermission(session, PERMISSIONS.RECEIPTS_VOID_LINE);
    const { id } = await params;
    const receipt = await prisma.receipt.findUnique({ where: { id } });
    if (!receipt) return jsonError("Receipt not found", 404);
    if (receipt.status === "VOID") return jsonOk(receipt);
    const voidDenied = receiptVoidDenied(receipt.status);
    if (voidDenied) return jsonError(voidDenied, 400);

    const voided = await prisma.receipt.update({
      where: { id },
      data: { status: "VOID" },
    });
    return jsonOk(voided);
  } catch (err) {
    return handleRouteError(err);
  }
}
