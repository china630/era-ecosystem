import { z } from "zod";
import type { LeadChannel, PartyKind, ProspectType } from "@prisma/client";

export const partyKindSchema = z.enum(["INDIVIDUAL", "LEGAL_ENTITY"]);
export const prospectTypeSchema = z.enum(["CUSTOMER", "PARTNER", "OTHER"]);
export const channelSchema = z.enum([
  "whatsapp",
  "instagram",
  "visit",
  "phone",
  "other",
]);

export const leadPartyFieldsSchema = z.object({
  title: z.string().min(1).optional(),
  contactRef: z.string().min(1).optional(),
  partyKind: partyKindSchema.optional(),
  taxId: z
    .string()
    .optional()
    .transform((v) => (v?.trim() && /^\d{10}$/.test(v.trim()) ? v.trim() : undefined)),
  companyName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z
    .string()
    .optional()
    .transform((v) => (v?.trim() && v.includes("@") ? v.trim() : undefined)),
  globalPersonId: z.string().optional(),
  activitySector: z.string().optional(),
  prospectType: prospectTypeSchema.optional(),
  addressLabel: z.string().optional(),
  sourceRef: z.string().optional(),
  channel: channelSchema.optional(),
  estimatedAmount: z.number().optional(),
  ownerId: z.string().optional(),
});

export const createLeadSchema = leadPartyFieldsSchema
  .extend({
    title: z.string().min(1),
    contactRef: z.string().min(1).optional(),
    stage: z
      .enum([
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "PROPOSAL",
        "WON",
        "LOST",
      ])
      .optional(),
  })
  .refine(
    (data) => Boolean(data.contactRef?.trim() || data.contactPhone?.trim()),
    { message: "contactRef or contactPhone required" },
  );

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = leadPartyFieldsSchema;

export function toPrismaPartyData(
  body: z.infer<typeof leadPartyFieldsSchema> & { title?: string; contactRef?: string },
  defaults?: { partyKind?: PartyKind; channel?: LeadChannel; prospectType?: ProspectType },
) {
  const taxId = body.taxId?.trim() || undefined;
  const partyKind =
    body.partyKind ??
    defaults?.partyKind ??
    (taxId ? "LEGAL_ENTITY" : "INDIVIDUAL");

  return {
    ...(body.title !== undefined ? { title: body.title } : {}),
    partyKind,
    taxId,
    companyName: body.companyName?.trim() || undefined,
    contactPhone: body.contactPhone?.trim() || undefined,
    contactEmail: body.contactEmail?.trim() || undefined,
    globalPersonId: body.globalPersonId?.trim() || undefined,
    activitySector: body.activitySector?.trim() || undefined,
    prospectType: body.prospectType ?? defaults?.prospectType ?? "CUSTOMER",
    addressLabel: body.addressLabel?.trim() || undefined,
    sourceRef: body.sourceRef?.trim() || undefined,
    ...(body.channel !== undefined ? { channel: body.channel } : {}),
    ...(body.estimatedAmount !== undefined
      ? { estimatedAmount: body.estimatedAmount }
      : {}),
    ...(body.ownerId !== undefined ? { ownerId: body.ownerId } : {}),
  };
}
