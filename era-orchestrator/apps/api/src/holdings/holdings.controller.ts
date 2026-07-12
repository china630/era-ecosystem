import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import {
  AddHoldingMemberDto,
  CreateHoldingDto,
  UpdateHoldingDto,
  UpdateHoldingMemberDto,
} from "./dto/holding.dto";
import { HoldingsService } from "./holdings.service";

@UseGuards(JwtAuthGuard)
@Controller("v1/holdings")
export class HoldingsController {
  constructor(private readonly holdings: HoldingsService) {}

  @Post()
  create(@CurrentUser() user: EraJwtPayload, @Body() dto: CreateHoldingDto) {
    return this.holdings.createHolding(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: EraJwtPayload) {
    return this.holdings.findAllHoldingsForUser(user.sub);
  }

  @Get("tree")
  tree(@CurrentUser() user: EraJwtPayload) {
    return this.holdings.getHoldingsTreeForUser(user.sub);
  }

  @Get(":id/members")
  listMembers(@CurrentUser() user: EraJwtPayload, @Param("id") id: string) {
    return this.holdings.listMembers(user.sub, id);
  }

  @Post(":id/members")
  addMember(
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
    @Body() dto: AddHoldingMemberDto,
  ) {
    return this.holdings.addMember(user.sub, id, dto.userId, dto.role);
  }

  @Patch(":id/members/:userId")
  updateMember(
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
    @Param("userId") memberUserId: string,
    @Body() dto: UpdateHoldingMemberDto,
  ) {
    return this.holdings.updateMemberRole(
      user.sub,
      id,
      memberUserId,
      dto.role,
    );
  }

  @Delete(":id/members/:userId")
  removeMember(
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
    @Param("userId") memberUserId: string,
  ) {
    return this.holdings.removeMember(user.sub, id, memberUserId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: EraJwtPayload, @Param("id") id: string) {
    return this.holdings.findOneHoldingForAccess(user.sub, id);
  }

  @Put(":id")
  update(
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateHoldingDto,
  ) {
    return this.holdings.updateHolding(user.sub, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: EraJwtPayload, @Param("id") id: string) {
    return this.holdings.deleteHolding(user.sub, id);
  }

  @Post(":holdingId/organizations/:organizationId")
  addOrganization(
    @CurrentUser() user: EraJwtPayload,
    @Param("holdingId") holdingId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.holdings.addOrganizationToHolding(
      user.sub,
      holdingId,
      organizationId,
    );
  }

  @Delete(":holdingId/organizations/:organizationId")
  removeOrganization(
    @CurrentUser() user: EraJwtPayload,
    @Param("holdingId") holdingId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.holdings.removeOrganizationFromHolding(
      user.sub,
      holdingId,
      organizationId,
    );
  }
}
