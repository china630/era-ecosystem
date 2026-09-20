import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { EXTRA_ENTITY_FINANCE_INVOICE } from "@era/satellite-kit";
import { OrganizationId } from "../common/org-id.decorator";
import {
  CreateExtraFieldDefinitionDto,
  PatchExtraFieldDefinitionDto,
  PutExtraAttributesDto,
} from "./dto/extra-field.dto";
import { ExtraFieldsService } from "./extra-fields.service";

@ApiTags("extra-fields")
@ApiBearerAuth("bearer")
@Controller("extra-fields")
@UseGuards(PermissionsGuard)
export class ExtraFieldsController {
  constructor(private readonly extras: ExtraFieldsService) {}

  @Get()
  @ApiOperation({ summary: "List extra-field definitions for an entity type" })
  list(
    @OrganizationId() orgId: string,
    @Query("entityType") entityType?: string,
  ) {
    return this.extras.list(
      orgId,
      entityType?.trim() || EXTRA_ENTITY_FINANCE_INVOICE,
    );
  }

  @Post()
  @Permissions(CP_PERMISSION.ADMIN_ORG_SETTINGS)
  @ApiOperation({ summary: "Create an extra-field definition" })
  create(
    @OrganizationId() orgId: string,
    @Body() dto: CreateExtraFieldDefinitionDto,
  ) {
    return this.extras.create(orgId, dto);
  }

  @Put("values/FINANCE_INVOICE/:invoiceId")
  @Permissions(CP_PERMISSION.ADMIN_ORG_SETTINGS)
  @ApiOperation({ summary: "Replace extra attributes on a sales invoice" })
  putInvoice(
    @OrganizationId() orgId: string,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() dto: PutExtraAttributesDto,
  ) {
    return this.extras.putInvoiceAttributes(
      orgId,
      invoiceId,
      dto.extraAttributes,
    );
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.ADMIN_ORG_SETTINGS)
  @ApiOperation({ summary: "Update labels / retire extra-field definition" })
  patch(
    @OrganizationId() orgId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchExtraFieldDefinitionDto,
  ) {
    return this.extras.patch(orgId, id, dto);
  }
}
