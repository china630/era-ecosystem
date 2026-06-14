import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { EmployeeEmploymentStatus, EmployeeKind, UserRole } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  notificationsPackEnabled,
  sendControlPlaneNotification,
} from "../integration/control-plane-notifications.client";

const HR_NOTIFY_ROLES: UserRole[] = [
  UserRole.HR_MANAGER,
  UserRole.HR_OFFICER,
  UserRole.OWNER,
  UserRole.ADMIN,
];

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function sameMonthDay(a: Date, b: Date): boolean {
  return a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

@Injectable()
export class HrRemindersService {
  private readonly logger = new Logger(HrRemindersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Daily 08:00 Asia/Baku — contract end T-7 and birthdays. */
  @Cron("0 8 * * *", { timeZone: "Asia/Baku" })
  async runDailyReminders(): Promise<void> {
    if (!notificationsPackEnabled()) {
      this.logger.debug("HR reminders skipped — ERA_NOTIFICATIONS_PACK not enabled");
      return;
    }

    const today = utcDayStart(new Date());
    const contractTarget = addDays(today, 7);

    const employees = await this.prisma.employee.findMany({
      where: {
        kind: EmployeeKind.EMPLOYEE,
        employmentStatus: EmployeeEmploymentStatus.ACTIVE,
        deletedAt: null,
        OR: [{ contractEndDate: contractTarget }, { dateOfBirth: { not: null } }],
      },
      select: {
        id: true,
        organizationId: true,
        firstName: true,
        lastName: true,
        contractEndDate: true,
        dateOfBirth: true,
      },
    });

    let sent = 0;
    for (const emp of employees) {
      const recipients = await this.hrRecipientEmails(emp.organizationId);
      if (recipients.length === 0) continue;

      if (emp.contractEndDate && utcDayStart(emp.contractEndDate).getTime() === contractTarget.getTime()) {
        for (const email of recipients) {
          await this.safeNotify(emp.organizationId, email, {
            templateKey: "hr.contract.end.reminder",
            subject: "Employment contract ending in 7 days",
            body: `${emp.firstName} ${emp.lastName} — contract ends ${emp.contractEndDate.toISOString().slice(0, 10)}`,
            sourceEntityType: "employee",
            sourceEntityId: emp.id,
          });
          sent += 1;
        }
      }

      if (emp.dateOfBirth && sameMonthDay(emp.dateOfBirth, today)) {
        for (const email of recipients) {
          await this.safeNotify(emp.organizationId, email, {
            templateKey: "hr.birthday.reminder",
            subject: "Employee birthday today",
            body: `${emp.firstName} ${emp.lastName} — birthday today`,
            sourceEntityType: "employee",
            sourceEntityId: emp.id,
          });
          sent += 1;
        }
      }
    }

    this.logger.log(`HR reminders cron: ${sent} notification(s) dispatched`);
  }

  private async hrRecipientEmails(organizationId: string): Promise<string[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        role: { in: HR_NOTIFY_ROLES },
      },
      include: { user: { select: { email: true } } },
    });
    return [
      ...new Set(
        memberships.map((m) => m.user.email?.trim()).filter((e): e is string => Boolean(e)),
      ),
    ];
  }

  private async safeNotify(
    organizationId: string,
    recipient: string,
    input: {
      templateKey: string;
      subject: string;
      body: string;
      sourceEntityType: string;
      sourceEntityId: string;
    },
  ): Promise<void> {
    try {
      await sendControlPlaneNotification(organizationId, {
        templateKey: input.templateKey,
        channel: "EMAIL",
        messageClass: "LIFECYCLE",
        recipient,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        subject: input.subject,
        body: input.body,
      });
    } catch (err) {
      this.logger.warn(
        `HR reminder notify failed for ${input.sourceEntityId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
