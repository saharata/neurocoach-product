"use client";

import { useEffect, useMemo, useState } from "react";

type Step4Investigations = {
  blood?: string;
  mri?: string;
  eeg?: string;
  ncs?: string;
  genetic?: string;
  autonomic?: string;
};

function CertaintyThai(v: string) {
  if (v === "VERY_HIGH") return "สูงมาก";
  if (v === "HIGH") return "สูง";
  if (v === "MODERATE") return "ปานกลาง";
  return "ต่ำ";
}

function ListBlock({ title, items }: { title: string; items?: any[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <ul style={{ marginTop: 0 }}>
        {items.map((x, i) => (
          <li key={i}>{String(x)}</li>
        ))}
      </ul>
    </div>
  );
}

function Step4Report({ out }: { out: any }) {
  if (!out) return null;

  return (
    <div>
      <div className="pill" style={{ marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span>
          ✅ <b>Final Dx:</b> {out.finalDiagnosis}
        </span>
        <span>
          <b>ความแน่นอน:</b> {CertaintyThai(out.diagnosisCertainty)} ({out.diagnosisCertainty})
        </span>
        <span>
          <b>Confidence:</b> {out.confidencePct}%
        </span>
      </div>

      <div className="hr" />

      <div style={{ fontWeight: 900, marginBottom: 6 }}>คำยืนยันแบบอาจารย์ (Commitment)</div>
      <div className="small" style={{ whiteSpace: "pre-wrap" }}>{out.attendingCommitment}</div>

      <div className="hr" />

      <div style={{ fontWeight: 900, marginBottom: 6 }}>ภาพรวมกลุ่มอาการ (Clinical syndrome)</div>
      <div className="small" style={{ whiteSpace: "pre-wrap" }}>{out.clinicalSyndrome}</div>

      <ListBlock title="จุดเปลี่ยนสำคัญจากผลตรวจ (Pivotal findings)" items={out.pivotalFindings || []} />

      <div className="hr" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <ListBlock title="หลักฐานสนับสนุน" items={out.supportingEvidence || []} />
        </div>
        <div>
          <ListBlock title="หลักฐานขัดแย้ง/ไม่เข้า" items={out.contradictingEvidence || []} />
        </div>
      </div>

      <div className="hr" />

      <div style={{ fontWeight: 900, marginBottom: 6 }}>DDx ที่ยังต้องเก็บไว้</div>
      {Array.isArray(out.remainingDDx) && out.remainingDDx.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {out.remainingDDx.map((d: any, i: number) => (
            <div key={i} className="card" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontWeight: 800 }}>{d.name}</div>
              <div className="small" style={{ marginTop: 6 }}>
                <b>ทำไมยังเป็นไปได้:</b> {d.whyStillPossible}
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                <b>อะไรที่จะหักล้าง:</b> {d.whatWouldDisprove}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="small">— ไม่มี DDx ที่เหลือแบบมีนัยสำคัญ —</div>
      )}

      <div className="hr" />

      <div style={{ fontWeight: 900, marginBottom: 6 }}>เงื่อนไขที่ต้อง “กลับมาคิดใหม่” (Falsification)</div>
      <div className="small" style={{ whiteSpace: "pre-wrap" }}>{out.falsificationTarget}</div>

      <div style={{ fontWeight: 900, marginTop: 12, marginBottom: 6 }}>ถ้าผิด… โรคถัดไปที่ต้องรีบจับ</div>
      <div className="small" style={{ whiteSpace: "pre-wrap" }}>
        <b>{out.nextBestIfWrong?.dx}</b> — {out.nextBestIfWrong?.oneBestTestOrAction}
      </div>

      <div className="hr" />

      <div style={{ fontWeight: 900, marginBottom: 6 }}>แผนดูแลรักษา (Plan)</div>
      <ListBlock title="Immediate (ตอนนี้เลย)" items={out.plan?.immediate || []} />
      <ListBlock title="Next tests (ตรวจเพิ่มเติมที่ควรทำ)" items={out.plan?.nextTests || []} />
      <ListBlock title="Treatment (การรักษา)" items={out.plan?.treatment || []} />
      <ListBlock title="Disposition (ส่งต่อ/รับไว้/วอร์ด/ICU)" items={out.plan?.disposition || []} />
      <ListBlock title="Follow up (ติดตาม)" items={out.plan?.followUp || []} />

      <div className="hr" />

      <ListBlock title="Safety / Red flags" items={out.safetyRedFlags || []} />
    </div>
  );
}

export default function Step4Page() {
  const [ctx, setCtx] = useState<any>(null);

  const [inv, setInv] = useState<Step4Investigations>({
    blood: "",
    mri: "",
    eeg: "",
    ncs: "",
    genetic: "",
    autonomic: "",
  });

  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("step4_context");
    if (raw) {
      try {
        setCtx(JSON.parse(raw));
      } catch {
        setCtx(null);
      }
    }
  }, []);

  const canGenerate = useMemo(() => {
    const hasOne = Object.values(inv).some((v) => (v || "").trim().length > 0);
    return hasOne && !!ctx?.clinical;
  }, [inv, ctx]);

  const setField = (k: keyof Step4Investigations, v: string) => setInv((p) => ({ ...p, [k]: v }));

  async function generate() {
    setErr("");
    setOut(null);
    setShowRaw(false);
    setLoading(true);

    try {
      if (!ctx?.clinical) {
        throw new Error("ไม่พบ context จาก Step 2 (กรุณากลับไป Step 2 → Generate → กด ไป Step 4)");
      }

      const payload = {
        clinical: ctx.clinical,
        ai: ctx.ai || {},
        investigations: inv,
        ts: new Date().toISOString(),
      };

      const r = await fetch("/api/step4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Step 4 failed");

      setOut(data);
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function copyReport() {
    if (!out) return;
    const text =
      `Final Dx: ${out.finalDiagnosis}\n` +
      `Certainty: ${out.diagnosisCertainty} (${CertaintyThai(out.diagnosisCertainty)})\n` +
      `Confidence: ${out.confidencePct}%\n\n` +
      `Commitment:\n${out.attendingCommitment}\n\n` +
      `Pivotal findings:\n- ${(out.pivotalFindings || []).join("\n- ")}\n\n` +
      `Plan:\n` +
      `- Immediate: ${(out.plan?.immediate || []).join("; ")}\n` +
      `- Next tests: ${(out.plan?.nextTests || []).join("; ")}\n` +
      `- Treatment: ${(out.plan?.treatment || []).join("; ")}\n` +
      `- Disposition: ${(out.plan?.disposition || []).join("; ")}\n` +
      `- Follow up: ${(out.plan?.followUp || []).join("; ")}\n\n` +
      `Safety:\n- ${(out.safetyRedFlags || []).join("\n- ")}\n`;
    await navigator.clipboard.writeText(text);
    alert("คัดลอกรายงานแล้ว");
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div style={{ fontWeight: 800 }}>Step 4 — Post-Investigation Final Diagnosis</div>
          <div className="small">ใส่ผลตรวจ → Generate final diagnosis (clinical-first, decisive)</div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button onClick={() => (window.location.href = "/step2")}>← กลับ Step 2</button>
          <button
            onClick={() => {
              sessionStorage.removeItem("step4_context");
              setCtx(null);
              setOut(null);
              setErr("");
            }}
          >
            Clear context
          </button>
        </div>
      </div>

      {!ctx?.clinical && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>ยังไม่พบ Step 2 context</div>
          <div className="small">
            ไป Step 2 → กด Generate discussion → กด “ไป Step 4 (Final Dx)” แล้วกลับมาหน้านี้
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* LEFT: Investigations */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Investigations (กรอกเท่าที่มี)</h3>

          <label className="small">Blood (CBC/Chem/Inflammatory)</label>
          <textarea className="input" rows={5} value={inv.blood || ""} onChange={(e) => setField("blood", e.target.value)} />

          <label className="small">MRI result (TEXT only)</label>
          <textarea className="input" rows={7} value={inv.mri || ""} onChange={(e) => setField("mri", e.target.value)} />

          <label className="small">EEG</label>
          <textarea className="input" rows={6} value={inv.eeg || ""} onChange={(e) => setField("eeg", e.target.value)} />

          <label className="small">NCS/EMG</label>
          <textarea className="input" rows={6} value={inv.ncs || ""} onChange={(e) => setField("ncs", e.target.value)} />

          <label className="small">Genetic testing</label>
          <textarea className="input" rows={5} value={inv.genetic || ""} onChange={(e) => setField("genetic", e.target.value)} />

          <label className="small">Autonomic testing</label>
          <textarea className="input" rows={5} value={inv.autonomic || ""} onChange={(e) => setField("autonomic", e.target.value)} />

          <div className="btnbar" style={{ marginTop: 10, gap: 10 }}>
            <button onClick={generate} disabled={!canGenerate || loading}>
              {loading ? "Generating..." : "Generate Final Diagnosis"}
            </button>

            <button
              onClick={() => {
                setInv({ blood: "", mri: "", eeg: "", ncs: "", genetic: "", autonomic: "" });
                setOut(null);
                setErr("");
                setShowRaw(false);
              }}
              disabled={loading}
            >
              Clear tests
            </button>

            {!canGenerate && (
              <span className="small">
                ต้องมี context จาก Step2 และกรอกผลตรวจอย่างน้อย 1 ช่อง
              </span>
            )}

            {err && <span className="small" style={{ color: "tomato" }}>{err}</span>}
          </div>
        </div>

        {/* RIGHT: Report */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0 }}>รายงานสรุป (อ่านง่าย)</h3>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowRaw((v) => !v)} disabled={!out}>
                {showRaw ? "ซ่อน Raw JSON" : "ดู Raw JSON"}
              </button>
              <button onClick={copyReport} disabled={!out}>
                Copy report
              </button>
            </div>
          </div>

          {!out && <div className="small" style={{ marginTop: 8 }}>กด Generate แล้วจะได้ Final Diagnosis แบบ “ยืนยันชัด”</div>}

          {out && (
            <>
              <div style={{ marginTop: 10 }}>
                <Step4Report out={out} />
              </div>

              {showRaw && (
                <>
                  <div className="hr" />
                  <div className="small" style={{ fontWeight: 800, marginBottom: 6 }}>Raw JSON</div>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(out, null, 2)}</pre>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}