import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BadRequestException, Injectable } from "@nestjs/common";
import { registryMeta } from "../../common/registry-meta";

const PROFILES = ["commercial", "ngo", "budget"] as const;
type Profile = (typeof PROFILES)[number];

@Injectable()
export class ChartOfAccountsService {
  private catalogRoot(): string {
    const fromEnv = process.env.DATA_HUB_FINANCE_CATALOG_ROOT?.trim();
    if (fromEnv) return join(fromEnv, "national");
    const hubCatalog = join(process.cwd(), "packages/database/catalog/national");
    return hubCatalog;
  }

  async get(profileRaw: string) {
    const profile = profileRaw.trim().toLowerCase() as Profile;
    if (!PROFILES.includes(profile)) {
      throw new BadRequestException({
        code: "INVALID_PROFILE",
        message: `profile must be one of: ${PROFILES.join(", ")}`,
      });
    }
    const file = `chart-of-accounts-${profile}.json`;
    const data = JSON.parse(
      await readFile(join(this.catalogRoot(), file), "utf-8"),
    ) as unknown;
    return {
      meta: registryMeta(`chart-of-accounts-${profile}`, new Date().toISOString().slice(0, 10)),
      profile,
      accounts: data,
    };
  }
}
