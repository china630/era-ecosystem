import { NextResponse } from 'next/server';

/**
 * Legacy B2C rates dump — not org-scoped.
 * Prefer GET /api/public/v1/availability with IBE publishable key.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'GONE',
      message:
        'Use GET /api/public/v1/availability with Authorization: Bearer <ibePublishableKey>',
      widget: 'b2c_v2_bar',
    },
    { status: 410 },
  );
}
