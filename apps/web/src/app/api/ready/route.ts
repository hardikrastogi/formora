import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";

/**
 * Readiness: liveness plus "can this instance actually serve a request that
 * touches the database." A monitor that only checked /api/health would stay
 * green through a MongoDB outage; this is the one that should actually page
 * someone. Deliberately reveals nothing about *why* the database is
 * unreachable — no connection string, no stack trace, no internal detail —
 * just up or down.
 */
export async function GET() {
  try {
    const mongoose = await connectToDatabase();
    // A real round trip, not just "a connection object exists" — pings the
    // server the way a driver health check normally would.
    await mongoose.connection.db?.admin().ping();
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
