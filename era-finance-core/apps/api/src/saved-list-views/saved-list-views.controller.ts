import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import {
  CreateSavedListViewDto,
  PatchSavedListViewDto,
} from "./dto/saved-list-view.dto";
import { SavedListViewsService } from "./saved-list-views.service";

@ApiTags("saved-list-views")
@ApiBearerAuth("bearer")
@Controller("saved-list-views")
@UseGuards(PermissionsGuard)
export class SavedListViewsController {
  constructor(private readonly views: SavedListViewsService) {}

  @Get()
  @ApiOperation({ summary: "List saved list views (own + shared)" })
  list(
    @OrganizationId() orgId: string,
    @CurrentUser() user: AuthUser,
    @Query("gridKey") gridKey?: string,
  ) {
    return this.views.list(orgId, user.userId, gridKey);
  }

  @Post()
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Create a saved list view" })
  create(
    @OrganizationId() orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSavedListViewDto,
  ) {
    return this.views.create(orgId, user.userId, user.role, dto);
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Update a saved list view" })
  patch(
    @OrganizationId() orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchSavedListViewDto,
  ) {
    return this.views.patch(orgId, user.userId, user.role, id, dto);
  }

  @Delete(":id")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Delete a saved list view" })
  remove(
    @OrganizationId() orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.views.remove(orgId, user.userId, id);
  }
}
