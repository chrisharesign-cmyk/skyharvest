import React, { useState, useMemo, useCallback } from "react";
import { useReportingSheets } from "./reportingContext.js";

const T = {
  sky:"#3e7da1", green:"#86b955", amber:"#d4890a", rust:"#c0432b",
  purple:"#7c5cbf", teal:"#2a9d8f",
  bg:"#f4f6f8", surface:"#ffffff", border:"#e2e8ed",
  textMain:"#1a2e3b", textSub:"#5a7080",
  sidebar:"#0f2535",
};

// ── Skip rows that are subtotals/calc helpers ─────────────────────────────────
const SKIP = [/WEIGHT NEEDED/i,/NON-RADISH WEIGHT/i,/RADISH WEIGHT FOR BOOST/i,
  /^Approx\s/i,/^Total Sunflower/i,/^Total Pea/i,/^TOTAL\s/i,
  /^Gourmet Garnish/i,/^#REF/i,/^Check\s/i,/^Total$/i];

// ── Analytics engine ──────────────────────────────────────────────────────────
function computeInsights(sheets) {
  if (!sheets || sheets.length === 0) return null;

  // Sort sheets chronologically
  const sorted = [...sheets].filter(s => s.date).sort((a,b)=> a.date - b.date);
  if (sorted.length === 0) return null;

  const dates = sorted.map(s => s.date);
  const dateLabels = sorted.map(s =>
    s.date.toLocaleDateString("en-GB", {day:"numeric", month:"short"})
  );

  // ── Weekly production totals (units) ─────────────────────────────────────
  const weeklyProduction = sorted.map(s => {
    if (s.cropRows && s.cropRows.length > 0) {
      return s.cropRows.reduce((sum, r) => sum + r.units, 0);
    }
    // For noWeightData sheets, sum customerOrders
    let total = 0;
    for (const prods of Object.values(s.customerOrders || {})) {
      for (const q of Object.values(prods)) total += q;
    }
    // Avoid double-counting by using the sheet's f134 if available
    return total;
  });

  // ── Per-customer weekly volumes ───────────────────────────────────────────
  const customerWeekly = {}; // customer → [qty per week]
  sorted.forEach((s, wi) => {
    const orders = s.customerOrders || {};
    // Track all customers seen so far
    for (const cust of Object.keys(orders)) {
      if (!customerWeekly[cust]) customerWeekly[cust] = Array(sorted.length).fill(0);
    }
    for (const [cust, prods] of Object.entries(orders)) {
      const total = Object.values(prods).reduce((a,b) => a+b, 0);
      customerWeekly[cust][wi] = total;
    }
  });

  // Fill missing customers with zeros for all weeks
  for (const arr of Object.values(customerWeekly)) {
    while (arr.length < sorted.length) arr.push(0);
  }

  // ── Customer summary stats ────────────────────────────────────────────────
  const totalWeeks = sorted.length;
  const recentCutoff = Math.max(0, totalWeeks - 7); // last 7 weeks = "recent"
  const earlyEnd    = Math.min(3, totalWeeks);       // first 3 weeks = "early"

  const customerStats = Object.entries(customerWeekly).map(([name, weekly]) => {
    const totalUnits   = weekly.reduce((a,b)=>a+b,0);
    const activeWeeks  = weekly.filter(v=>v>0).length;
    const earlyAvg     = earlyEnd > 0
      ? weekly.slice(0, earlyEnd).reduce((a,b)=>a+b,0) / earlyEnd : 0;
    const recentSlice  = weekly.slice(recentCutoff);
    const recentAvg    = recentSlice.length > 0
      ? recentSlice.reduce((a,b)=>a+b,0) / recentSlice.length : 0;
    const lastOrderIdx = weekly.map((v,i)=>[v,i]).filter(([v])=>v>0).pop();
    const lastOrderWk  = lastOrderIdx ? lastOrderIdx[1] : -1;
    const isGone       = lastOrderWk >= 0 && lastOrderWk < recentCutoff &&
                         weekly.slice(recentCutoff).every(v=>v===0);
    const trend        = earlyAvg > 0
      ? ((recentAvg - earlyAvg) / earlyAvg) * 100 : null;
    return { name, weekly, totalUnits, activeWeeks, earlyAvg, recentAvg, trend, isGone, lastOrderWk };
  }).filter(c => c.totalUnits > 0);

  customerStats.sort((a,b) => b.totalUnits - a.totalUnits);

  // ── Categorise accounts ───────────────────────────────────────────────────
  const totalAllUnits = customerStats.reduce((a,c)=>a+c.totalUnits, 0);

  const lostAccounts = customerStats.filter(c =>
    c.isGone && c.earlyAvg >= 5
  );

  const growingAccounts = customerStats.filter(c =>
    !c.isGone &&
    c.trend !== null &&
    c.trend >= 15 &&
    c.recentAvg >= 4 &&
    c.activeWeeks >= 5
  );

  const decliningAccounts = customerStats.filter(c =>
    !c.isGone &&
    c.trend !== null &&
    c.trend <= -25 &&
    c.earlyAvg >= 8 &&
    c.recentAvg < c.earlyAvg * 0.75
  );

  const stableTop = customerStats.filter(c =>
    !c.isGone &&
    (c.trend === null || Math.abs(c.trend) < 15) &&
    c.recentAvg >= 8
  );

  // ── Production trend analysis ─────────────────────────────────────────────
  const peakWeek   = weeklyProduction.indexOf(Math.max(...weeklyProduction));
  const recentProd = weeklyProduction.slice(recentCutoff);
  const recentProdAvg = recentProd.reduce((a,b)=>a+b,0) / recentProd.length;
  const earlyProd  = weeklyProduction.slice(0, earlyEnd);
  const earlyProdAvg  = earlyProd.reduce((a,b)=>a+b,0) / earlyEnd;

  // Check for plateau (last 7 weeks coefficient of variation)
  const rpMean = recentProdAvg;
  const rpStd  = Math.sqrt(recentProd.reduce((s,v)=>s+(v-rpMean)**2,0)/recentProd.length);
  const rpCV   = rpMean > 0 ? rpStd/rpMean : 0;
  const isPlateaued = rpCV < 0.08 && recentProd.length >= 5;

  // ── Top 10 for the report ─────────────────────────────────────────────────
  const top10 = customerStats.slice(0, 10);
  const top1pct  = totalAllUnits > 0 ? (top10[0]?.totalUnits / totalAllUnits * 100).toFixed(1) : 0;
  const top5pct  = totalAllUnits > 0
    ? (top10.slice(0,5).reduce((s,c)=>s+c.totalUnits,0) / totalAllUnits * 100).toFixed(1) : 0;
  const top10pct = totalAllUnits > 0
    ? (top10.reduce((s,c)=>s+c.totalUnits,0) / totalAllUnits * 100).toFixed(1) : 0;

  return {
    dateRange: { from: dates[0], to: dates[dates.length-1] },
    dateLabels,
    weeklyProduction,
    totalWeeks,
    peakWeek,
    peakUnits: Math.max(...weeklyProduction),
    recentProdAvg: Math.round(recentProdAvg),
    earlyProdAvg: Math.round(earlyProdAvg),
    prodChangePct: earlyProdAvg > 0
      ? Math.round((recentProdAvg - earlyProdAvg) / earlyProdAvg * 100) : null,
    isPlateaued,
    customerStats,
    lostAccounts,
    growingAccounts,
    decliningAccounts,
    stableTop,
    top10,
    totalAllUnits,
    concentration: { top1: top1pct, top5: top5pct, top10: top10pct },
    totalCustomers: customerStats.length,
  };
}

// ── Build the prompt payload ──────────────────────────────────────────────────
function buildPrompt(ins, periodLabel) {
  const fmt = d => d.toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"});
  const fmtShort = d => d.toLocaleDateString("en-GB", {day:"numeric", month:"short"});

  const custTable = ins.top10.map((c,i) =>
    `${i+1}. ${c.name}: ${Math.round(c.recentAvg)}/wk recent (${Math.round(c.earlyAvg)}/wk early, trend ${c.trend !== null ? (c.trend>0?"+":"")+Math.round(c.trend)+"%" : "n/a"})`
  ).join("\n");

  const lostList = ins.lostAccounts.length > 0
    ? ins.lostAccounts.map(c =>
        `- ${c.name}: was ${Math.round(c.earlyAvg)}/wk in early period, zero in last 7 weeks`
      ).join("\n")
    : "None identified.";

  const growingList = ins.growingAccounts.length > 0
    ? ins.growingAccounts.map(c =>
        `- ${c.name}: ${Math.round(c.earlyAvg)}/wk early → ${Math.round(c.recentAvg)}/wk recent (+${Math.round(c.trend)}%)`
      ).join("\n")
    : "None with >15% growth.";

  const decliningList = ins.decliningAccounts.length > 0
    ? ins.decliningAccounts.map(c =>
        `- ${c.name}: ${Math.round(c.earlyAvg)}/wk early → ${Math.round(c.recentAvg)}/wk recent (${Math.round(c.trend)}%)`
      ).join("\n")
    : "None with >25% decline.";

  const weeklyProdSummary = ins.dateLabels.map((l,i) =>
    `${l}: ${ins.weeklyProduction[i]}`
  ).join(", ");

  return `You are analysing operational data for SkyHarvest, a Vancouver-based microgreens and specialty produce business supplying fine-dining restaurants, hotels, and retail grocers.

PERIOD: ${periodLabel || fmt(ins.dateRange.from)+' to '+fmt(ins.dateRange.to)+' ('+ins.totalWeeks+' weeks)'}

WEEKLY PRODUCTION (units harvested):
${weeklyProdSummary}

KEY PRODUCTION STATS:
- Peak week: ${ins.dateLabels[ins.peakWeek]} at ${ins.peakUnits} units
- Early-period average (first 3 weeks): ${ins.earlyProdAvg} units/week
- Recent average (last 7 weeks): ${ins.recentProdAvg} units/week
- Overall change: ${ins.prodChangePct !== null ? (ins.prodChangePct > 0 ? "+" : "") + ins.prodChangePct + "%" : "n/a"}
- Production plateau detected: ${ins.isPlateaued ? "YES — last 7 weeks show <8% variation around the mean" : "No plateau — volume is still moving"}

TOP 10 ACCOUNTS (by total volume over the period):
${custTable}

ACCOUNT CONCENTRATION:
- Top account: ${ins.concentration.top1}% of all volume
- Top 5 accounts: ${ins.concentration.top5}% of all volume
- Top 10 accounts: ${ins.concentration.top10}% of all volume
- Total active customers in dataset: ${ins.totalCustomers}

ACCOUNTS CONFIRMED LOST (zero orders last 7 weeks, were meaningful earlier):
${lostList}

GROWING ACCOUNTS (>15% increase early → recent):
${growingList}

DECLINING ACCOUNTS (>25% reduction, not yet zero):
${decliningList}

---

Write a business insights report for SkyHarvest's management team. Begin with a one-line summary stating the exact period this report covers. Use plain, direct prose — no fluff. Lead with the most important finding. Structure it into these four sections with these exact headings:

## Production Trend
Summarise the overall volume trajectory. Explain the production shift clearly. Flag the plateau if present.

## Account Health
Cover: the lost accounts and their combined impact, the declining accounts that need attention, and the growing/new accounts that represent momentum. Be specific with numbers.

## Concentration & Risk
Assess the top-account dependency. Is it healthy or dangerous? What does the long tail look like?

## Recommended Actions
Three to five specific, prioritised actions SkyHarvest should take now based on this data. Each action in one sentence. No vague strategy — only things derivable from this data.

Tone: evidence-based, direct, a senior analyst writing for a business owner. UK English. No bullet lists except in Recommended Actions.`;
}

// ── Trend sparkline ───────────────────────────────────────────────────────────
function Spark({ data, color = T.sky, height = 28, width = 80 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{display:"block"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = T.sky }) {
  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,
      padding:"14px 18px",minWidth:140,flex:"1 1 140px"}}>
      <div style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",
        letterSpacing:"0.06em",marginBottom:6}}>{label}</div>
      <div style={{fontSize:26,fontWeight:900,color,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11,color:T.textSub,marginTop:4}}>{sub}</div>}
    </div>
  );
}

