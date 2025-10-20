import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      message: "Pipecat voice session endpoint will be implemented by the background agent.",
      status: "not_configured",
    },
    { status: 501 }
  );
}
