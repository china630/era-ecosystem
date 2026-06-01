import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): EraJwtPayload => {
    const req = ctx.switchToHttp().getRequest<{ user: EraJwtPayload }>();
    return req.user;
  },
);
