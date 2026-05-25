import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { canVoidLine, getRequestSession } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  try {
    const session = await getRequestSession();
    if (!session) return jsonError("Unauthorized", 401);
    if (!canVoidLine(session)) {
      return jsonError("SHIFT_SUPERVISOR or OUTLET_ADMIN role required", 403);
    }

    const { id, lineId } = await params;
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!receipt) return jsonError("Receipt not found", 404);
    if (receipt.status !== "OPEN") {
      return jsonError("Only open receipts allow line void", 400);
    }

    const line = receipt.lines.find((item) => item.id === lineId);
    if (!line) return jsonError("Line not found", 404);
    if (line.lineStatus === "VOID") {
      return jsonOk({ receipt, line });
    }

    await prisma.receiptLine.update({
      where: { id: lineId },
      data: { lineStatus: "VOID" },
    });

    const amountNet = receipt.lines
      .filter((item) => item.id !== lineId && item.lineStatus === "ACTIVE")
      .reduce((sum, item) => sum + Number(item.lineTotal), 0);

    const updated = await prisma.receipt.update({
      where: { id },
      data: { amountNet },
      include: { lines: true },
    });

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
