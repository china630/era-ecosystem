import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Public } from "../auth/decorators/public.decorator";
import {
  assertInternalServiceToken,
  assertMatchingServiceToken,
} from "../common/utils/internal-service-token.util";
import { BuyerPortalService } from "./buyer-portal.service";
import {
  BuyerPortalInviteDto,
  BuyerPortalLoginDto,
  BuyerPortalPickOrgDto,
  BuyerPortalRevokeGrantDto,
  BuyerPortalSetPasswordDto,
} from "./dto/buyer-portal.dto";

type BuyerJwtPayload = {
  sub: string;
  email: string;
  actor: "buyer";
};

type OrchAdminJwtPayload = {
  sub?: string;
  isSuperAdmin?: boolean;
  role?: string;
};

@Controller("buyer-portal")
export class BuyerPortalController {
  constructor(
    private readonly service: BuyerPortalService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Post("login")
  async login(@Body() body: BuyerPortalLoginDto) {
    const result = await this.service.login(body);
    const accessToken = await this.jwt.signAsync(
      {
        sub: result.accountId,
        email: result.email,
        actor: "buyer",
      } satisfies BuyerJwtPayload,
      { expiresIn: "8h" },
    );
    return { ...result, accessToken };
  }

  @Public()
  @Post("orgs/pick")
  async pick(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: BuyerPortalPickOrgDto,
  ) {
    const payload = await this.requireBuyerJwt(authorization);
    return this.service.pickOrg(payload.sub, payload.email, body);
  }

  @Public()
  @Post("set-password")
  setPassword(@Body() body: BuyerPortalSetPasswordDto) {
    return this.service.setPassword(body);
  }

  /**
   * Finance staff invite (service token) or Control Plane admin JWT.
   */
  @Public()
  @Post("invite")
  async invite(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-service-token") xServiceToken: string | undefined,
    @Body() body: BuyerPortalInviteDto,
  ) {
    await this.requireInviteAuth(authorization, xServiceToken);
    return this.service.invite(body);
  }

  @Public()
  @Post("grants/revoke")
  async revoke(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-service-token") xServiceToken: string | undefined,
    @Body() body: BuyerPortalRevokeGrantDto,
  ) {
    await this.requireInviteAuth(authorization, xServiceToken);
    return this.service.revokeGrant(body);
  }

  private async requireBuyerJwt(
    authorization: string | undefined,
  ): Promise<BuyerJwtPayload> {
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Buyer session required");
    }
    try {
      const payload = await this.jwt.verifyAsync<BuyerJwtPayload>(
        authorization.slice(7).trim(),
      );
      if (payload.actor !== "buyer" || !payload.sub || !payload.email) {
        throw new UnauthorizedException("Invalid buyer session");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid buyer session");
    }
  }

  private async requireInviteAuth(
    authorization: string | undefined,
    xServiceToken: string | undefined,
  ): Promise<void> {
    try {
      assertMatchingServiceToken(authorization, xServiceToken);
      return;
    } catch {
      /* fall through to orch admin JWT */
    }
    try {
      assertInternalServiceToken(
        authorization,
        "SATELLITE_EVENT_SERVICE_TOKEN",
        xServiceToken,
      );
      return;
    } catch {
      /* fall through */
    }
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "Service token or Control Plane admin session required",
      );
    }
    try {
      const payload = await this.jwt.verifyAsync<OrchAdminJwtPayload>(
        authorization.slice(7).trim(),
      );
      if (payload.isSuperAdmin === true) return;
      const role = String(payload.role ?? "").toUpperCase();
      if (role === "OWNER" || role === "ADMIN") return;
    } catch {
      /* ignore */
    }
    throw new UnauthorizedException(
      "Service token or Control Plane admin session required",
    );
  }
}
