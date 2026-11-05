import { BadRequestException, Injectable } from "@nestjs/common";
import {
  addBakuDays,
  bakuDayBounds,
  bakuYmd,
  billingPeriodKeyBaku,
  todayBakuYmd,
} from "@era/satellite-kit/time";
import { PrismaService } from "../prisma/prisma.service";

export const MODULE_GRACE_DAYS = 7;

export type LateMonthChoice = "start_now" | "defer_to_first";

export type LateMonthConfirmationPayload = {
  code: "LATE_MONTH_CONFIRMATION_REQUIRED";
  message: string;
  graceEndsAt: string;
  choices: LateMonthChoice[];
};

@Injectable()
export class ModuleGraceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Grace applies only after platform trial (paid commercial mode). */
  async isOrgEligibleForModuleGrace(organizationId: string): Promise<boolean> {
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      select: { isTrial: true },
    });
    return sub != null && !sub.isTrial;
  }

  async getGraceRow(organizationId: string, moduleKey: string) {
    return this.prisma.organizationModuleGrace.findUnique({
      where: {
        organizationId_moduleKey: { organizationId, moduleKey },
      },
    });
  }

  graceEndsAtFromStart(startedAt: Date): Date {
    const startYmd = todayBakuYmd(startedAt);
    const endYmd = addBakuDays(startYmd, MODULE_GRACE_DAYS);
    return bakuDayBounds(endYmd).start;
  }

  isWithinGraceWindow(
    row: { graceStartedAt: Date | null; graceEndsAt: Date | null; graceConsumedAt: Date | null },
    at: Date,
  ): boolean {
    if (row.graceConsumedAt != null) return false;
    if (row.graceStartedAt == null || row.graceEndsAt == null) return false;
    const t = at.getTime();
    return t >= row.graceStartedAt.getTime() && t < row.graceEndsAt.getTime();
  }

  /**
   * Late-month modal when enabling would leave a short billable tail (ADR sku-grace-trial-7d).
   */
  needsLateMonthConfirmation(
    now: Date,
    graceEndsAt: Date,
  ): boolean {
    const { day } = bakuYmd(now);
    if (day >= 20) return true;
    const period = billingPeriodKeyBaku(now);
    const [y, m] = period.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthEndKey = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const graceEndKey = todayBakuYmd(graceEndsAt);
    if (graceEndKey > monthEndKey) {
      return false;
    }
    const tailStart = bakuDayBounds(graceEndKey).start.getTime();
    const tailEnd = bakuDayBounds(monthEndKey).end.getTime();
    const tailDays =
      Math.floor((tailEnd - tailStart) / 86_400_000) + 1;
    return tailDays > 0 && tailDays < MODULE_GRACE_DAYS;
  }

  buildLateMonthConfirmation(graceEndsAt: Date): LateMonthConfirmationPayload {
    return {
      code: "LATE_MONTH_CONFIRMATION_REQUIRED",
      message:
        "Enabling now starts a 7-day SKU trial; the remaining billable days in this calendar month (Asia/Baku) are short. Choose Start now, Defer to 1st next month, or Cancel.",
      graceEndsAt: graceEndsAt.toISOString(),
      choices: ["start_now", "defer_to_first"],
    };
  }

  nextBakuMonthStart(now: Date): Date {
    const key = billingPeriodKeyBaku(now);
    const [ys, ms] = key.split("-");
    let y = Number(ys);
    let m = Number(ms) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const nextKey = `${y}-${String(m).padStart(2, "0")}`;
    return bakuDayBounds(`${nextKey}-01`).start;
  }

  async assertLateMonthChoiceOrThrow(input: {
    organizationId: string;
    moduleKey: string;
    now: Date;
    confirmLateMonth?: LateMonthChoice;
  }): Promise<"proceed" | "deferred"> {
    const row = await this.getGraceRow(input.organizationId, input.moduleKey);
    if (row?.graceConsumedAt != null) {
      return "proceed";
    }
    if (row?.graceStartedAt != null) {
      return "proceed";
    }
    const graceEndsAt = this.graceEndsAtFromStart(input.now);
    if (!this.needsLateMonthConfirmation(input.now, graceEndsAt)) {
      return "proceed";
    }
    if (!input.confirmLateMonth) {
      throw new BadRequestException(
        this.buildLateMonthConfirmation(graceEndsAt),
      );
    }
    if (input.confirmLateMonth === "defer_to_first") {
      const scheduledEnableAt = this.nextBakuMonthStart(input.now);
      await this.prisma.organizationModuleGrace.upsert({
        where: {
          organizationId_moduleKey: {
            organizationId: input.organizationId,
            moduleKey: input.moduleKey,
          },
        },
        create: {
          organizationId: input.organizationId,
          moduleKey: input.moduleKey,
          scheduledEnableAt,
        },
        update: { scheduledEnableAt },
      });
      return "deferred";
    }
    return "proceed";
  }

  async startGraceIfEligible(
    organizationId: string,
    moduleKey: string,
    now: Date,
  ): Promise<void> {
    const eligible = await this.isOrgEligibleForModuleGrace(organizationId);
    if (!eligible) return;

    const existing = await this.getGraceRow(organizationId, moduleKey);
    if (existing?.graceConsumedAt != null) return;
    if (existing?.graceStartedAt != null) return;

    const graceStartedAt = now;
    const graceEndsAt = this.graceEndsAtFromStart(now);
    await this.prisma.organizationModuleGrace.upsert({
      where: {
        organizationId_moduleKey: { organizationId, moduleKey },
      },
      create: {
        organizationId,
        moduleKey,
        graceStartedAt,
        graceEndsAt,
      },
      update: {
        graceStartedAt,
        graceEndsAt,
        scheduledEnableAt: null,
      },
    });
  }

  /** OFF during grace still consumes the lifetime window (anti-fraud). */
  async consumeGraceOnDisable(
    organizationId: string,
    moduleKey: string,
    now: Date,
  ): Promise<void> {
    const row = await this.getGraceRow(organizationId, moduleKey);
    if (!row?.graceStartedAt || row.graceConsumedAt != null) return;
    if (!this.isWithinGraceWindow(row, now)) return;
    await this.prisma.organizationModuleGrace.update({
      where: {
        organizationId_moduleKey: { organizationId, moduleKey },
      },
      data: { graceConsumedAt: now },
    });
  }

  /**
   * Skip module charge for a billed calendar month when the lifetime grace window overlaps it.
   */
  async shouldSkipModuleForBillingPeriod(
    organizationId: string,
    moduleKey: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<boolean> {
    const row = await this.getGraceRow(organizationId, moduleKey);
    if (!row?.graceStartedAt || !row.graceEndsAt) return false;
    if (row.graceEndsAt.getTime() <= periodStart.getTime()) return false;
    if (row.graceStartedAt.getTime() > periodEnd.getTime()) return false;
    return true;
  }
}
