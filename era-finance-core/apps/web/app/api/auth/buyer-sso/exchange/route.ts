import {
  buyerAuthCookieName,
  buyerSsoExchangeBodySchema,
  consumeSsoSignatureOnce,
  signBuyerSession,
  verifyBuyerSsoSignature,
} from "@era/satellite-kit";
import { NextResponse } from "next/server";

/**
 * Buyer portal SSO — distinct from staff/owner auth.
 * Payload: buyer|{email}|{organizationId}|{counterpartyId}|{expiresAt}|{jti}
 *
 * Filesystem route takes precedence over Next rewrite to Nest.
 */
export async function POST(request: Request) {
  try {
    const body = buyerSsoExchangeBodySchema.parse(await request.json());
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: "SSO token expired" }, { status: 401 });
    }

    const ok = verifyBuyerSsoSignature({
      email: body.email,
      organizationId: body.organizationId,
      counterpartyId: body.counterpartyId,
      expiresAt: body.expiresAt,
      signature: body.signature,
      jti: body.jti,
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid buyer SSO signature" },
        { status: 401 },
      );
    }
    if (!consumeSsoSignatureOnce(body.signature, body.expiresAt)) {
      return NextResponse.json(
        { error: "SSO ticket already used" },
        { status: 401 },
      );
    }

    const email = body.email.trim().toLowerCase();
    const token = await signBuyerSession({
      sub: `buyer:${body.counterpartyId}:${email}`,
      actor: "buyer",
      email,
      fullName: body.fullName?.trim() || email.split("@")[0] || "Buyer",
      organizationId: body.organizationId,
      counterpartyId: body.counterpartyId,
    });

    const cookie = buyerAuthCookieName();
    const res = NextResponse.json({
      organizationId: body.organizationId,
      counterpartyId: body.counterpartyId,
      email,
    });
    res.cookies.set(cookie, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "SSO exchange failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
