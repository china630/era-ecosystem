import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";
import {
  buyerAuthCookieName,
  buyerSsoExchangeBodySchema,
  consumeSsoSignatureOnce,
  signBuyerSession,
  verifyBuyerSsoSignature,
} from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { BuyerSessionGuard, type BuyerRequest } from "./buyer-session.guard";
import { BuyerIssueTradeCreditGrantDto } from "./dto/buyer-issue-trade-credit-grant.dto";
import { TradeCreditPhase2Service } from "./trade-credit-phase2.service";
import { TradeCreditService } from "./trade-credit.service";

class BuyerNotifyPrefsDto {
  @ApiProperty()
  @IsBoolean()
  notifyOptIn!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notifyChannel?: string | null;
}

class BuyerFactorLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  invoiceId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string | null;
}

@ApiTags("buyer-trade-credit")
@Controller()
@Public()
export class TradeCreditBuyerController {
  constructor(
    private readonly tradeCredit: TradeCreditService,
    private readonly phase2: TradeCreditPhase2Service,
    private readonly prisma: PrismaService,
  ) {}

  @Post("auth/buyer-sso/exchange")
  @ApiOperation({
    summary: "Buyer portal SSO exchange sets era_buyer_session cookie",
  })
  exchangeAuth(
    @Body() raw: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.exchange(raw, res);
  }

  @Post("buyer/sso/exchange")
  @ApiOperation({ summary: "Buyer portal SSO exchange (alias)" })
  exchangeBuyer(
    @Body() raw: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.exchange(raw, res);
  }

  private async exchange(raw: unknown, res: Response) {
    const body = buyerSsoExchangeBodySchema.parse(raw);
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("SSO token expired");
    }
    const ok = verifyBuyerSsoSignature({
      email: body.email,
      organizationId: body.organizationId,
      counterpartyId: body.counterpartyId,
      expiresAt: body.expiresAt,
      signature: body.signature,
      jti: body.jti,
    });
    if (!ok) {
      throw new UnauthorizedException("Invalid buyer SSO signature");
    }
    if (!consumeSsoSignatureOnce(body.signature, body.expiresAt)) {
      throw new UnauthorizedException("SSO ticket already used");
    }

    const cp = await this.prisma.counterparty.findFirst({
      where: {
        id: body.counterpartyId,
        organizationId: body.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!cp) {
      throw new UnauthorizedException("Counterparty not found");
    }

    const email = body.email.trim().toLowerCase();
    const token = await signBuyerSession({
      sub: `buyer:${body.counterpartyId}:${email}`,
      actor: "buyer",
      email,
      fullName: body.fullName?.trim() || email.split("@")[0] || "Buyer",
      organizationId: body.organizationId,
      counterpartyId: body.counterpartyId,
    });

    const cookie = buyerAuthCookieName();
    res.cookie(cookie, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return {
      organizationId: body.organizationId,
      counterpartyId: body.counterpartyId,
      email,
    };
  }

  @Get("buyer/trade-credit")
  @UseGuards(BuyerSessionGuard)
  @ApiOperation({
    summary: "Buyer facility view (limit, residual, open AR); omits A-D",
  })
  async getFacility(@Req() req: BuyerRequest) {
    const session = req.buyerSession!;
    const view = await this.tradeCredit.getFacilityView(
      session.organizationId,
      session.counterpartyId,
    );
    const factorLeadEnabled = await this.phase2.isFactorLeadEntitled(
      session.organizationId,
    );
    return { ...view, factorLeadEnabled };
  }

  @Post("buyer/trade-credit/grants")
  @UseGuards(BuyerSessionGuard)
  @ApiOperation({ summary: "Buyer issues pickup grant (issuedByBuyer=true)" })
  async issueGrant(
    @Req() req: BuyerRequest,
    @Body() dto: BuyerIssueTradeCreditGrantDto,
  ) {
    const session = req.buyerSession!;
    const issued = await this.tradeCredit.issueGrant({
      organizationId: session.organizationId,
      counterpartyId: session.counterpartyId,
      amount: dto.amount,
      issuedByBuyer: true,
      issuedByUserId: null,
      override: false,
    });
    void this.phase2.maybeNotifyGrantIssued({
      organizationId: session.organizationId,
      counterpartyId: session.counterpartyId,
      grantId: issued.id,
      amount: issued.amount,
      expiresAt: issued.expiresAt,
      email: session.email,
    });
    return issued;
  }

  @Get("buyer/trade-credit/grants/:id")
  @UseGuards(BuyerSessionGuard)
  @ApiOperation({
    summary: "Grant metadata for deep link (no plaintext code reissue)",
  })
  getGrant(
    @Req() req: BuyerRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) grantId: string,
  ) {
    const session = req.buyerSession!;
    return this.phase2.getBuyerGrantMeta(
      session.organizationId,
      session.counterpartyId,
      grantId,
    );
  }

  @Get("buyer/trade-credit/invoices")
  @UseGuards(BuyerSessionGuard)
  @ApiOperation({ summary: "Open AR invoices for payment schedule" })
  listInvoices(@Req() req: BuyerRequest) {
    const session = req.buyerSession!;
    return this.tradeCredit.listOpenArInvoices(
      session.organizationId,
      session.counterpartyId,
    );
  }

  @Post("buyer/trade-credit/invoices/:id/pay-link")
  @UseGuards(BuyerSessionGuard)
  @ApiOperation({ summary: "Create payment link for open invoice (Phase 2c)" })
  payInvoice(
    @Req() req: BuyerRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) invoiceId: string,
  ) {
    const session = req.buyerSession!;
    return this.phase2.createInvoicePayLink({
      organizationId: session.organizationId,
      counterpartyId: session.counterpartyId,
      invoiceId,
    });
  }

  @Get("buyer/trade-credit/notify-prefs")
  @UseGuards(BuyerSessionGuard)
  @ApiOperation({ summary: "Buyer notify opt-in prefs (Phase 2a)" })
  getNotifyPrefs(@Req() req: BuyerRequest) {
    const session = req.buyerSession!;
    return this.phase2.getBuyerPrefs(
      session.organizationId,
      session.counterpartyId,
    );
  }

  @Put("buyer/trade-credit/notify-prefs")
  @UseGuards(BuyerSessionGuard)
  @ApiOperation({ summary: "Update buyer notify opt-in (Phase 2a)" })
  setNotifyPrefs(@Req() req: BuyerRequest, @Body() dto: BuyerNotifyPrefsDto) {
    const session = req.buyerSession!;
    return this.phase2.setBuyerPrefs(
      session.organizationId,
      session.counterpartyId,
      {
        notifyOptIn: dto.notifyOptIn,
        notifyChannel: dto.notifyChannel,
      },
    );
  }

  @Post("buyer/trade-credit/factor-leads")
  @UseGuards(BuyerSessionGuard)
  @ApiOperation({
    summary: "Submit factoring referral lead (Phase 2c; no GL)",
  })
  factorLead(@Req() req: BuyerRequest, @Body() dto: BuyerFactorLeadDto) {
    const session = req.buyerSession!;
    return this.phase2.submitFactorLead({
      organizationId: session.organizationId,
      counterpartyId: session.counterpartyId,
      invoiceId: dto.invoiceId,
      note: dto.note,
    });
  }
}
