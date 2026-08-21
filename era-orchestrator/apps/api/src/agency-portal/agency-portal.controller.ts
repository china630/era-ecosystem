import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Public } from "../auth/decorators/public.decorator";
import { assertInternalServiceToken } from "../common/utils/internal-service-token.util";
import { AgencyPortalService } from "./agency-portal.service";
import {
  AgencyPortalInviteDto,
  AgencyPortalLoginDto,
  AgencyPortalPickPropertyDto,
  AgencyPortalRevokeGrantDto,
  AgencyPortalSetPasswordDto,
} from "./dto/agency-portal.dto";

type AgencyJwtPayload = {
  sub: string;
  email: string;
  actor: "agency";
};

@Controller("agency-portal")
export class AgencyPortalController {
  constructor(
    private readonly service: AgencyPortalService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Post("login")
  async login(@Body() body: AgencyPortalLoginDto) {
    const result = await this.service.login(body);
    const accessToken = await this.jwt.signAsync(
      {
        sub: result.accountId,
        email: result.email,
        actor: "agency",
      } satisfies AgencyJwtPayload,
      { expiresIn: "8h" },
    );
    return { ...result, accessToken };
  }

  @Public()
  @Post("properties/pick")
  async pick(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: AgencyPortalPickPropertyDto,
  ) {
    const payload = await this.requireAgencyJwt(authorization);
    return this.service.pickProperty(payload.sub, payload.email, body);
  }

  @Public()
  @Post("set-password")
  setPassword(@Body() body: AgencyPortalSetPasswordDto) {
    return this.service.setPassword(body);
  }

  /** Hotel SatAdmin invite — service token (same family as satellite events / internal). */
  @Public()
  @Post("invite")
  invite(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-service-token") xServiceToken: string | undefined,
    @Body() body: AgencyPortalInviteDto,
  ) {
    assertInternalServiceToken(authorization, "SATELLITE_EVENT_SERVICE_TOKEN", xServiceToken);
    return this.service.invite(body);
  }

  @Public()
  @Post("grants/revoke")
  revoke(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-service-token") xServiceToken: string | undefined,
    @Body() body: AgencyPortalRevokeGrantDto,
  ) {
    assertInternalServiceToken(authorization, "SATELLITE_EVENT_SERVICE_TOKEN", xServiceToken);
    return this.service.revokeGrant(body);
  }

  private async requireAgencyJwt(
    authorization: string | undefined,
  ): Promise<AgencyJwtPayload> {
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Agency session required");
    }
    try {
      const payload = await this.jwt.verifyAsync<AgencyJwtPayload>(
        authorization.slice(7).trim(),
      );
      if (payload.actor !== "agency" || !payload.sub || !payload.email) {
        throw new UnauthorizedException("Invalid agency session");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid agency session");
    }
  }
}
