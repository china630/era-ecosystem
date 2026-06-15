import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BankAuthRequest } from "../../auth/bank-auth.guard";
import { verifyCustomerJwt, type CustomerJwtPayload } from "./dbo-crypto.util";

export type BankCustomerRequest = BankAuthRequest & {
  customerAuth: CustomerJwtPayload;
};

@Injectable()
export class BankCustomerAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<BankCustomerRequest>();
    const secret = this.config.get<string>("BANK_DBO_JWT_SECRET")?.trim();
    if (!secret || secret.length < 16) {
      throw new UnauthorizedException("BANK_DBO_JWT_SECRET not configured");
    }

    const header =
      req.headers["x-customer-authorization"] ?? req.headers["x-customer-token"];
    const raw = typeof header === "string" ? header : null;
    const token = raw?.startsWith("Bearer ") ? raw.slice(7).trim() : raw?.trim();
    if (!token) throw new UnauthorizedException("Customer JWT required");

    const payload = verifyCustomerJwt(token, secret);
    if (!payload) throw new UnauthorizedException("Invalid or expired customer JWT");
    req.customerAuth = payload;
    return true;
  }
}
