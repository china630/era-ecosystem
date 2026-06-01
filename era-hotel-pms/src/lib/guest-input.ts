import { z } from 'zod';

export const GUEST_NATIONALITIES = ['AZ', 'OTHER'] as const;
export type GuestNationality = (typeof GUEST_NATIONALITIES)[number];

export const createGuestSchema = z
  .object({
    fullName: z.string().trim().min(1),
    nationality: z.enum(GUEST_NATIONALITIES).default('AZ'),
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
      if (!fin && !passport) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'AZ guests need FIN or passport number',
          path: ['nationalIdFin'],
        });
      }
    } else if (!passport) {
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

export function normalizeGuestInput(input: CreateGuestInput) {
  return {
    fullName: input.fullName.trim(),
    nationality: input.nationality,
    nationalIdFin: input.nationalIdFin?.trim() || null,
    passportNumber: input.passportNumber?.trim() || null,
    phone: input.phone?.trim() || null,
    voen: input.voen?.trim() || null,
    globalPersonId: input.globalPersonId?.trim() || null,
  };
}
