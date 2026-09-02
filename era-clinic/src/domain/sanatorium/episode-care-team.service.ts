import { prisma } from "@/lib/prisma";
import { episodeWriteDenied, EPISODE_CLOSED } from "@/domain/sanatorium/episode-gates";

export type CareDoctorRow = {
  id: string;
  practitionerId: string;
  assignedAt: string;
  assignedByUserId: string | null;
  practitioner: {
    id: string;
    code: string;
    fullName: string;
    specialty: string | null;
    staffKind: string;
  };
};

export async function listEpisodeCareDoctors(
  episodeId: string,
): Promise<CareDoctorRow[]> {
  const rows = await prisma.episodeCareDoctor.findMany({
    where: { episodeId },
    orderBy: { assignedAt: "asc" },
    include: {
      practitioner: {
        select: {
          id: true,
          code: true,
          fullName: true,
          specialty: true,
          staffKind: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    practitionerId: r.practitionerId,
    assignedAt: r.assignedAt.toISOString(),
    assignedByUserId: r.assignedByUserId,
    practitioner: r.practitioner,
  }));
}

export async function countEpisodeCareDoctors(episodeId: string): Promise<number> {
  return prisma.episodeCareDoctor.count({ where: { episodeId } });
}

export async function addEpisodeCareDoctor(input: {
  episodeId: string;
  practitionerId: string;
  assignedByUserId?: string | null;
}): Promise<CareDoctorRow> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: input.episodeId },
    select: { id: true, status: true, organizationId: true },
  });
  if (!episode) {
    const err = new Error("Episode not found");
    (err as Error & { code?: string }).code = "NOT_FOUND";
    throw err;
  }
  const closed = episodeWriteDenied(episode.status);
  if (closed) {
    const err = new Error(closed);
    (err as Error & { code?: string }).code = EPISODE_CLOSED;
    throw err;
  }

  const practitioner = await prisma.practitioner.findFirst({
    where: {
      id: input.practitionerId,
      organizationId: episode.organizationId,
      active: true,
      staffKind: "DOCTOR",
    },
    select: {
      id: true,
      code: true,
      fullName: true,
      specialty: true,
      staffKind: true,
    },
  });
  if (!practitioner) {
    const err = new Error("Practitioner must be an active doctor in this organization");
    (err as Error & { code?: string }).code = "INVALID_PRACTITIONER";
    throw err;
  }

  const existing = await prisma.episodeCareDoctor.findUnique({
    where: {
      episodeId_practitionerId: {
        episodeId: input.episodeId,
        practitionerId: input.practitionerId,
      },
    },
  });
  if (existing) {
    const err = new Error("Doctor already on this course care team");
    (err as Error & { code?: string }).code = "CARE_DOCTOR_EXISTS";
    throw err;
  }

  const row = await prisma.episodeCareDoctor.create({
    data: {
      episodeId: input.episodeId,
      practitionerId: input.practitionerId,
      assignedByUserId: input.assignedByUserId ?? null,
    },
    include: {
      practitioner: {
        select: {
          id: true,
          code: true,
          fullName: true,
          specialty: true,
          staffKind: true,
        },
      },
    },
  });

  return {
    id: row.id,
    practitionerId: row.practitionerId,
    assignedAt: row.assignedAt.toISOString(),
    assignedByUserId: row.assignedByUserId,
    practitioner: row.practitioner,
  };
}

export async function removeEpisodeCareDoctor(input: {
  episodeId: string;
  practitionerId: string;
}): Promise<void> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: input.episodeId },
    select: { id: true, status: true },
  });
  if (!episode) {
    const err = new Error("Episode not found");
    (err as Error & { code?: string }).code = "NOT_FOUND";
    throw err;
  }
  const closed = episodeWriteDenied(episode.status);
  if (closed) {
    const err = new Error(closed);
    (err as Error & { code?: string }).code = EPISODE_CLOSED;
    throw err;
  }

  if (episode.status === "OPEN") {
    const count = await prisma.episodeCareDoctor.count({
      where: { episodeId: input.episodeId },
    });
    if (count <= 1) {
      const err = new Error("Cannot remove the last doctor from an open course");
      (err as Error & { code?: string }).code = "LAST_CARE_DOCTOR";
      throw err;
    }
  }

  const result = await prisma.episodeCareDoctor.deleteMany({
    where: {
      episodeId: input.episodeId,
      practitionerId: input.practitionerId,
    },
  });
  if (result.count === 0) {
    const err = new Error("Care team member not found");
    (err as Error & { code?: string }).code = "NOT_FOUND";
    throw err;
  }
}
