import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "o3";

/**
 * Output shape MUST match Step2 state:
 * {
 *   problem_representation: string,
 *   history: { cc,hpi,ros,pmh,meds,allergy,social,family,redFlags: string[] },
 *   exam: { vitals,general,neuro:{ mentalStatus,cranialNerves,motor,reflexes,sensory,coordination,gait,keyNegatives:string[] } }
 * }
 */
const SCHEMA = {
  name: "step1_prefill",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      problem_representation: { type: "string" },

      history: {
        type: "object",
        additionalProperties: false,
        properties: {
          cc: { type: "string" },
          hpi: { type: "string" },
          ros: { type: "string" },
          pmh: { type: "string" },
          meds: { type: "string" },
          allergy: { type: "string" },
          social: { type: "string" },
          family: { type: "string" },
          redFlags: { type: "array", items: { type: "string" } },
        },
        required: ["cc", "hpi", "ros", "pmh", "meds", "allergy", "social", "family", "redFlags"],
      },

      exam: {
        type: "object",
        additionalProperties: false,
        properties: {
          vitals: { type: "string" },
          general: { type: "string" },
          neuro: {
            type: "object",
            additionalProperties: false,
            properties: {
              mentalStatus: { type: "string" },
              cranialNerves: { type: "string" },
              motor: { type: "string" },
              reflexes: { type: "string" },
              sensory: { type: "string" },
              coordination: { type: "string" },
              gait: { type: "string" },
              keyNegatives: { type: "array", items: { type: "string" } },
            },
            required: [
              "mentalStatus",
              "cranialNerves",
              "motor",
              "reflexes",
              "sensory",
              "coordination",
              "gait",
              "keyNegatives",
            ],
          },
        },
        required: ["vitals", "general", "neuro"],
      },
    },
    required: ["problem_representation", "history", "exam"],
  },
  strict: true,
};

function systemPrompt() {
  return `
You are a clinical scribe assistant for neurologists.

Task:
- Convert doctor–patient conversation (Thai/English) into structured History and Neurologic Exam for the UI.
- Primary focus: URI/cold symptoms (fever, cough, sore throat, rhinorrhea, dyspnea) but still capture neuro symptoms and red flags.

Rules:
- DO NOT invent details.
- If missing, use empty string "" for text fields.
- For redFlags and keyNegatives: return array of strings (can be empty).
- Keep Thai if transcript is Thai.
- Return JSON only and follow schema strictly.

Red flag label examples (use as items in history.redFlags when present):
- high_fever_or_toxic
- altered_consciousness
- focal_neurologic_deficit
- severe_headache
- neck_stiffness
- seizure
- progressive_weakness
- dyspnea_or_hypoxia
- chest_pain
- immunocompromised_or_high_risk

Key negatives: include important negatives mentioned (e.g., "no seizure", "no dyspnea", "no weakness").
`.trim();
}

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "transcript is required (string)" }, { status: 400 });
    }
const completion = await client.chat.completions.create({
  model: MODEL,
  messages: [
    { role: "system", content: systemPrompt() },
    { role: "user", content: transcript },
  ],
  response_format: { type: "json_schema", json_schema: SCHEMA as any },
  // temperature: 0.2  <-- remove
});

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let prefill: any;
    try {
      prefill = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Model returned non-JSON", raw }, { status: 502 });
    }

    return NextResponse.json({ prefill });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Step1 failed", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}