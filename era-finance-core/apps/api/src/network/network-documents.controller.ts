import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { LedgerType, UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { AcceptNetworkDocumentDto } from "./dto/accept-network-document.dto";
import { RejectNetworkDocumentDto } from "./dto/reject-network-document.dto";
import { NetworkDocumentPostingService } from "./network-document-posting.service";
import { NetworkDocumentService } from "./network-document.service";
import { NetworkEqaimePrefillService } from "./network-eqaime-prefill.service";
import { NetworkNettingService } from "./network-netting.service";

@ApiTags("network")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(RolesGuard)
export class NetworkDocumentsController {
  constructor(
    private readonly documents: NetworkDocumentService,
    private readonly posting: NetworkDocumentPostingService,
    private readonly networkNetting: NetworkNettingService,
    private readonly eqaimePrefillSvc: NetworkEqaimePrefillService,
  ) {}

  @Get("network/documents/inbox")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.USER, UserRole.DIRECTOR)
  @ApiOperation({ summary: "Inbound network documents (PENDING_REVIEW)" })
  inbox(@OrganizationId() organizationId: string) {
    return this.documents.listInbox(organizationId);
  }

  @Get("network/documents/inbox/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.USER, UserRole.DIRECTOR)
  @ApiOperation({ summary: "Inbound network document detail" })
  inboxDetail(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.documents.getInboxDetail(organizationId, id);
  }

  @Get("network/documents/inbox/:id/eqaime-prefill")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "e-Qaimə prefill DTO from network document" })
  eqaimePrefill(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.eqaimePrefillSvc.buildPrefillFromNetworkDocument(organizationId, id);
  }

  @Post("network/documents/inbox/:id/eqaime-ref")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Link e-Qaimə external id after RPA sync" })
  setEqaimeRef(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() body: { externalId: string },
  ) {
    return this.documents.setEQaimeRef(organizationId, id, body.externalId);
  }

  @Post("network/documents/inbox/:id/accept")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Accept inbound network document and post mirror journal" })
  accept(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: AcceptNetworkDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.posting.acceptAndPost(organizationId, id, dto, user.role ?? undefined, {
      userId: user.userId,
    });
  }

  @Post("network/documents/inbox/:id/reject")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.USER)
  @ApiOperation({ summary: "Reject inbound network document" })
  reject(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: RejectNetworkDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.posting.reject(organizationId, id, dto.reason, {
      userId: user.userId,
    });
  }

  @Get("network/documents/outbox")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.DIRECTOR)
  @ApiOperation({ summary: "Outgoing network documents issued by this org" })
  outbox(@OrganizationId() organizationId: string) {
    return this.documents.listOutbox(organizationId);
  }

  @Get("network/netting/preview")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "ERA network netting preview for partner organization" })
  nettingPreview(
    @OrganizationId() organizationId: string,
    @Query("partnerOrganizationId") partnerOrganizationId: string,
    @Query("ledgerType") ledgerType?: LedgerType,
  ) {
    return this.networkNetting.previewForPartnerOrganization(
      organizationId,
      partnerOrganizationId,
      ledgerType ?? LedgerType.NAS,
    );
  }

  @Post("network/netting")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "ERA network mutual settlement (NETTING schema)" })
  nettingExecute(
    @OrganizationId() organizationId: string,
    @Body() body: { partnerOrganizationId: string; amount: number; ledgerType?: LedgerType },
    @CurrentUser() user: AuthUser,
  ) {
    return this.networkNetting.executeForPartnerOrganization(
      organizationId,
      body.partnerOrganizationId,
      body.amount,
      body.ledgerType ?? LedgerType.NAS,
      user.role ?? undefined,
      { userId: user.userId },
    );
  }
}
