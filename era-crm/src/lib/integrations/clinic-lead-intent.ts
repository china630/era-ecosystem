/**
 * Best-effort clinic appointment intent when lead uses clinic vertical pipeline (audit v4 W5).
 */
import { prisma } from "@/lib/prisma";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { isClinicVerticalPipelineName } from "@/lib/integrations/pipelines.service";

export const CRM_CLINIC_APPOINTMENT_INTENT = "crm.clinic.appointment_intent" as const;

export async function publishClinicLeadAppointmentIntent(input: {
  organizationId: string;
  leadId: string;
  pipelineId?: string | null;
}): Promise<void> {
  let pipelineName: string | null = null;
  if (input.pipelineId) {
    const pipe = await prisma.pipeline.findFirst({
      where: { id: input.pipelineId, organizationId: input.organizationId },
      select: { name: true },
    });
    pipelineName = pipe?.name ?? null;
  }
  if (!isClinicVerticalPipelineName(pipelineName)) return;

  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: input.organizationId },
    select: {
      id: true,
      title: true,
      contactPhone: true,
      contactEmail: true,
      globalPersonId: true,
    },
  });
  if (!lead) return;

  try {
    await dispatchSatelliteEvent({
      organizationId: input.organizationId,
      type: CRM_CLINIC_APPOINTMENT_INTENT,
      payload: {
        leadId: lead.id,
        vertical: "clinic",
        patientName: lead.title,
        contactPhone: lead.contactPhone ?? undefined,
        contactEmail: lead.contactEmail ?? undefined,
        globalPersonId: lead.globalPersonId ?? undefined,
        pipelineName,
      },
    });
  } catch (err) {
    console.warn("[crm] clinic appointment intent publish failed", err);
  }
}