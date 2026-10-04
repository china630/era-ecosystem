/**
 * ISO 3166-1 alpha-2 for citizenship and passport issuing country.
 * Labels come from Intl.DisplayNames so az / en / ru stay in one list.
 */
const ISO_ALPHA2 = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ",
  "CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ",
  "DE","DJ","DK","DM","DO","DZ",
  "EC","EE","EG","EH","ER","ES","ET",
  "FI","FJ","FK","FM","FO","FR",
  "GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY",
  "HK","HM","HN","HR","HT","HU",
  "ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT",
  "JE","JM","JO","JP",
  "KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ",
  "LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY",
  "MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ",
  "NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ",
  "OM",
  "PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY",
  "QA",
  "RE","RO","RS","RU","RW",
  "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ",
  "TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ",
  "UA","UG","UM","US","UY","UZ",
  "VA","VC","VE","VG","VI","VN","VU",
  "WF","WS",
  "XK",
  "YE","YT",
  "ZA","ZM","ZW",
] as const;

export type IsoAlpha2 = (typeof ISO_ALPHA2)[number];

const CODE_SET = new Set<string>(ISO_ALPHA2);

function displayLocale(locale: string): string {
  const base = locale.toLowerCase().split("-")[0];
  if (base === "az" || base === "ru" || base === "en") return base;
  return "en";
}

function regionName(code: string, locale: string): string | null {
  try {
    const names = new Intl.DisplayNames([displayLocale(locale), "en"], { type: "region" });
    const name = names.of(code);
    if (!name || name.toUpperCase() === code) return null;
    return name;
  } catch {
    return null;
  }
}

export function countryLabel(code: string | null | undefined, locale: string): string {
  const raw = code?.trim();
  if (!raw) return "—";
  const upper = raw.toUpperCase();
  const name = regionName(upper, locale);
  return name ? `${name} (${upper})` : upper;
}

/** Searchable options. Keeps a stored code that is not ISO (for example a surrogate) visible. */
export function countryOptions(
  locale: string,
  current?: string | null,
): Array<{ value: string; label: string }> {
  const options = ISO_ALPHA2.map((code) => ({
    value: code,
    label: countryLabel(code, locale),
  })).sort((a, b) => a.label.localeCompare(b.label, displayLocale(locale)));
  const extra = current?.trim().toUpperCase();
  if (extra && !CODE_SET.has(extra)) {
    return [{ value: extra, label: extra }, ...options];
  }
  return options;
}
