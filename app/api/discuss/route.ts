import { NextResponse } from "next/server";
import { DiscussRequestSchema, DiscussResponseSchema } from "../../../lib/schema";
import { buildSystemPrompt, buildUserPrompt } from "../../../lib/prompts";
import { callOpenAIJson } from "../../../lib/openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_TEXT_MODEL || "o3";
    if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

    const body = await req.json();
    const parsed = DiscussRequestSchema.parse(body);

    const system = buildSystemPrompt(parsed.style.tone);
    const user = buildUserPrompt(parsed);

    const out = await callOpenAIJson({ apiKey, model, system, user });

    // validate JSON response
    const json = JSON.parse(out);
    const safe = DiscussResponseSchema.parse(json);

    return NextResponse.json(safe);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}