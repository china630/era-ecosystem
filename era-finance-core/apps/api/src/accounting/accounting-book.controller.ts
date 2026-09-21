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
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { requireOrgRole } from "../auth/require-org-role";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { AccountingBookService } from "./accounting-book.service";
import { CreateAccountingBookDto } from "./dto/create-accounting-book.dto";

@ApiTags("accounting-books")
@ApiBearerAuth("bearer")
@Controller("accounting/books")
export class AccountingBookController {
  constructor(private readonly books: AccountingBookService) {}

  @Get()
  @ApiOperation({
    summary:
      "List accounting books for the organization (MANAGEMENT hidden from ACCOUNTANT)",
  })
  list(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.books.listBooksForRole(organizationId, requireOrgRole(user));
  }

  @Get("slots")
  @ApiOperation({ summary: "Get accounting book slot usage and entitlement" })
  slots(@OrganizationId() organizationId: string) {
    return this.books.getSlots(organizationId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.ADMIN_ORG_SETTINGS)
  @ApiOperation({ summary: "Create an extra accounting book" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateAccountingBookDto,
  ) {
    return this.books.createBook(organizationId, dto);
  }

  @Patch(":id/retire")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_BOOK_MGMT)
  @ApiOperation({ summary: "Retire an unused extra accounting book" })
  retire(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.books.retireBook(organizationId, id);
  }

  @Patch(":id/default-ops")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.ADMIN_ORG_SETTINGS)
  @ApiOperation({
    summary:
      "Set default ops book (NAS only; MANAGEMENT → 400 OPS_BOOK_MUST_BE_NAS)",
  })
  setDefaultOps(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.books.setDefaultOps(organizationId, id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an accounting book by id" })
  get(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.books.getBook(organizationId, id);
  }
}
