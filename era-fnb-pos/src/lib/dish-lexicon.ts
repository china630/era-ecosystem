export type DishLexiconEntry = {
  name: string;
  aliases: string[];
  category: string;
};

export const DISH_LEXICON: DishLexiconEntry[] = [
  { name: "Çay", aliases: ["chai", "tea", "чай"], category: "Drinks" },
  { name: "Qəhvə", aliases: ["coffee", "кофе", "kofe"], category: "Drinks" },
  { name: "Limonad", aliases: ["lemonade"], category: "Drinks" },
  { name: "Ayran", aliases: ["airan"], category: "Drinks" },
  { name: "Pivə", aliases: ["beer", "пиво", "pive"], category: "Bar" },
  { name: "Dönər", aliases: ["doner", "shawarma", "шаурма"], category: "Grill" },
  { name: "Xəngəl", aliases: ["khingal", "хинкал", "khinkal"], category: "Dough" },
  { name: "Qutab", aliases: ["gutab", "кутаб"], category: "Dough" },
  { name: "Dolma", aliases: ["долма"], category: "Hot" },
  { name: "Plov", aliases: ["pilaf", "плов"], category: "Hot" },
  { name: "Kababı", aliases: ["kebab", "кебаб", "lula"], category: "Grill" },
  { name: "Düşbərə", aliases: ["dushbara", "дюшбара"], category: "Soup" },
  { name: "Pide", aliases: ["пиде"], category: "Bakery" },
  { name: "Lahmacun", aliases: ["лахмаджун"], category: "Bakery" },
  { name: "Burger", aliases: ["бургер"], category: "Fast" },
  { name: "Kartof fri", aliases: ["fries", "фри"], category: "Fast" },
  { name: "Pizza", aliases: ["пицца"], category: "Fast" },
  { name: "Salat", aliases: ["salad", "салат"], category: "Cold" },
  { name: "Şirniyyat", aliases: ["dessert", "десерт"], category: "Sweet" },
  { name: "Baklava", aliases: ["пахлава"], category: "Sweet" },
];

export function suggestDishes(q: string, limit = 8): DishLexiconEntry[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 1) return DISH_LEXICON.slice(0, limit);
  const scored = DISH_LEXICON.map((e) => {
    const hay = [e.name, ...e.aliases].join(" ").toLowerCase();
    const hit = hay.includes(needle) || e.name.toLowerCase().startsWith(needle);
    return { e, hit };
  }).filter((x) => x.hit);
  return scored.slice(0, limit).map((x) => x.e);
}
