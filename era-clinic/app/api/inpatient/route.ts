import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const wards = await prisma.ward.findMany({
      orderBy: { code: "asc" },
      include: {
        beds: {
          orderBy: { code: "asc" },
          include: {
            assignments: {
              where: { dischargedAt: null },
              take: 1,
            },
          },
        },
      },
    });

    const patientIds = new Set<string>();
    for (const ward of wards) {
      for (const bed of ward.beds) {
        const active = bed.assignments[0];
        if (active) patientIds.add(active.patientRefId);
      }
    }
    const patients =
      patientIds.size > 0
        ? await prisma.patientRef.findMany({
            where: { id: { in: [...patientIds] } },
            select: { id: true, refCode: true, fullName: true },
          })
        : [];
    const patientById = new Map(patients.map((p) => [p.id, p]));

    const enriched = wards.map((ward) => ({
      ...ward,
      beds: ward.beds.map((bed) => ({
        ...bed,
        assignments: bed.assignments.map((a) => ({
          ...a,
          patient: patientById.get(a.patientRefId) ?? null,
        })),
      })),
    }));

    return jsonOk({ wards: enriched });
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
    const active = await prisma.bedAssignment.findFirst({
      where: { bedId: bed.id, dischargedAt: null },
    });
    if (active) return jsonError("Bed is already occupied", 409);

    const assignment = await prisma.$transaction(async (tx) => {
      await tx.bed.update({
        where: { id: bed.id },
        data: { status: "OCCUPIED" },
      });
      return tx.bedAssignment.create({
        data: { bedId: bed.id, patientRefId: body.patientRefId },
      });
    });
    return jsonOk(assignment, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
