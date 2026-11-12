import { prisma } from "@/lib/prisma";

export async function listPunchListItems(projectId: string) {
  return prisma.punchListItem.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export type CreatePunchListItemInput = {
  location: string;
  description: string;
  photoUrl?: string;
};

export async function createPunchListItem(projectId: string, body: CreatePunchListItemInput) {
  return prisma.punchListItem.create({
    data: {
      projectId,
      location: body.location,
      description: body.description,
      photoUrl: body.photoUrl,
    },
  });
}

export async function findPunchListItem(projectId: string, itemId: string) {
  return prisma.punchListItem.findFirst({
    where: { id: itemId, projectId },
  });
}

export async function updatePunchListItemStatus(
  itemId: string,
  status: "OPEN" | "FIXED" | "VERIFIED",
) {
  return prisma.punchListItem.update({
    where: { id: itemId },
    data: { status },
  });
}
