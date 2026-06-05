import { lookupGlobalPersonByFin, resolveGlobalPerson } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export async function linkPatientGlobalPerson(input: {
  patientRefId: string;
  fin?: string;
  fullName?: string;
  phone?: string;
}): Promise<string | null> {
  let globalPersonId: string | null = null;
  if (input.fin?.trim()) {
    const r = await lookupGlobalPersonByFin(input.fin.trim());
    globalPersonId = r.globalPersonId;
  }
  if (!globalPersonId && input.fullName?.trim()) {
    const r = await resolveGlobalPerson({
      fin: input.fin?.trim(),
      fullName: input.fullName.trim(),
      phone: input.phone?.trim(),
    });
    globalPersonId = r.globalPersonId;
  }
  if (globalPersonId) {
    await prisma.patientRef.update({
      where: { id: input.patientRefId },
      data: { globalPersonId },
    });
  }
  return globalPersonId;
}
