// ── Sky Harvest Tray Store ────────────────────────────────────────────────────
// Shared module — imported by App.jsx, TrayDetailCard, GrowRoom etc.

let _trays = [
  {id:"SH-260505-PEA-0001",crop:"Pea Shoots",planted:"2026-05-05",harvest:"2026-06-02",daysLeft:7,
   lot:"JSS-ORG-2026-042-PEA",soil:"Mix 3",who:"Maria Chen",shelf:"A-1",
   status:"On track",fab:false,notes:[],healthHistory:[],tray_count:4,certUploaded:false},
  {id:"SH-260505-SUN-0002",crop:"Sunflower Shoots",planted:"2026-05-05",harvest:"2026-06-02",daysLeft:7,
   lot:"WCS-ORG-2026-001-SUN",soil:"Mix 3",who:"Maria Chen",shelf:"A-2",
   status:"On track",fab:true,notes:[],healthHistory:[],tray_count:3,certUploaded:false},
  {id:"SH-260512-RAD-0003",crop:"Red Radish",planted:"2026-05-12",harvest:"2026-06-02",daysLeft:7,
   lot:"MSS-ORG-2026-007-RAD",soil:"Mix 1",who:"Jake Okafor",shelf:"B-1",
   status:"On track",fab:true,
   notes:[{by:"Maria Chen",at:"May 21",text:"Looking dense and healthy. Good colour."}],
   healthHistory:[{date:"May 21",score:88,stage:"Cotyledon expansion",by:"Maria Chen"}],
   tray_count:2,certUploaded:false},
  {id:"SH-260514-ARU-0004",crop:"Arugula",planted:"2026-05-14",harvest:"2026-06-04",daysLeft:9,
   lot:"OSC-ORG-2026-018-ARU",soil:"Mix 1",who:"Maria Chen",shelf:"B-3",
   status:"Watch",fab:true,
   notes:[{by:"Jake Okafor",at:"May 22",text:"⚠ Stems looking a bit leggy on the right side. Possible uneven light."}],
   healthHistory:[{date:"May 22",score:72,stage:"First true leaves",by:"Jake Okafor"}],
   tray_count:2,certUploaded:false},
];

const _listeners = new Set();

function _notify() { _listeners.forEach(fn => fn([..._trays])); }

export function getTrayStore()          { return [..._trays]; }
export function subscribeTrayStore(fn)  { _listeners.add(fn); return () => _listeners.delete(fn); }

export function addTray(tray) {
  _trays = [tray, ..._trays];
  _notify();
}

export function addTrayNote(trayId, note) {
  _trays = _trays.map(t => t.id === trayId
    ? { ...t, notes: [...t.notes, note] } : t);
  _notify();
}

export function addTrayHealth(trayId, health) {
  _trays = _trays.map(t => t.id === trayId
    ? { ...t,
        healthHistory: [...t.healthHistory, health],
        status: health.score >= 80 ? "On track"
               : health.score >= 60 ? "Watch" : "Concern" }
    : t);
  _notify();
}

export function getTrayById(id) {
  return _trays.find(t => t.id === id) || null;
}
