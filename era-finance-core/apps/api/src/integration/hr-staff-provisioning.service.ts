import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SATELLITE_STAFF_DEACTIVATED,
  SATELLITE_STAFF_PROVISIONED,
} from "@era/contracts";
import { EmployeeEmploymentStatus, type Employee, type JobPosition } from "@erafinance/database";
import { randomUUID } from "crypto";
import { mapFinancePositionToSatelliteRole } from "./satellite-role-map";

type EmployeeWithPosition = Employee & {
  jobPosition: JobPosition & { department?: { name: string } | null };
};

@Injectable()
export class HrStaffProvisioningService {
  private readonly logger = new Logger(HrStaffProvisioningService.name);

  constructor(private readonly config: ConfigService) {}

  private orchestratorUrl(): string {
    return (
      this.config.get<string>("ORCHESTRATOR_EVENT_URL") ??
      this.config.get<string>("ORCHESTRATOR_INTERNAL_URL") ??
      process.env.CONTROL_PLANE_URL ??
      "http://127.0.0.1:4100"
    ).replace(/\/$/, "");
  }

  private token(): string {
    return (
      this.config.get<string>("ORCHESTRATOR_SERVICE_TOKEN")?.trim() ??
      this.config.get<string>("SATELLITE_EVENT_SERVICE_TOKEN")?.trim() ??
      ""
    );
  }

  async emitProvisioned(
    organizationId: string,
    employee: EmployeeWithPosition,
    options?: { pin?: string; login?: string },
  ): Promise<void> {
    const satelliteKey = employee.provisionedSatelliteKey?.trim();
    if (!satelliteKey) return;

    const satelliteRole = mapFinancePositionToSatelliteRole(
      employee.jobPosition.name,
      employee.provisionedSatelliteRole,
    );
    const staffCode = employee.id.slice(0, 8).toUpperCase();
    const event = {
      type: SATELLITE_STAFF_PROVISIONED,
      organizationId,
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      globalPersonId: employee.globalPersonId ?? undefined,
      payload: {
        financeEmployeeId: employee.id,
        satelliteKey,
        satelliteRole,
        staffCode,
        fullName: `${employee.firstName} ${employee.lastName}`.replace(/__enc__\w+__/g, "").trim() || staffCode,
        pin: options?.pin,
        login: options?.login ?? `emp-${staffCode.toLowerCase()}`,
        positionTitle: employee.jobPosition.name,
        departmentName: employee.jobPosition.department?.name ?? undefined,
      },
    };

    await this.publish(event);
  }

  async emitDeactivated(
    organizationId: string,
    employee: Pick<Employee, "id" | "provisionedSatelliteKey" | "globalPersonId">,
    satelliteUserId?: string,
  ): Promise<void> {
    const satelliteKey = employee.provisionedSatelliteKey?.trim();
    if (!satelliteKey) return;
    const event = {
      type: SATELLITE_STAFF_DEACTIVATED,
      organizationId,
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      globalPersonId: employee.globalPersonId ?? undefined,
      payload: {
        financeEmployeeId: employee.id,
        satelliteKey,
        staffCode: employee.id.slice(0, 8).toUpperCase(),
        satelliteUserId,
      },
    };
    await this.publish(event);
  }

  shouldDeactivate(employmentStatus: EmployeeEmploymentStatus): boolean {
    return employmentStatus === EmployeeEmploymentStatus.TERMINATED;
  }

  private async publish(event: Record<string, unknown>): Promise<void> {
    const token = this.token();
    if (!token) {
      this.logger.warn("Skip staff provisioning: ORCHESTRATOR_SERVICE_TOKEN missing");
      return;
    }
    try {
      const res = await fetch(`${this.orchestratorUrl()}/api/v1/satellite-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        this.logger.warn(`Staff event publish HTTP ${res.status}`);
      }
    } catch (e) {
      this.logger.warn(
        `Staff event publish failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
