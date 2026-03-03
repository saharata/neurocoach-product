"use client";

export default function CoachPanel({ coach }: { coach: any }) {
  return (
    <div className="card">
      <h3>Coach</h3>

      <div className="pill" style={{marginBottom: 10}}>
        <span>Alerts</span>
      </div>
      <pre>{(coach?.alerts || []).length ? (coach.alerts || []).map((s:string)=>`• ${s}`).join("\n") : "—"}</pre>

      <div className="pill" style={{margin: "12px 0 10px 0"}}>
        <span>Missing key items</span>
      </div>
      <pre>{(coach?.missingKeyItems || []).length ? (coach.missingKeyItems || []).map((s:string)=>`• ${s}`).join("\n") : "—"}</pre>

      <div className="pill" style={{margin: "12px 0 10px 0"}}>
        <span>Suggested questions</span>
      </div>
      <pre>{(coach?.suggestedQuestions || []).length ? (coach.suggestedQuestions || []).map((s:string)=>`• ${s}`).join("\n") : "—"}</pre>

      <div className="small" style={{marginTop: 10}}>
        *โค้ชไม่ได้ฟันธงโรค แต่ช่วยชี้ “อะไรขาด/อะไรไม่เข้ากัน” เพื่อให้ reasoning แน่นขึ้น
      </div>
    </div>
  );
}