import { createHash } from "crypto";
import type { DboChannel } from "@prisma/client";
import {
  DBO_SESSION_COOKIE,
  signDboSessionCookie,
  verifyDboSessionCookie,
  type DboSessionPayload,
} from "@/lib/dbo-session-cookie";
import { prisma } from "@/lib/prisma";

export { DBO_SESSION_COOKIE, verifyDboSessionCookie, type DboSessionPayload };

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export type CreateCustomerSessionInput = {
  customerId: string;
  globalPersonId?: string | null;
  channel: DboChannel;
  deviceId?: string | null;
  customerJwt: string;
  ttlMinutes?: number;
};

export async function createCustomerSession(input: CreateCustomerSessionInput) {
  const ttlMinutes = input.ttlMinutes ?? 60 * 4;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const session = await prisma.customerSession.create({
    data: {
      customerId: input.customerId,
      globalPersonId: input.globalPersonId ?? null,
      channel: input.channel,
      deviceId: input.deviceId ?? null,
      customerJwt: input.customerJwt,
      expiresAt,
    },
  });
  const cookieToken = signDboSessionCookie({
    sessionId: session.id,
    customerId: session.customerId,
    channel: session.channel,
    exp: Math.floor(expiresAt.getTime() / 1000),
  });
  return { session, cookieToken, maxAge: ttlMinutes * 60 };
}

export async function resolveCustomerSession(token: string | null | undefined) {
  if (!token) return null;
  const payload = verifyDboSessionCookie(token);
  if (!payload) return null;
  const session = await prisma.customerSession.findUnique({ where: { id: payload.sessionId } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.customerId !== payload.customerId) return null;
  return session;
}

export async function revokeCustomerSession(sessionId: string) {
  await prisma.customerSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function updateSessionCustomerJwt(sessionId: string, customerJwt: string) {
  await prisma.customerSession.update({
    where: { id: sessionId },
    data: { customerJwt },
  });
}

export async function createPaymentSignRequest(input: {
  engineOrderId: string;
  customerId: string;
  requestedBySessionId: string;
  expiresAt?: Date;
}) {
  const expiresAt =
    input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  return prisma.paymentSignRequest.create({
    data: {
      engineOrderId: input.engineOrderId,
      customerId: input.customerId,
      requestedBySessionId: input.requestedBySessionId,
      expiresAt,
      status: "PENDING",
    },
  });
}

export async function listPendingSignRequests(customerId: string) {
  return prisma.paymentSignRequest.findMany({
    where: {
      customerId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function markSignRequestSigned(input: {
  id: string;
  signedBySessionId: string;
  asanTransactionId?: string | null;
}) {
  return prisma.paymentSignRequest.update({
    where: { id: input.id },
    data: {
      status: "SIGNED",
      signedBySessionId: input.signedBySessionId,
      asanTransactionId: input.asanTransactionId ?? null,
    },
  });
}
