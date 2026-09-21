import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  buyerAuthCookieName,
  verifyBuyerSession,
  type BuyerSessionPayload,
} from "@era/satellite-kit";
import type { Request } from "express";

export type BuyerRequest = Request & { buyerSession?: BuyerSessionPayload };

@Injectable()
export class BuyerSessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<BuyerRequest>();
    const cookieName = buyerAuthCookieName();
    const cookieToken =
      typeof req.cookies?.[cookieName] === "string"
        ? (req.cookies[cookieName] as string)
        : undefined;
    const auth = req.headers.authorization;
    const bearer =
      auth?.startsWith("Bearer ") ? auth.slice(7).trim() : undefined;
    const token = bearer || cookieToken;
    if (!token) {
      throw new UnauthorizedException("Buyer session required");
    }
    try {
      const session = await verifyBuyerSession(token);
      if (!session.organizationId || !session.counterpartyId) {
        throw new UnauthorizedException("Invalid buyer session scope");
      }
      req.buyerSession = session;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid buyer session");
    }
  }
}
