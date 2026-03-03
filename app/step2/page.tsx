"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EvidencePanel from "../EvidencePanel";
import DiscussionPanel from "../DiscussionPanel";
import CoachPanel from "../CoachPanel";
import Step1Bar from "../Step1Bar";

type Mode = "PRE_INVESTIGATION" | "POST_INVESTIGATION";
type Tone = "ATTENDING" | "TEACHING" | "NEUTRAL";
type Verbosity = "SHORT" | "STANDARD" | "DEEP";

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function Step2Page() {
  const [mode, setMode] = useState<Mode>("PRE_INVESTIGATION");
  const [tone, setTone] = useState<Tone>("ATTENDING");
  const [verbosity, setVerbosity] = useState<Verbosity>("STANDARD");

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
    },
  });

  // NOTE: Step2 เดิมใช้เป็น array; เก็บไว้เหมือนเดิมเพื่อไม่กระทบ component อื่น
  const [investigations, setInvestigations] = useState({
    imaging: [] as string[],
    eeg: [] as string[],
    labsCsf: [] as string[],
    ncsEmg: [] as string[],
  });

  const [out, setOut] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // =========================
  // ✅ Step 3 — Email + Sheet
  // =========================
  const [consultEmail, setConsultEmail] = useState("");
  const [step3Loading, setStep3Loading] = useState(false);
  const [step3Msg, setStep3Msg] = useState<string>("");

  // =========================
  // ✅ Voice (WebRTC Realtime)
  // =========================
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const [voiceStatus, setVoiceStatus] = useState<
    "idle" | "requesting_mic" | "getting_token" | "connecting" | "ready" | "error"
  >("idle");
  const [voiceError, setVoiceError] = useState<string>("");

  // ✅ toggle: เริ่ม voice หลัง generate เท่านั้น
  const [autoVoiceAfterGenerate, setAutoVoiceAfterGenerate] = useState(true);

  // -------------------------
  // ✅ Step4 Context Saver (minimal change)
  // -------------------------
  function saveStep4Context(latestOut: any) {
    try {
      const payload = {
        clinical: { problemRepresentation, history, exam },
        ai: {
          discussion: latestOut?.discussion ?? null,
          attending: latestOut?.attending ?? null,
          ddxByCategory: latestOut?.ddxByCategory ?? null,
        },
        ts: new Date().toISOString(),
      };
      sessionStorage.setItem("step4_context", JSON.stringify(payload));
    } catch {}
  }

  // ✅ Apply Step1 → fill Step2 state immediately
  function applyPrefill(prefill: any) {
    if (typeof prefill?.problem_representation === "string") {
      setProblemRepresentation(prefill.problem_representation);
    }
    if (prefill?.history) setHistory((prev) => ({ ...prev, ...prefill.history }));
    if (prefill?.exam) {
      setExam((prev) => ({
        ...prev,
        ...prefill.exam,
        neuro: { ...prev.neuro, ...(prefill.exam.neuro || {}) },
      }));
    }
    // reset output to avoid mixing cases
    setOut(null);
    setStep3Msg("");
  }

  const requestBody = useMemo(
    () => ({
      mode,
      locked,
      clinical: { problemRepresentation, history, exam },
      investigations,
      style: { tone, verbosity },
    }),
    [mode, locked, problemRepresentation, history, exam, investigations, tone, verbosity]
  );

  async function getEphemeralToken() {
    const r = await fetch("/api/realtime-token", { method: "POST" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Failed to get realtime token");
    if (!data?.client_secret) throw new Error("No client_secret returned");
    return data.client_secret as string;
  }

  function stopVoice() {
    try {
      dcRef.current?.close();
    } catch {}
    try {
      pcRef.current?.close();
    } catch {}
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}

    dcRef.current = null;
    pcRef.current = null;
    localStreamRef.current = null;

    setVoiceStatus("idle");
  }

  // =========================
  // ✅ Voice Instructions (STRICT 2 blocks only)
  // =========================
  function buildVoiceInstructionsFromOut(latestOut: any) {
    const toneText =
      tone === "ATTENDING"
        ? "โทนเหมือนอาจารย์แพทย์ attending พูดชัดเจน"
        : tone === "TEACHING"
        ? "โทนสอน resident แทรก reasoning สั้นๆ"
        : "โทนกลาง สุภาพ";

    const verbosityText =
      verbosity === "SHORT"
        ? "สั้นมาก"
        : verbosity === "DEEP"
        ? "ละเอียดขึ้นแต่ยังไม่ยาว"
        : "มาตรฐาน กระชับ";

    const toText = (v: any): string => {
      if (v == null) return "";
      if (typeof v === "string") return v;
      if (Array.isArray(v)) {
        return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n");
      }
      if (typeof v === "object") return JSON.stringify(v, null, 2);
      return String(v);
    };

    const pick = (...vals: any[]) => {
      for (const v of vals) {
        const s = toText(v).trim();
        if (s) return s;
      }
      return "";
    };

    const block1 = pick(
      latestOut?.discussion?.shortNote,
      latestOut?.discussion?.short_note,
      latestOut?.discussion?.localizationShort,
      latestOut?.discussion?.localization_short,
      latestOut?.discussion?.localization,
      latestOut?.attending?.shortNote,
      latestOut?.attending?.short_note,
      latestOut?.attending?.localization,
      latestOut?.localizationShort,
      latestOut?.localization_short,
      latestOut?.localization
    );

    const block2 = pick(
      latestOut?.discussion?.shortlist,
      latestOut?.discussion?.dxShortlist,
      latestOut?.discussion?.dx_shortlist,
      latestOut?.discussion?.summaryShort,
      latestOut?.discussion?.summary_short,
      latestOut?.attending?.shortlist,
      latestOut?.attending?.dxShortlist,
      latestOut?.attending?.summaryShort,
      latestOut?.shortlist,
      latestOut?.summaryShort,
      latestOut?.summary_short
    );

    const safeBlock1 = block1 || "(ยังไม่พบช็อตโน้ต/โลคาไลเซชั่นใน out)";
    const safeBlock2 = block2 || "(ยังไม่พบ shortlist/ช็อตสรุปวินิจฉัยใน out)";

    return `
คุณคือแพทย์ระบบประสาท ทำหน้าที่อ่านออกเสียง “เฉพาะ 2 บล็อก” เท่านั้น แล้วค่อยถามคำถามเพิ่ม
กติกา:
- พูดภาษาไทยเท่านั้น (ยกเว้นชื่อโรค/ตัวย่อจำเป็น)
- ${toneText}
- ระดับความละเอียด: ${verbosityText}
- ห้ามดึง/เดา/อธิบายจากข้อมูลอื่นนอกจากข้อความ 2 บล็อกที่ให้
- ห้ามอ่าน discussion เต็ม หรือ reasoning ยาว หรือส่วน coach

ทำตามลำดับนี้เคร่งครัด:

[ช่วงที่ 1: ช็อตโน้ต/โลคาไลเซชั่น]
- อ่าน/สรุปจากบล็อกที่ 1 เท่านั้น
- ถ้ายาว ให้ย่อเป็น 3–5 bullet (ไม่เกิน 45 วินาที)
- ปิดท้ายด้วยประโยค: "ต่อไปเป็นสรุปวินิจฉัย"

[ช่วงที่ 2: shortlist/สรุปวินิจฉัย]
- อ่าน/สรุปจากบล็อกที่ 2 เท่านั้น
- ถ้ามีหลายโรค ให้เรียงรายการ พร้อมเหตุผล 1 บรรทัดต่อข้อ

[ช่วงที่ 3: ถามคำถามเพิ่ม]
- สร้างคำถาม 3 ข้อ เพื่อแยกโรค/คัด red flags
- “ถามแค่ข้อที่ 1 ข้อเดียว” แล้วหยุดรอคำตอบ

=== บล็อกที่ 1: ช็อตโน้ต/โลคาไลเซชั่น ===
${safeBlock1}

=== บล็อกที่ 2: shortlist/สรุปวินิจฉัย ===
${safeBlock2}
`.trim();
  }

  async function startVoiceWithContext(latestOut: any) {
    setVoiceError("");
    setVoiceStatus("requesting_mic");

    try {
      const local = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = local;

      setVoiceStatus("getting_token");
      const EPHEMERAL_KEY = await getEphemeralToken();

      setVoiceStatus("connecting");
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      local.getTracks().forEach((t) => pc.addTrack(t, local));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        const instructions = buildVoiceInstructionsFromOut(latestOut);

        dc.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio", "text"],
              instructions,
            },
          })
        );

        setVoiceStatus("ready");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // ✅ configurable + safe default (avoid deprecated preview model)
      const model = process.env.NEXT_PUBLIC_REALTIME_MODEL || "gpt-realtime";

      const sdpResp = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        }
      );

      const answerSdp = await sdpResp.text();
      if (!sdpResp.ok) throw new Error(answerSdp || "Realtime SDP failed");

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err: any) {
      setVoiceStatus("error");
      setVoiceError(err?.message || "Voice error");
      stopVoice();
    }
  }

  async function generate() {
    setLoading(true);
    setOut(null);
    setStep3Msg("");

    try {
      const resp = await fetch("/api/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Request failed");

      setOut(data);

      // ✅ always save context for Step4 (minimal + robust)
      saveStep4Context(data);

      if (autoVoiceAfterGenerate) {
        stopVoice();
        await startVoiceWithContext(data);
      }
    } catch (e: any) {
      setOut({ error: e?.message || "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // ✅ Step 3 submit
  // =========================
  async function submitStep3() {
    setStep3Msg("");
    setStep3Loading(true);

    try {
      const email = consultEmail.trim();
      if (!email) throw new Error("กรุณากรอกอีเมลผู้คอนเซ้าท์ก่อน");
      if (!isValidEmail(email)) throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
      if (!out || out?.error) throw new Error("ยังไม่มีผลลัพธ์จาก Generate discussion");

      const payload = {
        consultEmail: email,
        clinical: {
          problemRepresentation,
          history,
          exam,
        },
        ai: {
          discussion: out?.discussion ?? null,
          coach: out?.coach ?? null,
          attending: out?.attending ?? null,
        },
        ts: new Date().toISOString(),
      };

      const resp = await fetch("/api/step3-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Step 3 failed");

      setStep3Msg("✅ ส่งอีเมล + บันทึกลงชีทเรียบร้อย");
    } catch (e: any) {
      setStep3Msg(`❌ ${e?.message || "เกิดข้อผิดพลาด"}`);
    } finally {
      setStep3Loading(false);
    }
  }

  useEffect(() => {
    return () => stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canGoStep4 = !!out && !out?.error;

  return (
    <div className="container">
      <Step1Bar onApplyPrefill={applyPrefill} />

      <div className="header">
        <div>
          <div style={{ fontWeight: 800 }}>Step 2 — Neuro Discussion + Coach</div>
          <div className="small">Localization → DDx by category → shortlist → next tests (pre-investigation)</div>
        </div>

        <div className="row" style={{ maxWidth: 520 }}>
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

      {/* Voice */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="btnbar" style={{ alignItems: "center", gap: 10 }}>
          <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={autoVoiceAfterGenerate}
              onChange={(e) => setAutoVoiceAfterGenerate(e.target.checked)}
            />
            ฟัง/พูดหลัง Generate เท่านั้น
          </label>

          <span className="pill">Voice: {voiceStatus}</span>

          {voiceStatus === "error" && (
            <span style={{ color: "salmon", fontSize: 12 }}>Error: {voiceError}</span>
          )}

          <button onClick={stopVoice} disabled={voiceStatus === "idle"}>
            Stop voice
          </button>

          <button
            onClick={() => {
              if (out && !out?.error) {
                stopVoice();
                startVoiceWithContext(out);
              }
            }}
            disabled={!out || !!out?.error || voiceStatus === "connecting" || voiceStatus === "ready"}
          >
            Start voice (manual)
          </button>
        </div>

        <audio ref={remoteAudioRef} autoPlay />
        <div className="small" style={{ marginTop: 8 }}>
          Tip: ถ้า browser block เสียง ให้กดปุ่มใดๆ อีกครั้งหลังอนุญาตไมค์
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

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <h3>Run</h3>

            <div className="btnbar" style={{ gap: 10, flexWrap: "wrap" }}>
              <button onClick={generate} disabled={loading}>
                {loading ? "Generating..." : "Generate discussion"}
              </button>

              <button
                onClick={() => {
                  setOut(null);
                  setStep3Msg("");
                }}
                disabled={loading}
              >
                Clear output
              </button>

              <button
                onClick={() => {
                  if (!canGoStep4) return;
                  // ensure latest context saved
                  saveStep4Context(out);
                  window.location.href = "/step4";
                }}
                disabled={!canGoStep4 || loading}
              >
                ไป Step 4 (Final Dx)
              </button>

              <span className="pill">Model: {process.env.NEXT_PUBLIC_MODEL_HINT || "server env"}</span>
            </div>

            {out?.error && <pre style={{ marginTop: 10 }}>{out.error}</pre>}

            {/* =========================
                ✅ Step 3 UI: Email + Sheet
               ========================= */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label className="small" style={{ minWidth: 140 }}>
                  Consultant email:
                </label>
                <input
                  type="email"
                  value={consultEmail}
                  onChange={(e) => setConsultEmail(e.target.value)}
                  placeholder="name@hospital.org"
                  style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                />
              </div>

              <div className="btnbar" style={{ gap: 10 }}>
                <button
                  onClick={submitStep3}
                  disabled={step3Loading || !consultEmail.trim() || !isValidEmail(consultEmail.trim()) || !out || !!out?.error}
                >
                  {step3Loading ? "Submitting..." : "Submit Step 3 (Email + Sheet)"}
                </button>

                {step3Msg && <span className="pill">{step3Msg}</span>}
              </div>

              <div className="small">
                *Step 3 ไม่เก็บชื่อ/HN/AN/เลขเคส — ส่งเฉพาะข้อมูลที่ถอดจาก History/Exam + ผล AI/Coach
              </div>
            </div>
          </div>

          <DiscussionPanel data={out && !out.error ? out : null} />
          <CoachPanel coach={out && !out.error ? out.coach : null} />
        </div>
      </div>
    </div>
  );
}