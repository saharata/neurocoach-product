"use client";

type Props = {
  problemRepresentation: string;
  setProblemRepresentation: (v: string) => void;

  history: any;
  setHistory: (v: any) => void;

  exam: any;
  setExam: (v: any) => void;

  locked: { history: boolean; exam: boolean };
  setLocked: (v: { history: boolean; exam: boolean }) => void;
};

export default function EvidencePanel(p: Props) {
  const { problemRepresentation, setProblemRepresentation, history, setHistory, exam, setExam, locked, setLocked } = p;

  const setHx = (k: string, v: string) => setHistory({ ...history, [k]: v });
  const setNeuro = (k: string, v: string) => setExam({ ...exam, neuro: { ...exam.neuro, [k]: v } });

  return (
    <div className="card">
      <h3>Evidence (Hx / Exam)</h3>

      <div className="pill" style={{marginBottom: 10}}>
        <span>Lock:</span>
        <span>Hx {locked.history ? "✅" : "⬜"}</span>
        <span>Exam {locked.exam ? "✅" : "⬜"}</span>
      </div>

      <label className="small">Problem representation (draft)</label>
      <textarea
        value={problemRepresentation}
        onChange={(e) => setProblemRepresentation(e.target.value)}
        placeholder="อายุ/เพศ + อาการหลัก + tempo + deficit หลัก + อาการร่วมสำคัญ + risk"
      />

      <div className="btnbar">
        <button onClick={() => setLocked({ ...locked, history: !locked.history })}>
          {locked.history ? "Unlock Hx" : "Lock Hx"}
        </button>
        <button onClick={() => setLocked({ ...locked, exam: !locked.exam })}>
          {locked.exam ? "Unlock Exam" : "Lock Exam"}
        </button>
      </div>

      <div className="hr" />

      <div className="row">
        <div>
          <label className="small">CC</label>
          <input value={history.cc} onChange={(e) => setHx("cc", e.target.value)} disabled={locked.history} />
        </div>
        <div>
          <label className="small">Red flags (semicolon)</label>
          <input value={(history.redFlags || []).join("; ")}
                 onChange={(e) => setHx("redFlags", e.target.value.split(";").map(s=>s.trim()).filter(Boolean))}
                 disabled={locked.history} />
        </div>
      </div>

      <label className="small">HPI</label>
      <textarea value={history.hpi} onChange={(e) => setHx("hpi", e.target.value)} disabled={locked.history} />

      <label className="small">ROS</label>
      <textarea value={history.ros} onChange={(e) => setHx("ros", e.target.value)} disabled={locked.history} />

      <div className="row">
        <div>
          <label className="small">PMH</label>
          <textarea value={history.pmh} onChange={(e) => setHx("pmh", e.target.value)} disabled={locked.history} />
        </div>
        <div>
          <label className="small">Meds</label>
          <textarea value={history.meds} onChange={(e) => setHx("meds", e.target.value)} disabled={locked.history} />
        </div>
      </div>

      <div className="row">
        <div>
          <label className="small">Allergy</label>
          <input value={history.allergy} onChange={(e) => setHx("allergy", e.target.value)} disabled={locked.history} />
        </div>
        <div>
          <label className="small">Social/Exposure</label>
          <input value={history.social} onChange={(e) => setHx("social", e.target.value)} disabled={locked.history} />
        </div>
      </div>

      <label className="small">Family history</label>
      <input value={history.family} onChange={(e) => setHx("family", e.target.value)} disabled={locked.history} />

      <div className="hr" />

      <label className="small">Vitals</label>
      <input value={exam.vitals} onChange={(e) => setExam({ ...exam, vitals: e.target.value })} disabled={locked.exam} />

      <label className="small">General</label>
      <input value={exam.general} onChange={(e) => setExam({ ...exam, general: e.target.value })} disabled={locked.exam} />

      <div className="row">
        <div>
          <label className="small">Mental status</label>
          <textarea value={exam.neuro.mentalStatus} onChange={(e) => setNeuro("mentalStatus", e.target.value)} disabled={locked.exam} />
        </div>
        <div>
          <label className="small">Cranial nerves</label>
          <textarea value={exam.neuro.cranialNerves} onChange={(e) => setNeuro("cranialNerves", e.target.value)} disabled={locked.exam} />
        </div>
      </div>

      <div className="row">
        <div>
          <label className="small">Motor</label>
          <textarea value={exam.neuro.motor} onChange={(e) => setNeuro("motor", e.target.value)} disabled={locked.exam} />
        </div>
        <div>
          <label className="small">Reflexes</label>
          <textarea value={exam.neuro.reflexes} onChange={(e) => setNeuro("reflexes", e.target.value)} disabled={locked.exam} />
        </div>
      </div>

      <div className="row">
        <div>
          <label className="small">Sensory</label>
          <textarea value={exam.neuro.sensory} onChange={(e) => setNeuro("sensory", e.target.value)} disabled={locked.exam} />
        </div>
        <div>
          <label className="small">Coordination</label>
          <textarea value={exam.neuro.coordination} onChange={(e) => setNeuro("coordination", e.target.value)} disabled={locked.exam} />
        </div>
      </div>

      <label className="small">Gait</label>
      <textarea value={exam.neuro.gait} onChange={(e) => setNeuro("gait", e.target.value)} disabled={locked.exam} />

      <label className="small">Key negatives (semicolon)</label>
      <input
        value={(exam.neuro.keyNegatives || []).join("; ")}
        onChange={(e) => setNeuro("keyNegatives", e.target.value.split(";").map(s=>s.trim()).filter(Boolean))}
        disabled={locked.exam}
      />
    </div>
  );
}