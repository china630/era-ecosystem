import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { decryptText, encryptText } from "../security/pii-crypto.util";

const CHANNEX_CONFIG_KEY = "vendor.channex";

export type ChannexVendorConfigPublic = {
  apiBase: string;
  hasApiKey: boolean;
  pmsCertified: boolean;
  updatedAt: string | null;
};

type ChannexStored = {
  apiBase?: string;
  apiKeyCipher?: string;
  pmsCertified?: boolean;
};

const DEFAULT_STAGING_BASE = "https://staging.channex.io/api/v1";
const DEFAULT_PROD_BASE = "https://app.channex.io/api/v1";

@Injectable()
export class ChannexVendorService {
  constructor(private readonly prisma: PrismaService) {}

  private async readStored(): Promise<{ value: ChannexStored; updatedAt: Date | null }> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: CHANNEX_CONFIG_KEY },
    });
    if (!row) return { value: {}, updatedAt: null };
    const value = (row.value ?? {}) as ChannexStored;
    return { value, updatedAt: row.updatedAt };
  }

  async getPublic(): Promise<ChannexVendorConfigPublic> {
    const { value, updatedAt } = await this.readStored();
    return {
      apiBase: value.apiBase?.trim() || DEFAULT_STAGING_BASE,
      hasApiKey: Boolean(value.apiKeyCipher?.trim()),
      pmsCertified: Boolean(value.pmsCertified),
      updatedAt: updatedAt?.toISOString() ?? null,
    };
  }

  /**
   * Material for satellite ARI/webhook clients — service-token only.
   * Never expose via Super-Admin JSON dumps of this shape.
   */
  async getClientMaterial(): Promise<{
    apiBase: string;
    apiKey: string | null;
    hasApiKey: boolean;
    pmsCertified: boolean;
  }> {
    const { value } = await this.readStored();
    const apiBase = value.apiBase?.trim() || DEFAULT_STAGING_BASE;
    let apiKey: string | null = null;
    if (value.apiKeyCipher?.trim()) {
      try {
        apiKey = decryptText(value.apiKeyCipher);
      } catch {
        apiKey = null;
      }
    }
    return {
      apiBase,
      apiKey,
      hasApiKey: Boolean(apiKey),
      pmsCertified: Boolean(value.pmsCertified),
    };
  }

  async upsert(input: {
    apiBase?: string;
    apiKey?: string | null;
    useProductionBase?: boolean;
    pmsCertified?: boolean;
  }): Promise<ChannexVendorConfigPublic> {
    const { value } = await this.readStored();
    let apiBase = value.apiBase?.trim() || DEFAULT_STAGING_BASE;
    if (input.useProductionBase === true) {
      apiBase = DEFAULT_PROD_BASE;
    } else if (input.useProductionBase === false) {
      apiBase = DEFAULT_STAGING_BASE;
    } else if (input.apiBase?.trim()) {
      apiBase = input.apiBase.trim().replace(/\/$/, "");
    }

    let apiKeyCipher = value.apiKeyCipher;
    if (input.apiKey === null) {
      apiKeyCipher = undefined;
    } else if (typeof input.apiKey === "string" && input.apiKey.trim()) {
      apiKeyCipher = encryptText(input.apiKey.trim());
    }

    const pmsCertified =
      input.pmsCertified === undefined ? Boolean(value.pmsCertified) : Boolean(input.pmsCertified);

    if (!apiBase.startsWith("https://")) {
      throw new BadRequestException("Channex apiBase must be https");
    }

    await this.prisma.systemConfig.upsert({
      where: { key: CHANNEX_CONFIG_KEY },
      create: {
        key: CHANNEX_CONFIG_KEY,
        value: { apiBase, apiKeyCipher, pmsCertified },
      },
      update: {
        value: { apiBase, apiKeyCipher, pmsCertified },
      },
    });
    return this.getPublic();
  }

  async requireConfigured(): Promise<void> {
    const pub = await this.getPublic();
    if (!pub.hasApiKey) {
      throw new NotFoundException("Channex partner API key not configured");
    }
  }
}
