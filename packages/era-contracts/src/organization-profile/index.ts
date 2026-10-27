import { z } from "zod";

export const orgContactKindSchema = z.enum([
  "PHONE",
  "MOBILE",
  "FAX",
  "EMAIL",
  "WEBSITE",
  "WHATSAPP",
  "TELEGRAM",
]);
export type OrgContactKind = z.infer<typeof orgContactKindSchema>;

export const orgContactPurposeSchema = z.enum([
  "GENERAL",
  "LEGAL",
  "BILLING",
  "BOOKING",
  "EMERGENCY",
  "PRINT",
]);
export type OrgContactPurpose = z.infer<typeof orgContactPurposeSchema>;

export const orgAddressKindSchema = z.enum([
  "LEGAL",
  "POSTAL",
  "SITE",
  "BRANCH",
]);
export type OrgAddressKind = z.infer<typeof orgAddressKindSchema>;

export const organizationContactChannelSchema = z.object({
  id: z.string().uuid().optional(),
  kind: orgContactKindSchema,
  value: z.string().min(1).max(500),
  label: z.string().max(120).nullable().optional(),
  purpose: orgContactPurposeSchema.default("GENERAL"),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type OrganizationContactChannelDto = z.infer<
  typeof organizationContactChannelSchema
>;

export const organizationAddressSchema = z.object({
  id: z.string().uuid().optional(),
  kind: orgAddressKindSchema,
  line1: z.string().min(1).max(500),
  line2: z.string().max(500).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  postalCode: z.string().max(32).nullable().optional(),
  country: z.string().max(2).nullable().optional(),
  lineAz: z.string().max(1000).nullable().optional(),
  lineRu: z.string().max(1000).nullable().optional(),
  lineEn: z.string().max(1000).nullable().optional(),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type OrganizationAddressDto = z.infer<typeof organizationAddressSchema>;

export const organizationProfileSnapshotSchema = z.object({
  organizationId: z.string().uuid(),
  parentOrganizationId: z.string().uuid().nullable().optional(),
  operatingMode: z.enum(["STANDALONE", "DEPARTMENT"]).optional(),
  legalName: z.string(),
  tradeName: z.string().nullable().optional(),
  nameAz: z.string().nullable().optional(),
  nameRu: z.string().nullable().optional(),
  nameEn: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  currency: z.string().default("AZN"),
  directorName: z.string().nullable().optional(),
  directorTitle: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  stampUrl: z.string().nullable().optional(),
  signatureDirectorUrl: z.string().nullable().optional(),
  bankLine: z.string().nullable().optional(),
  contacts: z.array(organizationContactChannelSchema).default([]),
  addresses: z.array(organizationAddressSchema).default([]),
  /** Flat print keys (kit PrintSnapshot whitelist). */
  print: z.object({
    "org.name": z.string(),
    "org.taxId": z.string(),
    "org.legalAddress": z.string(),
    "org.logoUrl": z.string(),
    "org.bankLine": z.string(),
    "org.phone": z.string(),
    "org.email": z.string(),
    "org.website": z.string(),
  }),
  inheritedFromParent: z
    .object({
      legalName: z.boolean().optional(),
      taxId: z.boolean().optional(),
      logoUrl: z.boolean().optional(),
      bankLine: z.boolean().optional(),
      legalAddress: z.boolean().optional(),
    })
    .optional(),
  updatedAt: z.string().datetime().optional(),
  etag: z.string().optional(),
});
export type OrganizationProfileSnapshot = z.infer<
  typeof organizationProfileSnapshotSchema
>;

export const organizationProfilePatchSchema = z.object({
  tradeName: z.string().max(300).nullable().optional(),
  nameAz: z.string().max(300).nullable().optional(),
  nameRu: z.string().max(300).nullable().optional(),
  nameEn: z.string().max(300).nullable().optional(),
  directorName: z.string().max(200).nullable().optional(),
  directorTitle: z.string().max(200).nullable().optional(),
  logoUrl: z.string().max(2000).nullable().optional(),
  stampUrl: z.string().max(2000).nullable().optional(),
  signatureDirectorUrl: z.string().max(2000).nullable().optional(),
  bankLine: z.string().max(500).nullable().optional(),
  /** When set, replaces the full contact list for the org. */
  contacts: z.array(organizationContactChannelSchema).max(50).optional(),
  /** When set, replaces the full address list for the org. */
  addresses: z.array(organizationAddressSchema).max(20).optional(),
});
export type OrganizationProfilePatch = z.infer<
  typeof organizationProfilePatchSchema
>;
