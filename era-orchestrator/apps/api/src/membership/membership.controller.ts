import {
  Controller,
  Get,
  Headers,
  Post,
  Body,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Controller()
export class MembershipController {
  constructor(private readonly auth: AuthService) {}

  private async userIdFromBearer(authHeader: string | undefined): Promise<string> {
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Bearer token required");
    }
    const token = authHeader.slice(7);
    const payload = await this.auth.verifyAccessToken(token);
    return payload.sub;
  }

  @Get("memberships")
  async list(@Headers("authorization") authorization: string | undefined) {
    const userId = await this.userIdFromBearer(authorization);
    return this.auth.listMemberships(userId);
  }

  @Post("auth/switch-organization")
  async switchOrg(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: { organizationId: string },
  ) {
    const userId = await this.userIdFromBearer(authorization);
    return this.auth.switchOrganization(userId, body.organizationId);
  }
}
