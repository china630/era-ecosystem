import { NextResponse } from 'next/server';

const RETIRED = {
  error: 'Contract pricing API retired',
  hint: 'use SalesContract',
};

export async function GET() {
  return NextResponse.json(RETIRED, { status: 410 });
}

export async function POST() {
  return NextResponse.json(RETIRED, { status: 410 });
}
