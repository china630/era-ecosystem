import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  channel: z.enum(["whatsapp", "instagram"]),
  externalRef: z.string().min(1),
  leadId: z.string().optional(),
  preview: z.string().optional(),
  lastMessageAt: z.string().datetime().optional(),
});

export async function GET() {
  try {
    const threads = await prisma.inboxThread.findMany({
      include: {
        lead: { select: { id: true, title: true, contactRef: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    });
    return jsonOk(threads);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());

    if (body.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
      if (!lead) return jsonError("Lead not found", 404);
    }

    const thread = await prisma.inboxThread.create({
      data: {
        channel: body.channel,
        externalRef: body.externalRef,
        leadId: body.leadId,
        preview: body.preview,
        lastMessageAt: body.lastMessageAt
          ? new Date(body.lastMessageAt)
          : new Date(),
      },
      include: {
        lead: { select: { id: true, title: true, contactRef: true } },
      },
    });

    return jsonOk(thread, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
