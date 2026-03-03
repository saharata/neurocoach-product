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

  return (
    <div className="card">
      <h3>Attending Discussion</h3>

      <div className="pill" style={{marginBottom: 10}}>
        <span>Localization</span>
      </div>
      <pre>{data.localization || ""}</pre>

      <div className="hr" />

      <div className="pill" style={{marginBottom: 10}}>
        <span>DDx by category</span>
      </div>

     

      <div className="hr" />

      <div className="pill" style={{marginBottom: 10}}>
        <span>Shortlist</span>
      </div>
      <pre>{(data.shortlist || []).map((s:any)=>`• ${s.diagnosis} (${s.confidence}) — ${s.why}`).join("\n")}</pre>

      <div className="pill" style={{margin: "12px 0 10px 0"}}>
        <span>Next tests</span>
      </div>
      <pre>{(data.nextTests || []).map((s:string)=>`• ${s}`).join("\n")}</pre>
    </div>
  );
}