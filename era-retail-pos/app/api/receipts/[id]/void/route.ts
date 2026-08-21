import { jsonOk, jsonError, handleRouteError, assertRetailEntitled } from "@/lib/api-utils";
import { receiptVoidDenied } from "@/lib/receipt-status-gates";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertRetailEntitled();
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
