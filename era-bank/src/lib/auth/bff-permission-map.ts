import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

function lastSegments(pathSegments?: string[]): { tail: string; prev: string } {
  const tail = pathSegments?.[pathSegments.length - 1] ?? "";
  const prev = pathSegments?.[pathSegments.length - 2] ?? "";
  return { tail, prev };
}

function isApproveTail(tail: string, prev: string): boolean {
  return (
    tail === "approve" ||
    tail.endsWith("-approve") ||
    prev === "approve" ||
    prev.endsWith("-approve")
  );
}

function isRejectTail(tail: string, prev: string): boolean {
  return (
    tail === "reject" ||
    tail.endsWith("-reject") ||
    prev === "reject" ||
    prev.endsWith("-reject")
  );
}

const PRODUCT_TEMPLATE_READ_ANY: Permission[] = [
  PERMISSIONS.PRODUCT_FACTORY_MANAGE,
  PERMISSIONS.CIF_WRITE,
  PERMISSIONS.ACCOUNTS_WRITE,
  PERMISSIONS.DEPOSITS_WRITE,
  PERMISSIONS.LOANS_WRITE,
  PERMISSIONS.CARDS_WRITE,
];

/**
 * Map BFF enginePrefix + method + path tail → any-of required permissions.
 * Unknown area → [] (fail-closed).
 */
export function requiredPermissionsForEngineProxy(input: {
  enginePrefix: string;
  method: string;
  pathSegments?: string[];
}): Permission[] {
  const area = input.enginePrefix.replace(/-/g, "_");
  const method = input.method.toUpperCase();
  const { tail, prev } = lastSegments(input.pathSegments);

  if (area === "product_templates" || area === "product-templates") {
    if (method === "GET" || method === "HEAD") {
      return PRODUCT_TEMPLATE_READ_ANY;
    }
    return [PERMISSIONS.PRODUCT_FACTORY_MANAGE];
  }

  if (area === "eod") {
    if (method === "GET" || method === "HEAD") {
      return [PERMISSIONS.EOD_RUN, PERMISSIONS.SCREEN_ADMIN_EOD];
    }
    return [PERMISSIONS.EOD_RUN];
  }

  if (isApproveTail(tail, prev)) {
    const p = approvePermission(area);
    return p ? [p] : [];
  }
  if (isRejectTail(tail, prev)) {
    const p = rejectPermission(area);
    return p ? [p] : [];
  }
  if (tail === "reverse") {
    return area === "postings" ? [PERMISSIONS.POSTINGS_REVERSE] : [];
  }
  if (area === "aml" && (tail === "fmn" || prev === "fmn")) {
    return [PERMISSIONS.AML_FMN];
  }
  if (area === "cards" && (tail === "issue" || prev === "issue")) {
    return [PERMISSIONS.CARDS_ISSUE];
  }
  if (
    area === "treasury" &&
    (tail.includes("fx") || prev.includes("fx") || tail === "fx-deals")
  ) {
    return method === "GET" || method === "HEAD"
      ? [PERMISSIONS.TREASURY_READ]
      : [PERMISSIONS.TREASURY_FX];
  }

  if (method === "GET" || method === "HEAD") {
    const p = readPermission(area);
    return p ? [p] : [];
  }
  const w = writePermission(area);
  return w ? [w] : [];
}

/** @deprecated use requiredPermissionsForEngineProxy (any-of). */
export function permissionForEngineProxy(input: {
  enginePrefix: string;
  method: string;
  pathSegments?: string[];
}): Permission | null {
  return requiredPermissionsForEngineProxy(input)[0] ?? null;
}

