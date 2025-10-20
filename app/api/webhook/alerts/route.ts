import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  console.log("Received alert webhook", payload);
  // Stub webhook that simply acknowledges the payload for now.
  return NextResponse.json({ received: true });
}
