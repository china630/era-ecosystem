import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const { batchId } = await params;
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        leads: {
          select: {
            id: true,
            title: true,
            taxId: true,
            contactPhone: true,
            prospectType: true,
            stage: true,
          },
          take: 50,
        },
      },
    });
    if (!batch) return jsonError("Import batch not found", 404);
    let report: unknown = {};
    try {
      report = JSON.parse(batch.reportJson);
    } catch {
      report = {};
    }
    return jsonOk({ ...batch, report });
  } catch (err) {
    return handleRouteError(err);
  }
}