function readPermission(area: string): Permission | null {
  switch (area) {
    case "cif":
      return PERMISSIONS.CIF_READ;
    case "accounts":
      return PERMISSIONS.ACCOUNTS_READ;
    case "postings":
      return PERMISSIONS.POSTINGS_READ;
    case "payments":
      return PERMISSIONS.PAYMENTS_READ;
    case "cash":
      return PERMISSIONS.CASH_READ;
    case "fees":
      return PERMISSIONS.FEES_READ;
    case "deposits":
      return PERMISSIONS.DEPOSITS_READ;
    case "loans":
      return PERMISSIONS.LOANS_READ;
    case "gl":
      return PERMISSIONS.GL_READ;
    case "aml":
      return PERMISSIONS.AML_READ;
    case "reports":
      return PERMISSIONS.REPORTS_READ;
    case "cards":
      return PERMISSIONS.CARDS_READ;
    case "card_txns":
    case "card-txns":
      return PERMISSIONS.CARD_TXNS_READ;
    case "treasury":
      return PERMISSIONS.TREASURY_READ;
    case "collections":
      return PERMISSIONS.COLLECTIONS_READ;
    case "trade":
      return PERMISSIONS.TRADE_READ;
    case "islamic":
      return PERMISSIONS.ISLAMIC_READ;
    case "wealth":
      return PERMISSIONS.WEALTH_READ;
    case "risk":
      return PERMISSIONS.RISK_READ;
    case "markets":
      return PERMISSIONS.MARKETS_READ;
    case "atm":
      return PERMISSIONS.ATM_READ;
    case "branches":
      return PERMISSIONS.BRANCHES_READ;
    default:
      return null;
  }
}

function writePermission(area: string): Permission | null {
  switch (area) {
    case "cif":
      return PERMISSIONS.CIF_WRITE;
    case "accounts":
      return PERMISSIONS.ACCOUNTS_WRITE;
    case "postings":
      return PERMISSIONS.POSTINGS_WRITE;
    case "payments":
      return PERMISSIONS.PAYMENTS_WRITE;
    case "cash":
      return PERMISSIONS.CASH_WRITE;
    case "fees":
      return PERMISSIONS.FEES_WRITE;
    case "deposits":
      return PERMISSIONS.DEPOSITS_WRITE;
    case "loans":
      return PERMISSIONS.LOANS_WRITE;
    case "gl":
      return PERMISSIONS.GL_WRITE;
    case "aml":
      return PERMISSIONS.AML_WRITE;
    case "cards":
      return PERMISSIONS.CARDS_WRITE;
    case "card_txns":
    case "card-txns":
      return PERMISSIONS.CARD_TXNS_WRITE;
    case "treasury":
      return PERMISSIONS.TREASURY_WRITE;
    case "collections":
      return PERMISSIONS.COLLECTIONS_WRITE;
    case "trade":
      return PERMISSIONS.TRADE_WRITE;
    case "islamic":
      return PERMISSIONS.ISLAMIC_WRITE;
    case "wealth":
      return PERMISSIONS.WEALTH_WRITE;
    case "risk":
      return PERMISSIONS.RISK_WRITE;
    case "markets":
      return PERMISSIONS.MARKETS_WRITE;
    case "atm":
      return PERMISSIONS.ATM_WRITE;
    case "branches":
      return PERMISSIONS.BRANCHES_WRITE;
    case "reports":
      return PERMISSIONS.REPORTS_READ;
    default:
      return null;
  }
}

function approvePermission(area: string): Permission | null {
  switch (area) {
    case "postings":
      return PERMISSIONS.POSTINGS_APPROVE;
    case "payments":
      return PERMISSIONS.PAYMENTS_APPROVE;
    case "deposits":
      return PERMISSIONS.DEPOSITS_APPROVE;
    case "loans":
      return PERMISSIONS.LOANS_APPROVE;
    case "collections":
      return PERMISSIONS.COLLECTIONS_APPROVE;
    case "risk":
      return PERMISSIONS.RISK_APPROVE;
    default:
      return null;
  }
}

function rejectPermission(area: string): Permission | null {
  switch (area) {
    case "postings":
      return PERMISSIONS.POSTINGS_REJECT;
    case "payments":
      return PERMISSIONS.PAYMENTS_REJECT;
    case "deposits":
      return PERMISSIONS.DEPOSITS_REJECT;
    case "loans":
      return PERMISSIONS.LOANS_REJECT;
    case "collections":
      return PERMISSIONS.COLLECTIONS_APPROVE;
    case "risk":
      return PERMISSIONS.RISK_REJECT;
    default:
      return null;
  }
}
