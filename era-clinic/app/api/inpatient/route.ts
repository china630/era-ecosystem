import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const wards = await prisma.ward.findMany({
      include: {
        beds: {
          include: {
            assignments: {
              where: { dischargedAt: null },
              take: 1,
            },
          },
        },
      },
    });
    return jsonOk({ wards });
  } catch (err) {
    return handleRouteError(err);
  }
}

const bodySchema = z.object({
  wardCode: z.string(),
  bedCode: z.string(),
  patientRefId: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    let ward = await prisma.ward.findUnique({ where: { code: body.wardCode } });
    if (!ward) {
      ward = await prisma.ward.create({
        data: { code: body.wardCode, name: body.wardCode },
      });
    }
    let bed = await prisma.bed.findFirst({
      where: { wardId: ward.id, code: body.bedCode },
    });
    if (!bed) {
      bed = await prisma.bed.create({
        data: { wardId: ward.id, code: body.bedCode, status: "OCCUPIED" },
      });
    }
    const assignment = await prisma.bedAssignment.create({
      data: { bedId: bed.id, patientRefId: body.patientRefId },
    });
    return jsonOk(assignment, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
