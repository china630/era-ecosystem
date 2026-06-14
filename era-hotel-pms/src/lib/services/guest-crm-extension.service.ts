import { prisma } from '@/lib/prisma';

export type GuestCrmExtensionData = {
  interests: string[];
  socialMedia: Record<string, string>;
  generalCrmNotes: string;
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getGuestCrmExtension(guestId: string): Promise<GuestCrmExtensionData> {
  const row = await prisma.guestCrmExtension.findUnique({ where: { guestId } });
  return {
    interests: parseJson<string[]>(row?.interestsJson, []),
    socialMedia: parseJson<Record<string, string>>(row?.socialMediaJson, {}),
    generalCrmNotes: row?.generalCrmNotes ?? '',
  };
}

export async function upsertGuestCrmExtension(
  guestId: string,
  patch: Partial<GuestCrmExtensionData>,
) {
  const current = await getGuestCrmExtension(guestId);
  const next = {
    interests: patch.interests ?? current.interests,
    socialMedia: patch.socialMedia ?? current.socialMedia,
    generalCrmNotes: patch.generalCrmNotes ?? current.generalCrmNotes,
  };
  return prisma.guestCrmExtension.upsert({
    where: { guestId },
    create: {
      guestId,
      interestsJson: JSON.stringify(next.interests),
      socialMediaJson: JSON.stringify(next.socialMedia),
      generalCrmNotes: next.generalCrmNotes,
    },
    update: {
      interestsJson: JSON.stringify(next.interests),
      socialMediaJson: JSON.stringify(next.socialMedia),
      generalCrmNotes: next.generalCrmNotes,
    },
  });
}
