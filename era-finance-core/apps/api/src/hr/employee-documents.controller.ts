import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { EmployeeDocumentsService } from "./employee-documents.service";
import { UploadEmployeeDocumentDto } from "./dto/upload-employee-document.dto";

@ApiTags("hr-employee-documents")
@ApiBearerAuth("bearer")
@Controller("hr/employees/:employeeId/documents")
@UseGuards(RolesGuard)
export class EmployeeDocumentsController {
  constructor(private readonly documents: EmployeeDocumentsService) {}

  @Get()
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.HR_MANAGER,
    UserRole.HR_OFFICER,
    UserRole.ACCOUNTANT,
    UserRole.DEPARTMENT_HEAD,
  )
  @ApiOperation({ summary: "List employee HR documents (vault metadata)" })
  list(
    @OrganizationId() organizationId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
  ) {
    return this.documents.list(organizationId, employeeId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.HR_MANAGER, UserRole.HR_OFFICER)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "kind"],
      properties: {
        file: { type: "string", format: "binary" },
        kind: {
          type: "string",
          enum: [
            "CONTRACT",
            "ID_DOCUMENT",
            "MEDICAL",
            "EDUCATION",
            "TAX",
            "OTHER",
          ],
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: "Upload employee HR document" })
  upload(
    @OrganizationId() organizationId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadEmployeeDocumentDto,
  ) {
    return this.documents.upload(
      organizationId,
      employeeId,
      user.userId,
      dto.kind,
      file,
    );
  }
}
