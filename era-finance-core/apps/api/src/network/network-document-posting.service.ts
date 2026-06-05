import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BillingStatus,
  LedgerType,
  NetworkDocumentStatus,
  Prisma,
  type PostingRole,
  type UserRole,
} from "@erafinance/database";
import { assertMayPostManualJournal } from "../auth/policies/invoice-finance.policy";
import { AccountingService } from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PrismaService } from "../prisma/prisma.service";
import { parseIsoDateOnly } from "../reporting/reporting-period.util";
import type { AcceptNetworkDocumentDto } from "./dto/accept-network-document.dto";
import {
  NETWORK_INBOUND_DEBIT_ROLES,
  type NetworkInboundDebitRole,
} from "./network-settings.util";

const Decimal = Prisma.Decimal;

@Injectable()
export class NetworkDocumentPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly posting: PostingAccountResolver,
  ) {}

  private async mirrorCounterpartyId(
    recipientOrgId: string,
    issuerTaxIdBlindIndex: string | null,
  ): Promise<string> {
    if (!issuerTaxIdBlindIndex?.trim()) {
      throw new BadRequestException(
        "Issuer VÖEN is missing on network document; cannot post mirror journal",
      );
    }
    const cp = await this.prisma.counterparty.findFirst({
      where: {
        organizationId: recipientOrgId,
        taxIdBlindIndex: issuerTaxIdBlindIndex.trim(),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!cp) {
      throw new BadRequestException(
        "Create a counterparty with the issuer VÖEN before accepting the network document",
      );
    }
    return cp.id;
  }

  async acceptAndPost(
    recipientOrgId: string,
    docId: string,
    body: AcceptNetworkDocumentDto,
    actingUserRole?: UserRole,
    audit?: { userId?: string },
  ) {
    if (actingUserRole !== undefined) {
      assertMayPostManualJournal(actingUserRole);
    }
    const debitRole = body.debitRole as NetworkInboundDebitRole;
    if (!(NETWORK_INBOUND_DEBIT_ROLES as readonly string[]).includes(debitRole)) {
      throw new BadRequestException(`Invalid debitRole: ${body.debitRole}`);
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: recipientOrgId, isDeleted: false },
      select: { billingStatus: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    if (org.billingStatus === BillingStatus.HARD_BLOCK) {
      throw new BadRequestException("Billing HARD_BLOCK: posting is read-only");
    }

    const doc = await this.prisma.networkDocument.findFirst({
      where: { id: docId, recipientOrganizationId: recipientOrgId },
    });
    if (!doc) throw new NotFoundException("Network document not found");
    if (doc.status !== NetworkDocumentStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Document status ${doc.status} cannot be accepted`,
      );
    }

    let payDate: Date;
    try {
      payDate = body.postingDate?.trim()
        ? parseIsoDateOnly(body.postingDate.trim())
        : new Date();
    } catch {
      throw new BadRequestException("Invalid postingDate (expected YYYY-MM-DD)");
    }

    const claimsVat = body.claimsVat !== false;
    const totalNet = new Decimal(doc.totalNet);
    const vatAmount = new Decimal(doc.vatAmount);
    const totalGross = new Decimal(doc.totalGross);
    if (totalGross.lte(0)) {
      throw new BadRequestException("Document total must be positive");
    }

    const counterpartyId = await this.mirrorCounterpartyId(
      recipientOrgId,
      doc.issuerTaxIdBlindIndex,
    );

    const roles: PostingRole[] = claimsVat && vatAmount.gt(0)
      ? [debitRole, "VAT_INPUT", "SUPPLIER_PAYABLE"]
      : [debitRole, "SUPPLIER_PAYABLE"];
    const codes = await this.posting.resolveMany(recipientOrgId, roles);

    const lines: Array<{ accountCode: string; debit: string; credit: string }> = [];
    lines.push({
      accountCode: codes[debitRole],
      debit: totalNet.toString(),
      credit: "0",
    });
    if (claimsVat && vatAmount.gt(0)) {
      lines.push({
        accountCode: codes.VAT_INPUT,
        debit: vatAmount.toString(),
        credit: "0",
      });
    }
    lines.push({
      accountCode: codes.SUPPLIER_PAYABLE,
      debit: "0",
      credit: totalGross.toString(),
    });

    return this.prisma.$transaction(async (tx) => {
      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        organizationId: recipientOrgId,
        date: payDate,
        reference: `NETDOC:${doc.correlationId}`,
        description: `Network inbound invoice ${doc.issuerInvoiceNumber ?? doc.sourceInvoiceId}`,
        counterpartyId,
        ledgerType: LedgerType.NAS,
        lines,
      });

      const updated = await tx.networkDocument.update({
        where: { id: doc.id },
        data: {
          status: NetworkDocumentStatus.POSTED,
          recipientDebitRole: debitRole,
          recipientClaimsVat: claimsVat,
          recipientTransactionId: transactionId,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: recipientOrgId,
          userId: audit?.userId ?? null,
          entityType: "NetworkDocument",
          entityId: doc.id,
          action: "NETWORK_DOCUMENT_ACCEPT",
          newValues: {
            transactionId,
            debitRole,
            claimsVat,
            amount: totalGross.toString(),
          },
        },
      });

      return { document: updated, transactionId };
    });
  }

  async reject(
    recipientOrgId: string,
    docId: string,
    reason: string,
    audit?: { userId?: string },
  ) {
    const doc = await this.prisma.networkDocument.findFirst({
      where: { id: docId, recipientOrganizationId: recipientOrgId },
    });
    if (!doc) throw new NotFoundException("Network document not found");
    if (doc.status !== NetworkDocumentStatus.PENDING_REVIEW) {
      throw new BadRequestException(`Document status ${doc.status} cannot be rejected`);
    }

    const updated = await this.prisma.networkDocument.update({
      where: { id: doc.id },
      data: {
        status: NetworkDocumentStatus.REJECTED,
        rejectReason: reason.trim(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: recipientOrgId,
        userId: audit?.userId ?? null,
        entityType: "NetworkDocument",
        entityId: doc.id,
        action: "NETWORK_DOCUMENT_REJECT",
        newValues: { reason: reason.trim() },
      },
    });

    return updated;
  }
}
