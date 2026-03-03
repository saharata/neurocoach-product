"use client";

import { useMemo, useState } from "react";

type Prefill = {
  problem_representation: string;
  history: any;
  exam: any;
};

type Props = {
  onApplyPrefill: (p: Prefill) => void;
};

export default function Step1Bar({ onApplyPrefill }: Props) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastAppliedAt, setLastAppliedAt] = useState<string>("");

  const hasText = useMemo(() => transcript.trim().length > 0, [transcript]);

  async function runStep1() {
    setErr(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/step1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || data?.error || "Step1 failed");

      // API return: { prefill }
      onApplyPrefill(data.prefill);

      const now = new Date();
      setLastAppliedAt(now.toLocaleString());
      setOpen(false); // ✅ auto-collapse after apply (ปรับได้)
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setTranscript("");
    setErr(null);
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      {/* Collapsed header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{ width: 40, height: 34 }}
            aria-label={open ? "Collapse" : "Expand"}
            title={open ? "Collapse" : "Expand"}
          >
            {open ? "▾" : "▸"}
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Step 1 — Capture (Transcript → Structured Hx/Exam)
            </div>
            <div className="small" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {lastAppliedAt ? `Last applied: ${lastAppliedAt}` : "Paste transcript → Generate → Apply to Step 2"}
            </div>
          </div>

          {/* mini status pill */}
          <span className="pill" style={{ marginLeft: 6 }}>
            {loading ? "Working..." : hasText ? "Ready" : "Empty"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => setOpen(true)} disabled={open}>
            Expand
          </button>
          <button onClick={runStep1} disabled={loading || !hasText}>
            {loading ? "Generating..." : "Generate & Apply"}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div style={{ marginTop: 12 }}>
          <label className="small">Transcript</label>
          <textarea
            rows={6}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste transcript here..."
          />

          <div className="btnbar" style={{ marginTop: 10 }}>
            <button onClick={runStep1} disabled={loading || !hasText}>
              {loading ? "Generating..." : "Generate Step 1 → Apply to Step 2"}
            </button>
            <button onClick={clear} disabled={loading || !hasText}>
              Clear
            </button>
            <button onClick={() => setOpen(false)} disabled={loading}>
              Collapse
            </button>
          </div>

          {err && <pre style={{ marginTop: 10 }}>{err}</pre>}
        </div>
      )}
    </div>
  );
}