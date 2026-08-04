/** Stable cash-order subtype codes (former Prisma enums; T1 catalog SoR). */
export const CashOrderPkoSubtype = {
  INCOME_FROM_CUSTOMER: "INCOME_FROM_CUSTOMER",
  RETURN_FROM_ACCOUNTABLE: "RETURN_FROM_ACCOUNTABLE",
  WITHDRAWAL_FROM_BANK: "WITHDRAWAL_FROM_BANK",
  OTHER: "OTHER",
} as const;

export type CashOrderPkoSubtype =
  (typeof CashOrderPkoSubtype)[keyof typeof CashOrderPkoSubtype];

export const CashOrderRkoSubtype = {
  SALARY: "SALARY",
  SUPPLIER_PAYMENT: "SUPPLIER_PAYMENT",
  ACCOUNTABLE_ISSUE: "ACCOUNTABLE_ISSUE",
  BANK_DEPOSIT: "BANK_DEPOSIT",
  OTHER: "OTHER",
} as const;

export type CashOrderRkoSubtype =
  (typeof CashOrderRkoSubtype)[keyof typeof CashOrderRkoSubtype];

export const DEFAULT_PKO_SUBTYPES: Array<{
  code: CashOrderPkoSubtype;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  sortOrder: number;
}> = [
  {
    code: CashOrderPkoSubtype.INCOME_FROM_CUSTOMER,
    nameAz: "Müştəridən mədaxil",
    nameRu: "Поступление от покупателя",
    nameEn: "Income from customer",
    sortOrder: 10,
  },
  {
    code: CashOrderPkoSubtype.RETURN_FROM_ACCOUNTABLE,
    nameAz: "Hesabatlı şəxsdən qaytarma",
    nameRu: "Возврат от подотчётного",
    nameEn: "Return from accountable",
    sortOrder: 20,
  },
  {
    code: CashOrderPkoSubtype.WITHDRAWAL_FROM_BANK,
    nameAz: "Bankdan çıxarış",
    nameRu: "Снятие с банка",
    nameEn: "Withdrawal from bank",
    sortOrder: 30,
  },
  {
    code: CashOrderPkoSubtype.OTHER,
    nameAz: "Digər",
    nameRu: "Прочее",
    nameEn: "Other",
    sortOrder: 40,
  },
];

export const DEFAULT_RKO_SUBTYPES: Array<{
  code: CashOrderRkoSubtype;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  sortOrder: number;
}> = [
  {
    code: CashOrderRkoSubtype.SALARY,
    nameAz: "Əmək haqqı",
    nameRu: "Зарплата",
    nameEn: "Salary",
    sortOrder: 10,
  },
  {
    code: CashOrderRkoSubtype.SUPPLIER_PAYMENT,
    nameAz: "Təchizatçıya ödəniş",
    nameRu: "Оплата поставщику",
    nameEn: "Supplier payment",
    sortOrder: 20,
  },
  {
    code: CashOrderRkoSubtype.ACCOUNTABLE_ISSUE,
    nameAz: "Hesabatlı şəxsə verilmə",
    nameRu: "Выдача подотчётному",
    nameEn: "Accountable issue",
    sortOrder: 30,
  },
  {
    code: CashOrderRkoSubtype.BANK_DEPOSIT,
    nameAz: "Banka mədaxil",
    nameRu: "Взнос в банк",
    nameEn: "Bank deposit",
    sortOrder: 40,
  },
  {
    code: CashOrderRkoSubtype.OTHER,
    nameAz: "Digər",
    nameRu: "Прочее",
    nameEn: "Other",
    sortOrder: 50,
  },
];
