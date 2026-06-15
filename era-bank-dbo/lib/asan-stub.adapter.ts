/**
 * Dev ASAN İmza / SİMA stub adapter for the DBO channel.
 * Production swaps this for a real gateway without changing BFF contracts.
 */

export type AsanChallengeStart = {
  transactionId: string;
  redirectUrl: string;
};

export type AsanChallengeComplete = {
  verified: boolean;
  fin?: string;
  voen?: string;
};

function stubEnabled(): boolean {
  return process.env.ASAN_STUB_ENABLED !== "false";
}

export function startAsanChallenge(identifier: string, channel: "RETAIL" | "CORPORATE"): AsanChallengeStart {
  if (!stubEnabled()) {
    throw new Error("ASAN stub is disabled");
  }
  const transactionId = `asan-stub-${channel.toLowerCase()}-${Buffer.from(identifier).toString("base64url").slice(0, 12)}-${Date.now()}`;
  const origin = process.env.ERA_BANK_DBO_ORIGIN ?? "http://127.0.0.1:3211";
  return {
    transactionId,
    redirectUrl: `${origin}/login?asanTx=${encodeURIComponent(transactionId)}&channel=${channel}`,
  };
}

export function completeAsanChallenge(
  transactionId: string,
  identifier: string,
  channel: "RETAIL" | "CORPORATE",
): AsanChallengeComplete {
  if (!stubEnabled()) {
    throw new Error("ASAN stub is disabled");
  }
  if (!transactionId.startsWith("asan-stub-")) {
    return { verified: false };
  }
  if (channel === "RETAIL") {
    return { verified: true, fin: identifier.toUpperCase() };
  }
  return { verified: true, voen: identifier };
}

export function isAsanStubTransaction(transactionId: string): boolean {
  return transactionId.startsWith("asan-stub-");
}
