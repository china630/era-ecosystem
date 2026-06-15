import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const BANKING_MODULE_KEY = "bankingModule";

export const RequireBankingModule = (moduleKey: string) =>
  SetMetadata(BANKING_MODULE_KEY, moduleKey);

@Injectable()
export class BankingModuleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const moduleKey = this.reflector.getAllAndOverride<string | undefined>(
      BANKING_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!moduleKey) return true;

    const enabledCsv = process.env.BANKING_ENABLED_MODULES;
    if (!enabledCsv) return true;

    const enabled = enabledCsv.split(",").map((s) => s.trim()).filter(Boolean);
    if (enabled.length === 0) return true;
    if (enabled.includes(moduleKey) || enabled.includes("all")) return true;

    throw new ForbiddenException(`Banking module not enabled: ${moduleKey}`);
  }
}
