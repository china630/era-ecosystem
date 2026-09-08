import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getGuestFull, patchGuestFull } from '@/lib/services/guest-full.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const patchSchema = z
  .object({
    fullName: z.string().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    middleName: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    sex: z.string().nullable().optional(),
    /** @deprecated use sex */
    gender: z.string().nullable().optional(),
    nationality: z.string().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    vipType: z.string().nullable().optional(),
    birthDate: z.string().nullable().optional(),
    birthPlace: z.string().nullable().optional(),
    greyList: z.boolean().optional(),
    problematic: z.boolean().optional(),
    gdprConfirmed: z.boolean().optional(),
    smsConsent: z.boolean().optional(),
    whatsappConsent: z.boolean().optional(),
    phoneConsent: z.boolean().optional(),
    emailConsent: z.boolean().optional(),
    callBack: z.boolean().optional(),
    nationalIdFin: z.string().nullable().optional(),
    voen: z.string().nullable().optional(),
    passportNumber: z.string().nullable().optional(),
    occupation: z.string().nullable().optional(),
    registrationNumber: z.string().nullable().optional(),
    vehiclePlate: z.string().nullable().optional(),
    hotelName: z.string().nullable().optional(),
    visaType: z.string().nullable().optional(),
    visaNumber: z.string().nullable().optional(),
    visaExpiry: z.string().nullable().optional(),
    maritalStatus: z.string().nullable().optional(),
    parentFatherName: z.string().nullable().optional(),
    /** @deprecated use parentFatherName */
    fatherName: z.string().nullable().optional(),
    parentMotherName: z.string().nullable().optional(),
    /** @deprecated use parentMotherName */
    motherName: z.string().nullable().optional(),
    verificationStatus: z.string().nullable().optional(),
    marriageDate: z.string().nullable().optional(),
    bonusPercent: z.number().nullable().optional(),
    phoneVerified: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    isLocked: z.boolean().optional(),
  })
  .transform(({ gender, fatherName, motherName, ...data }) => ({
    ...data,
    sex: data.sex ?? gender,
    parentFatherName: data.parentFatherName ?? fatherName,
    parentMotherName: data.parentMotherName ?? motherName,
  }));

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await getGuestFull(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    return jsonOk(serialize(await patchGuestFull(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
