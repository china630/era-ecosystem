import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { StaffSession } from "@/lib/api-utils";
import { CONSTRUCTION_SESSION_KEY, type ConstructionRequest } from "../session";

export const Staff = createParamDecorator((_data: unknown, ctx: ExecutionContext): StaffSession => {
  const req = ctx.switchToHttp().getRequest<ConstructionRequest>();
  const session = req[CONSTRUCTION_SESSION_KEY];
  if (!session) throw new Error("Staff session missing after guard");
  return session;
});
