import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const BodySchema = z.object({
  clinical: z.object({
    problemRepresentation: z.string().optional().default(""),
    history: z.any(),
    exam: z.any(),
  }),
  ai: z
    .object({
      discussion: z.any().optional(),
      attending: z.any().optional(),
      ddxByCategory: z.any().optional(),
    })
    .optional(),
  investigations: z.object({
    blood: z.string().optional(),
    mri: z.string().optional(),
    eeg: z.string().optional(),
    ncs: z.string().optional(),
    genetic: z.string().optional(),
    autonomic: z.string().optional(),
  }),
  ts: z.string(),
});

const ResultSchema = z.object({
  attendingCommitment: z.string(),
  finalDiagnosis: z.string(),
  confidencePct: z.number().min(0).max(100),
  diagnosisCertainty: z.enum(["VERY_HIGH", "HIGH", "MODERATE", "LOW"]),

  clinicalSyndrome: z.string(),
  pivotalFindings: z.array(z.string()),

  supportingEvidence: z.array(z.string()),
  contradictingEvidence: z.array(z.string()),

  remainingDDx: z.array(
    z.object({
      name: z.string(),
      whyStillPossible: z.string(),
      whatWouldDisprove: z.string(),
    })
  ),

  falsificationTarget: z.string(),
  nextBestIfWrong: z.object({
    dx: z.string(),
    oneBestTestOrAction: z.string(),
  }),

  plan: z.object({
    immediate: z.array(z.string()),
    nextTests: z.array(z.string()),
    treatment: z.array(z.string()),
    disposition: z.array(z.string()),
    followUp: z.array(z.string()),
  }),

  safetyRedFlags: z.array(z.string()),
});

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function invBlock(inv: any) {
  const blocks = [
    inv.blood ? `BLOOD:\n${inv.blood}` : "",
    inv.mri ? `MRI (TEXT):\n${inv.mri}` : "",
    inv.eeg ? `EEG:\n${inv.eeg}` : "",
    inv.ncs ? `NCS/EMG:\n${inv.ncs}` : "",
    inv.genetic ? `GENETIC:\n${inv.genetic}` : "",
    inv.autonomic ? `AUTONOMIC:\n${inv.autonomic}` : "",
  ].filter(Boolean);
  return blocks.length ? blocks.join("\n\n") : "(No investigations provided)";
}

function buildPrompt(b: z.infer<typeof BodySchema>) {
  return `
You are a senior neurologist attending. This is STEP 4: POST-INVESTIGATION DIAGNOSTIC CLOSURE.

ATTENDING RULES (clinical-first):
1) Commit to ONE most likely final diagnosis. No hedging.
2) Clinical-first: prioritize Hx/Exam and illness script matching.
3) Use investigations ONLY to confirm/refute/pivot the clinical hypothesis.
4) State pivotal findings and why they change the probability.
5) Provide falsification: what would make you reconsider.
6) Provide a safety-net: next-best diagnosis if wrong + ONE best test/action to catch it early.
7) Output MUST be valid JSON exactly matching schema. No extra keys. No markdown.

CLINICAL:
Problem representation: ${b.clinical.problemRepresentation || ""}
History JSON: ${JSON.stringify(b.clinical.history)}
Exam JSON: ${JSON.stringify(b.clinical.exam)}

OPTIONAL PRE-INVESTIGATION CONTEXT (background only):
Attending pre-summary: ${JSON.stringify(b.ai?.attending ?? null)}
DDx by category: ${JSON.stringify(b.ai?.ddxByCategory ?? null)}
Discussion/localization: ${JSON.stringify(b.ai?.discussion ?? null)}

INVESTIGATIONS:
${invBlock(b.investigations)}

OUTPUT JSON SCHEMA:
{
  "attendingCommitment": "string",
  "finalDiagnosis": "string",
  "confidencePct": 0-100,
  "diagnosisCertainty": "VERY_HIGH|HIGH|MODERATE|LOW",
  "clinicalSyndrome": "string",
  "pivotalFindings": ["..."],
  "supportingEvidence": ["..."],
  "contradictingEvidence": ["..."],
  "remainingDDx": [{"name":"...","whyStillPossible":"...","whatWouldDisprove":"..."}],
  "falsificationTarget": "string",
  "nextBestIfWrong": {"dx":"...","oneBestTestOrAction":"..."},
  "plan": {
    "immediate": ["..."],
    "nextTests": ["..."],
    "treatment": ["..."],
    "disposition": ["..."],
    "followUp": ["..."]
  },
  "safetyRedFlags": ["..."]
}
`.trim();
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const prompt = buildPrompt(parsed.data);

  const resp = await openai.responses.create({
    model: process.env.OPENAI_MODEL_STEP4 || "o3",
    input: prompt,
  });

  const text = resp.output_text?.trim() || "";
  const json = safeJsonParse(text);

  const validated = ResultSchema.safeParse(json);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Model output not valid JSON schema", raw: text, details: validated.error.flatten() },
      { status: 502 }
    );
  }

  return NextResponse.json(validated.data);
}