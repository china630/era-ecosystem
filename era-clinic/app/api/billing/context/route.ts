import { NextResponse } from "next/server";
import {
  isWalkInDeferredToHub,
} from "@/lib/billing-router";

export async function GET() {
  const deferWalkInToHub = await isWalkInDeferredToHub();
  return NextResponse.json({ deferWalkInToHub });
}
