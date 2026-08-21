import { Prisma } from "@prisma/client";
import { jsonOk, jsonError, handleRouteError, assertRetailEntitled } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

type ShiftXReport = Prisma.ShiftGetPayload<{
  include: {
    register: { include: { outlet: true } };
    receipts: true;
  };
}>;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertRetailEntitled();
    const { id } = await params;
    const shift = (await prisma.shift.findUnique({
      where: { id },
      include: {
        register: { include: { outlet: true } },
        receipts: { where: { status: "PAID" } },
      },
    })) as ShiftXReport | null;
    if (!shift) return jsonError("Shift not found", 404);

    const totalSales = shift.receipts.reduce(
      (sum, r) => sum + Number(r.amountNet),
      0,
    );

    return jsonOk({
      shiftId: shift.id,
      status: shift.status,
      outletCode: shift.register.outlet.code,
      registerCode: shift.register.code,
      openedAt: shift.openedAt,
      paidReceiptCount: shift.receipts.length,
      totalSales,
      currency: "AZN",
      reportType: "X",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
