import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { expressCookieReader, expressHeaderReader } from "@era/satellite-kit";
import { getSatelliteSession } from "@/lib/api-utils";
import { CONSTRUCTION_SESSION_KEY, type ConstructionRequest } from "../session";

@Injectable()
export class ConstructionStaffGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ConstructionRequest>();
    const session = await getSatelliteSession({
      cookies: expressCookieReader(req),
      headers: expressHeaderReader(req),
    });
    if (!session) throw new UnauthorizedException({ error: "Unauthorized" });
    req[CONSTRUCTION_SESSION_KEY] = session;
    return true;
  }
}
