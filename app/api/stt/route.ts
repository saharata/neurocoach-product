import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const STT_MODEL = process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe"; // แนะนำตัวนี้ :contentReference[oaicite:1]{index=1}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing audio file (form field: file)" }, { status: 400 });
    }

    // ส่งให้ OpenAI transcription endpoint (รองรับ webm) :contentReference[oaicite:2]{index=2}
    const transcription = await client.audio.transcriptions.create({
      file: file as any, // SDK รับ File/Blob
      model: STT_MODEL as any,
      // language: "th", // ใส่ได้ถ้าอยากบังคับภาษา
      // prompt: "This is a Thai medical interview transcript." // optional
    });

    return NextResponse.json({ text: transcription.text || "" });
  } catch (e: any) {
    return NextResponse.json(
      { error: "STT failed", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}