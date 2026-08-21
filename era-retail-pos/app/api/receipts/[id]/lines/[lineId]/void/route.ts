import { Prisma } from "@prisma/client";
import { jsonOk, jsonError, handleRouteError, assertRetailEntitled } from "@/lib/api-utils";
import { receiptLineVoidDenied } from "@/lib/receipt-status-gates";
import { totalsFromReceipt } from "@/lib/receipt-totals";
import { prisma } from "@/lib/prisma";
import { canVoidLine, getRequestSession } from "@/lib/session";

type ReceiptWithLines = Prisma.ReceiptGetPayload<{ include: { lines: true } }>;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  try {
    await assertRetailEntitled();
    const session = await getRequestSession();
    if (!session) return jsonError("Unauthorized", 401);
    if (!canVoidLine(session)) {
      return jsonError("SHIFT_SUPERVISOR or OUTLET_ADMIN role required", 403);
    }

    const { id, lineId } = await params;
    const receipt = (await prisma.receipt.findUnique({
      where: { id },
      include: { lines: true },
    })) as ReceiptWithLines | null;
    if (!receipt) return jsonError("Receipt not found", 404);
    const lineVoidDenied = receiptLineVoidDenied(receipt.status);
    if (lineVoidDenied) return jsonError(lineVoidDenied, 400);

    const line = receipt.lines.find((item) => item.id === lineId);
    if (!line) return jsonError("Line not found", 404);
    if (line.lineStatus === "VOID") {
      return jsonOk({ receipt, line });
    }

    await prisma.receiptLine.update({
      where: { id: lineId },
      data: { lineStatus: "VOID" },
    });

    const linesAfterVoid = receipt.lines.map((item) =>
      item.id === lineId ? { ...item, lineStatus: "VOID" as const } : item,
    );
    const { subtotal, discountAmount, amountNet } = totalsFromReceipt(
      receipt,
      linesAfterVoid,
    );

    const updated = await prisma.receipt.update({
      where: { id },
      data: { subtotalAmount: subtotal, discountAmount, amountNet },
      include: { lines: true },
    });

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
