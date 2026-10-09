import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { SatelliteEventDispatchService } from "./satellite-event-dispatch.service";

@ApiTags("inventory")
@ApiBearerAuth("bearer")
@Controller("inventory/day-documents")
@UseGuards(PermissionsGuard)
export class HotelDayDocumentController {
  constructor(private readonly dispatch: SatelliteEventDispatchService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Hotel day documents the night audit could not post" })
  list(@OrganizationId() organizationId: string) {
    return this.dispatch.listRejectedHotelDayDocuments(organizationId);
  }

  @Post(":id/post")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Post a rejected hotel day document after the card or warehouse is fixed" })
  post(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.dispatch.acceptHotelDayDocument(organizationId, id);
  }
}
