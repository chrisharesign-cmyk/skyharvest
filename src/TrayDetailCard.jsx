import { useState } from "react";
import { addTrayNote } from "./lib/trayStore.js";

const T = {
  sky:"#3e7da1", green:"#86b955", amber:"#d4890a", rust:"#c0432b",
  bg:"#f4f6f8", surface:"#ffffff", border:"#e2e8ed",
  textMain:"#1a2e3b", textSub:"#5a7080", textDim:"#5a8aaa",
};

const StatusColors = {
  "On track": { bg:"#e8f6dc", text:"#2a6010" },
  "Watch":    { bg:"#fef3dc", text:"#7a5000" },
  "Concern":  { bg:"#fde8e8", text:"#7a1a1a" },
  "harvested":{ bg:"#e8eef5", text:"#2a4060" },
  "failed":   { bg:"#fde8e8", text:"#7a1a1a" },
};

const CHAIN_STEPS = (tray) => [
  {
    icon:"🌾", label:"Seed Supplier",
    value: tray.seed_supplier || "West Coast Seeds",
    cert: tray.seed_cert || "Pro-Cert Organic · PRO-2026-WCS-001",
    ok: true,
  },
  {
    icon:"🧪", label:"Seed Lot",
    value: tray.lot || "—",
    cert: tray.lot ? "Certified organic seed · lot verified" : "No lot number recorded",
    ok: !!tray.lot,
  },
  {
    icon:"🪴", label:"Soil Batch",
    value: tray.soil || "—",
    cert: "Pacific Rim Horticulture · COABC/PACS certified",
    ok: !!tray.soil,
  },
  {
    icon:"🌱", label:"Planted",
    value: `${tray.planted} · ${tray.who}`,
    cert: `${tray.tray_count || 1} trays · Shelf ${tray.shelf || "—"}`,
    ok: true,
  },
  {
    icon:"✂️", label:"Harvest",
    value: tray.harvest || "Scheduled",
    cert: tray.daysLeft <= 0 ? "Ready to harvest" : `${tray.daysLeft} days remaining`,
    ok: tray.status !== "failed",
  },
];

