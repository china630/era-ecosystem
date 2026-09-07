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
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { AccountingBookService } from "./accounting-book.service";
import { CreateAccountingBookDto } from "./dto/create-accounting-book.dto";

@ApiTags("accounting-books")
@ApiBearerAuth("bearer")
@Controller("accounting/books")
export class AccountingBookController {
  constructor(private readonly books: AccountingBookService) {}

  @Get()
  @ApiOperation({ summary: "List accounting books for the organization" })
  list(@OrganizationId() organizationId: string) {
    return this.books.listBooks(organizationId);
  }

  @Get("slots")
  @ApiOperation({ summary: "Get accounting book slot usage and entitlement" })
  slots(@OrganizationId() organizationId: string) {
    return this.books.getSlots(organizationId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create an extra accounting book" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateAccountingBookDto,
  ) {
    return this.books.createBook(organizationId, dto);
  }

  @Patch(":id/retire")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Retire an unused extra accounting book" })
  retire(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.books.retireBook(organizationId, id);
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
