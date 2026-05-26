import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrganizationKind, Prisma } from "@erafinance/database";
import { PrismaService } from "../../prisma/prisma.service";
import { PostingAccountResolver } from "./posting-account-resolver.service";
import { PostingJournalBuilder } from "./posting-journal-builder.service";
import type { RecordGrantReceiptDto } from "./dto/record-grant-receipt.dto";

function parseDateOnly(raw: string | undefined): Date {
  if (!raw?.trim()) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) throw new BadRequestException("date must be YYYY-MM-DD");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0));
}

@Injectable()
export class GrantReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: PostingAccountResolver,
    private readonly postingJournal: PostingJournalBuilder,
  ) {}

  async record(organizationId: string, dto: RecordGrantReceiptDto) {
    const kind = await this.resolver.getOrganizationKind(organizationId);
    if (kind !== OrganizationKind.NGO) {
      throw new BadRequestException(
        "Grant receipts are only available for NGO organizations",
      );
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException("amount must be positive");
    }

    const date = parseDateOnly(dto.date);
    const reference = dto.reference?.trim() || `GRANT-${Date.now()}`;
    const description =
      dto.description?.trim() ||
      `Grant / targeted funding receipt (${amount.toString()} AZN)`;

    if (dto.bankAccountCode?.trim()) {
      const acc = await this.prisma.account.findFirst({
        where: {
          organizationId,
          code: dto.bankAccountCode.trim(),
          deletedAt: null,
        },
      });
      if (!acc) {
        throw new NotFoundException(
          `Bank account ${dto.bankAccountCode} not found in organization chart`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const { transactionId } = await this.postingJournal.postInTransaction(tx, {
        organizationId,
        schemaId: "NGO_GRANT_INCOME",
        amounts: { main: amount },
        date,
        reference,
        description,
        dynamicAccounts: dto.bankAccountCode?.trim()
          ? { debitAccountCode: dto.bankAccountCode.trim() }
          : undefined,
      });
      return { ok: true, transactionId, reference };
    });
  }
}
