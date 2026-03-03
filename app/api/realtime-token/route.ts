import { NextResponse } from "next/server";

export async function POST() {
  try {
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: "alloy",
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }

    return NextResponse.json({
      client_secret: data.client_secret?.value,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Realtime token error" },
      { status: 500 }
    );
  }
}