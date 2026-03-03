"use client";

import { useState } from "react";

export default function VoiceBar() {
  const [status, setStatus] = useState<"idle"|"getting_token"|"ready"|"live"|"stopped">("idle");
  const [tokenInfo, setTokenInfo] = useState<any>(null);

  async function getToken() {
    setStatus("getting_token");
    const resp = await fetch("/api/realtime-token", { method: "POST" });
    const data = await resp.json();
    setTokenInfo(data);
    setStatus("ready");
  }

  return (
    <div className="card" style={{marginTop: 14}}>
      <h3>Voice (Step 2)</h3>

      <div className="row">
        <button onClick={getToken} disabled={status === "getting_token"}>
          🎙️ Prepare Talk (get token)
        </button>
        <span className="pill">Status: {status}</span>
      </div>

      <div className="small" style={{marginTop: 10}}>
        ตอนนี้เป็น “starter”: ดึง ephemeral token ได้แล้ว จากนั้นคุณจะต่อ WebRTC ในหน้า step2 เพื่อคุยสดจริง
      </div>

      {tokenInfo?.client_secret?.value && (
        <pre style={{marginTop: 10}}>
{`Got client_secret (ephemeral): ${tokenInfo.client_secret.value.slice(0, 12)}...`}
        </pre>
      )}
    </div>
  );
}