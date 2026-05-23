#!/usr/bin/env node
/**
 * Manual smoke for Stage 17 POS bridge (requires running app + seed).
 * Usage: node scripts/test-pos-bridge.mjs
 */
const base = process.env.PMS_URL ?? 'http://localhost:3000';
const secret = process.env.POS_BRIDGE_SECRET ?? 'dev-pos-bridge-secret';

const headers = {
  'Content-Type': 'application/json',
  'X-Pos-Bridge-Secret': secret,
};

async function req(method, path, body, extra = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...headers, ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('GET /api/pms/in-house?query=20');
  const inh = await req('GET', '/api/pms/in-house?query=20');
  console.log(inh.status, inh.data);

  const key = crypto.randomUUID();
  console.log('POST /api/pos/room-charge (idempotent)', key);
  const body = {
    roomNumber: '201',
    revenueCode: 'FOOD',
    amount: 1.5,
    description: 'Bridge test',
    outletCode: 'RESTAURANT',
    externalTicketId: key,
  };
  const r1 = await req('POST', '/api/pos/room-charge', body, {
    'Idempotency-Key': key,
  });
  console.log(r1.status, r1.data?.id ?? r1.data?.error);
  const r2 = await req('POST', '/api/pos/room-charge', body, {
    'Idempotency-Key': key,
  });
  console.log('repeat', r2.status, r2.data?.idempotent);

  console.log('PUT pos-shift OPEN');
  await req('PUT', '/api/pms/pos-shift-status', {
    outletCode: 'RESTAURANT',
    shiftId: 'test-shift-1',
    status: 'OPEN',
  });
  const st = await req('GET', '/api/pms/pos-shift-status');
  console.log('shift status', st.data);

  await req('PUT', '/api/pms/pos-shift-status', {
    outletCode: 'RESTAURANT',
    shiftId: 'test-shift-1',
    status: 'CLOSED',
    closedAt: new Date().toISOString(),
  });
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
