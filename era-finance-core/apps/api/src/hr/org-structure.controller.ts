import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { OrganizationId } from "../common/org-id.decorator";
import { OrgStructureService } from "./org-structure.service";

@ApiTags("hr-org-structure")
@ApiBearerAuth("bearer")
@Controller("hr")
export class OrgStructureController {
  constructor(private readonly org: OrgStructureService) {}

  @Get("org-structure/tree")
  @ApiOperation({ summary: "Department tree (read-only mirror from CP)" })
  tree(@OrganizationId() organizationId: string) {
    return this.org.getDepartmentTree(organizationId);
  }

  @Get("departments")
  @ApiOperation({ summary: "Departments flat list (CostCenter mirror)" })
  listDepartments(@OrganizationId() organizationId: string) {
    return this.org.listDepartmentsFlat(organizationId);
  }

  @Get("job-positions")
  @ApiOperation({ summary: "Job positions (read-only mirror from CP)" })
  listJobPositions(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.org.listJobPositions(organizationId, departmentId, { page, pageSize });
  }
}
