import { getDefaultTenant } from "@/domain/settings/settings.service";
import type { PatientSex } from "@prisma/client";
import {
  occupancyFitsGenderWindow,
  resolveGenderSession,
  genderTenantFromPrisma,
  type GenderSessionTypeInput,
} from "@/domain/procedure/gender-session";

export async function slotAllowedForGender(input: {
  procedureType: GenderSessionTypeInput;
  sex: PatientSex | null | undefined;
  startsAt: Date;
  endsAt: Date;
}): Promise<boolean> {
  const tenant = await getDefaultTenant();
  const resolved = resolveGenderSession(genderTenantFromPrisma(tenant), input.procedureType);
  return occupancyFitsGenderWindow({
    resolved,
    sex: input.sex,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
}