// ── Shared tray detail card ───────────────────────────────────────────────────
export default function TrayDetailCard({
  tray,
  showOrganic = false,   // show the organic chain of custody section
  showAddNote = false,   // show the inline add-note form
  showActions = true,    // show health check / plant another buttons
  onHealthCheck,         // callback when Health Check is clicked
  onPlantAnother,        // callback when Plant Another is clicked
  onNoteAdded,           // callback after a note is saved
}) {
  const [note, setNote] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [localTray, setLocalTray] = useState(tray);
  const [activeTab, setActiveTab] = useState("overview"); // overview | organic | notes | health

  const sc = StatusColors[localTray.status] || { bg:"#f0f0f0", text:"#444" };

  const handleSaveNote = () => {
    if (!note.trim()) return;
    const n = {
      by: "Maria Chen",
      at: new Date().toLocaleDateString("en-GB", { day:"numeric", month:"short" }),
      text: note,
    };
    addTrayNote(localTray.id, n);
    const updated = { ...localTray, notes: [...(localTray.notes || []), n] };
    setLocalTray(updated);
    setNote(""); setShowNoteForm(false);
    onNoteAdded?.(updated);
  };

  const tabs = [
    { id:"overview", label:"Overview" },
    { id:"organic",  label:"🔗 Organic Chain" },
    { id:"notes",    label:`Notes ${(localTray.notes||[]).length ? `(${localTray.notes.length})` : ""}` },
    { id:"health",   label:`Health ${(localTray.healthHistory||[]).length ? `(${localTray.healthHistory.length})` : ""}` },
  ];

  return (
    <div style={{ background:T.surface, borderRadius:12,
      border:`2px solid ${localTray.fab ? T.rust : T.sky}`, overflow:"hidden" }}>

      {/* Header */}
      <div style={{ padding:"16px 20px",
        background:`linear-gradient(135deg,#1a2e3b,${localTray.fab ? T.rust : T.sky})`,
        display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          {localTray.fab && (
            <p style={{ fontSize:9, color:"rgba(255,255,255,0.6)", fontStyle:"italic",
              textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 3px" }}>
              Fabricated demo data
            </p>
          )}
          <h3 style={{ fontSize:18, fontWeight:900, color:"#fff", margin:0 }}>
            {localTray.crop}
          </h3>
          <p style={{ fontSize:11, fontFamily:"monospace", color:"rgba(255,255,255,0.7)",
            margin:"3px 0 0" }}>{localTray.id}</p>
        </div>
        <span style={{ fontSize:11, fontWeight:700, padding:"4px 12px",
          borderRadius:10, ...sc, flexShrink:0, marginTop:2 }}>
          {localTray.status}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, background:"#f8fafb" }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex:1, padding:"9px 4px", fontSize:11, fontWeight:700,
              border:"none", borderBottom:`2px solid ${activeTab===tab.id ? T.sky : "transparent"}`,
              background:"transparent", color:activeTab===tab.id ? T.sky : T.textSub,
              cursor:"pointer", transition:"all 0.15s", whiteSpace:"nowrap" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div style={{ padding:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px 0" }}>
            {[
              ["Planted",        localTray.planted],
              ["Est. Harvest",   localTray.harvest],
              ["Days Remaining", `${localTray.daysLeft}d`],
              ["Shelf",          localTray.shelf],
              ["Trays",          localTray.tray_count || "—"],
              ["Planted By",     localTray.who],
              ["Seed Lot",       localTray.lot],
              ["Soil Mix",       localTray.soil],
              ["Cert Uploaded",  localTray.certUploaded ? "✓ Yes" : "Not yet"],
            ].map(([label, val], i) => (
              <div key={label} style={{
                display:"flex", flexDirection:"column",
                padding:"8px 12px",
                background: i % 2 === 0 ? "#fff" : "#fafbfc",
                borderBottom:`1px solid ${T.border}`,
              }}>
                <span style={{ fontSize:10, fontWeight:700, color:T.textSub,
                  textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>
                  {label}
                </span>
                <span style={{ fontSize:13, fontWeight:600,
                  color: localTray.fab && ["Seed Lot","Soil Mix","Planted By"].includes(label)
                    ? T.rust : T.textMain,
                  fontStyle: localTray.fab && ["Seed Lot","Soil Mix","Planted By"].includes(label)
                    ? "italic" : "normal" }}>
                  {val || "—"}
                </span>
              </div>
            ))}
          </div>
          {showActions && (
            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              <button onClick={onHealthCheck}
                style={{ flex:1, padding:"10px", background:T.green, color:"#fff",
                  border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                🤖 Tray Health AI
              </button>
              {onPlantAnother && (
                <button onClick={onPlantAnother}
                  style={{ flex:1, padding:"10px", background:"#fff", color:T.sky,
                    border:`1px solid ${T.sky}`, borderRadius:8, fontSize:12,
                    fontWeight:700, cursor:"pointer" }}>
                  + Plant Another
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Organic chain tab */}
      {activeTab === "organic" && (
        <div style={{ padding:16 }}>
          <p style={{ fontSize:11, color:T.textSub, margin:"0 0 14px", lineHeight:1.5 }}>
            Complete chain of custody from seed purchase to scheduled harvest.
            Every link must be verified for BCCOP certification.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {CHAIN_STEPS(localTray).map((step, i) => (
              <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start",
                padding:"10px 0",
                borderBottom: i < CHAIN_STEPS(localTray).length - 1
                  ? `1px solid ${T.border}` : "none" }}>
                {/* Connector line + icon */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                  width:32, flexShrink:0 }}>
                  <div style={{ width:32, height:32, borderRadius:16,
                    background: step.ok ? "#e8f6dc" : "#fde8e8",
                    border:`2px solid ${step.ok ? T.green : T.rust}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:14 }}>
                    {step.ok
                      ? <span style={{ fontSize:13 }}>{step.icon}</span>
                      : <span style={{ fontSize:13, color:T.rust }}>✗</span>}
                  </div>
                  {i < CHAIN_STEPS(localTray).length - 1 && (
                    <div style={{ width:2, flex:1, minHeight:12,
                      background: step.ok ? "#c8e8a8" : "#fca5a5", margin:"3px 0" }}/>
                  )}
                </div>
                {/* Content */}
                <div style={{ flex:1, paddingTop:4 }}>
                  <div style={{ display:"flex", justifyContent:"space-between",
                    alignItems:"flex-start", gap:8 }}>
                    <p style={{ fontSize:12, fontWeight:700, color:T.textMain, margin:0 }}>
                      {step.label}
                    </p>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px",
                      borderRadius:8,
                      background: step.ok ? "#e8f6dc" : "#fde8e8",
                      color: step.ok ? "#2a6010" : T.rust,
                      flexShrink:0 }}>
                      {step.ok ? "✓ Verified" : "⚠ Missing"}
                    </span>
                  </div>
                  <p style={{ fontSize:12, color:localTray.fab ? T.rust : T.textMain,
                    fontStyle: localTray.fab ? "italic" : "normal",
                    margin:"2px 0 0", fontWeight:500 }}>{step.value}</p>
                  <p style={{ fontSize:10, color:T.textSub, margin:"1px 0 0" }}>{step.cert}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:12, padding:10, background:"#f0f6fb",
            borderRadius:8, border:`1px solid ${T.border}`, fontSize:11, color:T.textSub }}>
            💡 BCCOP requires all five steps to be documented and verifiable during annual inspection.
          </div>
        </div>
      )}

      {/* Notes tab */}
      {activeTab === "notes" && (
        <div style={{ padding:16 }}>
          {showAddNote && (
            <div style={{ marginBottom:12 }}>
              {showNoteForm ? (
                <div>
                  <textarea value={note} onChange={e => setNote(e.target.value)}
                    placeholder="e.g. ⚠ Soft stems on left side — possible overwater. OR: Excellent density."
                    rows={3} style={{ width:"100%", padding:"10px", border:`1px solid ${T.border}`,
                      borderRadius:8, fontSize:13, resize:"none", boxSizing:"border-box",
                      outline:"none", fontFamily:"inherit" }}/>
                  <div style={{ display:"flex", gap:8, marginTop:6 }}>
                    <button onClick={handleSaveNote}
                      style={{ flex:1, padding:"9px", background:T.sky, color:"#fff",
                        border:"none", borderRadius:8, fontSize:13, fontWeight:700,
                        cursor:"pointer" }}>
                      Save Note
                    </button>
                    <button onClick={() => { setShowNoteForm(false); setNote(""); }}
                      style={{ padding:"9px 14px", background:"#fff", color:T.textSub,
                        border:`1px solid ${T.border}`, borderRadius:8, fontSize:13,
                        cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowNoteForm(true)}
                  style={{ width:"100%", padding:"9px", background:"#fff", color:T.sky,
                    border:`1px dashed ${T.sky}`, borderRadius:8, fontSize:13,
                    fontWeight:700, cursor:"pointer", marginBottom:8 }}>
                  + Add Note or Observation
                </button>
              )}
            </div>
          )}
          {!(localTray.notes || []).length ? (
            <div style={{ textAlign:"center", padding:"20px 0", color:T.textSub }}>
              <p style={{ fontSize:24, margin:"0 0 8px" }}>📝</p>
              <p style={{ fontSize:13, margin:0 }}>No notes yet.</p>
              {!showAddNote && <p style={{ fontSize:11, color:T.textSub, margin:"4px 0 0" }}>
                Add observations from the Grow Room view.
              </p>}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {(localTray.notes || []).map((n, i) => (
                <div key={i} style={{
                  padding:"10px 14px", borderRadius:8,
                  background: n.text.includes("⚠") ? "#fff5f5" : "#f8fafb",
                  border:`1px solid ${n.text.includes("⚠") ? "#fca5a5" : T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between",
                    marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:T.textMain }}>
                      {n.by}
                    </span>
                    <span style={{ fontSize:10, color:T.textSub }}>{n.at}</span>
                  </div>
                  <p style={{ fontSize:13, color:T.textMain, margin:0, lineHeight:1.5 }}>
                    {n.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Health history tab */}
      {activeTab === "health" && (
        <div>
          {!(localTray.healthHistory || []).length ? (
            <div style={{ textAlign:"center", padding:"28px 16px", color:T.textSub }}>
              <p style={{ fontSize:24, margin:"0 0 8px" }}>🤖</p>
              <p style={{ fontSize:13, margin:0 }}>No health assessments yet.</p>
              {showActions && (
                <button onClick={onHealthCheck}
                  style={{ marginTop:12, padding:"9px 18px", background:T.green,
                    color:"#fff", border:"none", borderRadius:8, fontSize:12,
                    fontWeight:700, cursor:"pointer" }}>
                  🤖 Run Tray Health AI
                </button>
              )}
            </div>
          ) : (
            (localTray.healthHistory || []).map((h, i) => (
              <div key={i} style={{
                padding:"12px 16px",
                borderBottom: `1px solid ${T.border}`,
                display:"flex", alignItems:"center", gap:14 }}>
                {/* Score circle */}
                <div style={{ width:48, height:48, borderRadius:24, flexShrink:0,
                  background: h.score >= 80 ? "#e8f6dc"
                            : h.score >= 60 ? "#fef3dc" : "#fde8e8",
                  border:`2px solid ${h.score >= 80 ? T.green
                                   : h.score >= 60 ? T.amber : T.rust}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  flexDirection:"column" }}>
                  <span style={{ fontSize:15, fontWeight:900,
                    color: h.score >= 80 ? T.green
                          : h.score >= 60 ? T.amber : T.rust,
                    lineHeight:1 }}>{h.score}</span>
                  <span style={{ fontSize:8, color:T.textSub, lineHeight:1 }}>/100</span>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:T.textMain, margin:0 }}>
                    {h.stage}
                  </p>
                  <p style={{ fontSize:11, color:T.textSub, margin:"2px 0 0" }}>
                    {h.date} · {h.by}
                  </p>
                  {h.observations && (
                    <p style={{ fontSize:11, color:T.textSub, margin:"4px 0 0",
                      fontStyle:"italic" }}>{h.observations}</p>
                  )}
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px",
                  borderRadius:8,
                  background: h.score >= 80 ? "#e8f6dc"
                            : h.score >= 60 ? "#fef3dc" : "#fde8e8",
                  color: h.score >= 80 ? "#2a6010"
                        : h.score >= 60 ? "#7a5000" : T.rust }}>
                  {h.score >= 80 ? "Good" : h.score >= 60 ? "Watch" : "Concern"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
