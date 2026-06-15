import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CredentialStatus,
  CustomerType,
  KycStatus,
  SignatoryStatus,
  TrustTier,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { AsanSimaStubAdapter } from "../../integration/asan-sima-stub.adapter";
import { MdmClient } from "../../integration/mdm.client";
import {
  hashLoginIdentifier,
  hashOtpCode,
  signCustomerJwt,
} from "./dbo-crypto.util";

@Injectable()
export class DboAuthService {
  private readonly logger = new Logger(DboAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly config: ConfigService,
    private readonly asan: AsanSimaStubAdapter,
    private readonly mdm: MdmClient,
  ) {}

  private jwtSecret(): string {
    const secret = this.config.get<string>("BANK_DBO_JWT_SECRET")?.trim();
    if (!secret || secret.length < 16) {
      throw new BadRequestException("BANK_DBO_JWT_SECRET must be at least 16 chars");
    }
    return secret;
  }

  private devOtpCode(): string {
    return this.config.get<string>("DEV_OTP_CODE") ?? "123456";
  }

  async resolveCustomerByIdentifier(identifier: string, channel: "RETAIL" | "CORPORATE") {
    const loginHash = hashLoginIdentifier(identifier);
    const credential = await this.prisma.dboCustomerCredential.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        loginHash,
        status: CredentialStatus.ACTIVE,
      },
    });
    if (!credential) {
      throw new UnauthorizedException("Unknown customer credentials");
    }
    const customer = await this.prisma.bankCustomer.findFirst({
      where: { id: credential.customerId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!customer || customer.status !== "ACTIVE") {
      throw new UnauthorizedException("Customer not active");
    }
    if (channel === "RETAIL" && customer.customerType !== CustomerType.NATURAL) {
      throw new UnauthorizedException("Retail channel requires NATURAL customer");
    }
    if (channel === "CORPORATE" && customer.customerType !== CustomerType.LEGAL) {
      throw new UnauthorizedException("Corporate channel requires LEGAL customer");
    }
    return { customer, credential };
  }

  async requestOtp(identifier: string, channel: "RETAIL" | "CORPORATE") {
    const { customer, credential } = await this.resolveCustomerByIdentifier(identifier, channel);
    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account temporarily locked");
    }

    const code = this.devOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.dboOtpChallenge.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: customer.id,
        codeHash: hashOtpCode(code),
        expiresAt,
      },
    });

    this.logger.log(`DBO OTP for ${identifier}: ${code} (dev only)`);
    return { sent: true, expiresAt: expiresAt.toISOString(), devHint: process.env.NODE_ENV !== "production" };
  }

  async verifyOtp(input: {
    identifier: string;
    channel: "RETAIL" | "CORPORATE";
    code: string;
  }) {
    const { customer, credential } = await this.resolveCustomerByIdentifier(
      input.identifier,
      input.channel,
    );

    const challenge = await this.prisma.dboOtpChallenge.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: customer.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge || challenge.codeHash !== hashOtpCode(input.code)) {
      await this.prisma.dboCustomerCredential.update({
        where: { id: credential.id },
        data: { failedAttempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid OTP");
    }

    await this.prisma.dboOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    await this.prisma.dboCustomerCredential.update({
      where: { id: credential.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    return this.issueCustomerJwt(customer.id, input.channel);
  }

  startAsanChallenge(identifier: string, channel: "RETAIL" | "CORPORATE") {
    return this.asan.startChallenge({ identifier, fin: identifier });
  }

  async completeAsanCallback(input: {
    transactionId: string;
    identifier: string;
    channel: "RETAIL" | "CORPORATE";
  }) {
    const result = this.asan.completeChallenge(input.transactionId);
    if (!result.verified) throw new UnauthorizedException("ASAN verification failed");

    const { customer } = await this.resolveCustomerByIdentifier(input.identifier, input.channel);

    await this.prisma.bankCustomer.update({
      where: { id: customer.id },
      data: { kycTrustTier: TrustTier.GOVERNMENT_VERIFIED, kycStatus: KycStatus.VERIFIED },
    });

    if (customer.globalPersonId) {
      await this.mdm.resolvePerson({ fin: result.fin }).catch(() => undefined);
      this.logger.log(`MDM trust upgrade stub for globalPersonId=${customer.globalPersonId}`);
    }

    return this.issueCustomerJwt(customer.id, input.channel);
  }

  async me(customerId: string) {
    const customer = await this.prisma.bankCustomer.findFirst({
      where: { id: customerId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!customer) throw new UnauthorizedException("Customer not found");

    const accounts = await this.prisma.account.findMany({
      where: { customerId, bankOrgId: this.bankOrg.bankOrgId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });

    const totalMinor = accounts.reduce((sum, a) => sum + a.availableBalanceMinor, 0n);

    return {
      customer: {
        id: customer.id,
        customerType: customer.customerType,
        kycTrustTier: customer.kycTrustTier,
        globalPersonId: customer.globalPersonId,
        voen: customer.voen,
      },
      accounts: accounts.map((a) => ({
        id: a.id,
        iban: a.iban,
        currency: a.currency,
        availableBalanceMinor: a.availableBalanceMinor.toString(),
        ledgerBalanceMinor: a.ledgerBalanceMinor.toString(),
      })),
      totalAvailableMinor: totalMinor.toString(),
      currency: accounts[0]?.currency ?? "AZN",
    };
  }

  private async issueCustomerJwt(customerId: string, channel: "RETAIL" | "CORPORATE") {
    const accounts = await this.prisma.account.findMany({
      where: { customerId, bankOrgId: this.bankOrg.bankOrgId, status: "ACTIVE" },
      select: { id: true },
    });
    const customer = await this.prisma.bankCustomer.findFirst({
      where: { id: customerId },
    });
    if (!customer) throw new UnauthorizedException("Customer not found");

    let signatoryRole: string | undefined;
    if (channel === "CORPORATE") {
      const signatory = await this.prisma.corporateSignatory.findFirst({
        where: {
          bankOrgId: this.bankOrg.bankOrgId,
          customerId,
          status: SignatoryStatus.ACTIVE,
        },
        orderBy: { role: "asc" },
      });
      signatoryRole = signatory?.role;
    }

    const customerJwt = signCustomerJwt(
      {
        sub: customerId,
        channel,
        accountIds: accounts.map((a) => a.id),
        globalPersonId: customer.globalPersonId ?? undefined,
        signatoryRole,
      },
      this.jwtSecret(),
    );

    return {
      customerJwt,
      customerId,
      globalPersonId: customer.globalPersonId,
      channel,
      accountIds: accounts.map((a) => a.id),
    };
  }
}
