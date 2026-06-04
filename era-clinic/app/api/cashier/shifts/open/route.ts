import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const code = `SHIFT-${Date.now()}`;
    const shift = await prisma.clinicShift.create({
      data: { code, status: "OPEN" },
    });
    return jsonOk(shift, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
