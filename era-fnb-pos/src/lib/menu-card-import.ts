export type MenuCardRow = {
  productCode: string;
  productGroup: string;
  name: string;
  price: number;
  revenueGroup: string;
};

export type MenuCardCategory = {
  code: string;
  name: string;
  revenueCode: string;
};

export type MenuCardDish = {
  plu: string;
  name: string;
  priceAzn: number;
  categoryCode: string;
  financeSku: string;
  recipeSku: string | null;
};

export type MenuCardPlan = {
  categories: MenuCardCategory[];
  dishes: MenuCardDish[];
  skipped: string[];
};

/** Naftani (41xx) hotel revenue codes — ADR hotel-revenue-code-resolution. */
export const REVENUE_CODE: Record<string, string> = {
  FOOD: "4101",
  BEVERAGE: "4102",
  "ALCOLIC BEVERAGE": "4103",
  "ALCOHOLIC BEVERAGE": "4103",
  ALCOHOL: "4103",
  TABACCO: "4104",
  TOBACCO: "4104",
  ICARE: "4105",
  OTHER: "4106",
};

const SKIPPED_REVENUE = new Set(["LAUNDRY", "SPA MEDIKAL", "SPA MEDICAL", "SPA STORE"]);

/** Product groups that are not F&B menu (shop / hotel services). */
const SKIPPED_GROUPS = new Set([
  "LAUNDRY",
  "CAMAŞIRXANA",
  "SPA MEDIKAL",
  "SPA MEDICAL",
  "SPA STORE",
  "ÖDƏNİŞLİ PROSEDURLAR",
  "ODENISLI PROSEDURLAR",
  "SUVENİRLƏR",
  "SUVENIRLER",
]);

const CATEGORY_ALIASES: Record<string, string> = {
  "WELCOME DRING": "WELCOME DRINK",
  "SOYUQ QƏLYANALTILAR": "SOYUQ QƏLYANALTILAR",
  "ƏLAVƏ": "ZAL İCARƏSİ",
  "NAFTANİ VİP ZAL": "ZAL İCARƏSİ",
  "NAFTANI VIP ZAL": "ZAL İCARƏSİ",
};

function azUpper(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("az-AZ");
}

/** Fold Azerbaijani / Turkish dotted I so regex matches work after toLowerCase. */
function foldName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("az-AZ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ə/g, "e")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ");
}

function categoryCode(name: string): string {
  const slug = azUpper(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ə/g, "E")
    .replace(/Ö/g, "O")
    .replace(/Ü/g, "U")
    .replace(/Ğ/g, "G")
    .replace(/Ş/g, "S")
    .replace(/Ç/g, "C")
    .replace(/İ/g, "I")
    .replace(/İ/g, "I")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || "MENU";
}

/** Canonical menu category label (Azerbaijani uppercase, known aliases). */
export function normalizeCategoryName(productGroup: string, fallback = "MENU"): string {
  const upper = azUpper(productGroup || fallback);
  return CATEGORY_ALIASES[upper] ?? upper;
}

/** Revenue group after the known card mistakes. Null means the row is not an F&B dish. */
export function correctedRevenueGroup(row: MenuCardRow): string | null {
  const revenue = azUpper(row.revenueGroup);
  const group = azUpper(row.productGroup);
  const groupFold = foldName(row.productGroup);
  const name = foldName(row.name);
  if (SKIPPED_REVENUE.has(revenue) || SKIPPED_GROUPS.has(group)) return null;
  if (/suvenir|souvenir/.test(groupFold) || /^suvenir\b/.test(name)) return null;
  if (/vibro|laundry|стирк|camasirxana/.test(name)) return null;
  if (/chip|чипс|xalis bal|халис бал/.test(name)) return "FOOD";
  if (/vip\s*zal|vip\s*зал|icare|icar[eə]|icər[eə]/.test(name)) return "ICARE";
  if (
    /mojito|pin[ao]\s*colada/.test(name) &&
    /free|virgin|0%|безалк|alcohol-free|non-?alcohol|spir[ti]siz|спирт/.test(name)
  ) {
    return "BEVERAGE";
  }
  if (/chardon+ay|verdejo|verdoje|riesling/.test(name)) return "ALCOLIC BEVERAGE";
  if (
    (/juice|сок|sire|meyv/.test(groupFold) || /qarpiz|yemis|арбуз|дыня|watermelon|melon/.test(name)) &&
    revenue === "FOOD"
  ) {
    return "BEVERAGE";
  }
  if (!REVENUE_CODE[revenue]) return null;
  return revenue;
}

function isPortion(name: string): boolean {
  return /glass|бокал|portion|порц|shot|шот|50\s*cl/i.test(name);
}

function isBottle(name: string): boolean {
  return /bottle|бутыл|0[.,]75|0[.,]7\b|1\s*l\b|\(1\s*l/i.test(name);
}

function brandTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/glass|бокал|portion|порц|shot|шот|bottle|бутыл|50\s*cl/g, " ")
    .split(/[^a-zа-я0-9]+/i)
    .filter((token) => token.length >= 4);
}

/** Portion cards point recipeSku at the bottle. The finance recipe holds the pour size. */
export function linkPortionRecipes(dishes: MenuCardDish[], names: Map<string, string>): MenuCardDish[] {
  return dishes.map((dish) => {
    const name = names.get(dish.plu) ?? dish.name;
    if (!isPortion(name) || isBottle(name)) return dish;
    const tokens = brandTokens(name);
    const bottle = dishes.find((other) => {
      if (other.plu === dish.plu) return false;
      const otherName = names.get(other.plu) ?? other.name;
      if (!isBottle(otherName) && other.priceAzn <= dish.priceAzn) return false;
      const otherTokens = brandTokens(otherName);
      return tokens.some((token) => otherTokens.includes(token));
    });
    if (!bottle) return dish;
    return { ...dish, recipeSku: bottle.financeSku };
  });
}

export function planMenuCards(rows: MenuCardRow[]): MenuCardPlan {
  const categories = new Map<string, MenuCardCategory>();
  const dishes: MenuCardDish[] = [];
  const names = new Map<string, string>();
  const skipped: string[] = [];
  for (const row of rows) {
    const code = row.productCode.trim();
    const name = row.name.trim().replace(/\s+/g, " ");
    if (!code || !name) continue;
    const revenue = correctedRevenueGroup(row);
    if (!revenue) {
      skipped.push(`${code} ${name}`);
      continue;
    }
    const groupName =
      revenue === "ICARE"
        ? "ZAL İCARƏSİ"
        : normalizeCategoryName(row.productGroup, revenue);
    const revenueCode = REVENUE_CODE[revenue] ?? "4101";
    const catCode = `${categoryCode(groupName)}-${revenueCode}`;
    if (!categories.has(catCode)) {
      categories.set(catCode, {
        code: catCode,
        name: groupName,
        revenueCode,
      });
    }
    names.set(code, name);
    dishes.push({
      plu: code,
      name,
      priceAzn: Number.isFinite(row.price) ? row.price : 0,
      categoryCode: catCode,
      financeSku: code,
      recipeSku: null,
    });
  }
  return {
    categories: [...categories.values()],
    dishes: linkPortionRecipes(dishes, names),
    skipped,
  };
}
