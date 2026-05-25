import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const receipt = await prisma.receipt.findUnique({ where: { id } });
    if (!receipt) return jsonError("Receipt not found", 404);
    if (receipt.status === "VOID") return jsonOk(receipt);
    if (receipt.status === "PAID") {
      return jsonError("Paid receipts must be returned, not voided", 400);
    }

    const voided = await prisma.receipt.update({
      where: { id },
      data: { status: "VOID" },
    });
    return jsonOk(voided);
  } catch (err) {
    return handleRouteError(err);
  }
}
