import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { isDepartmentHeadRole } from "../auth/policies/hr-payroll.policy";
import { requireOrgRole } from "../auth/require-org-role";
import type { AuthUser } from "../auth/types/auth-user";
import { CheckQuota } from "../common/decorators/check-quota.decorator";
import { QuotaGuard } from "../common/guards/quota.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { QuotaResource } from "../quota/quota-resource";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { BulkPrefillEmployeesDto } from "./dto/bulk-prefill-employees.dto";
import { BulkContractSalaryDto } from "./dto/bulk-contract-salary.dto";
import { BulkSyncResultEmployeesDto } from "./dto/bulk-sync-result-employees.dto";
import { ConvertEmployeeToFinDto, CreateEmployeeDto } from "./dto/create-employee.dto";
import { ResolveEmployeePersonDto } from "./dto/resolve-employee-person.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { DepartmentHeadScopeService } from "./department-head-scope.service";
import { EmployeesService } from "./employees.service";

@ApiTags("hr-employees")
@ApiBearerAuth("bearer")
@Controller("hr/employees")
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly scope: DepartmentHeadScopeService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({
    summary:
      "Список сотрудников (пагинация; departmentId — фильтр; DEPARTMENT_HEAD — только свой отдел)",
  })
  async list(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("departmentId") departmentId?: string,
    @Query("cpEmploymentId") cpEmploymentId?: string,
  ) {
    const role = requireOrgRole(user);
    let dept = departmentId;
    if (isDepartmentHeadRole(role)) {
      dept =
        (await this.scope.resolveManagedDepartmentId(
          organizationId,
          user.userId,
        )) ?? undefined;
    }
    const p =
      page != null && page !== "" ? Number.parseInt(page, 10) : undefined;
    const ps =
      pageSize != null && pageSize !== ""
        ? Number.parseInt(pageSize, 10)
        : undefined;
    return this.employees.list(organizationId, {
      page: p,
      pageSize: ps,
      departmentId: dept,
      cpEmploymentId: cpEmploymentId?.trim() || undefined,
      actingUserRole: role,
    });
  }

  @Get("emas-prefill")
  @ApiOperation({ summary: "ƏMAS prefill by cpEmploymentId or employeeId" })
  getEmasPrefill(
    @OrganizationId() organizationId: string,
    @Query("employeeId") employeeId?: string,
    @Query("cpEmploymentId") cpEmploymentId?: string,
  ) {
    return this.employees.getEmasPrefill(organizationId, { employeeId, cpEmploymentId });
  }

  @Get(":id/prefill")
  @ApiOperation({
    summary:
      "Сотрудник — минимальный DTO для браузерного расширения (ƏMAS prefill)",
  })
  getPrefillForExtension(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.employees.getExtensionPrefill(organizationId, id);
  }

  @Post("bulk-prefill")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Bulk DTO list for extension ƏMAS prefill" })
  getBulkPrefill(
    @OrganizationId() organizationId: string,
    @Body() dto: BulkPrefillEmployeesDto,
  ) {
    return this.employees.getExtensionPrefillBulk(organizationId, dto.employeeIds);
  }

  @Post("bulk-sync-result")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Persist bulk sync results for employees (ƏMAS)" })
  saveBulkSyncResult(
    @OrganizationId() organizationId: string,
    @Body() dto: BulkSyncResultEmployeesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employees.saveBulkSyncResult(organizationId, dto, user.userId);
  }

  @Post("bulk-contract-salary")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({
    summary:
      "Bulk set contract salary (tariff=salary, supplement=0) after CP hire-mirror",
  })
  bulkContractSalary(
    @OrganizationId() organizationId: string,
    @Body() dto: BulkContractSalaryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employees.bulkContractSalary(
      organizationId,
      dto.items,
      requireOrgRole(user),
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Сотрудник по id" })
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employees.getOne(organizationId, id, requireOrgRole(user));
  }

  @Post("resolve-person")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Resolve MDM person for payroll hire (FIN lookup, no local PII persist)" })
  resolvePerson(
    @OrganizationId() organizationId: string,
    @Body() dto: ResolveEmployeePersonDto,
  ) {
    return this.employees.resolvePersonForHire(organizationId, dto);
  }

  @Post()
  @UseGuards(QuotaGuard)
  @CheckQuota(QuotaResource.USERS)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Создать сотрудника" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employees.create(organizationId, dto, requireOrgRole(user));
  }

  @Post(":id/convert-to-fin")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Convert foreign employee to citizen FIN (MDM merge)" })
  convertToFin(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: ConvertEmployeeToFinDto,
  ) {
    return this.employees.convertToFin(organizationId, id, dto);
  }

  @Patch(":id")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Обновить сотрудника" })
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employees.update(
      organizationId,
      id,
      dto,
      requireOrgRole(user),
    );
  }

  @Delete(":id")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "Удалить сотрудника" })
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.employees.remove(organizationId, id);
  }
}
