import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { clinicNestSession, clinicStaffGuard } from "../bridge";

export const CLINIC_SESSION = Symbol("clinicSession");

type Guarded = {
  [CLINIC_SESSION]?: Awaited<ReturnType<typeof clinicNestSession>>;
};

@Injectable()
export class ClinicApiGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Guarded>();
    try {
      await clinicStaffGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as never);
    } catch {
      throw new UnauthorizedException({ error: "Unauthorized" });
    }
    req[CLINIC_SESSION] = await clinicNestSession(req as never);
    return true;
  }
}

export function readClinicSession(req: object) {
  const session = (req as Guarded)[CLINIC_SESSION];
  if (!session) throw new UnauthorizedException({ error: "Unauthorized" });
  return session;
}
