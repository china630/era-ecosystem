#!/usr/bin/env node
/**
 * Dev acquiring stub — authorize / capture against era-bank-core card API.
 * Usage:
 *   node tools/card-acquiring-stub.mjs authorize --amount 5000 --token <cardId> --ref auth-001
 *   node tools/card-acquiring-stub.mjs capture --ref auth-001
 *   node tools/card-acquiring-stub.mjs reverse --ref auth-001
 */
const BASE = (process.env.ERA_BANK_CORE_URL ?? "http://127.0.0.1:4300").replace(/\/$/, "");
const SERVICE_TOKEN = process.env.BANK_CORE_SERVICE_TOKEN ?? "dev-bank-core-service-token";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      out[a.slice(2)] = argv[i + 1];
      i += 1;
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function api(path, body) {
  const res = await fetch(`${BASE}/api/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    console.error(JSON.stringify({ status: res.status, body: json }, null, 2));
    process.exit(1);
  }
  return json;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (cmd === "authorize") {
    const amount = args.amount ?? "5000";
    const cardId = args.token ?? args.card;
    if (!cardId) {
      console.error("authorize requires --token <cardId>");
      process.exit(1);
    }
    const ref = args.ref ?? `stub-auth-${Date.now()}`;
    const result = await api("card-txns/authorize", {
      cardId,
      amountMinor: String(amount),
      currency: "AZN",
      processorRef: ref,
      merchantName: args.merchant ?? "Stub Merchant",
      mcc: args.mcc ?? "5411",
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (cmd === "capture") {
    const ref = args.ref;
    if (!ref && !args.authTxnId) {
      console.error("capture requires --ref <processorRef> or --authTxnId");
      process.exit(1);
    }
    const result = await api("card-txns/capture", {
      processorRef: ref,
      authTxnId: args.authTxnId,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (cmd === "reverse") {
    const authTxnId = args.authTxnId ?? args.id;
    if (!authTxnId) {
      console.error("reverse requires --authTxnId (id from authorize response)");
      process.exit(1);
    }
    const result = await api(`card-txns/${authTxnId}/reverse`, {});
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.error("Usage: authorize | capture | reverse");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
