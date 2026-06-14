import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { CreateSupplierScorecardDto } from "./dto/create-supplier-scorecard.dto";
import { UpdateSupplierScorecardDto } from "./dto/update-supplier-scorecard.dto";
import {
  CreateSupplierRatingDto,
  UpdateSupplierRatingDto,
} from "./dto/supplier-rating.dto";
import { SupplierScorecardService } from "./supplier-scorecard.service";

@ApiTags("procurement-supplier-scorecard")
@ApiBearerAuth("bearer")
@Controller("procurement/supplier-scorecards")
@UseGuards(RolesGuard, PermissionsGuard)
export class SupplierScorecardController {
  constructor(private readonly scorecards: SupplierScorecardService) {}

  @Get()
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({ summary: "List supplier scorecards" })
  listScorecards(
    @OrganizationId() organizationId: string,
    @Query("counterpartyId", new ParseUUIDPipe({ optional: true }))
    counterpartyId?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize?: number,
  ) {
    return this.scorecards.listScorecards(organizationId, {
      counterpartyId,
      page,
      pageSize,
    });
  }

  @Post()
  @Permissions("purchases.manage")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: "Create supplier scorecard" })
  createScorecard(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateSupplierScorecardDto,
  ) {
    return this.scorecards.createScorecard(organizationId, dto);
  }

  @Get("ratings")
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({ summary: "List supplier ratings" })
  listRatings(
    @OrganizationId() organizationId: string,
    @Query("counterpartyId", new ParseUUIDPipe({ optional: true }))
    counterpartyId?: string,
    @Query("scorecardId", new ParseUUIDPipe({ optional: true }))
    scorecardId?: string,
  ) {
    return this.scorecards.listRatings(organizationId, {
      counterpartyId,
      scorecardId,
    });
  }

  @Post("ratings")
  @Permissions("purchases.manage")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: "Create supplier rating (1–5)" })
  createRating(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSupplierRatingDto,
  ) {
    return this.scorecards.createRating(organizationId, user.userId, dto);
  }

  @Patch("ratings/:id")
  @Permissions("purchases.manage")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: "Update supplier rating" })
  updateRating(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierRatingDto,
  ) {
    return this.scorecards.updateRating(organizationId, id, dto);
  }

  @Delete("ratings/:id")
  @Permissions("purchases.manage")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: "Delete supplier rating" })
  deleteRating(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.scorecards.deleteRating(organizationId, id);
  }

  @Get(":id")
  @Permissions("purchases.manage")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.PROCUREMENT,
  )
  @ApiOperation({ summary: "Get supplier scorecard" })
  getScorecard(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.scorecards.getScorecard(organizationId, id);
  }

  @Patch(":id")
  @Permissions("purchases.manage")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: "Update supplier scorecard" })
  updateScorecard(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierScorecardDto,
  ) {
    return this.scorecards.updateScorecard(organizationId, id, dto);
  }

  @Delete(":id")
  @Permissions("purchases.manage")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: "Delete supplier scorecard" })
  deleteScorecard(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.scorecards.deleteScorecard(organizationId, id);
  }
}
