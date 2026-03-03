"use client";

import { useMemo, useRef, useState } from "react";

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
  const [loadingStep1, setLoadingStep1] = useState(false);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const hasText = useMemo(() => transcript.trim().length > 0, [transcript]);

  async function startRecording() {
    setErr(null);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await transcribeBlob(blob);
    };

    mediaRecorderRef.current = mr;
    mr.start();
    setRecording(true);
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setRecording(false);
  }

  async function transcribeBlob(blob: Blob) {
    setTranscribing(true);
    setErr(null);

    try {
      const fd = new FormData();
      fd.append("file", blob, "audio.webm");

      const resp = await fetch("/api/stt", { method: "POST", body: fd });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || data?.error || "STT failed");

      const text = (data?.text || "").trim();
      if (text) setTranscript((prev) => (prev ? prev + "\n" : "") + text);
    } catch (e: any) {
      setErr(e?.message || "Unknown STT error");
    } finally {
      setTranscribing(false);
    }
  }

  async function runStep1() {
    setErr(null);
    setLoadingStep1(true);
    try {
      const resp = await fetch("/api/step1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || data?.error || "Step1 failed");

      onApplyPrefill(data.prefill);
      setOpen(false);
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setLoadingStep1(false);
    }
  }

  function clear() {
    setTranscript("");
    setErr(null);
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
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
              Step 1 — Voice interview (Record → STT → Transcript)
            </div>
            <div className="small" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {recording ? "Recording..." : transcribing ? "Transcribing..." : "Record audio to build transcript"}
            </div>
          </div>

          <span className="pill" style={{ marginLeft: 6 }}>
            {recording ? "REC" : transcribing ? "STT" : hasText ? "Ready" : "Empty"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => setOpen(true)} disabled={open}>Expand</button>
          <button onClick={runStep1} disabled={loadingStep1 || !hasText}>
            {loadingStep1 ? "Applying..." : "Generate & Apply"}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div className="btnbar">
            {!recording ? (
              <button onClick={startRecording} disabled={transcribing}>
                🎙 Start recording
              </button>
            ) : (
              <button onClick={stopRecording}>
                ⏹ Stop
              </button>
            )}

            <button onClick={runStep1} disabled={loadingStep1 || !hasText || recording || transcribing}>
              {loadingStep1 ? "Generating..." : "Generate Step 1 → Apply to Step 2"}
            </button>

            <button onClick={clear} disabled={recording || transcribing || !hasText}>Clear</button>
            <button onClick={() => setOpen(false)} disabled={recording || transcribing}>Collapse</button>
          </div>

          <label className="small" style={{ marginTop: 10 }}>Transcript</label>
          <textarea
            rows={8}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Transcript will appear here..."
          />

          {err && <pre style={{ marginTop: 10 }}>{err}</pre>}
        </div>
      )}
    </div>
  );
}