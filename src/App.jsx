import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from "react";
import { getTrayStore, subscribeTrayStore, addTray, addTrayNote, addTrayHealth } from "./lib/trayStore.js";
import TrayDetailCard from "./TrayDetailCard.jsx";
import Reporting from "./Reporting.jsx";

// ── Shared mobile detection ───────────────────────────────────────────────────
// Module-level so any view can import useMobile() without prop drilling
const _mobileListeners = new Set();
let _isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    const was = _isMobile;
    _isMobile = window.innerWidth < 768;
    if (was !== _isMobile) _mobileListeners.forEach(fn => fn(_isMobile));
  });
}
function useMobile() {
  const [m, setM] = useState(_isMobile);
  useEffect(() => { _mobileListeners.add(setM); return () => _mobileListeners.delete(setM); }, []);
  return m;
}
import * as XLSX from 'xlsx';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import HarvestManager from "./HarvestManager.jsx";
import OrderInbox from "./OrderInbox.jsx";
import ProvenanceTrail from "./ProvenanceTrail.jsx";
import { subscribe as workflowSubscribe, getState as getWorkflowState, getPickList, getDeliveryRuns, getConfirmedCustomers } from "./lib/workflowStore";

// ── Shared reporting context (sheets uploaded in Reporting tab) ───────────────
import { ReportingSheetsContext, useReportingSheets } from "./reportingContext.js";


// ── Brand tokens ──────────────────────────────────────────────────────────────
export const T = {
  sidebar:    "#0f2535",
  sidebarHov: "#162e42",
  active:     "#3e7da1",
  activeBg:   "#1a3d54",
  label:      "#4a7a96",
  text:       "#c8dce8",
  textDim:    "#5a8aaa",
  green:      "#86b955",
  greenDark:  "#5a8a2e",
  amber:      "#d4890a",
  rust:       "#c0432b",
  sky:        "#3e7da1",
  bg:         "#f4f6f8",
  surface:    "#ffffff",
  border:     "#e2e8ed",
  textMain:   "#1a2e3b",
  textSub:    "#5a7080",
};

// Tray store imported from shared module
// (see src/lib/trayStore.js)
// ── Nav structure ──────────────────────────────────────────────────────────────
const NAV = [
  { section: "OVERVIEW", items: [
    { id:"dashboard",  label:"Dashboard",        icon:"🌿", color:"#86b955" },
    { id:"calendar",   label:"Weekly Calendar",  icon:"📅", color:"#3e7da1" },
  ]},
  { section: "GROWING", items: [
    { id:"plantings",  label:"Planting Records", icon:"🌱", color:"#5a8a2e" },
    { id:"growroom",   label:"Grow Room",        icon:"🔬", color:"#2a7a6a" },
    { id:"trayhealth", label:"Tray Health AI",   icon:"🤖", color:"#3e7da1" },
  ]},
  { section: "ORDERS", items: [
    { id:"orderinbox", label:"Orders Inbox",     icon:"📬", color:"#6b3a8a" },
    { id:"harvestruns",label:"Harvest Runs",     icon:"📋", color:"#d4890a" },
    { id:"picklist",   label:"Pick List",        icon:"✅", color:"#86b955" },
    { id:"deliveries", label:"Delivery Runs",    icon:"🚐", color:"#5a6e7a" },
  ]},
  { section: "CUSTOMERS", items: [
    { id:"customers",  label:"All Customers",    icon:"👥", color:"#6b3a8a" },
    { id:"atrisk",     label:"At Risk",          icon:"⚠️", color:"#c0432b" },
  ]},
  { section: "RECORDS", items: [
    { id:"harvests",     label:"Reporting",         icon:"📊", color:"#3e7da1" },
    { id:"provenance",   label:"Provenance Trail",  icon:"🔗", color:"#5a8a2e" },
    { id:"cert",         label:"Certification",     icon:"🏷️", color:"#5a8a2e" },
  ]},
  { section: "SYSTEM", items: [
    { id:"roadmap",    label:"What's Possible",  icon:"🚀", color:"#6b3a8a" },
    { id:"legacy",     label:"Legacy Site",      icon:"🔗", color:"#5a7080" },
  ]},
];

// ── Shared components ────────────────────────────────────────────────────────
export const Pill = ({label}) => {
  const styles = {
    "Active":    {bg:"#e8f6dc",text:"#2a6010"},
    "Watch":     {bg:"#fef3dc",text:"#7a5000"},
    "At Risk":   {bg:"#fde8e8",text:"#7a1a1a"},
    "Confirmed": {bg:"#e8f6dc",text:"#2a6010"},
    "Pending":   {bg:"#e8f0fb",text:"#1a3a7a"},
    "Delivered": {bg:"#f0f0f0",text:"#4a4a4a"},
    "Scheduled": {bg:"#e8f0fb",text:"#1a3a7a"},
    "Completed": {bg:"#e8f6dc",text:"#2a6010"},
    "On track":  {bg:"#e8f6dc",text:"#2a6010"},
    "System":    {bg:"#e8f6dc",text:"#2a6010"},
    "Manual":    {bg:"#fef3dc",text:"#7a5000"},
    "External":  {bg:"#e8f0fb",text:"#1a3a7a"},
  };
  const s = styles[label] || {bg:"#f0f0f0",text:"#444"};
  return <span style={{background:s.bg,color:s.text,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:12,letterSpacing:"0.02em",whiteSpace:"nowrap"}}>{label}</span>;
};

export const Trend = ({v}) => v > 0
  ? <span style={{color:T.green,fontWeight:700,fontSize:12}}>▲ {v}%</span>
  : <span style={{color:T.rust,fontWeight:700,fontSize:12}}>▼ {Math.abs(v)}%</span>;

export function PageHeader({title, sub, action}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:800,color:T.textMain,margin:0,letterSpacing:"-0.02em"}}>{title}</h1>
        {sub && <p style={{fontSize:13,color:T.textSub,margin:"4px 0 0"}}>{sub}</p>}
      </div>
      {action && <button style={{background:T.sky,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>{action}</button>}
    </div>
    </ReportingSheetsContext.Provider>
  );
}

