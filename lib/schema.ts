import { z } from "zod";

export const StyleSchema = z.object({
  tone: z.enum(["ATTENDING", "TEACHING", "NEUTRAL"]).default("ATTENDING"),
  verbosity: z.enum(["SHORT", "STANDARD", "DEEP"]).default("STANDARD"),
});

export const ClinicalSchema = z.object({
  problemRepresentation: z.string().default(""),
  history: z.object({
    cc: z.string().default(""),
    hpi: z.string().default(""),
    ros: z.string().default(""),
    pmh: z.string().default(""),
    meds: z.string().default(""),
    allergy: z.string().default(""),
    social: z.string().default(""),
    family: z.string().default(""),
    redFlags: z.array(z.string()).default([]),
  }),
  exam: z.object({
    vitals: z.string().default(""),
    general: z.string().default(""),
    neuro: z.object({
      mentalStatus: z.string().default(""),
      cranialNerves: z.string().default(""),
      motor: z.string().default(""),
      reflexes: z.string().default(""),
      sensory: z.string().default(""),
      coordination: z.string().default(""),
      gait: z.string().default(""),
      keyNegatives: z.array(z.string()).default([]),
    }),
  }),
});

export const DiscussRequestSchema = z.object({
  mode: z.enum(["PRE_INVESTIGATION", "POST_INVESTIGATION"]).default("PRE_INVESTIGATION"),
  locked: z.object({
    history: z.boolean().default(false),
    exam: z.boolean().default(false),
  }),
  clinical: ClinicalSchema,
  investigations: z.object({
    imaging: z.array(z.string()).default([]),
    eeg: z.array(z.string()).default([]),
    labsCsf: z.array(z.string()).default([]),
    ncsEmg: z.array(z.string()).default([]),
  }).default({ imaging: [], eeg: [], labsCsf: [], ncsEmg: [] }),
  style: StyleSchema.default({ tone: "ATTENDING", verbosity: "STANDARD" }),
});

export const DiscussResponseSchema = z.object({
  localization: z.string().default(""),
  ddxByCategory: z.array(z.object({
    category: z.string(),
    support: z.array(z.string()).default([]),
    against: z.array(z.string()).default([]),
    diseases: z.array(z.string()).default([]),
    nextTests: z.array(z.string()).default([]),
  })).default([]),
  shortlist: z.array(z.object({
    diagnosis: z.string(),
    why: z.string(),
    confidence: z.enum(["HIGH", "MODERATE", "LOW"]).default("LOW"),
  })).default([]),
  nextTests: z.array(z.string()).default([]),
  coach: z.object({
    alerts: z.array(z.string()).default([]),
    missingKeyItems: z.array(z.string()).default([]),
    suggestedQuestions: z.array(z.string()).default([]),
  }).default({ alerts: [], missingKeyItems: [], suggestedQuestions: [] }),
});