// ── Account row ───────────────────────────────────────────────────────────────
function AccountRow({ c, rank }) {
  const trendColor = c.trend === null ? T.textSub
    : c.trend > 15 ? T.green : c.trend < -25 ? T.rust : T.amber;
  const trendLabel = c.trend === null ? "—"
    : (c.trend > 0 ? "+" : "") + Math.round(c.trend) + "%";
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",
      borderBottom:`1px solid ${T.border}`}}>
      <div style={{width:20,fontSize:11,fontWeight:700,color:T.textSub,textAlign:"right",
        flexShrink:0}}>{rank}</div>
      <div style={{flex:1,fontSize:12,fontWeight:600,color:T.textMain,
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
      <Spark data={c.weekly} color={trendColor} width={60} height={20}/>
      <div style={{width:44,fontSize:11,fontWeight:700,color:trendColor,
        textAlign:"right",flexShrink:0}}>{trendLabel}</div>
      <div style={{width:48,fontSize:12,fontWeight:700,color:T.textMain,
        textAlign:"right",flexShrink:0}}>{Math.round(c.recentAvg)}<span
        style={{fontSize:10,fontWeight:400,color:T.textSub}}>/wk</span></div>
    </div>
  );
}

// ── Production chart (bar) ────────────────────────────────────────────────────
function ProdChart({ labels, data }) {
  const max = Math.max(...data, 1);
  const barW = Math.max(8, Math.floor(560 / data.length) - 3);
  return (
    <div style={{overflowX:"auto"}}>
      <div style={{display:"flex",alignItems:"flex-end",gap:3,height:80,
        padding:"0 4px",minWidth: data.length * (barW+3)}}>
        {data.map((v, i) => {
          const h = Math.max(2, (v/max)*72);
          const isRecent = i >= data.length - 7;
          return (
            <div key={i} title={`${labels[i]}: ${v} units`}
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flex:"0 0 auto"}}>
              <div style={{width:barW,height:h,borderRadius:"3px 3px 0 0",
                background: isRecent ? T.sky : "#c8dce8"}}/>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:3,padding:"3px 4px",minWidth: data.length*(barW+3)}}>
        {data.map((_, i) => {
          const lbl = labels[i];
          const parts = lbl.split(" ");
          return (
            <div key={i} style={{width:barW,fontSize:8,color:T.textSub,textAlign:"center",
              lineHeight:1.2,flex:"0 0 auto",overflow:"hidden"}}>
              {parts[0]}<br/>{parts[1]||""}
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:12,marginTop:6,fontSize:10,color:T.textSub}}>
        <span>█ <span style={{color:T.sky}}>■</span> Last 7 weeks</span>
        <span>■ <span style={{color:"#c8dce8"}}>■</span> Earlier weeks</span>
      </div>
    </div>
  );
}

// ── Alert pill ────────────────────────────────────────────────────────────────
function Pill({ label, color, bg }) {
  return (
    <span style={{display:"inline-block",padding:"2px 8px",borderRadius:12,
      fontSize:10,fontWeight:700,color,background:bg,marginRight:4}}>{label}</span>
  );
}

// ── Formatted AI report renderer ──────────────────────────────────────────────
function ReportRenderer({ text }) {
  if (!text) return null;
  const sections = text.split(/^## /m).filter(Boolean);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {sections.map((sec, i) => {
        const [heading, ...bodyParts] = sec.split("\n");
        const body = bodyParts.join("\n").trim();
        const paras = body.split(/\n\n+/).filter(Boolean);
        return (
          <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,
            borderRadius:10,padding:"16px 20px"}}>
            <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:800,color:T.sidebar,
              borderBottom:`2px solid ${T.sky}`,paddingBottom:6}}>{heading.trim()}</h3>
            {paras.map((p, j) => {
              // Bullet list detection
              if (p.startsWith("- ") || p.startsWith("* ")) {
                const items = p.split("\n").map(l => l.replace(/^[-*]\s*/,"").trim()).filter(Boolean);
                return (
                  <ul key={j} style={{margin:"6px 0",paddingLeft:18}}>
                    {items.map((item,k) => (
                      <li key={k} style={{fontSize:13,color:T.textMain,lineHeight:1.6,
                        marginBottom:4}}>{item}</li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={j} style={{margin:"0 0 8px",fontSize:13,color:T.textMain,
                  lineHeight:1.65}}>{p}</p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Main BusinessInsights component ──────────────────────────────────────────
export default function BusinessInsights({ sheets }) {
  const [aiReport, setAiReport]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [activeView, setActiveView] = useState("overview"); // overview | report
  const { periodLabel = "All data" } = (() => {
    try { return useReportingSheets(); } catch(e) { return {}; }
  })();

  const ins = useMemo(() => {
    try { return computeInsights(sheets); }
    catch(e) { console.error("Insights compute error:", e); return null; }
  }, [sheets]);

  const generateReport = useCallback(async () => {
    if (!ins) return;
    const activePeriodLabel = periodLabel;
    setLoading(true);
    setError("");
    setAiReport("");
    setActiveView("report");
    try {
      const prompt = buildPrompt(ins, activePeriodLabel);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1400,
          messages:[{ role:"user", content: prompt }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const txt = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("\n") || "";
      setAiReport(txt);
    } catch(e) {
      setError("Failed to generate report: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [ins]);

  // ── No data state ──────────────────────────────────────────────────────────
  if (!sheets || sheets.length === 0) {
    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",minHeight:300,gap:12,color:T.textSub}}>
        <div style={{fontSize:36}}>📊</div>
        <div style={{fontSize:14,fontWeight:600}}>No data loaded</div>
        <div style={{fontSize:12}}>Upload a harvest sheet in the Reporting tab first.</div>
      </div>
    );
  }

  if (!ins) {
    return (
      <div style={{padding:24,color:T.rust,fontSize:13}}>
        Could not compute insights from this data. Check the harvest sheet format.
      </div>
    );
  }

  const fmtDate = d => d.toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"});
  const prodChg = ins.prodChangePct;
  const prodChgColor = prodChg === null ? T.textSub : prodChg > 0 ? T.green : T.rust;

  return (
    <div style={{padding:"0 0 32px"}}>
      {/* Header */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,
        padding:"16px 20px",marginBottom:14,display:"flex",alignItems:"center",
        justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:T.sidebar}}>Business Insights</div>
          <div style={{fontSize:11,color:T.textSub,marginTop:2}}>
            {fmtDate(ins.dateRange.from)} → {fmtDate(ins.dateRange.to)}
            {" · "}{ins.totalWeeks} weeks · {ins.totalCustomers} active accounts
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {/* View toggle */}
          <div style={{display:"flex",border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
            {[["overview","📈 Overview"],["report","📝 AI Report"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>setActiveView(id)}
                style={{padding:"6px 14px",fontSize:11,fontWeight:700,border:"none",
                  cursor:"pointer",background:activeView===id?T.sky:"#fff",
                  color:activeView===id?"#fff":T.textMain}}>
                {lbl}
              </button>
            ))}
          </div>
          <button onClick={generateReport} disabled={loading}
            style={{padding:"7px 16px",fontSize:12,fontWeight:700,border:"none",
              borderRadius:8,cursor:loading?"wait":"pointer",
              background:loading?"#c8dce8":T.green,color:"#fff",
              display:"flex",alignItems:"center",gap:6}}>
            {loading ? "⏳ Generating…" : "✨ Generate AI Insights"}
          </button>
        </div>
      </div>

      {/* Cost note */}
      <div style={{background:"#f0f6fb",border:"1px solid #d0e4f0",borderRadius:8,
        padding:"7px 14px",marginBottom:14,display:"flex",alignItems:"center",
        justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
        <span style={{fontSize:11,color:T.textSub}}>
          <strong style={{color:T.sky}}>API cost per report run: ~1p</strong>
          {" "}(approx. £0.52/yr weekly · £0.12/yr monthly) · uses Claude Sonnet · ~1,700 tokens per call
        </span>
        {periodLabel && periodLabel !== "No data" && (
          <span style={{fontSize:11,fontWeight:700,color:T.sky,
            background:"#dbeeff",padding:"2px 9px",borderRadius:10,flexShrink:0}}>
            📅 {periodLabel}
          </span>
        )}
      </div>

      {/* ── OVERVIEW VIEW ─────────────────────────────────────────────────── */}
      {activeView === "overview" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Stat cards */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <StatCard label="Peak Weekly Output"
              value={ins.peakUnits}
              sub={`Week of ${ins.dateLabels[ins.peakWeek]}`}
              color={T.sky}/>
            <StatCard label="Recent Average"
              value={ins.recentProdAvg}
              sub="units/week (last 7 weeks)"
              color={T.sky}/>
            <StatCard label="Volume Change"
              value={(prodChg > 0 ? "+" : "") + (prodChg ?? "—") + (prodChg !== null ? "%" : "")}
              sub="early period vs recent"
              color={prodChgColor}/>
            <StatCard label="Active Accounts"
              value={ins.totalCustomers}
              sub={`Top 1 = ${ins.concentration.top1}% of volume`}
              color={T.purple}/>
            <StatCard label="Lost Accounts"
              value={ins.lostAccounts.length}
              sub={ins.lostAccounts.length > 0
                ? `~${Math.round(ins.lostAccounts.reduce((s,c)=>s+c.earlyAvg,0))}/wk lost`
                : "none identified"}
              color={ins.lostAccounts.length > 0 ? T.rust : T.green}/>
            <StatCard label="Growing Accounts"
              value={ins.growingAccounts.length}
              sub={ins.growingAccounts.length > 0
                ? `+${Math.round(ins.growingAccounts.reduce((s,c)=>s+(c.recentAvg-c.earlyAvg),0))}/wk added`
                : "none >15% growth"}
              color={T.green}/>
          </div>

          {/* Production chart */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,
            padding:"16px 20px"}}>
            <div style={{fontSize:12,fontWeight:700,color:T.textMain,marginBottom:12}}>
              Weekly Production Volume
              {ins.isPlateaued && (
                <Pill label="PLATEAU DETECTED" color="#7c5cbf" bg="#f0eaf8"/>
              )}
            </div>
            <ProdChart labels={ins.dateLabels} data={ins.weeklyProduction}/>
          </div>

          {/* Two-column: top accounts + lost/growing */}
          <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>

            {/* Top 10 accounts */}
            <div style={{flex:"2 1 320px",background:T.surface,border:`1px solid ${T.border}`,
              borderRadius:10,padding:"16px 20px"}}>
              <div style={{fontSize:12,fontWeight:700,color:T.textMain,marginBottom:10}}>
                Top 10 Accounts
                <span style={{fontSize:10,fontWeight:400,color:T.textSub,marginLeft:8}}>
                  sorted by total volume · sparkline = weekly trend
                </span>
              </div>
              {ins.top10.map((c,i) => <AccountRow key={c.name} c={c} rank={i+1}/>)}
            </div>

            {/* Lost + growing panels */}
            <div style={{flex:"1 1 240px",display:"flex",flexDirection:"column",gap:14}}>

              {/* Lost accounts */}
              <div style={{background:T.surface,border:`1px solid ${T.border}`,
                borderRadius:10,padding:"16px 20px"}}>
                <div style={{fontSize:12,fontWeight:700,color:T.textMain,marginBottom:8}}>
                  🔴 Confirmed Lost
                </div>
                {ins.lostAccounts.length === 0
                  ? <div style={{fontSize:12,color:T.textSub}}>No accounts confirmed lost.</div>
                  : ins.lostAccounts.map(c => (
                    <div key={c.name} style={{display:"flex",justifyContent:"space-between",
                      alignItems:"baseline",padding:"4px 0",
                      borderBottom:`1px solid ${T.border}`}}>
                      <div style={{fontSize:12,color:T.textMain,flex:1,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        marginRight:8}}>{c.name}</div>
                      <div style={{fontSize:11,color:T.rust,flexShrink:0,fontWeight:700}}>
                        was {Math.round(c.earlyAvg)}/wk
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* Declining (not yet zero) */}
              {ins.decliningAccounts.length > 0 && (
                <div style={{background:T.surface,border:`1px solid ${T.border}`,
                  borderRadius:10,padding:"16px 20px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.textMain,marginBottom:8}}>
                    🟡 Declining
                  </div>
                  {ins.decliningAccounts.map(c => (
                    <div key={c.name} style={{display:"flex",justifyContent:"space-between",
                      alignItems:"baseline",padding:"4px 0",
                      borderBottom:`1px solid ${T.border}`}}>
                      <div style={{fontSize:12,color:T.textMain,flex:1,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        marginRight:8}}>{c.name}</div>
                      <div style={{fontSize:11,color:T.amber,flexShrink:0,fontWeight:700}}>
                        {Math.round(c.trend)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Growing accounts */}
              <div style={{background:T.surface,border:`1px solid ${T.border}`,
                borderRadius:10,padding:"16px 20px"}}>
                <div style={{fontSize:12,fontWeight:700,color:T.textMain,marginBottom:8}}>
                  🟢 Growing
                </div>
                {ins.growingAccounts.length === 0
                  ? <div style={{fontSize:12,color:T.textSub}}>No accounts with >15% growth.</div>
                  : ins.growingAccounts.map(c => (
                    <div key={c.name} style={{display:"flex",justifyContent:"space-between",
                      alignItems:"baseline",padding:"4px 0",
                      borderBottom:`1px solid ${T.border}`}}>
                      <div style={{fontSize:12,color:T.textMain,flex:1,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        marginRight:8}}>{c.name}</div>
                      <div style={{fontSize:11,color:T.green,flexShrink:0,fontWeight:700}}>
                        +{Math.round(c.trend)}%
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* Concentration */}
              <div style={{background:T.surface,border:`1px solid ${T.border}`,
                borderRadius:10,padding:"16px 20px"}}>
                <div style={{fontSize:12,fontWeight:700,color:T.textMain,marginBottom:10}}>
                  Concentration
                </div>
                {[
                  ["Top 1", ins.concentration.top1 + "%", ins.top10[0]?.name],
                  ["Top 5", ins.concentration.top5 + "%", "of total volume"],
                  ["Top 10", ins.concentration.top10 + "%", "of total volume"],
                ].map(([lbl, val, sub]) => (
                  <div key={lbl} style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${T.border}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:T.textSub}}>{lbl}</div>
                    <div style={{fontSize:12,fontWeight:800,color:T.sky}}>{val}</div>
                    <div style={{fontSize:10,color:T.textSub,maxWidth:100,textAlign:"right",
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── AI REPORT VIEW ────────────────────────────────────────────────── */}
      {activeView === "report" && (
        <div>
          {loading && (
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,
              padding:"40px 24px",textAlign:"center",color:T.textSub}}>
              <div style={{fontSize:28,marginBottom:10}}>⏳</div>
              <div style={{fontSize:13,fontWeight:600}}>Analysing your data…</div>
              <div style={{fontSize:11,marginTop:4}}>Claude is reading your harvest sheets and generating insights.</div>
            </div>
          )}
          {error && (
            <div style={{background:"#fef2f2",border:`1px solid #fca5a5`,borderRadius:10,
              padding:"16px 20px",color:T.rust,fontSize:13}}>
              {error}
            </div>
          )}
          {aiReport && <ReportRenderer text={aiReport}/>}
          {!loading && !aiReport && !error && (
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,
              padding:"40px 24px",textAlign:"center",color:T.textSub}}>
              <div style={{fontSize:28,marginBottom:10}}>✨</div>
              <div style={{fontSize:13,fontWeight:600}}>Click "Generate AI Insights" to produce your report</div>
              <div style={{fontSize:11,marginTop:4}}>
                Claude will analyse your {ins.totalWeeks} weeks of data across {ins.totalCustomers} accounts.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
