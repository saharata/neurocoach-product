"use client";

import { useMemo, useState } from "react";
import EvidencePanel from "@/components/step2/EvidencePanel";
import DiscussionPanel from "@/components/step2/DiscussionPanel";
import CoachPanel from "@/components/step2/CoachPanel";
import VoiceBar from "@/components/step2/VoiceBar";

export default function Step2Page() {
  const [mode, setMode] = useState<"PRE_INVESTIGATION"|"POST_INVESTIGATION">("PRE_INVESTIGATION");
  const [tone, setTone] = useState<"ATTENDING"|"TEACHING"|"NEUTRAL">("ATTENDING");
  const [verbosity, setVerbosity] = useState<"SHORT"|"STANDARD"|"DEEP">("STANDARD");

  const [locked, setLocked] = useState({ history: false, exam: false });

  const [problemRepresentation, setProblemRepresentation] = useState("");

  const [history, setHistory] = useState({
    cc: "",
    hpi: "",
    ros: "",
    pmh: "",
    meds: "",
    allergy: "",
    social: "",
    family: "",
    redFlags: [] as string[],
  });

  const [exam, setExam] = useState({
    vitals: "",
    general: "",
    neuro: {
      mentalStatus: "",
      cranialNerves: "",
      motor: "",
      reflexes: "",
      sensory: "",
      coordination: "",
      gait: "",
      keyNegatives: [] as string[],
    }
  });

  const [investigations, setInvestigations] = useState({
    imaging: [] as string[],
    eeg: [] as string[],
    labsCsf: [] as string[],
    ncsEmg: [] as string[],
  });

  const [out, setOut] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const requestBody = useMemo(() => ({
    mode,
    locked,
    clinical: {
      problemRepresentation,
      history,
      exam
    },
    investigations,
    style: { tone, verbosity }
  }), [mode, locked, problemRepresentation, history, exam, investigations, tone, verbosity]);

  async function generate() {
    setLoading(true);
    setOut(null);
    try {
      const resp = await fetch("/api/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Request failed");
      setOut(data);
    } catch (e: any) {
      setOut({ error: e?.message || "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div style={{fontWeight: 800}}>Step 2 — Neuro Discussion + Coach</div>
          <div className="small">Localization → DDx by category → shortlist → next tests (pre-investigation)</div>
        </div>

        <div className="row" style={{maxWidth: 520}}>
          <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="PRE_INVESTIGATION">PRE-INVESTIGATION</option>
            <option value="POST_INVESTIGATION">POST-INVESTIGATION</option>
          </select>
          <select value={tone} onChange={(e) => setTone(e.target.value as any)}>
            <option value="ATTENDING">Attending</option>
            <option value="TEACHING">Teaching</option>
            <option value="NEUTRAL">Neutral</option>
          </select>
          <select value={verbosity} onChange={(e) => setVerbosity(e.target.value as any)}>
            <option value="SHORT">Short</option>
            <option value="STANDARD">Standard</option>
            <option value="DEEP">Deep</option>
          </select>
        </div>
      </div>

      <div className="grid">
        <EvidencePanel
          problemRepresentation={problemRepresentation}
          setProblemRepresentation={setProblemRepresentation}
          history={history}
          setHistory={setHistory}
          exam={exam}
          setExam={setExam}
          locked={locked}
          setLocked={setLocked}
        />

        <div style={{display:"flex", flexDirection:"column", gap: 14}}>
          <div className="card">
            <h3>Run</h3>
            <div className="btnbar">
              <button onClick={generate} disabled={loading}>
                {loading ? "Generating..." : "Generate discussion"}
              </button>
              <button onClick={() => setOut(null)} disabled={loading}>
                Clear output
              </button>
              <span className="pill">Model: {process.env.NEXT_PUBLIC_MODEL_HINT || "server env"}</span>
            </div>
            {out?.error && (
              <pre style={{marginTop: 10}}>{out.error}</pre>
            )}
          </div>

          <DiscussionPanel data={out && !out.error ? out : null} />
          <CoachPanel coach={out && !out.error ? out.coach : null} />
        </div>
      </div>

      <VoiceBar />
    </div>
  );
}