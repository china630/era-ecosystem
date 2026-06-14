import { NextResponse } from 'next/server';

const RETIRED = {
  error: 'Contract pricing API retired',
  hint: 'use SalesContract',
};

export async function PATCH() {
  return NextResponse.json(RETIRED, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json(RETIRED, { status: 410 });
}
