import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  location: z.string().min(1),
  description: z.string().min(1),
  photoUrl: z.string().max(2048).optional(),
});

const patchSchema = z.object({
  itemId: z.string(),
  status: z.enum(["OPEN", "FIXED", "VERIFIED"]),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const items = await prisma.punchListItem.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(items);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);
    const body = createSchema.parse(await req.json());
    const item = await prisma.punchListItem.create({
      data: {
        projectId: id,
        location: body.location,
        description: body.description,
        photoUrl: body.photoUrl,
      },
    });
    return jsonOk(item, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const item = await prisma.punchListItem.findFirst({
      where: { id: body.itemId, projectId: id },
    });
    if (!item) return jsonError("Item not found", 404);
    const updated = await prisma.punchListItem.update({
      where: { id: item.id },
      data: { status: body.status },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
