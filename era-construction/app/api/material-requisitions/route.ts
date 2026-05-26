import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { createShipment } from "@/integration/control-plane-platform.client";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  projectCode: z.string(),
  itemCode: z.string(),
  description: z.string(),
  qty: z.number().positive(),
});

export async function GET() {
  try {
    const requisitions = await prisma.materialRequisition.findMany({
      include: { project: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(requisitions);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const project = await prisma.project.findUnique({
      where: { code: body.projectCode },
    });
    if (!project) return jsonError("Project not found", 404);

    const requisition = await prisma.materialRequisition.create({
      data: {
        projectId: project.id,
        itemCode: body.itemCode,
        description: body.description,
        qty: body.qty,
      },
      include: { project: true },
    });

    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? "";
    if (organizationId) {
      try {
        await createShipment(
          {
            sourceEntityType: "material_requisition",
            sourceEntityId: requisition.id,
            externalRef: body.itemCode,
          },
          { organizationId },
        );
      } catch {
        // optional delivery stub
      }
    }

    return jsonOk(requisition, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
