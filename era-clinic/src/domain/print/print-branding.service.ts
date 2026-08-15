import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/domain/settings/settings.service";
import {
  DEFAULT_CHECKUP_SECTIONS,
  type CheckupSectionConfig,
  type PrintBranding,
  type PrintLang,
} from "@/domain/print/print-types";

function pick(lang: PrintLang, en: string | null, ru: string | null, az: string | null, fallback: string): string {
  if (lang === "ru") return (ru || en || az || fallback).trim() || fallback;
  if (lang === "az") return (az || en || ru || fallback).trim() || fallback;
  return (en || az || ru || fallback).trim() || fallback;
}

export async function getPrintBranding(lang: PrintLang): Promise<PrintBranding> {
  const tenant = await getDefaultTenant();
  return {
    logoDataUrl: tenant.printLogoDataUrl ?? null,
    clinicName: pick(
      lang,
      tenant.printClinicNameEn,
      tenant.printClinicNameRu,
      tenant.printClinicNameAz,
      tenant.name,
    ),
    address: pick(
      lang,
      tenant.printAddressEn,
      tenant.printAddressRu,
      tenant.printAddressAz,
      "",
    ),
    phone: tenant.printPhone ?? null,
    email: tenant.printEmail ?? null,
    website: tenant.printWebsite ?? null,
    footer: pick(
      lang,
      tenant.printFooterEn,
      tenant.printFooterRu,
      tenant.printFooterAz,
      "",
    ) || null,
    signatureLab: tenant.printSignatureLab ?? null,
    signatureDoctor: tenant.printSignatureDoctor ?? null,
  };
}

export async function getCheckupSectionsConfig(): Promise<CheckupSectionConfig[]> {
  const tenant = await getDefaultTenant();
  if (!tenant.checkupSectionsJson) return DEFAULT_CHECKUP_SECTIONS;
  try {
    const parsed = JSON.parse(tenant.checkupSectionsJson) as CheckupSectionConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CHECKUP_SECTIONS;
    return parsed;
  } catch {
    return DEFAULT_CHECKUP_SECTIONS;
  }
}

export type PrintSettingsPatch = {
  printLogoDataUrl?: string | null;
  printClinicNameEn?: string | null;
  printClinicNameRu?: string | null;
  printClinicNameAz?: string | null;
  printAddressEn?: string | null;
  printAddressRu?: string | null;
  printAddressAz?: string | null;
  printPhone?: string | null;
  printEmail?: string | null;
  printWebsite?: string | null;
  printFooterEn?: string | null;
  printFooterRu?: string | null;
  printFooterAz?: string | null;
  printSignatureLab?: string | null;
  printSignatureDoctor?: string | null;
  checkupSectionsJson?: string | null;
};

export async function updatePrintSettings(input: PrintSettingsPatch) {
  const tenant = await getDefaultTenant();
  return prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      ...(input.printLogoDataUrl !== undefined ? { printLogoDataUrl: input.printLogoDataUrl } : {}),
      ...(input.printClinicNameEn !== undefined ? { printClinicNameEn: input.printClinicNameEn } : {}),
      ...(input.printClinicNameRu !== undefined ? { printClinicNameRu: input.printClinicNameRu } : {}),
      ...(input.printClinicNameAz !== undefined ? { printClinicNameAz: input.printClinicNameAz } : {}),
      ...(input.printAddressEn !== undefined ? { printAddressEn: input.printAddressEn } : {}),
      ...(input.printAddressRu !== undefined ? { printAddressRu: input.printAddressRu } : {}),
      ...(input.printAddressAz !== undefined ? { printAddressAz: input.printAddressAz } : {}),
      ...(input.printPhone !== undefined ? { printPhone: input.printPhone } : {}),
      ...(input.printEmail !== undefined ? { printEmail: input.printEmail } : {}),
      ...(input.printWebsite !== undefined ? { printWebsite: input.printWebsite } : {}),
      ...(input.printFooterEn !== undefined ? { printFooterEn: input.printFooterEn } : {}),
      ...(input.printFooterRu !== undefined ? { printFooterRu: input.printFooterRu } : {}),
      ...(input.printFooterAz !== undefined ? { printFooterAz: input.printFooterAz } : {}),
      ...(input.printSignatureLab !== undefined ? { printSignatureLab: input.printSignatureLab } : {}),
      ...(input.printSignatureDoctor !== undefined
        ? { printSignatureDoctor: input.printSignatureDoctor }
        : {}),
      ...(input.checkupSectionsJson !== undefined
        ? { checkupSectionsJson: input.checkupSectionsJson }
        : {}),
    },
  });
}
