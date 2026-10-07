import { z } from 'zod';
import { guestComposedFullName } from '@/lib/guest-identity.shared';

/** ISO 3166-1 alpha-2 citizenship; legacy `OTHER` still accepted as "foreign, unknown". */
const guestNationalitySchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => v === 'OTHER' || /^[A-Z]{2}$/.test(v), {
    message: 'Nationality must be an ISO 3166-1 alpha-2 code',
  });

export const createGuestSchema = z
  .object({
    fullName: z.string().trim().min(1),
    firstName: z.string().trim().min(1, 'First name is required'),
    middleName: z.string().trim().optional().nullable(),
    lastName: z.string().trim().min(1, 'Last name is required'),
    title: z.string().trim().optional().nullable(),
    sex: z.string().trim().min(1, 'Gender is required'),
    email: z.string().trim().optional().nullable(),
    birthDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date is required'),
    nationality: guestNationalitySchema.default('AZ'),
    nationalIdFin: z.string().trim().optional().nullable(),
    passportNumber: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    voen: z.string().trim().optional().nullable(),
    globalPersonId: z.string().trim().optional().nullable(),
  });

export type CreateGuestInput = z.infer<typeof createGuestSchema>;

/** Ops cache fields only — identity is transient (MDM link via guest-identity). */
export function normalizeGuestInput(input: CreateGuestInput) {
  const firstName = input.firstName?.trim() || null;
  const middleName = input.middleName?.trim() || null;
  const lastName = input.lastName?.trim() || null;
  const birthDate = input.birthDate?.trim() ? new Date(input.birthDate.trim()) : null;
  return {
    fullName: guestComposedFullName({ firstName, middleName, lastName, fullName: input.fullName }),
    firstName,
    middleName,
    lastName,
    title: input.title?.trim() || null,
    sex: input.sex?.trim() || null,
    email: input.email?.trim() || null,
    birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : null,
    nationality: input.nationality,
    phone: input.phone?.trim() || null,
    voen: input.voen?.trim() || null,
    globalPersonId: input.globalPersonId?.trim() || null,
  };
}
