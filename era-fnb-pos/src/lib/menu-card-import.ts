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

const REVENUE_CODE: Record<string, string> = {
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

const SKIPPED = new Set(["LAUNDRY", "SPA MEDIKAL", "SPA MEDICAL", "SPA STORE"]);

function categoryCode(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || "MENU";
}

/** Revenue group after the known card mistakes. Null means the row is not an F&B dish. */
export function correctedRevenueGroup(row: MenuCardRow): string | null {
  const revenue = row.revenueGroup.trim().toUpperCase();
  const group = row.productGroup.trim().toUpperCase();
  const name = row.name.trim().toLowerCase();
  if (SKIPPED.has(revenue) || SKIPPED.has(group)) return null;
  if (/vibro|laundry|стирк/.test(name)) return null;
  if (/chip|чипс|xalis bal|халис бал/.test(name)) return "FOOD";
  if (/vip zal|vip зал/.test(name)) return "ICARE";
  if (/mojito|pina colada/.test(name) && /free|virgin|0%|безалк|alcohol-free|non-?alcohol/.test(name)) {
    return "BEVERAGE";
  }
  if (/chardonnay|verdejo|riesling/.test(name)) return "ALCOLIC BEVERAGE";
  if (/juice|сок|watermelon|melon|арбуз|дыня/.test(group) && revenue === "FOOD") return "BEVERAGE";
  if (!REVENUE_CODE[revenue]) return null;
  return revenue;
}

function isPortion(name: string): boolean {
  return /glass|бокал|portion|порц|shot|шот/i.test(name);
}

function isBottle(name: string): boolean {
  return /bottle|бутыл|0[.,]75|0[.,]5\b/i.test(name);
}

function brandTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/glass|бокал|portion|порц|shot|шот|bottle|бутыл/g, " ")
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
    const name = row.name.trim();
    if (!code || !name) continue;
    const revenue = correctedRevenueGroup(row);
    if (!revenue) {
      skipped.push(`${code} ${name}`);
      continue;
    }
    const groupName = row.productGroup.trim() || revenue;
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