export function DataTable({cols, rows}) {
  return (
    <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${T.border}`}}>
            {cols.map(c=>(
              <th key={c.key} style={{textAlign:"left",padding:"10px 16px",fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?"#fff":"#fafbfc",transition:"background 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#f0f7ff"}
              onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#fafbfc"}>
              {cols.map(c=>(
                <td key={c.key} style={{padding:"11px 16px",color:T.textMain,verticalAlign:"middle"}}>
                  {c.render?c.render(row[c.key],row):row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </ReportingSheetsContext.Provider>
  );
}

export function KPI({label, value, sub, good}) {
  return (
    <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:"16px 20px"}}>
      <p style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>{label}</p>
      <p style={{fontSize:26,fontWeight:900,color:T.textMain,margin:"6px 0 4px",letterSpacing:"-0.03em"}}>{value}</p>
      {sub&&<p style={{fontSize:12,fontWeight:600,color:good===false?T.rust:T.green,margin:0}}>{sub}</p>}
    </div>
    </ReportingSheetsContext.Provider>
  );
}

// ── Fabrication badge ─────────────────────────────────────────────────────────
export const Fab = ({children}) => (
  <span style={{color:"#b91c1c",fontStyle:"italic",fontSize:"0.9em"}}>{children}</span>
);

// ── Mock data (dashboard uses this) ───────────────────────────────────────────
const weeklyRev = [
  {w:"Mar 3",wed:1840,fri:1320},{w:"Mar 10",wed:2010,fri:1480},{w:"Mar 17",wed:1760,fri:1390},
  {w:"Mar 24",wed:2230,fri:1640},{w:"Mar 31",wed:2080,fri:1510},{w:"Apr 7",wed:2440,fri:1820},
  {w:"Apr 14",wed:2190,fri:1700},{w:"Apr 21",wed:2560,fri:1950},{w:"Apr 28",wed:2310,fri:1880},
  {w:"May 5",wed:2680,fri:2040},{w:"May 12",wed:2490,fri:1960},{w:"May 19",wed:2820,fri:2180},
];

// Real customers from spreadsheet — top ones by pack volume
const topCustomers = [
  {name:"Stongs North Van",     monthly:4820,trend:+8},
  {name:"Choices Yaletown",     monthly:3940,trend:+3},
  {name:"Greens Market",        monthly:3200,trend:+5},
  {name:"Choices Kitsilano",    monthly:2610,trend:+12},
  {name:"Terminal City Club",   monthly:2180,trend:-4},
  {name:"Choices North Van",    monthly:1940,trend:+5},
  {name:"Okini",                monthly:1720,trend:+18},
  {name:"Plaza Premium",        monthly:1490,trend:-2},
  {name:"Emerald Earth Foods",  monthly:1340,trend:-14},
  {name:"Lift",                 monthly:1060,trend:-8},
];

const atRisk = [
  {name:"Baan Lao",        change:-38,weeks:4,last:"$180",status:"Suspended"},
  {name:"Artigiano",       change:-22,weeks:3,last:"$290",status:"Declining"},
  {name:"Compass",         change:-19,weeks:4,last:"$120",status:"Declining"},
  {name:"Max Munchies",    change:-45,weeks:6,last:"$0",  status:"Lapsed"},
  {name:"Ancora West Van", change:-11,weeks:2,last:"$440",status:"Watch"},
];

const risingStars = [
  {name:"Okini",              change:+18,weeks:6,newLines:3,value:"$1,720"},
  {name:"Avela Catering",     change:+31,weeks:4,newLines:2,value:"$640"},
  {name:"Arbutus Club",       change:+24,weeks:5,newLines:4,value:"$580"},
  {name:"Terminal City Club", change:+12,weeks:8,newLines:2,value:"$2,610"},
  {name:"Ama Raw Bar",        change:+9, weeks:5,newLines:1,value:"$940"},
];

const biggestSellers = [
  {crop:"Pea Shoots",      weeklyKg:9.2, weeklyVal:2840,share:100},
  {crop:"Sunflower Shoots",weeklyKg:6.4, weeklyVal:1920,share:68},
  {crop:"Radish Blend",    weeklyKg:5.8, weeklyVal:1440,share:51},
  {crop:"Cilantro",        weeklyKg:5.1, weeklyVal:980, share:35},
  {crop:"Mellow Mix",      weeklyKg:4.2, weeklyVal:860, share:30},
  {crop:"Spicy Mix",       weeklyKg:3.1, weeklyVal:720, share:25},
  {crop:"Basil",           weeklyKg:3.8, weeklyVal:640, share:23},
];

const growingCycles = [
  {crop:"Basil",            planted:19,total:21,daysLeft:2, kg:3.8},
  {crop:"Arugula",          planted:18,total:21,daysLeft:3, kg:2.4},
  {crop:"Pea Shoots",       planted:24,total:28,daysLeft:4, kg:9.2},
  {crop:"Red Radish",       planted:17,total:21,daysLeft:4, kg:4.6},
  {crop:"Cilantro",         planted:23,total:28,daysLeft:5, kg:5.1},
  {crop:"Sunflower Shoots", planted:21,total:28,daysLeft:7, kg:6.4},
  {crop:"Kale",             planted:20,total:28,daysLeft:8, kg:2.1},
  {crop:"Mustard",          planted:14,total:21,daysLeft:7, kg:3.2},
];

const harvestVsOrders = [
  {crop:"Pea Shoots",   harvest:9.2,orders:8.6,cover:true},
  {crop:"Sunflower",    harvest:6.4,orders:7.1,cover:false},
  {crop:"Radish Blend", harvest:5.8,orders:4.9,cover:true},
  {crop:"Cilantro",     harvest:5.1,orders:4.4,cover:true},
  {crop:"Mellow Mix",   harvest:4.2,orders:4.8,cover:false},
  {crop:"Basil",        harvest:3.8,orders:3.1,cover:true},
  {crop:"Red Radish",   harvest:4.6,orders:3.8,cover:true},
  {crop:"Arugula",      harvest:2.4,orders:2.9,cover:false},
];

// Real plantings — fabricated but coloured red
const plantings = [
  {id:"SH-260505-PEA-0001",crop:"Pea Shoots",      planted:"May 5",  harvest:"Jun 2", lot:"JSS-ORG-2026-042-PEA",soil:"Mix 3",who:"Maria Chen",  shelf:"A-1",status:"On track",fab:false},
  {id:"SH-260505-SUN-0002",crop:"Sunflower Shoots",planted:"May 5",  harvest:"Jun 2", lot:"WCS-ORG-2026-001-SUN",soil:"Mix 3",who:"Maria Chen",  shelf:"A-2",status:"On track",fab:true},
  {id:"SH-260512-RAD-0003",crop:"Red Radish",      planted:"May 12", harvest:"Jun 2", lot:"MSS-ORG-2026-007-RAD",soil:"Mix 1",who:"Jake Okafor", shelf:"B-1",status:"On track",fab:true},
  {id:"SH-260514-ARU-0004",crop:"Arugula",         planted:"May 14", harvest:"Jun 4", lot:"OSC-ORG-2026-018-ARU",soil:"Mix 1",who:"Maria Chen",  shelf:"B-3",status:"Watch",   fab:true},
  {id:"SH-260517-BAS-0005",crop:"Basil",           planted:"May 17", harvest:"Jun 7", lot:"WCS-ORG-2026-001-BAS",soil:"Mix 2",who:"Jake Okafor", shelf:"C-1",status:"On track",fab:true},
  {id:"SH-260510-CIL-0006",crop:"Cilantro",        planted:"May 10", harvest:"Jun 7", lot:"JSS-ORG-2026-042-CIL",soil:"Mix 3",who:"Maria Chen",  shelf:"C-2",status:"On track",fab:true},
];

const deliveries = [
  {run:"Wed 28 May",route:"North Shore",    driver:"Sam Wright", transport:"🚗",stops:4,value:520,depart:"7:00 AM", status:"Scheduled",fab:true},
  {run:"Wed 28 May",route:"Downtown",       driver:"Leo Park",   transport:"🚲",stops:4,value:426,depart:"9:00 AM", status:"Scheduled",fab:true},
  {run:"Wed 28 May",route:"Richmond",       driver:"Sam Wright", transport:"🚗",stops:3,value:364,depart:"11:30 AM",status:"Scheduled",fab:true},
  {run:"Fri 23 May",route:"North Shore",    driver:"Sam Wright", transport:"🚗",stops:4,value:498,depart:"7:00 AM", status:"Completed",fab:true},
  {run:"Fri 23 May",route:"Downtown",       driver:"Leo Park",   transport:"🚲",stops:4,value:401,depart:"9:00 AM", status:"Completed",fab:true},
];

const certRecords = [
  {req:"Seed lot records",    status:"System",  desc:"Stored against every planting. Supplier cert uploaded."},
  {req:"Growing media",       status:"System",  desc:"Soil mix batch linked to every tray."},
  {req:"Production records",  status:"System",  desc:"All planting data timestamped and immutable."},
  {req:"Harvest records",     status:"System",  desc:"Pick list confirmation records who harvested and when."},
  {req:"Sales records",       status:"System",  desc:"Order and delivery records linked to QuickBooks."},
  {req:"Traceability audit",  status:"System",  desc:"Seed lot → planting → harvest → delivery → customer."},
  {req:"Mass balance",        status:"System",  desc:"Auto-generated for any date range or crop."},
  {req:"Organic seed search", status:"Manual",  desc:"Document required if conventional seed used."},
  {req:"Inspection-ready pack",status:"System", desc:"One-click PDF of all 12-month records."},
  {req:"Label approval",      status:"Manual",  desc:"Submit designs to certifier before printing."},
  {req:"Annual inspection",   status:"External",desc:"On-site visit by PACS verification officer."},
];

// ── Roadmap data ──────────────────────────────────────────────────────────────
const ROADMAP = [
  {phase:"Built today",color:"#3e7da1",bg:"#f0f6fb",border:"#b8d0e0",badge:"Live",items:[
    {title:"Harvest Runs",icon:"📋",tag:"Orders",desc:"Live order grid replacing spreadsheet tabs. Click any cell to update quantities, saves to Supabase instantly. Pick list auto-generated. 3,160 real order lines imported from March–May 2026 harvest sheets."},
    {title:"Crop Weight Report",icon:"📊",tag:"Reporting",desc:"Upload Wednesday and Friday xlsx files. Calculates kg per crop. Two views: by product and by base crop with mix decomposition. Export to Excel or print as PDF."},
    {title:"Business Dashboard",icon:"🎛️",tag:"Management",desc:"Weekly revenue, customer leaderboard, at-risk alerts, rising stars, growing cycles, biggest sellers, harvest vs order cover status."},
    {title:"Next Run Route Planner",icon:"🗺️",tag:"Operations",desc:"Delivery stops grouped by route with departure times, addresses, and items per customer."},
    {title:"Pick List",icon:"✅",tag:"Operations",desc:"Tap-to-confirm harvest pick list with Excel export and print. Flags anything running short."},
    {title:"Tray Health AI",icon:"🤖",tag:"Growing",desc:"Upload a tray photo. Claude Vision assesses health score, stage, days to harvest, issues, recommendations."},
  ]},
  {phase:"Build next",color:"#5a8a2e",bg:"#f2f9ec",border:"#b8d898",badge:"Ready",items:[
    {title:"Digital Order Entry",icon:"📝",tag:"Orders",desc:"Replace spreadsheet columns with a proper order form. Standing orders auto-populate each week. One-off orders added in seconds."},
    {title:"Invoice Generator",icon:"🧾",tag:"Finance",desc:"One click produces a PDF delivery note and invoice per customer. Triggers QuickBooks entry automatically."},
    {title:"Growing Planner",icon:"🌱",tag:"Growing",desc:"Log a planting. System tracks days to harvest, highlights what is ready, shows whether yield covers orders."},
    {title:"Customer Email Alerts",icon:"⚠️",tag:"Sales",desc:"Auto-emails at-risk customers flag when orders decline 15%+ over three weeks."},
    {title:"Weekly Summary Email",icon:"📬",tag:"Management",desc:"Every Friday: automated email to Chris with revenue, kg harvested, top customers, at-risk flags."},
  ]},
  {phase:"Phase 2",color:"#d4890a",bg:"#fffbef",border:"#f5d48a",badge:"Phase 2",items:[
    {title:"Customer CRM",icon:"👥",tag:"Sales",desc:"Full customer database: contacts, delivery day, price list, order history, trends. Replaces the spreadsheet customer columns."},
    {title:"P&L by Crop",icon:"💰",tag:"Finance",desc:"Gross margin per kg and per pack for every product line. Shows which crops are most profitable."},
    {title:"Seed & Supply Inventory",icon:"📦",tag:"Growing",desc:"Track seed stock, growing media, packaging. Auto-flags reorder points. Connects to organic audit trail."},
    {title:"Order Forecasting",icon:"🔮",tag:"Analytics",desc:"Uses 12+ months of history to predict next week's orders. Feeds the growing planner automatically."},
  ]},
  {phase:"Full platform",color:"#6b21a8",bg:"#faf5ff",border:"#d8b4fe",badge:"Phase 3",items:[
    {title:"Customer Portal",icon:"🌐",tag:"Sales",desc:"Restaurants submit their own orders directly. No phone calls, no re-entry, no spreadsheet columns."},
    {title:"Route Optimisation",icon:"🗺️",tag:"Operations",desc:"Google Maps integration for optimal stop order. Factors in traffic, windows, van capacity."},
    {title:"Driver Mobile App",icon:"📱",tag:"Operations",desc:"Phone-optimised delivery app. Staff see their run, tap to confirm each stop, photo on delivery."},
    {title:"QuickBooks Integration",icon:"🔗",tag:"Finance",desc:"Invoice auto-created on delivery confirmation. Sales sync to correct accounts. No re-entry."},
  ]},
];

const TAG_COLORS = {
  "Orders":    {bg:"#e0f0f8",text:"#2a5f80"},
  "Reporting": {bg:"#e8eef5",text:"#1a3060"},
  "Management":{bg:"#e8f4ff",text:"#1e4d7a"},
  "Operations":{bg:"#e8f4ec",text:"#2a6b3a"},
  "Finance":   {bg:"#fef9ec",text:"#7a5200"},
  "Growing":   {bg:"#f0fce8",text:"#3a6b20"},
  "Sales":     {bg:"#fce8f8",text:"#6b1a60"},
  "Analytics": {bg:"#ece8fc",text:"#3a1a7a"},
};

// ── Harvest Report (legacy xlsx tool) ─────────────────────────────────────────
const SKIP_PATTERNS = [/WEIGHT NEEDED/i,/NON-RADISH WEIGHT/i,/RADISH WEIGHT FOR BOOST/i,/^Approx\s/i,/^Total Sunflower/i,/^Total Pea/i,/^TOTAL\s/i,/^Gourmet Garnish/i,/^#REF/i,/^Check\s/i];
const MIX_SPLITS = {"Mellow Mix":{Broccoli:0.45,"Purple Cabbage":0.45,Beets:0.10},"Spicy Mix":{Mustard:0.80,"Purple Cabbage":0.20},"Radish Blend":{Radish:1.00},"Salad Boost":{Radish:0.70,Arugula:0.09,Broccoli:0.21},"Haute Blend":null,"Brilliant Blend":null,"Violet Mosaic":null,"Peppercress (70%) & Beet (30%) blend":{"Peppercress":0.70,"Beets":0.30}};
function getMixFamily(n){for(const p of Object.keys(MIX_SPLITS))if(n.startsWith(p))return p;return null;}
function getProductFamily(name){if(!name)return null;let n=name.trim();n=n.replace(/\s*(SPUD Label|SPUD 100g bag|1 lb bag|RETAIL)\s*/gi," ").replace(/\s*\((XS|S|M|L|XL)\)\s*$/,"").replace(/\s*\((XS|S|M|L|XL)\)\s*$/,"").trim();if(/^Baby Basil/i.test(n)||/^Mini Micro Basil/i.test(n)||/^Thai Basil/i.test(n))return"Basil";if(/^Basil, Purple/i.test(n))return"Purple Basil";if(/^Basil/i.test(n))return"Basil";if(/^Baby Sky Hearts/i.test(n))return"Sky Hearts";if(/^Cilantro, Short Stem/i.test(n))return"Cilantro";if(/^Sunflower Shoots/i.test(n))return"Sunflower Shoots";if(/^Shiso, Green/i.test(n))return"Shiso (Green)";if(/^Shiso, Purple/i.test(n))return"Shiso (Purple)";if(/^Shiso, Britton/i.test(n))return"Shiso (Britton)";return n;}
function getBaseCrop(name){const f=getProductFamily(name);if(!f)return null;if(/^(Red Radish|White Radish|Ruby Stem Radish)/.test(f))return"Radish";return f;}
function parseSheetDate(name){let s=name.trim().replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i,"").replace(/\bSPL\b\s*/i,"").trim();const M={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};const m=s.match(/^([A-Za-z]+)\s+(\d+)\s+(\d+)/);if(!m)return null;const mo=M[m[1]],d=parseInt(m[2]),y=2000+parseInt(m[3]);if(!mo||!d||!y)return null;return new Date(y,mo-1,d);}
function shouldSkip(name,weightG){if(!name||typeof name!=="string")return true;if(SKIP_PATTERNS.some(p=>p.test(name.trim())))return true;if(typeof weightG!=="number"||weightG<=0)return true;return false;}
function parseXlsx(buffer){const wb=XLSX.read(buffer,{type:"array",cellFormula:false});const sheets=[];for(const sn of wb.SheetNames){const date=parseSheetDate(sn);if(!date)continue;const ws=wb.Sheets[sn];const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});let ds=5;for(let i=0;i<Math.min(10,raw.length);i++)if(raw[i]&&String(raw[i][2]||"").includes("AI Calc")){ds=i+1;break;}const rows=[];for(let i=ds;i<raw.length;i++){const r=raw[i];if(!r)continue;const nm=r[1],wg=r[2],u=r[3];if(shouldSkip(nm,wg))continue;if(typeof u!=="number"||u<=0)continue;rows.push({name:String(nm).trim(),weightG:Number(wg),units:Number(u)});}if(rows.length>0)sheets.push({date,sheetName:sn,cropRows:rows});}return sheets;}
function monthKey(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function weekMonday(d){const day=new Date(d),dow=day.getDay();day.setDate(day.getDate()+(dow===0?-6:1-dow));return day.toISOString().slice(0,10);}
function computeA(sheets,pkFn){const data={},periods=new Set();for(const{date,cropRows}of sheets){const pk=pkFn(date);periods.add(pk);for(const{name,weightG,units}of cropRows){const f=getProductFamily(name);if(!f)continue;const kg=(weightG*units)/1000;if(!data[f])data[f]={};data[f][pk]=(data[f][pk]||0)+kg;}}return{data,periods:[...periods].sort()};}
function computeB(sheets,pkFn){const data={},periods=new Set(),unresolved=new Set();for(const{date,cropRows}of sheets){const pk=pkFn(date);periods.add(pk);for(const{name,weightG,units}of cropRows){const kg=(weightG*units)/1000,mix=getMixFamily(name);if(mix){const sp=MIX_SPLITS[mix];if(sp)for(const[c,p]of Object.entries(sp)){if(!data[c])data[c]={};data[c][pk]=(data[c][pk]||0)+kg*p;}else{const lb=mix+" (undivided)";unresolved.add(mix);if(!data[lb])data[lb]={};data[lb][pk]=(data[lb][pk]||0)+kg;}}else{const c=getBaseCrop(name);if(!c)continue;if(!data[c])data[c]={};data[c][pk]=(data[c][pk]||0)+kg;}}}return{data,periods:[...periods].sort(),unresolved:[...unresolved]};}

// ── Views ─────────────────────────────────────────────────────────────────────

function DashboardView(){
  const thisW=weeklyRev[weeklyRev.length-1],lastW=weeklyRev[weeklyRev.length-2];
  const thisT=thisW.wed+thisW.fri,lastT=lastW.wed+lastW.fri;
  const pct=(((thisT-lastT)/lastT)*100).toFixed(1);
  const maxM=topCustomers[0].monthly;
  return(
    <div>
      <PageHeader title="Dashboard" sub="Week of 26 May 2026 · Values in CAD"/>
      <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 14px",marginBottom:16,fontSize:12,color:"#92400e"}}>
        ⚠ Revenue, customer trends and harvest data shown here are <strong>illustrative</strong> — derived from spreadsheet structure. Real figures populate once orders are entered in Harvest Runs.
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
        <KPI label="Weekly Revenue" value={`$${thisT.toLocaleString()}`} sub={`${pct>0?"+":""}${pct}% vs last week`} good={pct>0}/>
        <KPI label="Active Customers" value="149" sub="From harvest sheets" good={true}/>
        <KPI label="At Risk" value={`${atRisk.length}`} sub="On order decline" good={false}/>
        <KPI label="Harvest This Week" value="52.4 kg" sub="Wed + Fri combined" good={true}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12,marginBottom:12}}>
        <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:20}}>
          <p style={{fontSize:12,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 16px"}}>Weekly Revenue — Wed &amp; Fri Runs</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyRev} margin={{top:4,right:4,left:-20,bottom:0}}>
              <defs>
                <linearGradient id="gW" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.sky} stopOpacity={0.3}/><stop offset="95%" stopColor={T.sky} stopOpacity={0}/></linearGradient>
                <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={0.3}/><stop offset="95%" stopColor={T.green} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
              <XAxis dataKey="w" tick={{fontSize:10,fill:T.textSub}}/>
              <YAxis tick={{fontSize:10,fill:T.textSub}} tickFormatter={v=>`$${v}`}/>
              <Tooltip formatter={(v,n)=>[`$${v.toLocaleString()}`,n==="wed"?"Wednesday":"Friday"]}/>
              <Area type="monotone" dataKey="wed" stroke={T.sky} fill="url(#gW)" strokeWidth={2} name="wed"/>
              <Area type="monotone" dataKey="fri" stroke={T.green} fill="url(#gF)" strokeWidth={2} name="fri"/>
              <Legend formatter={v=>v==="wed"?"Wednesday Run":"Friday Run"}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:20}}>
          <p style={{fontSize:12,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 12px"}}>Top Customers</p>
          {topCustomers.slice(0,8).map((c,i)=>(
            <div key={c.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,fontWeight:800,color:T.textSub,width:16}}>{i+1}</span>
                <span style={{fontSize:11,fontWeight:600,color:T.textMain}}>{c.name}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Trend v={c.trend}/>
                <span style={{fontSize:12,fontWeight:800,color:T.textMain}}>${c.monthly.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:20}}>
          <p style={{fontSize:12,fontWeight:700,color:"#b91c1c",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 12px"}}>⚠ At Risk — Order Decline</p>
          {atRisk.map((r,i)=>(
            <div key={r.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<atRisk.length-1?`1px solid ${T.border}`:"none"}}>
              <span style={{fontSize:12,fontWeight:600,color:T.textMain}}>{r.name}</span>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <Trend v={r.change}/>
                <Pill label={r.status}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:20}}>
          <p style={{fontSize:12,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 12px"}}>★ Rising Stars</p>
          {risingStars.map((r,i)=>(
            <div key={r.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<risingStars.length-1?`1px solid ${T.border}`:"none"}}>
              <span style={{fontSize:12,fontWeight:600,color:T.textMain}}>{r.name}</span>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <Trend v={r.change}/>
                <span style={{fontSize:12,fontWeight:700,color:T.textMain}}>{r.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:20}}>
        <p style={{fontSize:12,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 12px"}}>Growing Cycles — Days to Harvest</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px 24px"}}>
          {growingCycles.map(g=>{
            const pct=((g.total-g.daysLeft)/g.total)*100;
            const col=g.daysLeft<=3?T.green:g.daysLeft<=6?T.amber:"#94a3b8";
            return(
              <div key={g.crop}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:600,color:T.textMain}}>{g.crop}</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:11,color:T.textSub}}>{g.kg}kg</span>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:g.daysLeft<=3?"#e8f6dc":g.daysLeft<=6?"#fef3dc":"#f0f0f0",color:col}}>{g.daysLeft<=1?"Ready":`${g.daysLeft}d`}</span>
                  </div>
                </div>
                <div style={{background:"#e8eef2",borderRadius:4,height:5}}>
                  <div style={{background:col,width:`${pct}%`,height:5,borderRadius:4}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </ReportingSheetsContext.Provider>
  );
}

function PlantingsView(){
  const [trays, setTrays] = useState(getTrayStore());
  const [step, setStep] = useState(0); // 0=list, 1=seed, 2=plant, 3=done
  const [form, setForm] = useState({crop:"Pea Shoots",lot:"",supplier:"West Coast Seeds",soil:"Mix 3",qty:4,shelf:"",who:"Maria Chen",cert:null});
  const [selectedTray, setSelectedTray] = useState(null);

  useEffect(()=>{ return subscribeTrayStore(t=>setTrays([...t])); },[]);

  const CROPS_P = ["Pea Shoots","Sunflower Shoots","Red Radish","Arugula","Kale","Cilantro","Mustard","Broccoli","Beets","Purple Cabbage","Basil","Shiso","Sky Hearts","Peppercress","Mellow Mix","Spicy Mix"];
  const CYCLE = {"Pea Shoots":28,"Sunflower Shoots":28,"Red Radish":21,"Arugula":21,"Kale":28,"Cilantro":28,"Mustard":21,"Broccoli":21,"Beets":28,"Purple Cabbage":28,"Basil":21,"Shiso":28,"Sky Hearts":14,"Peppercress":21};

  const handlePlant = () => {
    const today = new Date();
    const harvest = new Date(today);
    harvest.setDate(harvest.getDate() + (CYCLE[form.crop]||21));
    const id = `SH-${today.toISOString().slice(2,10).replace(/-/g,"")}-${form.crop.slice(0,3).toUpperCase()}-${String(Math.floor(Math.random()*9000)+1000)}`;
    addTray({
      id, crop:form.crop, planted:today.toISOString().slice(0,10),
      harvest:harvest.toISOString().slice(0,10),
      daysLeft:CYCLE[form.crop]||21,
      lot:form.lot, soil:form.soil, who:form.who, shelf:form.shelf,
      status:"On track", fab:false, notes:[], healthHistory:[],
      certUploaded:!!form.cert,
    });
    setStep(3);
  };

  if (step === 1) return (
    <div style={{maxWidth:520}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button onClick={()=>setStep(0)} style={{background:"none",border:"none",cursor:"pointer",color:T.sky,fontSize:13,fontWeight:700}}>← Back</button>
        <h1 style={{fontSize:20,fontWeight:800,color:T.textMain,margin:0}}>Step 1 — Seed Lot &amp; Organic Certificate</h1>
      </div>
      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:20,marginBottom:16}}>
        <p style={{fontSize:11,fontWeight:700,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 14px"}}>Which crop are you planting?</p>
        <select value={form.crop} onChange={e=>setForm(p=>({...p,crop:e.target.value}))}
          style={{width:"100%",padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:14,fontWeight:600,marginBottom:14,background:"#f8fafb"}}>
          {CROPS_P.map(c=><option key={c}>{c}</option>)}
        </select>
        <p style={{fontSize:11,fontWeight:700,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 10px"}}>Seed supplier</p>
        <select value={form.supplier} onChange={e=>setForm(p=>({...p,supplier:e.target.value}))}
          style={{width:"100%",padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,marginBottom:14,background:"#f8fafb"}}>
          {["West Coast Seeds","Johnny's Selected Seeds","OSC Seeds","Mumm's Sprouting Seeds","Veseys Seeds"].map(s=><option key={s}>{s}</option>)}
        </select>
        <p style={{fontSize:11,fontWeight:700,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 6px"}}>Seed lot number</p>
        <input value={form.lot} onChange={e=>setForm(p=>({...p,lot:e.target.value}))} placeholder="e.g. WCS-ORG-2026-001"
          style={{width:"100%",padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,marginBottom:16,boxSizing:"border-box"}}/>
      </div>
      <div style={{background:T.surface,borderRadius:12,border:`2px dashed ${form.cert?"#86b955":T.border}`,padding:20,marginBottom:16}}>
        <p style={{fontSize:11,fontWeight:700,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 10px"}}>Upload organic seed certificate (BCCOP requirement)</p>
        {form.cert ? (
          <div style={{display:"flex",gap:10,alignItems:"center",padding:10,background:"#f0f9ec",borderRadius:8,border:"1px solid #c8e8a8"}}>
            <span style={{fontSize:20}}>📄</span>
            <div style={{flex:1}}>
              <p style={{fontSize:12,fontWeight:700,color:"#2a6010",margin:0}}>{form.cert}</p>
              <p style={{fontSize:11,color:T.textSub,margin:"2px 0 0"}}>Certificate uploaded ✓</p>
            </div>
            <button onClick={()=>setForm(p=>({...p,cert:null}))} style={{background:"none",border:"none",cursor:"pointer",color:T.textSub,fontSize:14}}>✕</button>
          </div>
        ) : (
          <label style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer",padding:20}}>
            <span style={{fontSize:36}}>📋</span>
            <span style={{fontSize:13,fontWeight:700,color:T.sky}}>Tap to upload certificate PDF</span>
            <span style={{fontSize:11,color:T.textSub}}>Pro-Cert, MOFGA, COABC or equivalent</span>
            <input type="file" accept=".pdf,.jpg,.png" style={{display:"none"}}
              onChange={e=>setForm(p=>({...p,cert:e.target.files[0]?.name||"certificate.pdf"}))}/>
          </label>
        )}
      </div>
      <div style={{padding:10,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,fontSize:12,color:"#92400e",marginBottom:16}}>
        <strong>BCCOP v2 requirement:</strong> Organic seed certificate must be on file before planting. If organic seed is unavailable, a documented search must be uploaded instead.
      </div>
      <button onClick={()=>setStep(2)} disabled={!form.lot}
        style={{width:"100%",padding:14,background:form.lot?T.sky:"#c8d8e8",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:form.lot?"pointer":"not-allowed"}}>
        Next — Planting Details →
      </button>
    </div>
  );

  if (step === 2) return (
    <div style={{maxWidth:520}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button onClick={()=>setStep(1)} style={{background:"none",border:"none",cursor:"pointer",color:T.sky,fontSize:13,fontWeight:700}}>← Back</button>
        <h1 style={{fontSize:20,fontWeight:800,color:T.textMain,margin:0}}>Step 2 — Planting Details</h1>
      </div>
      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:20,marginBottom:16}}>
        {[
          {label:"Soil mix",field:"soil",type:"select",opts:["Mix 1 — Coco Coir/Perlite 70/30","Mix 2 — Coco Coir/Vermiculite 80/20","Mix 3 — Premium Microgreen Mix"]},
          {label:"Tray count",field:"qty",type:"number"},
          {label:"Shelf location",field:"shelf",type:"text",placeholder:"e.g. A-1"},
          {label:"Planted by",field:"who",type:"select",opts:["Maria Chen","Jake Okafor","Sam Wright","Chris Arthur"]},
        ].map(f=>(
          <div key={f.field} style={{marginBottom:14}}>
            <p style={{fontSize:11,fontWeight:700,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 6px"}}>{f.label}</p>
            {f.type==="select"?(
              <select value={form[f.field]} onChange={e=>setForm(p=>({...p,[f.field]:e.target.value}))}
                style={{width:"100%",padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,background:"#f8fafb"}}>
                {f.opts.map(o=><option key={o}>{o}</option>)}
              </select>
            ):(
              <input type={f.type} value={form[f.field]} onChange={e=>setForm(p=>({...p,[f.field]:e.target.value}))}
                placeholder={f.placeholder||""}
                style={{width:"100%",padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
            )}
          </div>
        ))}
        <div style={{padding:12,background:"#f0f6fb",borderRadius:8,border:`1px solid ${T.border}`,marginTop:8}}>
          <p style={{fontSize:11,fontWeight:700,color:T.sky,margin:"0 0 4px"}}>Barcode will be generated automatically</p>
          <p style={{fontSize:12,color:T.textSub,margin:0,fontFamily:"monospace"}}>SH-{new Date().toISOString().slice(2,10).replace(/-/g,"")}-{form.crop.slice(0,3).toUpperCase()}-XXXX</p>
        </div>
      </div>
      <button onClick={handlePlant} disabled={!form.shelf}
        style={{width:"100%",padding:14,background:form.shelf?T.green:"#c8d8e8",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:form.shelf?"pointer":"not-allowed"}}>
        🌱 Plant Tray &amp; Generate Barcode
      </button>
    </div>
  );

  if (step === 3) {
    const newest = trays[0];
    return (
      <div style={{maxWidth:520}}>
        <div style={{background:T.surface,borderRadius:12,border:`2px solid ${T.green}`,padding:24,textAlign:"center",marginBottom:16}}>
          <p style={{fontSize:48,margin:"0 0 12px"}}>✅</p>
          <h2 style={{fontSize:18,fontWeight:900,color:T.textMain,margin:"0 0 6px"}}>Tray planted successfully</h2>
          <p style={{fontSize:13,color:T.textSub,margin:"0 0 16px"}}>Barcode generated and added to grow room</p>
          <div style={{background:"#f0f9ec",borderRadius:8,padding:12,marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:T.textSub,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Barcode ID</p>
            <p style={{fontSize:18,fontWeight:900,color:T.textMain,fontFamily:"monospace",margin:0}}>{newest?.id}</p>
          </div>
          {form.cert && <p style={{fontSize:12,color:"#2a6010",fontWeight:600,margin:"0 0 16px"}}>✓ Organic certificate uploaded — BCCOP audit trail started</p>}
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>{setStep(0);setForm({crop:"Pea Shoots",lot:"",supplier:"West Coast Seeds",soil:"Mix 3",qty:4,shelf:"",who:"Maria Chen",cert:null});}}
              style={{flex:1,padding:12,background:T.sky,color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>
              Plant another tray
            </button>
            <button onClick={()=>setStep(0)}
              style={{flex:1,padding:12,background:"#fff",color:T.textMain,border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>
              View all trays
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedTray) return (
    <div>
      <button onClick={()=>setSelectedTray(null)}
        style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",
          cursor:"pointer",color:T.sky,fontSize:13,fontWeight:700,marginBottom:16,padding:0}}>
        ← Back to Planting Records
      </button>
      <div style={{maxWidth:600}}>
        <TrayDetailCard
          tray={selectedTray}
          showOrganic={true}
          showAddNote={false}
          showActions={true}
          onHealthCheck={()=>{}}
          onPlantAnother={()=>setStep(1)}
        />
      </div>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:T.textMain,margin:0}}>Planting Records</h1>
          <p style={{fontSize:13,color:T.textSub,margin:"4px 0 0"}}>Tray barcodes · seed lots · organic chain of custody · click any row for full detail</p>
        </div>
        <button onClick={()=>setStep(1)} style={{background:T.green,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Plant Tray</button>
      </div>
      {trays.some(t=>t.fab) && (
        <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:8,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#9a3412"}}>
          ⚠ Some records are <strong style={{color:"#b91c1c"}}>fabricated demo data</strong> (shown in red italic). Real records appear when trays are planted using the + Plant Tray flow.
        </div>
      )}
      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${T.border}`}}>
              {["Barcode ID","Crop","Planted","Days Left","Seed Lot","Planted By","Shelf","Notes","Status"].map(h=>(
                <th key={h} style={{textAlign:"left",padding:"10px 16px",fontSize:10,fontWeight:700,color:T.textSub,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trays.map((tray,i)=>(
              <tr key={tray.id}
                onClick={()=>setSelectedTray(tray)}
                style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?"#fff":"#fafbfc",cursor:"pointer",transition:"background 0.12s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#f0f7ff"}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#fafbfc"}>
                <td style={{padding:"11px 16px"}}><span style={{fontFamily:"monospace",fontSize:11,color:tray.fab?T.rust:T.sky,fontStyle:tray.fab?"italic":"normal"}}>{tray.id}</span></td>
                <td style={{padding:"11px 16px",fontWeight:600,color:tray.fab?T.rust:T.textMain,fontStyle:tray.fab?"italic":"normal"}}>{tray.crop}</td>
                <td style={{padding:"11px 16px",color:T.textSub}}>{tray.planted}</td>
                <td style={{padding:"11px 16px"}}><span style={{fontWeight:700,color:tray.daysLeft<=3?T.green:T.textMain}}>{tray.daysLeft}d</span></td>
                <td style={{padding:"11px 16px",color:tray.fab?T.rust:T.textSub,fontStyle:tray.fab?"italic":"normal",fontSize:11}}>{tray.lot}</td>
                <td style={{padding:"11px 16px",color:tray.fab?T.rust:T.textSub,fontStyle:tray.fab?"italic":"normal"}}>{tray.who}</td>
                <td style={{padding:"11px 16px",color:T.textSub,fontFamily:"monospace",fontSize:11}}>{tray.shelf}</td>
                <td style={{padding:"11px 16px",color:T.textSub,fontSize:11}}>
                  {tray.notes?.length>0
                    ? <span style={{color:tray.notes.some(n=>n.text?.includes("⚠"))?T.rust:T.sky,fontWeight:700}}>{tray.notes.length} note{tray.notes.length>1?"s":""}</span>
                    : "—"}
                </td>
                <td style={{padding:"11px 16px"}}><Pill label={tray.status}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </ReportingSheetsContext.Provider>
  );
}

function DeliveriesView(){
  const [wfState, setWfState] = useState(getWorkflowState());
  useEffect(()=>{ return workflowSubscribe(s=>setWfState({...s})); },[]);
  const runs = getDeliveryRuns();
  const haslive = runs.length > 0;

  return(
    <div>
      <PageHeader title="Delivery Runs — Wednesday 28 May" sub={haslive?`${runs.length} routes · auto-generated from confirmed orders`:"Confirm orders in Orders Inbox to generate delivery runs"}/>
      {!haslive && (
        <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#92400e"}}>
          No orders confirmed yet. Go to <strong>Orders Inbox</strong> and confirm incoming orders — routes will appear here automatically.
        </div>
      )}
      {haslive && runs.map(run=>(
        <div key={run.route} style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,marginBottom:16,overflow:"hidden"}}>
          <div style={{padding:"12px 20px",background:T.textMain,display:"flex",alignItems:"center",gap:16}}>
            <span style={{fontSize:18}}>{run.transport.mode.split(" ")[0]}</span>
            <div style={{flex:1}}>
              <p style={{fontSize:14,fontWeight:800,color:"#fff",margin:0}}>{run.route}</p>
              <p style={{fontSize:11,color:"#86b9d0",margin:"2px 0 0"}}>
                {run.transport.driver} · Depart {run.transport.depart} · {run.stopList.length} stops · {run.totalPacks} packs
              </p>
            </div>
            <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:8,background:"#e8f0fb",color:"#1a3a7a"}}>Scheduled</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:"#f8fafb"}}>
              {["Stop","Customer","Items","Packs","Est. Value","Confirmed"].map(h=>(
                <th key={h} style={{textAlign:"left",padding:"8px 16px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{run.stopList.map((stop,i)=>(
              <tr key={stop.customer} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?"#fff":"#fafbfc"}}>
                <td style={{padding:"10px 16px",color:T.textSub,fontWeight:700}}>{i+1}</td>
                <td style={{padding:"10px 16px",fontWeight:700,color:T.textMain}}>{stop.customer}</td>
                <td style={{padding:"10px 16px",color:T.textSub,fontSize:11,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{stop.items}</td>
                <td style={{padding:"10px 16px",fontWeight:800,color:T.textMain}}>{stop.totalPacks}</td>
                <td style={{padding:"10px 16px",color:T.textSub}}>${stop.valueCAD}</td>
                <td style={{padding:"10px 16px"}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:8,background:"#fef3dc",color:"#7a5000"}}>Pending</span>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ))}
      {haslive && (
        <div style={{padding:10,background:"#f0f6fb",borderRadius:8,border:`1px solid ${T.border}`,fontSize:12,color:T.textSub}}>
          💡 Driver confirmation — staff tap to confirm each stop on their phone. This closes the organic certification chain of custody for each delivery.
        </div>
      )}
    </div>
    </ReportingSheetsContext.Provider>
  );
}

function CertView(){
  return(
    <div>
      <PageHeader title="Organic Certification" sub="BCCOP v2 · PACS certified · Microgreens — no transition period"/>
      <DataTable
        cols={[
          {key:"req",label:"BCCOP Requirement",render:v=><span style={{fontWeight:700}}>{v}</span>},
          {key:"desc",label:"How the system satisfies it",render:v=><span style={{color:T.textSub,fontSize:12}}>{v}</span>},
          {key:"status",label:"Handled by",render:v=><Pill label={v}/>},
        ]}
        rows={certRecords}
      />
    </div>
    </ReportingSheetsContext.Provider>
  );
}

function HarvestReportView(){
  const [allSheets,setAllSheets]=useState([]);
  const [view,setView]=useState("A");
  const [groupBy,setGroupBy]=useState("month");
  const [loading,setLoading]=useState(false);
  const [loadedFiles,setLoadedFiles]=useState([]);
  const pkFn=groupBy==="month"?monthKey:weekMonday;
  const periodLabel=groupBy==="month"?(pk)=>{const[y,m]=pk.split("-");return new Date(y,m-1).toLocaleString("default",{month:"short",year:"2-digit"});}:(pk)=>pk;
  const report=useMemo(()=>{if(!allSheets.length)return null;return view==="A"?computeA(allSheets,pkFn):computeB(allSheets,pkFn);},[allSheets,view,groupBy]);
  const handleFiles=useCallback(async(files)=>{
    setLoading(true);const incoming=[],names=[];
    for(const f of files){try{const buf=await f.arrayBuffer();const p=parseXlsx(new Uint8Array(buf));incoming.push(...p);names.push(`${f.name} (${p.length} sheets)`);}catch(e){}}
    setLoadedFiles(p=>[...p,...names]);
    setAllSheets(p=>{const ex=new Set(p.map(s=>s.sheetName));return[...p,...incoming.filter(s=>!ex.has(s.sheetName))].sort((a,b)=>a.date-b.date);});
    setLoading(false);
  },[]);

  return(
    <div>
      <PageHeader title="Harvest Report" sub="Upload Wednesday and Friday xlsx files · crop weights by week or month"/>
      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:20,marginBottom:16}}>
        <p style={{fontSize:12,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 12px"}}>Upload harvest files</p>
        <label style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
          <span style={{padding:"8px 16px",background:T.sky,color:"#fff",borderRadius:8,fontSize:13,fontWeight:700}}>Choose files</span>
          <span style={{fontSize:13,color:T.textSub}}>Wednesday and Friday xlsx — any number</span>
          <input type="file" multiple accept=".xlsx" style={{display:"none"}} onChange={e=>{if(e.target.files.length)handleFiles([...e.target.files]);e.target.value="";}}/>
        </label>
        {loading&&<p style={{fontSize:13,color:T.sky,margin:"12px 0 0",fontWeight:600}}>Reading files…</p>}
        {loadedFiles.map((f,i)=><p key={i} style={{fontSize:12,color:T.textSub,margin:"6px 0 0"}}>✓ {f}</p>)}
        {allSheets.length>0&&<p style={{fontSize:13,fontWeight:700,color:T.green,margin:"8px 0 0"}}>{allSheets.length} sheets loaded · {allSheets[0].date.toLocaleDateString()} → {allSheets[allSheets.length-1].date.toLocaleDateString()}</p>}
      </div>
      {allSheets.length>0&&(
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
            {[["A","By Product"],["B","By Base Crop"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:"7px 14px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",background:view===v?T.sky:"#fff",color:view===v?"#fff":T.textMain}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
            {[["month","Monthly"],["week","Weekly"]].map(([g,l])=>(
              <button key={g} onClick={()=>setGroupBy(g)} style={{padding:"7px 14px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",background:groupBy===g?T.green:"#fff",color:groupBy===g?"#fff":T.textMain}}>{l}</button>
            ))}
          </div>
          <button onClick={()=>{setAllSheets([]);setLoadedFiles([]);}} style={{padding:"7px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:"1px solid #fca5a5",color:"#b91c1c",background:"#fff",cursor:"pointer"}}>Clear</button>
        </div>
      )}
      {report&&(()=>{
        const{data,periods}=report;
        const crops=Object.keys(data).sort((a,b)=>Object.values(data[b]).reduce((s,v)=>s+v,0)-Object.values(data[a]).reduce((s,v)=>s+v,0));
        const gt={};for(const p of periods)gt[p]=crops.reduce((s,c)=>s+(data[c][p]||0),0);
        const total=Object.values(gt).reduce((s,v)=>s+v,0);
        return(
          <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:T.textMain}}>
                <th style={{textAlign:"left",padding:"10px 16px",color:"#fff",fontWeight:700,fontSize:11,textTransform:"uppercase",position:"sticky",left:0,background:T.textMain,minWidth:180}}>
                  {view==="A"?"Product":"Crop"}
                </th>
                {periods.map(p=><th key={p} style={{textAlign:"right",padding:"10px 12px",color:"#fff",fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>{periodLabel(p)}</th>)}
                <th style={{textAlign:"right",padding:"10px 14px",color:T.green,fontWeight:700,fontSize:11,background:"#0a1b2a"}}>Total kg</th>
              </tr></thead>
              <tbody>{crops.map((crop,i)=>{
                const rowT=periods.reduce((s,p)=>s+(data[crop][p]||0),0);
                if(rowT<0.001)return null;
                const bg=i%2===0?"#fff":"#fafbfc";
                return(<tr key={crop} style={{borderBottom:`1px solid ${T.border}`,background:bg}}>
                  <td style={{padding:"9px 16px",fontWeight:600,color:T.textMain,position:"sticky",left:0,background:bg}}>{crop}</td>
                  {periods.map(p=><td key={p} style={{textAlign:"right",padding:"9px 12px",color:(data[crop][p]||0)>0?T.textMain:T.border}}>{(data[crop][p]||0)>0?(data[crop][p]).toFixed(2):"—"}</td>)}
                  <td style={{textAlign:"right",padding:"9px 14px",fontWeight:700,color:T.sky}}>{rowT.toFixed(2)}</td>
                </tr>);
              })}</tbody>
              <tfoot><tr style={{background:T.sky}}>
                <td style={{padding:"10px 16px",fontWeight:700,color:"#fff",position:"sticky",left:0,background:T.sky}}>Total</td>
                {periods.map(p=><td key={p} style={{textAlign:"right",padding:"10px 12px",fontWeight:700,color:"#fff"}}>{gt[p].toFixed(2)}</td>)}
                <td style={{textAlign:"right",padding:"10px 14px",fontWeight:900,color:"#fff"}}>{total.toFixed(2)}</td>
              </tr></tfoot>
            </table>
          </div>
        );
      })()}
    </div>
    </ReportingSheetsContext.Provider>
  );
}

function RoadmapView(){
  const [expanded,setExpanded]=useState({});
  const toggle=k=>setExpanded(p=>({...p,[k]:!p[k]}));
  return(
    <div>
      <PageHeader title="What's Possible" sub="Haresign Investments · Technology Roadmap"/>
      <div style={{background:`linear-gradient(135deg,${T.textMain} 0%,${T.sky} 100%)`,borderRadius:12,padding:24,marginBottom:20,color:"#fff"}}>
        <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#86b9d0",margin:"0 0 6px"}}>Sky Harvest · System Blueprint</p>
        <h2 style={{fontSize:20,fontWeight:900,margin:"0 0 8px"}}>Built today and what comes next</h2>
        <p style={{fontSize:13,color:"#a8cde0",margin:0}}>{ROADMAP[0].items.length} features live · {ROADMAP.slice(1).reduce((s,p)=>s+p.items.length,0)} more identified</p>
      </div>
      {ROADMAP.map((phase,pi)=>(
        <div key={phase.phase} style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{height:1,flex:1,background:phase.border}}/>
            <span style={{fontSize:11,fontWeight:800,padding:"3px 12px",borderRadius:12,background:phase.bg,color:phase.color,border:`1px solid ${phase.border}`}}>{phase.badge}</span>
            <span style={{fontSize:13,fontWeight:700,color:phase.color}}>{phase.phase}</span>
            <div style={{height:1,flex:1,background:phase.border}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {phase.items.map((item,ii)=>{
              const k=`${pi}-${ii}`,open=expanded[k];
              const tc=TAG_COLORS[item.tag]||{bg:"#f0f0f0",text:"#444"};
              return(
                <div key={item.title} onClick={()=>toggle(k)}
                  style={{borderRadius:10,border:`1px solid ${open?phase.color:T.border}`,background:open?phase.bg:"#fff",cursor:"pointer",padding:14,transition:"all 0.15s"}}>
                  <div style={{display:"flex",gap:8,alignItems:"flex-start",justifyContent:"space-between"}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:18}}>{item.icon}</span>
                      <span style={{fontSize:12,fontWeight:700,color:T.textMain}}>{item.title}</span>
                    </div>
                    <span style={{color:T.textSub,fontSize:11,flexShrink:0}}>{open?"▲":"▼"}</span>
                  </div>
                  <div style={{display:"flex",marginTop:8}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,...tc}}>{item.tag}</span>
                    {pi===0&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,background:"#e8f6dc",color:"#2a6010",marginLeft:6}}>✓ Live</span>}
                  </div>
                  {open&&<p style={{fontSize:12,color:T.textSub,margin:"10px 0 0",lineHeight:1.5}}>{item.desc}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
    </ReportingSheetsContext.Provider>
  );
}

function TrayHealthView(){
  const [trays] = useState(getTrayStore());
  const [selectedTrayId, setSelectedTrayId] = useState("");
  const [photo,setPhoto]=useState(null);
  const [photoData,setPhotoData]=useState(null);
  const [crop,setCrop]=useState("Pea Shoots");
  const [daysSince,setDaysSince]=useState(14);

  // When a tray is selected, pre-fill crop and days
  const handleTraySelect = (trayId) => {
    setSelectedTrayId(trayId);
    const tray = trays.find(t=>t.id===trayId);
    if (tray) {
      setCrop(tray.crop);
      const planted = new Date(tray.planted);
      const today = new Date();
      const days = Math.floor((today-planted)/(1000*60*60*24));
      setDaysSince(Math.min(days, 28));
    }
  };
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState(null);
  const fileRef=useRef(null);
  const CROPS_H=[{name:"Pea Shoots",days:28},{name:"Sunflower Shoots",days:28},{name:"Red Radish",days:21},{name:"Arugula",days:21},{name:"Cilantro",days:28},{name:"Kale",days:28},{name:"Basil",days:21},{name:"Mustard",days:21},{name:"Beets",days:28},{name:"Sky Hearts",days:14}];
  const totalDays=CROPS_H.find(c=>c.name===crop)?.days||21;
  const pct=Math.round((daysSince/totalDays)*100);
  const handleFile=useCallback(async(file)=>{
    const reader=new FileReader();
    reader.onload=e=>{setPhoto(e.target.result);setPhotoData(e.target.result.split(",")[1]);setResult(null);setError(null);};
    reader.readAsDataURL(file);
  },[]);
  const analyse=async()=>{
    if(!photoData)return;
    setLoading(true);setError(null);setResult(null);
    try{
      const r=await fetch("/.netlify/functions/analyse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageData:photoData,mediaType:"image/jpeg",crop,daysSince,totalDays})});
      const data=await r.json();
      if(data.error)throw new Error(data.error);
      setResult(data);
      // Save to tray health history if a tray was selected
      if (selectedTrayId && data.health_score) {
        addTrayHealth(selectedTrayId, {
          date: new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"}),
          score: data.health_score,
          stage: data.stage || "Assessed",
          by: "Camera scan",
        });
      }
    }catch(e){setError(e.message||"Analysis failed");}
    setLoading(false);
  };

  const isMobile = useMobile();

  if (isMobile) return (
    <div style={{margin:"-16px",minHeight:"calc(100vh - 108px)",background:T.bg}}>
      <div style={{background:T.textMain,padding:"16px 14px 12px"}}>
        <p style={{fontSize:11,fontWeight:700,color:"#86b9d0",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 10px"}}>Tray Health AI</p>
        {photo ? (
          <div style={{position:"relative",borderRadius:12,overflow:"hidden",marginBottom:10}}>
            <img src={photo} style={{width:"100%",height:200,objectFit:"cover"}} alt="Tray"/>
            <button onClick={()=>{setPhoto(null);setPhotoData(null);setResult(null);}}
              style={{position:"absolute",top:8,right:8,width:30,height:30,borderRadius:15,background:"rgba(0,0,0,0.6)",border:"none",cursor:"pointer",color:"#fff",fontWeight:900,fontSize:16}}>✕</button>
          </div>
        ) : (
          <label style={{display:"block",cursor:"pointer"}}>
            <div style={{background:"#122030",borderRadius:12,padding:28,textAlign:"center",marginBottom:10}}>
              <p style={{fontSize:48,margin:"0 0 8px"}}>📷</p>
              <p style={{fontSize:15,color:"#86b955",fontWeight:700,margin:"0 0 4px"}}>Tap to photograph a tray</p>
              <p style={{fontSize:12,color:"#4a6a80",margin:0}}>Or upload from camera roll</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
          </label>
        )}
        <select value={selectedTrayId} onChange={e=>handleTraySelect(e.target.value)}
          style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"none",fontSize:14,fontWeight:600,background:"rgba(255,255,255,0.1)",color:"#fff",marginBottom:8}}>
          <option value="" style={{background:T.textMain}}>— Select tray (optional) —</option>
          {trays.map(t=><option key={t.id} value={t.id} style={{background:T.textMain}}>{t.crop} — {t.id}</option>)}
        </select>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <select value={crop} onChange={e=>setCrop(e.target.value)}
            style={{padding:"10px 12px",borderRadius:8,border:"none",fontSize:13,background:"rgba(255,255,255,0.1)",color:"#fff"}}>
            {CROPS_H.map(c=><option key={c.name} style={{background:T.textMain}}>{c.name}</option>)}
          </select>
          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>Day</span>
            <input type="number" min={1} max={totalDays} value={daysSince} onChange={e=>setDaysSince(Number(e.target.value))}
              style={{width:40,background:"transparent",border:"none",color:"#fff",fontSize:14,fontWeight:700,outline:"none"}}/>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>of {totalDays}</span>
          </div>
        </div>
      </div>
      <div style={{padding:"12px 14px"}}>
        <button onClick={analyse} disabled={!photo||loading}
          style={{width:"100%",padding:"16px",borderRadius:12,border:"none",color:"#fff",fontWeight:900,fontSize:16,cursor:photo&&!loading?"pointer":"not-allowed",background:photo&&!loading?`linear-gradient(135deg,${T.sky},${T.green})`:"#c5d4de"}}>
          {loading?"🔬 Analysing tray…":"🔬 Analyse Tray Health"}
        </button>
        {error&&<div style={{marginTop:8,padding:10,borderRadius:8,background:"#fff0f0",fontSize:13,color:"#8b2020"}}>{error}</div>}
      </div>
      {result&&!loading&&(
        <div style={{margin:"0 12px 12px",background:T.surface,borderRadius:12,border:`2px solid ${result.pack_ready?T.green:T.sky}`,overflow:"hidden"}}>
          <div style={{padding:"14px 16px",background:result.pack_ready?"#f2faea":"#f5f8fb"}}>
            <h3 style={{fontSize:18,fontWeight:900,color:T.textMain,margin:"0 0 3px"}}>{result.pack_ready?"✅ Ready to pack":"🌱 "+result.days_to_harvest+"d to harvest"}</h3>
            <p style={{fontSize:12,color:T.textSub,margin:0}}>{result.yield_estimate}</p>
          </div>
          <div style={{padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{padding:12,background:"#f5f8fb",borderRadius:8}}>
              <p style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",margin:"0 0 4px"}}>Observations</p>
              <p style={{fontSize:13,color:T.textMain,margin:0,lineHeight:1.6}}>{result.observations}</p>
            </div>
            {result.problems?.map((p,i)=><div key={i} style={{padding:10,background:"#fff5f5",border:"1px solid #fdd",borderRadius:8,fontSize:13,color:"#7a2020"}}>⚠ {p}</div>)}
            {result.recommendations?.map((r,i)=><div key={i} style={{padding:10,background:"#f0f9ec",border:"1px solid #c8e8a8",borderRadius:8,fontSize:13,color:"#2a5020"}}>✓ {r}</div>)}
          </div>
        </div>
      )}
      <div style={{height:20}}/>
    </div>
  );

  return (
    <div>
      <PageHeader title="Tray Health AI" sub="Upload a tray photo · Claude Vision analyses growth stage and health"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"14px 20px 12px",borderBottom:`1px solid ${T.border}`}}>
              <p style={{fontSize:11,fontWeight:700,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Step 1 · Photo</p>
            </div>
            <div style={{padding:16}}>
              {photo ? (
                <div style={{position:"relative",borderRadius:8,overflow:"hidden"}}>
                  <img src={photo} style={{width:"100%",height:200,objectFit:"cover"}} alt="Tray"/>
                  <button onClick={()=>{setPhoto(null);setPhotoData(null);setResult(null);}} style={{position:"absolute",top:8,right:8,width:26,height:26,borderRadius:"50%",background:"#fff",border:"none",cursor:"pointer",fontWeight:900}}>✕</button>
                </div>
              ) : (
                <button onClick={()=>fileRef.current?.click()} style={{width:"100%",height:160,border:`2px dashed ${T.border}`,borderRadius:8,background:"#f8fafb",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span style={{fontSize:36}}>📷</span>
                  <span style={{fontSize:13,fontWeight:700,color:T.sky}}>Tap to upload tray photo</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
            </div>
          </div>
          <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:20}}>
            <p style={{fontSize:11,fontWeight:700,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 14px"}}>Step 2 · Tray &amp; Crop Details</p>
            <div style={{marginBottom:12}}>
              <p style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",margin:"0 0 5px"}}>Link to tray (optional)</p>
              <select value={selectedTrayId} onChange={e=>handleTraySelect(e.target.value)}
                style={{width:"100%",padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,fontSize:12,background:"#f8fafb",marginBottom:2}}>
                <option value="">— Choose tray or enter manually —</option>
                {trays.map(t=><option key={t.id} value={t.id}>{t.crop} — {t.id} (Shelf {t.shelf})</option>)}
              </select>
              {selectedTrayId&&<p style={{fontSize:10,color:T.green,margin:"3px 0 0",fontWeight:600}}>✓ Pre-filled. Result saves to tray history.</p>}
            </div>
            <select value={crop} onChange={e=>setCrop(e.target.value)} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:`1px solid ${T.border}`,fontSize:13,fontWeight:600,marginBottom:14,background:"#f8fafb"}}>
              {CROPS_H.map(c=><option key={c.name}>{c.name}</option>)}
            </select>
            <div style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
              Days since planting — <span style={{color:T.sky,fontWeight:900}}>Day {daysSince}</span> of {totalDays}
            </div>
            <input type="range" min={1} max={totalDays} value={daysSince} onChange={e=>setDaysSince(Number(e.target.value))} style={{width:"100%",accentColor:T.sky}}/>
          </div>
          <button onClick={analyse} disabled={!photo||loading} style={{padding:"14px",borderRadius:10,border:"none",color:"#fff",fontWeight:900,fontSize:14,cursor:photo&&!loading?"pointer":"not-allowed",background:photo&&!loading?`linear-gradient(135deg,${T.sky},${T.green})`:"#c5d4de"}}>
            {loading?"🔬 Analysing…":"🔬 Analyse Tray"}
          </button>
          {error&&<div style={{padding:12,borderRadius:8,background:"#fff0f0",border:"1px solid #fcc",color:"#8b2020",fontSize:12}}>{error}</div>}
        </div>
        <div>
          {!result&&!loading&&<div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:40,textAlign:"center",color:T.textSub}}>Upload a photo and hit Analyse</div>}
          {loading&&<div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:40,textAlign:"center",color:T.sky,fontWeight:700}}>🌱 Claude is examining your tray…</div>}
          {result&&!loading&&(
            <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <div style={{padding:"16px 20px",background:result.pack_ready?"#f2faea":"#f5f8fb",borderBottom:`1px solid ${T.border}`}}>
                <p style={{fontSize:11,fontWeight:700,color:result.pack_ready?T.green:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 4px"}}>{crop} · Day {daysSince}</p>
                <h3 style={{fontSize:18,fontWeight:900,color:T.textMain,margin:"0 0 4px"}}>{result.pack_ready?"✅ Ready":"🌱 "+result.days_to_harvest+"d to harvest"}</h3>
                <p style={{fontSize:12,color:T.textSub,margin:0}}>{result.yield_estimate}</p>
              </div>
              <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
                <div style={{padding:12,background:"#f5f8fb",borderRadius:8}}>
                  <p style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 4px"}}>Observations</p>
                  <p style={{fontSize:12,color:T.textMain,margin:0,lineHeight:1.5}}>{result.observations}</p>
                </div>
                {result.problems?.length>0&&result.problems.map((p,i)=><div key={i} style={{padding:10,background:"#fff5f5",border:"1px solid #fdd",borderRadius:8,fontSize:12,color:"#7a2020"}}>⚠ {p}</div>)}
                {result.recommendations?.length>0&&result.recommendations.map((r,i)=><div key={i} style={{padding:10,background:"#f0f9ec",border:"1px solid #c8e8a8",borderRadius:8,fontSize:12,color:"#2a5020"}}>✓ {r}</div>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </ReportingSheetsContext.Provider>
  );
}


// ── Grow Room View ─────────────────────────────────────────────────────────────
function GrowRoomView() {
  const [trays, setTrays] = useState(getTrayStore());
  const [scanInput, setScanInput] = useState("");
  const [scannedTray, setScannedTray] = useState(null);
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const isMobile = useMobile();
  useEffect(()=>{ return subscribeTrayStore(t=>setTrays([...t])); },[]);
  const handleScan = (e) => {
    if(e)e.preventDefault();
    const found=trays.find(t=>t.id.toLowerCase()===scanInput.toLowerCase().trim());
    if(found){setScannedTray(found);setScanInput("");}
    else{const f=trays.find(t=>t.id.toUpperCase().includes(scanInput.toUpperCase().slice(0,3)))||trays[0];setScannedTray(f);setScanInput("");}
  };
  const handleAddNote=()=>{
    if(!note.trim()||!scannedTray)return;
    const n={by:"Maria Chen",at:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"}),text:note};
    addTrayNote(scannedTray.id,n);setNote("");setShowNoteInput(false);
    setScannedTray(t=>({...t,notes:[...t.notes,n]}));
  };
  const sc=(s)=>s==="On track"?{bg:"#e8f6dc",c:"#2a6010"}:s==="Watch"?{bg:"#fef3dc",c:"#7a5000"}:{bg:"#fde8e8",c:"#7a1a1a"};

  if(isMobile){
    if(scannedTray) return(
      <div style={{margin:"-16px",minHeight:"calc(100vh - 108px)",background:T.bg}}>
        <div style={{background:`linear-gradient(135deg,${T.textMain},${T.sky})`,padding:"14px 16px 12px",display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setScannedTray(null)} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,padding:"6px 12px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0}}>← Back</button>
          <div style={{flex:1}}>
            <p style={{fontSize:10,color:"#86b9d0",textTransform:"uppercase",letterSpacing:"0.08em",margin:0}}>Tray Record</p>
            <h3 style={{fontSize:16,fontWeight:900,color:"#fff",margin:"1px 0 0"}}>{scannedTray.crop}</h3>
          </div>
          <span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:10,...sc(scannedTray.status)}}>{scannedTray.status}</span>
        </div>
        <div style={{background:T.surface,margin:"12px 12px 0",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.05em"}}>Barcode</span>
          <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:T.sky}}>{scannedTray.id}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"10px 12px 0"}}>
          {[["Planted",scannedTray.planted,false],["Est. Harvest",scannedTray.harvest,false],["Days Left",`${scannedTray.daysLeft}d`,false],["Shelf",scannedTray.shelf,false],["Seed Lot",scannedTray.lot,scannedTray.fab],["Planted By",scannedTray.who,scannedTray.fab]].map(([label,val,isFab])=>(
            <div key={label} style={{background:T.surface,borderRadius:8,padding:"10px 12px"}}>
              <p style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.04em",margin:"0 0 3px"}}>{label}</p>
              <p style={{fontSize:13,fontWeight:700,color:isFab?T.rust:T.textMain,margin:0,fontStyle:isFab?"italic":"normal"}}>{val}</p>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"10px 12px 0"}}>
          <button style={{padding:"14px",background:T.green,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>🤖 Health AI</button>
          <button onClick={()=>setShowNoteInput(p=>!p)} style={{padding:"14px",background:T.surface,color:T.sky,border:`1px solid ${T.sky}`,borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>📝 Add Note</button>
        </div>
        {showNoteInput&&(
          <div style={{padding:"10px 12px"}}>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. ⚠ Soft stems on left — possible overwater" rows={3} style={{width:"100%",padding:"10px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:14,resize:"none",boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={handleAddNote} style={{flex:1,padding:"12px",background:T.sky,color:"#fff",border:"none",borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer"}}>Save Note</button>
              <button onClick={()=>{setShowNoteInput(false);setNote("");}} style={{padding:"12px 16px",background:"#fff",color:T.textSub,border:`1px solid ${T.border}`,borderRadius:8,fontSize:14,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        )}
        {scannedTray.notes.length>0&&(
          <div style={{margin:"10px 12px 0",background:T.surface,borderRadius:10,overflow:"hidden"}}>
            <p style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 14px 6px",margin:0}}>Notes ({scannedTray.notes.length})</p>
            {scannedTray.notes.map((n,i)=>(
              <div key={i} style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`,background:n.text.includes("⚠")?"#fff5f5":"#fff"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,fontWeight:700,color:T.textMain}}>{n.by}</span><span style={{fontSize:10,color:T.textSub}}>{n.at}</span></div>
                <p style={{fontSize:13,color:T.textMain,margin:0,lineHeight:1.5}}>{n.text}</p>
              </div>
            ))}
          </div>
        )}
        <div style={{height:20}}/>
      </div>
    );
    return(
      <div style={{margin:"-16px"}}>
        <div style={{background:T.textMain,padding:"16px 14px 12px"}}>
          <p style={{fontSize:11,fontWeight:700,color:"#86b9d0",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 10px"}}>Grow Room Scanner</p>
          <div style={{background:"#122030",borderRadius:12,padding:20,marginBottom:12,textAlign:"center",minHeight:100,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6}}>
            <span style={{fontSize:40}}>📷</span>
            <p style={{fontSize:13,color:"#86b955",fontWeight:700,margin:0}}>Camera ready — scan tray barcode</p>
          </div>
          <form onSubmit={handleScan} style={{display:"flex",gap:8}}>
            <input value={scanInput} onChange={e=>setScanInput(e.target.value)} placeholder="Or type barcode…" autoCapitalize="none" style={{flex:1,padding:"12px 14px",border:"none",borderRadius:10,fontSize:15,outline:"none",background:"rgba(255,255,255,0.1)",color:"#fff"}}/>
            <button type="submit" style={{padding:"12px 18px",background:T.green,color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer"}}>Go</button>
          </form>
        </div>
        <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
          <p style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"4px 0 4px"}}>All Trays ({trays.length})</p>
          {trays.map((t)=>(
            <div key={t.id} onClick={()=>setScannedTray(t)} style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
              <div style={{flex:1}}>
                <p style={{fontSize:15,fontWeight:700,color:t.fab?T.rust:T.textMain,margin:0,fontStyle:t.fab?"italic":"normal"}}>{t.crop}</p>
                <p style={{fontSize:11,color:T.textSub,margin:"2px 0 0",fontFamily:"monospace"}}>{t.id} · Shelf {t.shelf}</p>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                {t.notes.some(n=>n.text.includes("⚠"))&&<span style={{fontSize:16}}>⚠️</span>}
                <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:8,...sc(t.status)}}>{t.daysLeft}d</span>
                <span style={{color:T.textSub,fontSize:16}}>›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return(
    <div>
      <PageHeader title="Grow Room" sub="Scan a tray barcode to see its full record, history and health"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}`,background:"#f8fafb"}}>
              <p style={{fontSize:11,fontWeight:700,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Barcode Scanner</p>
            </div>
            <div style={{padding:16}}>
              <div style={{background:"#1a2e3b",borderRadius:10,padding:16,marginBottom:14,textAlign:"center",minHeight:80,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6}}>
                <span style={{fontSize:28}}>📷</span>
                <p style={{fontSize:11,color:"#86b955",fontWeight:700,margin:0}}>Camera ready — scan tray barcode</p>
              </div>
              <form onSubmit={handleScan} style={{display:"flex",gap:8}}>
                <input value={scanInput} onChange={e=>setScanInput(e.target.value)} placeholder="Type or scan barcode ID…" style={{flex:1,padding:"9px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,outline:"none"}}/>
                <button type="submit" style={{padding:"9px 14px",background:T.sky,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>Go</button>
              </form>
            </div>
          </div>
          <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`}}><p style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>All Trays ({trays.length})</p></div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:"#f8fafb"}}>{["Crop","Shelf","Days","Status","Notes"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 12px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>)}</tr></thead>
              <tbody>{trays.map((t,i)=>(
                <tr key={t.id} onClick={()=>setScannedTray(t)} style={{borderBottom:`1px solid ${T.border}`,background:scannedTray?.id===t.id?"#f0f7ff":i%2===0?"#fff":"#fafbfc",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#f0f7ff"} onMouseLeave={e=>e.currentTarget.style.background=scannedTray?.id===t.id?"#f0f7ff":i%2===0?"#fff":"#fafbfc"}>
                  <td style={{padding:"8px 12px",fontWeight:600,color:t.fab?T.rust:T.textMain,fontStyle:t.fab?"italic":"normal"}}>{t.crop}</td>
                  <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11,color:T.textSub}}>{t.shelf}</td>
                  <td style={{padding:"8px 12px"}}><span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:8,background:t.daysLeft<=3?"#e8f6dc":t.daysLeft<=6?"#fef3dc":"#f0f0f0",color:t.daysLeft<=3?T.green:t.daysLeft<=6?T.amber:"#666"}}>{t.daysLeft}d</span></td>
                  <td style={{padding:"8px 12px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,...sc(t.status)}}>{t.status}</span></td>
                  <td style={{padding:"8px 12px",color:T.textSub,fontSize:11}}>{t.notes.length>0?<span style={{color:t.notes.some(n=>n.text.includes("⚠"))?T.rust:T.textSub,fontWeight:t.notes.some(n=>n.text.includes("⚠"))?700:400}}>{t.notes.length} note{t.notes.length>1?"s":""}</span>:"—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        <div>
          {scannedTray?(
            <TrayDetailCard
              tray={scannedTray}
              showOrganic={false}
              showAddNote={true}
              showActions={true}
              onNoteAdded={updated=>setScannedTray(updated)}
              onHealthCheck={()=>{}}
            />
          ):(
            <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:40,textAlign:"center",color:T.textSub}}>
              <p style={{fontSize:36,margin:"0 0 12px"}}>📦</p>
              <p style={{fontSize:14,fontWeight:700,color:T.textMain,margin:"0 0 6px"}}>Select or scan a tray</p>
              <p style={{fontSize:12,margin:0,lineHeight:1.6}}>Click any tray in the list or type its barcode above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </ReportingSheetsContext.Provider>
  );
}

// ── Customers & At Risk Views ──────────────────────────────────────────────────
function CustomersView() {
  const custList = [
    ...topCustomers.map((c,i)=>({...c,id:`C${String(i+1).padStart(3,"0")}`,type:"Restaurant",day:"Wed+Fri",status:"Active",contact:`orders@${c.name.toLowerCase().replace(/[^a-z]/g,"")}.ca`})),
    ...atRisk.map((r,i)=>({name:r.name,id:`C${String(i+20).padStart(3,"0")}`,monthly:parseInt(r.last?.replace(/[$,]/g,"")||0),trend:r.change,type:"Restaurant",day:"Wed",status:r.status,contact:`info@${r.name.toLowerCase().replace(/[^a-z]/g,"")}.ca`})),
  ];
  return(
    <div>
      <PageHeader title="All Customers" sub={`${custList.length} customers`} action="+ Add Customer"/>
      <DataTable cols={[
        {key:"id",label:"ID",render:v=><span style={{fontFamily:"monospace",fontSize:11,color:T.sky}}>{v}</span>},
        {key:"name",label:"Customer"},
        {key:"type",label:"Type"},
        {key:"day",label:"Delivery Day"},
        {key:"monthly",label:"Monthly CAD",render:v=><span style={{fontWeight:700}}>${(v||0).toLocaleString()}</span>},
        {key:"trend",label:"Trend",render:v=><Trend v={v}/>},
        {key:"status",label:"Status",render:v=><Pill label={v}/>},
      ]} rows={custList}/>
    </div>
    </ReportingSheetsContext.Provider>
  );
}

function AtRiskView() {
  return(
    <div>
      <PageHeader title="At Risk Customers" sub={`${atRisk.length} customers need attention`}/>
      <DataTable cols={[
        {key:"name",label:"Customer"},
        {key:"change",label:"4-week Trend",render:v=><Trend v={v}/>},
        {key:"weeks",label:"Weeks Declining",render:v=><span style={{fontWeight:700}}>{v}w</span>},
        {key:"last",label:"Last Order"},
        {key:"status",label:"Status",render:v=><Pill label={v}/>},
      ]} rows={atRisk}/>
    </div>
    </ReportingSheetsContext.Provider>
  );
}

// ── Pick List View ─────────────────────────────────────────────────────────────
function PickListView() {
  const [checked, setChecked] = useState({});
  const [wfState, setWfState] = useState(getWorkflowState());
  useEffect(()=>{ return workflowSubscribe(s=>setWfState({...s})); },[]);
  const isMobile = useMobile();
  const workflowPickList = getPickList();
  const fabricatedBase = [
    {crop:"Pea Shoots (M)",wt:93,units:49,totalG:4557,fab:true},
    {crop:"Sunflower Shoots (M)",wt:101,units:26,totalG:2626,fab:true},
    {crop:"Radish Blend (M)",wt:98,units:12,totalG:1176,fab:true},
    {crop:"Mellow Mix (L)",wt:208,units:8,totalG:1664,fab:true},
    {crop:"Kale (S)",wt:42,units:7,totalG:294,fab:true},
  ];
  const confirmedCrops = new Set(workflowPickList.map(p=>p.product));
  const pickList = [
    ...workflowPickList.map(p=>({crop:p.product,units:p.totalQty,packWt:p.wt,totalG:p.totalQty*p.wt,fab:false})),
    ...fabricatedBase.filter(f=>!confirmedCrops.has(f.crop)).map(f=>({crop:f.crop,units:f.units,packWt:f.wt,totalG:f.totalG,fab:true})),
  ];
  const done = Object.values(checked).filter(Boolean).length;
  const totalKg = (pickList.reduce((s,r)=>s+r.totalG,0)/1000).toFixed(1);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isMobile?12:20}}>
        <div>
          <h1 style={{fontSize:isMobile?18:22,fontWeight:800,color:T.textMain,margin:0}}>Pick List — Wed 28 May</h1>
          <p style={{fontSize:12,color:T.textSub,margin:"3px 0 0"}}>Pack by 6:30 AM · {done}/{pickList.length} confirmed · {totalKg}kg</p>
        </div>
        <div style={{width:52,height:52,borderRadius:26,background:done===pickList.length?T.green:T.sky,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:900,color:"#fff",lineHeight:1}}>{done}</span>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.7)",lineHeight:1}}>/{pickList.length}</span>
        </div>
      </div>
      {isMobile?(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {pickList.map((r,i)=>(
            <div key={r.crop} onClick={()=>setChecked(p=>({...p,[i]:!p[i]}))}
              style={{background:checked[i]?"#f0f9ec":T.surface,borderRadius:12,border:`2px solid ${checked[i]?T.green:T.border}`,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",opacity:checked[i]?0.7:1}}>
              <div style={{width:40,height:40,borderRadius:8,flexShrink:0,border:`2px solid ${checked[i]?T.green:"#c8d8e8"}`,background:checked[i]?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {checked[i]&&<span style={{fontSize:22,color:"#fff",fontWeight:900,lineHeight:1}}>✓</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:15,fontWeight:700,color:checked[i]?T.textSub:T.textMain,margin:0,textDecoration:checked[i]?"line-through":"none"}}>
                  {r.crop}{r.fab&&<span style={{marginLeft:6,fontSize:10,color:"#b91c1c",fontStyle:"italic"}}>(demo)</span>}
                </p>
                <p style={{fontSize:12,color:T.textSub,margin:"3px 0 0"}}>{r.packWt}g · {(r.totalG/1000).toFixed(2)}kg total</p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{fontSize:28,fontWeight:900,color:r.fab?T.rust:T.textMain,margin:0,lineHeight:1}}>{r.units}</p>
                <p style={{fontSize:10,color:T.textSub,margin:"2px 0 0"}}>packs</p>
              </div>
            </div>
          ))}
          <div style={{padding:"12px 14px",background:"#fffbeb",borderRadius:10,border:"1px solid #fde68a",fontSize:13,color:"#92400e",marginTop:4}}>
            ⚠ Sunflower Shoots short 0.7kg — check tray A-2
          </div>
        </div>
      ):(
        <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:"#f8fafb"}}>{["","Crop / Pack","Units","Pack wt (g)","Total (g)","kg"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 16px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}</tr></thead>
            <tbody>{pickList.map((r,i)=>(
              <tr key={r.crop} onClick={()=>setChecked(p=>({...p,[i]:!p[i]}))} style={{borderBottom:`1px solid ${T.border}`,background:checked[i]?"#f0f9ec":i%2===0?"#fff":"#fafbfc",cursor:"pointer"}}>
                <td style={{padding:"11px 16px"}}><div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked[i]?T.green:"#c8d8e8"}`,background:checked[i]?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:900}}>{checked[i]?"✓":""}</div></td>
                <td style={{padding:"11px 16px",fontWeight:600,color:checked[i]?T.textSub:T.textMain,textDecoration:checked[i]?"line-through":"none"}}>{r.crop}{r.fab&&<span style={{marginLeft:6,fontSize:9,color:"#9ca3af",fontStyle:"italic"}}>(demo)</span>}</td>
                <td style={{padding:"11px 16px",fontWeight:800,color:r.fab?T.rust:T.textMain}}>{r.units}</td>
                <td style={{padding:"11px 16px",color:T.textSub}}>{r.packWt}</td>
                <td style={{padding:"11px 16px",color:T.textSub}}>{r.totalG.toLocaleString()}</td>
                <td style={{padding:"11px 16px",fontWeight:700,color:T.sky}}>{(r.totalG/1000).toFixed(2)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{background:T.textMain}}>
              <td colSpan={2} style={{padding:"10px 16px",fontWeight:800,color:"#fff"}}>Total</td>
              <td style={{padding:"10px 16px",fontWeight:900,color:"#fff"}}>{pickList.reduce((s,r)=>s+r.units,0)}</td>
              <td/><td style={{padding:"10px 16px",fontWeight:900,color:"#fff"}}>{pickList.reduce((s,r)=>s+r.totalG,0).toLocaleString()}</td>
              <td style={{padding:"10px 16px",fontWeight:900,color:T.green}}>{totalKg}</td>
            </tr></tfoot>
          </table>
          <div style={{padding:"10px 16px",background:"#fffbeb",borderTop:`1px solid #fde68a`,fontSize:12,color:"#92400e"}}>⚠ Sunflower Shoots short 0.7kg vs orders — check tray A-2</div>
        </div>
      )}
    </div>
    </ReportingSheetsContext.Provider>
  );
}

// ── Calendar View ──────────────────────────────────────────────────────────────
function CalendarView() {
  const week=[
    {day:"Mon 26",tasks:[{time:"7:00",label:"Review standing orders",type:"admin"},{time:"9:00",label:"Plant Pea Shoots — 6 trays (A-1)",type:"grow"},{time:"14:00",label:"Confirm Wed orders",type:"admin"}]},
    {day:"Tue 27",tasks:[{time:"6:30",label:"Harvest prep — check trays",type:"grow"},{time:"7:00",label:"Harvest Wednesday orders",type:"harvest"},{time:"13:00",label:"Pack & label",type:"harvest"}]},
    {day:"Wed 28",tasks:[{time:"7:00",label:"North Shore run — Sam (🚗)",type:"delivery"},{time:"9:00",label:"Downtown run — Leo (🚲)",type:"delivery"},{time:"11:30",label:"Richmond run — Sam (🚗)",type:"delivery"}]},
    {day:"Thu 29",tasks:[{time:"9:00",label:"Plant Sunflower — 4 trays (B-2)",type:"grow"},{time:"14:00",label:"Confirm Friday orders",type:"admin"}]},
    {day:"Fri 30",tasks:[{time:"7:00",label:"Harvest Friday orders",type:"harvest"},{time:"9:00",label:"North Shore + Downtown runs",type:"delivery"}]},
  ];
  const tc={admin:{bg:"#e8f0fb",text:"#1a3a7a"},grow:{bg:"#e8f6dc",text:"#2a6010"},harvest:{bg:"#fef3dc",text:"#7a5000"},delivery:{bg:"#fde8e8",text:"#7a1a1a"}};
  return(
    <div>
      <PageHeader title="Weekly Calendar" sub="Week of 26 May 2026 · Auto-generated from confirmed orders"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,overflowX:"auto"}}>
        {week.map(day=>(
          <div key={day.day} style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden",minWidth:140}}>
            <div style={{padding:"10px 14px",background:T.textMain}}><p style={{fontSize:12,fontWeight:800,color:"#fff",margin:0}}>{day.day}</p></div>
            <div style={{padding:10,display:"flex",flexDirection:"column",gap:8}}>
              {day.tasks.map((t,i)=>(
                <div key={i} style={{padding:"7px 10px",borderRadius:7,...tc[t.type]}}>
                  <p style={{fontSize:10,fontWeight:700,margin:"0 0 2px",opacity:0.7}}>{t.time}</p>
                  <p style={{fontSize:11,fontWeight:600,margin:0,lineHeight:1.3}}>{t.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    </ReportingSheetsContext.Provider>
  );
}


function OrderInboxWrapper() {
  const isMobile = useMobile();
  return (
    <div style={{
      position:"fixed",
      top:44,
      left:isMobile?0:234,
      right:0,
      bottom:isMobile?64:0,
      zIndex:10,
      overflow:"hidden"
    }}>
      <OrderInbox/>
    </div>
    </ReportingSheetsContext.Provider>
  );
}

// ── VIEWS object ──────────────────────────────────────────────────────────────

// ── BusinessInsights wrapper (reads shared sheets from context) ───────────────
function BusinessInsightsWrapper() {
  const { sheets } = useReportingSheets();
  return <BusinessInsights sheets={sheets} />;
}

const VIEWS = {
  dashboard:   <DashboardView/>,
  plantings:   <PlantingsView/>,
  growroom:    <GrowRoomView/>,
  deliveries:  <DeliveriesView/>,
  cert:        <CertView/>,
  harvests:    <Reporting/>,
  roadmap:     <RoadmapView/>,
  trayhealth:  <TrayHealthView/>,
  harvestruns: <HarvestManagerEmbed/>,
  picklist:    <PickListView/>,
  orderinbox:  <OrderInboxWrapper/>,
  customers:   <CustomersView/>,
  atrisk:      <AtRiskView/>,
  calendar:    <CalendarView/>,
  provenance:  <ProvenanceTrail/>,
  legacy: null,
};

// ── Mobile bottom nav ─────────────────────────────────────────────────────────
const MOBILE_NAV = [
  {id:"dashboard",  icon:"🏠", label:"Home"},
  {id:"orderinbox", icon:"📬", label:"Orders"},
  {id:"harvestruns",icon:"📋", label:"Harvest"},
  {id:"picklist",   icon:"✅", label:"Pick List"},
  {id:"_more",      icon:"☰",  label:"More"},
];

function HarvestManagerEmbed() {
  return (
    <div style={{height:"100%",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <HarvestManager/>
    </div>
    </ReportingSheetsContext.Provider>
  );
}

function LegacySiteView({ navigate }) {
  return (
    <div style={{maxWidth:600}}>
      <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,background:"#f8fafb"}}>
          <p style={{fontSize:11,fontWeight:700,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 4px"}}>Interim Stopgap Features</p>
          <h3 style={{fontSize:16,fontWeight:900,color:T.textMain,margin:0}}>Legacy Site</h3>
        </div>
        <div style={{padding:20}}>
          <p style={{fontSize:13,color:T.textSub,margin:"0 0 16px",lineHeight:1.6}}>
            Standalone tools built as stopgaps while the full system is developed. Click any feature to open it.
          </p>
          <button onClick={()=>navigate("harvests")}
            style={{display:"flex",gap:16,alignItems:"flex-start",textAlign:"left",padding:20,background:"#fff",border:`2px solid ${T.sky}`,borderRadius:12,cursor:"pointer",width:"100%",transition:"all 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="#f0f7ff"}
            onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
            <span style={{fontSize:32,flexShrink:0}}>📊</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <p style={{fontSize:15,fontWeight:800,color:T.textMain,margin:0}}>Harvest Report</p>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,background:"#e8f6dc",color:"#2a6010"}}>✓ Live</span>
              </div>
              <p style={{fontSize:13,color:T.textSub,margin:"0 0 10px",lineHeight:1.5}}>
                Upload Wednesday and Friday harvest xlsx files. Crop weight report by product or base crop. Export to Excel or print as PDF.
              </p>
              <p style={{fontSize:12,fontWeight:700,color:T.sky,margin:0}}>Click to open →</p>
            </div>
          </button>
          <p style={{fontSize:11,color:T.textSub,margin:"14px 0 0",textAlign:"center",fontStyle:"italic"}}>More tools will appear here as they are built</p>
        </div>
      </div>
    </div>
    </ReportingSheetsContext.Provider>
  );
}

export default function SkyHarvestMIS() {
  const [active, setActive] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sharedSheets, setSharedSheets] = useState([]);
  const [sharedPeriodLabel, setSharedPeriodLabel] = useState("All data");
  const isMobile = useMobile();

  const handleNav = (id) => {
    if (id === "_more") { setMobileMenuOpen(p=>!p); return; }
    setActive(id);
    setMobileMenuOpen(false);
  };

  return (
    <ReportingSheetsContext.Provider value={{sheets:sharedSheets,setSheets:setSharedSheets,periodLabel:sharedPeriodLabel,setPeriodLabel:setSharedPeriodLabel}}>
    <div style={{display:"flex",height:"100vh",overflow:"hidden",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>

      {/* Sidebar — desktop only */}
      {/* Hide webkit scrollbar globally for sidebar */}
      <style>{`.sh-nav::-webkit-scrollbar{display:none}`}</style>
      {!isMobile && <div style={{width:234,background:T.sidebar,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
        <div style={{padding:"12px 12px 10px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:34,height:34,borderRadius:8,background:`linear-gradient(135deg,${T.green},${T.sky})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",flexShrink:0}}>SH</div>
            <div>
              <p style={{color:"#fff",fontWeight:800,fontSize:13,margin:0}}>Sky Harvest</p>
              <p style={{color:T.textDim,fontSize:10,margin:0}}>Vancouver Island</p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"rgba(255,255,255,0.06)",borderRadius:8}}>
            <div style={{width:26,height:26,borderRadius:13,background:`linear-gradient(135deg,${T.sky},${T.green})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",flexShrink:0}}>CA</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{color:"#fff",fontSize:11,fontWeight:600,margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>chris@skyharvest.ca</p>
              <p style={{color:T.textDim,fontSize:9,margin:0}}>Owner</p>
            </div>
            <span style={{color:T.textDim,fontSize:12,cursor:"pointer",flexShrink:0}}>↪</span>
          </div>
        </div>
        <div className="sh-nav" style={{flex:1,overflowY:"auto",padding:"6px 0",scrollbarWidth:"none",msOverflowStyle:"none"}}>
          {NAV.map(section=>(
            <div key={section.section}>
              <p style={{fontSize:10,fontWeight:700,color:T.label,letterSpacing:"0.1em",padding:"7px 14px 3px",margin:0}}>{section.section}</p>
              {section.items.map(item=>{
                const isActive=active===item.id;
                return(
                  <button key={item.id} onClick={()=>handleNav(item.id)}
                    style={{width:"calc(100% - 16px)",display:"flex",alignItems:"center",gap:10,padding:"6px 12px",background:isActive?T.activeBg:"transparent",border:"none",cursor:"pointer",textAlign:"left",borderRadius:7,margin:"1px 8px",transition:"background 0.12s"}}>
                    <span style={{fontSize:15,width:20,textAlign:"center",flexShrink:0}}>{item.icon}</span>
                    <span style={{fontSize:13,fontWeight:isActive?700:500,color:isActive?"#fff":T.text,flex:1}}>{item.label}</span>
                    {isActive&&<div style={{width:3,height:16,borderRadius:2,background:T.green,flexShrink:0}}/>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

      </div>}

      {/* Mobile slide-up menu */}
      {isMobile && mobileMenuOpen && (
        <div style={{position:"fixed",inset:0,zIndex:200}} onClick={()=>setMobileMenuOpen(false)}>
          <div style={{position:"absolute",bottom:64,left:0,right:0,background:T.sidebar,borderRadius:"16px 16px 0 0",padding:"16px 0 8px",boxShadow:"0 -8px 32px rgba(0,0,0,0.4)"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.2)",margin:"0 auto 12px"}}/>
            {NAV.map(section=>(
              <div key={section.section}>
                <p style={{fontSize:10,fontWeight:700,color:T.label,letterSpacing:"0.1em",padding:"8px 20px 4px",margin:0,textTransform:"uppercase"}}>{section.section}</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,padding:"0 8px"}}>
                  {section.items.map(item=>(
                    <button key={item.id} onClick={()=>handleNav(item.id)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",background:active===item.id?T.activeBg:"transparent",border:"none",cursor:"pointer",borderRadius:8,textAlign:"left",width:"100%"}}>
                      <span style={{fontSize:16}}>{item.icon}</span>
                      <span style={{fontSize:12,fontWeight:active===item.id?700:500,color:active===item.id?"#fff":T.text}}>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{height:8}}/>
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"0 16px",height:44,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          {isMobile ? (
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:28,height:28,borderRadius:6,background:`linear-gradient(135deg,${T.green},${T.sky})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff"}}>SH</div>
              <span style={{fontSize:13,fontWeight:800,color:T.textMain}}>Sky Harvest</span>
            </div>
          ) : <div/>}
          {!isMobile && <p style={{fontSize:12,fontWeight:600,color:T.textSub,margin:0}}>Sky Harvest Microgreens · Vancouver</p>}
          <p style={{fontSize:11,color:T.textSub,margin:0}}>Week of <strong style={{color:T.textMain}}>26 May 2026</strong></p>
        </div>
        <div style={{flex:1,overflowY:"auto",background:T.bg,
          padding:active==="orderinbox"?0:isMobile?"16px":24,
          paddingBottom:isMobile&&active!=="orderinbox"?"80px":undefined}}>
          {active==="legacy" ? <LegacySiteView navigate={setActive}/> : (VIEWS[active]||<DashboardView/>)}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:T.sidebar,borderTop:"1px solid rgba(255,255,255,0.1)",display:"flex",height:64,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {MOBILE_NAV.map(item=>{
            const isActive=item.id!=="__more"&&active===item.id;
            const isMore=item.id==="_more"&&mobileMenuOpen;
            return(
              <button key={item.id} onClick={()=>handleNav(item.id)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",borderTop:isActive||isMore?`2px solid ${T.green}`:"2px solid transparent",paddingTop:isActive||isMore?0:2}}>
                <span style={{fontSize:20}}>{item.icon}</span>
                <span style={{fontSize:10,fontWeight:isActive||isMore?700:400,color:isActive||isMore?"#fff":T.textDim}}>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
    </ReportingSheetsContext.Provider>
  );
}
