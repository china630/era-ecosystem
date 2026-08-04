import { BadRequestException, Injectable } from "@nestjs/common";
import { PayrollComponentKind } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { PayrollComponentCode } from "./payroll-component-codes";

const DEFAULT_COMPONENTS: Array<{
  code: PayrollComponentCode;
  kind: PayrollComponentKind;
  nameAz: string;
  nameRu: string;
  nameEn: string;
}> = [
  {
    code: PayrollComponentCode.BASE_SALARY,
    kind: PayrollComponentKind.EARNING,
    nameAz: "Əsas əmək haqqı",
    nameRu: "Базовый оклад",
    nameEn: "Base salary",
  },
  {
    code: PayrollComponentCode.BONUS,
    kind: PayrollComponentKind.EARNING,
    nameAz: "Bonus",
    nameRu: "Премия",
    nameEn: "Bonus",
  },
  {
    code: PayrollComponentCode.MATERIAL_AID,
    kind: PayrollComponentKind.EARNING,
    nameAz: "Maddi yardım",
    nameRu: "Материальная помощь",
    nameEn: "Material aid",
  },
  {
    code: PayrollComponentCode.NIGHT_PREMIUM,
    kind: PayrollComponentKind.EARNING,
    nameAz: "Gecə əlavəsi",
    nameRu: "Ночная надбавка",
    nameEn: "Night premium",
  },
  {
    code: PayrollComponentCode.EVENING_PREMIUM,
    kind: PayrollComponentKind.EARNING,
    nameAz: "Axşam əlavəsi",
    nameRu: "Вечерняя надбавка",
    nameEn: "Evening premium",
  },
  {
    code: PayrollComponentCode.OVERTIME_PREMIUM,
    kind: PayrollComponentKind.EARNING,
    nameAz: "Əlavə iş",
    nameRu: "Сверхурочные",
    nameEn: "Overtime premium",
  },
  {
    code: PayrollComponentCode.INCOME_TAX_RELIEF,
    kind: PayrollComponentKind.EARNING,
    nameAz: "Gəlir vergisi güzəşti",
    nameRu: "Налоговый вычет",
    nameEn: "Income tax relief",
  },
  {
    code: PayrollComponentCode.ALIMONY,
    kind: PayrollComponentKind.DEDUCTION,
    nameAz: "Aliment",
    nameRu: "Алименты",
    nameEn: "Alimony",
  },
  {
    code: PayrollComponentCode.EXECUTION_SHEET,
    kind: PayrollComponentKind.DEDUCTION,
    nameAz: "İcra vərəqəsi",
    nameRu: "Исполнительный лист",
    nameEn: "Execution sheet",
  },
  {
    code: PayrollComponentCode.LOAN,
    kind: PayrollComponentKind.DEDUCTION,
    nameAz: "Kredit tutulması",
    nameRu: "Удержание займа",
    nameEn: "Loan deduction",
  },
  {
    code: PayrollComponentCode.ADVANCE,
    kind: PayrollComponentKind.DEDUCTION,
    nameAz: "Avans",
    nameRu: "Аванс",
    nameEn: "Advance",
  },
  {
    code: PayrollComponentCode.UNION_DUE,
    kind: PayrollComponentKind.DEDUCTION,
    nameAz: "Həmkarlar ittifaqı haqqı",
    nameRu: "Профсоюзный взнос",
    nameEn: "Union due",
  },
];

@Injectable()
export class PayrollComponentsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultComponents(organizationId: string) {
    for (const c of DEFAULT_COMPONENTS) {
      await this.prisma.payrollComponent.upsert({
        where: {
          organizationId_code: { organizationId, code: c.code },
        },
        create: {
          organizationId,
          code: c.code,
          kind: c.kind,
          nameAz: c.nameAz,
          nameRu: c.nameRu,
          nameEn: c.nameEn,
          isActive: true,
        },
        update: {
          kind: c.kind,
          nameAz: c.nameAz,
          nameRu: c.nameRu,
          nameEn: c.nameEn,
        },
      });
    }
    return this.list(organizationId);
  }

  async list(organizationId: string, activeOnly = false) {
    return this.prisma.payrollComponent.findMany({
      where: {
        organizationId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ kind: "asc" }, { code: "asc" }],
    });
  }

  async create(
    organizationId: string,
    data: {
      code: string;
      kind: PayrollComponentKind;
      nameAz: string;
      nameRu: string;
      nameEn: string;
      isActive?: boolean;
    },
  ) {
    const code = data.code.trim().toUpperCase().replace(/\s+/g, "_");
    if (!code) {
      throw new BadRequestException("Payroll component code is required");
    }
    return this.prisma.payrollComponent.create({
      data: {
        organizationId,
        code,
        kind: data.kind,
        nameAz: data.nameAz.trim(),
        nameRu: data.nameRu.trim(),
        nameEn: data.nameEn.trim(),
        isActive: data.isActive ?? true,
      },
    });
  }

  kindForCode(code: string): PayrollComponentKind {
    const row = DEFAULT_COMPONENTS.find((c) => c.code === code);
    return row?.kind ?? PayrollComponentKind.EARNING;
  }

  async componentIdMap(
    organizationId: string,
  ): Promise<Map<string, string>> {
    await this.ensureDefaultComponents(organizationId);
    const rows = await this.prisma.payrollComponent.findMany({
      where: { organizationId },
      select: { id: true, code: true },
    });
    return new Map(rows.map((r) => [r.code, r.id]));
  }
}
