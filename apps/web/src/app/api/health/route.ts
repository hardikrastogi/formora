import { NextResponse } from "next/server";

/**
 * Liveness only: "is this instance up and able to respond at all." No
 * database call, no dependency checks — cheap enough to ping every few
 * seconds from an uptime monitor without adding load. See /api/ready for a
 * check that also confirms MongoDB is reachable.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
