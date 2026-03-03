"use client";

export default function DiscussionPanel({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="card">
        <h3>Attending Discussion</h3>
        <div className="small">กด “Generate discussion” เพื่อให้ระบบทำ localization + DDx + coach</div>
      </div>
    );
  }

  const ddxBlocks = Array.isArray(data.ddxByCategory) ? data.ddxByCategory : [];

  return (
    <div className="card">
      <h3>Attending Discussion</h3>

      <div className="pill" style={{ marginBottom: 10 }}>
        <span>Localization</span>
      </div>
      <pre>{data.localization || ""}</pre>

      <div className="hr" />

      <div className="pill" style={{ marginBottom: 10 }}>
        <span>DDx by category</span>
      </div>

      {ddxBlocks.map((block: any, idx: number) => {
        const category = block?.category ?? "";
        const items = Array.isArray(block?.items) ? block.items : [];

        return (
          <div key={idx} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{category}</div>

            {items.length === 0 ? (
              <div className="small">— ไม่มีข้อมูลในหมวดนี้ —</div>
            ) : (
              items.map((it: any, j: number) => {
                const diagnosis = it?.diagnosis ?? "";
                const likelihood = it?.likelihood ?? "";
                const support = Array.isArray(it?.support) ? it.support : [];
                const against = Array.isArray(it?.against) ? it.against : [];

                return (
                  <div key={j} className="card" style={{ padding: 12, marginBottom: 10 }}>
                    <div style={{ fontWeight: 700 }}>
                      {diagnosis}
                      {likelihood ? <span className="small"> — ความน่าจะเป็น: {likelihood}</span> : null}
                    </div>

                    <div className="small" style={{ marginTop: 8 }}>Support</div>
                    <pre>{support.map((s: string) => `• ${s}`).join("\n") || "—"}</pre>

                    <div className="small" style={{ marginTop: 8 }}>Against / Missing</div>
                    <pre>{against.map((s: string) => `• ${s}`).join("\n") || "—"}</pre>
                  </div>
                );
              })
            )}
          </div>
        );
      })}

      <div className="hr" />

      <div className="pill" style={{ marginBottom: 10 }}>
        <span>Shortlist</span>
      </div>
      <pre>
        {(data.shortlist || [])
          .map((s: any) => `• ${s.diagnosis} (${s.likelihood}) — ${s.why}`)
          .join("\n")}
      </pre>

      <div className="pill" style={{ margin: "12px 0 10px 0" }}>
        <span>Next tests</span>
      </div>
      <pre>{(data.nextTests || []).map((s: string) => `• ${s}`).join("\n")}</pre>

      {/* ถ้าคุณอยากโชว์ Coach ด้วย เพิ่มส่วนนี้ได้ */}
      <div className="hr" />
      <div className="pill" style={{ marginBottom: 10 }}>
        <span>Coach</span>
      </div>

      <div className="small">Alerts</div>
      <pre>{(data.coach?.alerts || []).map((s: string) => `• ${s}`).join("\n") || "—"}</pre>

      <div className="small" style={{ marginTop: 8 }}>Missing key items</div>
      <pre>{(data.coach?.missingKeyItems || []).map((s: string) => `• ${s}`).join("\n") || "—"}</pre>

      <div className="small" style={{ marginTop: 8 }}>Suggested questions</div>
      <pre>{(data.coach?.suggestedQuestions || []).map((s: string) => `• ${s}`).join("\n") || "—"}</pre>
    </div>
  );
}