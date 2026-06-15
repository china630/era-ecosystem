import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { prisma } from "@/lib/prisma";
import { crmNextContactDue } from "@/lib/production-calendar";

const bodySchema = z.object({
  nextContactAt: z.string().datetime().optional(),
  offsetBusinessDays: z.coerce.number().int().min(0).max(90).optional(),
  fromDate: z.string().optional(),
  note: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return jsonError("Lead not found", 404);

    let nextContactAt: Date;
    if (body.offsetBusinessDays != null) {
      const from = body.fromDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
      const dueIso = await crmNextContactDue(from, body.offsetBusinessDays);
      nextContactAt = new Date(`${dueIso}T09:00:00.000Z`);
    } else if (body.nextContactAt) {
      nextContactAt = new Date(body.nextContactAt);
    } else {
      return jsonError("nextContactAt or offsetBusinessDays required", 400);
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { nextContactAt },
    });

    const recipient =
      process.env.CRM_NOTIFY_RECIPIENT?.trim() ||
      `lead-${lead.id}@local`;
    await trySendPlatformNotification({
      templateKey: "crm.lead.follow_up",
      channel: "EMAIL",
      messageClass: "TRANSACTIONAL",
      recipient,
      sourceEntityType: "crm_lead",
      sourceEntityId: lead.id,
      body: `Follow up scheduled for ${nextContactAt.toISOString()}${body.note ? `: ${body.note}` : ""}`,
      payload: { nextContactAt: nextContactAt.toISOString(), note: body.note },
    });

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
