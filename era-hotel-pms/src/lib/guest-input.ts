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
    firstName: z.string().trim().optional().nullable(),
    middleName: z.string().trim().optional().nullable(),
    lastName: z.string().trim().optional().nullable(),
    title: z.string().trim().optional().nullable(),
    sex: z.string().trim().optional().nullable(),
    email: z.string().trim().optional().nullable(),
    birthDate: z.string().trim().optional().nullable(),
    nationality: guestNationalitySchema.default('AZ'),
    nationalIdFin: z.string().trim().optional().nullable(),
    passportNumber: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    voen: z.string().trim().optional().nullable(),
    globalPersonId: z.string().trim().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const fin = data.nationalIdFin?.trim() ?? '';
    const passport = data.passportNumber?.trim() ?? '';
    const phone = data.phone?.trim() ?? '';

    if (data.nationality === 'AZ') {
      if (!fin && !passport && !data.globalPersonId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'AZ guests need FIN or passport number',
          path: ['nationalIdFin'],
        });
      }
    } else if (!passport && !data.globalPersonId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Foreign guests need passport or travel document number',
        path: ['passportNumber'],
      });
    }

    if (data.nationality === 'AZ' && !phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone is required for AZ guests',
        path: ['phone'],
      });
    }
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
