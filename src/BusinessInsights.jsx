import React, { useState, useMemo, useCallback } from "react";
import { useReportingSheets } from "./reportingContext.js";

const T = {
  sky:"#3e7da1", green:"#86b955", amber:"#d4890a", rust:"#c0432b",
  purple:"#7c5cbf", teal:"#2a9d8f",
  bg:"#f4f6f8", surface:"#ffffff", border:"#e2e8ed",
  textMain:"#1a2e3b", textSub:"#5a7080", sidebar:"#0f2535",
};

// ── ISO week key ──────────────────────────────────────────────────────────────
function isoWeekKey(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - ((d.getDay()+6)%7));
  const jan4 = new Date(d.getFullYear(),0,4);
  const wk = 1 + Math.round(((d-jan4)/86400000 - 3 + ((jan4.getDay()+6)%7))/7);
  return `${d.getFullYear()}-W${String(wk).padStart(2,'0')}`;
}

function mondayLabel(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day===0?6:day-1));
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}

// ── WEEK-AWARE analytics engine ───────────────────────────────────────────────
function computeInsights(sheets) {
  if (!sheets || sheets.length === 0) return null;
  const sorted = [...sheets].filter(s=>s.date).sort((a,b)=>a.date-b.date);
  if (!sorted.length) return null;

  // Group individual sheets into calendar weeks
  const weekMap = {};
  for (const s of sorted) {
    const wk = isoWeekKey(s.date);
    if (!weekMap[wk]) weekMap[wk] = { sheets:[], earliest: s.date };
    weekMap[wk].sheets.push(s);
    if (s.date < weekMap[wk].earliest) weekMap[wk].earliest = s.date;
  }
  const weekKeys  = Object.keys(weekMap).sort();
  const totalWeeks = weekKeys.length;
  const weekLabels = weekKeys.map(wk => mondayLabel(weekMap[wk].earliest));

  // Weekly production (units) — one value per calendar week
  const weeklyProduction = weekKeys.map(wk =>
    weekMap[wk].sheets.reduce((sum,s) => {
      if (s.cropRows?.length > 0) return sum + s.cropRows.reduce((a,r)=>a+r.units,0);
      return sum + Object.values(s.customerOrders||{})
        .reduce((a,prods)=>a+Object.values(prods).reduce((b,v)=>b+v,0),0);
    },0)
  );

  // Per-customer WEEKLY volumes (Wed + Fri merged per week)
  const customerWeekly = {};
  weekKeys.forEach((wk,wi) => {
    for (const s of weekMap[wk].sheets) {
      for (const [cust,prods] of Object.entries(s.customerOrders||{})) {
        if (!customerWeekly[cust]) customerWeekly[cust] = Array(totalWeeks).fill(0);
        customerWeekly[cust][wi] += Object.values(prods).reduce((a,b)=>a+b,0);
      }
    }
  });
  for (const arr of Object.values(customerWeekly))
    while (arr.length < totalWeeks) arr.push(0);

  // Trend thresholds
  // earlyStart/earlyEnd: skip first 3 weeks (Jan spike / Dine Out Vancouver anomaly)
  // and use weeks 4-7 as the stable baseline — avoids measuring vs an exceptional period
  const recentCutoff = Math.max(0, totalWeeks - 7);
  const earlyStart   = totalWeeks > 7 ? 3 : 0;
  const earlyEnd     = totalWeeks > 7 ? Math.min(7, totalWeeks) : Math.min(3, totalWeeks);

  const customerStats = Object.entries(customerWeekly).map(([name,weekly]) => {
    const totalUnits  = weekly.reduce((a,b)=>a+b,0);
    const activeWeeks = weekly.filter(v=>v>0).length;
    const earlySlice  = weekly.slice(earlyStart, earlyEnd);
    const earlyAvg    = earlySlice.reduce((a,b)=>a+b,0)/Math.max(earlySlice.length,1);
    const recentSlice = weekly.slice(recentCutoff);
    const recentAvg   = recentSlice.reduce((a,b)=>a+b,0)/Math.max(recentSlice.length,1);
    const lastActive  = weekly.map((v,i)=>[v,i]).filter(([v])=>v>0).pop();
    const lastOrderWk = lastActive ? lastActive[1] : -1;
    const isDormant   = lastOrderWk>=0 && lastOrderWk<recentCutoff &&
                        weekly.slice(recentCutoff).every(v=>v===0);
    const trend       = earlyAvg>0 ? ((recentAvg-earlyAvg)/earlyAvg)*100 : null;
    return {name,weekly,totalUnits,activeWeeks,earlyAvg,recentAvg,trend,isDormant,lastOrderWk};
  }).filter(c=>c.totalUnits>0).sort((a,b)=>b.totalUnits-a.totalUnits);

  const totalAllUnits = customerStats.reduce((a,c)=>a+c.totalUnits,0);

  const dormantAccounts  = customerStats.filter(c=>c.isDormant && c.earlyAvg>=5);
  const growingAccounts  = customerStats.filter(c=>!c.isDormant && c.trend!==null && c.trend>=15 && c.recentAvg>=4 && c.activeWeeks>=5);
  const decliningAccounts= customerStats.filter(c=>!c.isDormant && c.trend!==null && c.trend<=-25 && c.earlyAvg>=8 && c.recentAvg<c.earlyAvg*0.75);
  const top10            = customerStats.slice(0,10);

  const top1pct  = totalAllUnits>0?(top10[0]?.totalUnits/totalAllUnits*100).toFixed(1):0;
  const top5pct  = totalAllUnits>0?(top10.slice(0,5).reduce((s,c)=>s+c.totalUnits,0)/totalAllUnits*100).toFixed(1):0;
  const top10pct = totalAllUnits>0?(top10.reduce((s,c)=>s+c.totalUnits,0)/totalAllUnits*100).toFixed(1):0;

  const peakWeek    = weeklyProduction.indexOf(Math.max(...weeklyProduction));
  const recentProd  = weeklyProduction.slice(recentCutoff);
  const recentProdAvg = recentProd.reduce((a,b)=>a+b,0)/Math.max(recentProd.length,1);
  const earlyProd     = weeklyProduction.slice(earlyStart, earlyEnd);
  const earlyProdAvg  = earlyProd.reduce((a,b)=>a+b,0)/Math.max(earlyProd.length,1);
  const rpCV = recentProdAvg>0
    ? Math.sqrt(recentProd.reduce((s,v)=>s+(v-recentProdAvg)**2,0)/recentProd.length)/recentProdAvg : 0;

  return {
    dateRange:{ from:sorted[0].date, to:sorted[sorted.length-1].date },
    weekLabels, weeklyProduction, totalWeeks,
    peakWeek, peakUnits:Math.max(...weeklyProduction),
    recentProdAvg:Math.round(recentProdAvg),
    earlyProdAvg:Math.round(earlyProdAvg),
    prodChangePct:earlyProdAvg>0?Math.round((recentProdAvg-earlyProdAvg)/earlyProdAvg*100):null,
    isPlateaued:rpCV<0.08 && recentProd.length>=5,
    customerStats, dormantAccounts, growingAccounts, decliningAccounts,
    top10, totalAllUnits,
    concentration:{top1:top1pct,top5:top5pct,top10:top10pct},
    totalCustomers:customerStats.length,
  };
}

// ── AI prompt builder ─────────────────────────────────────────────────────────
function buildPrompt(ins, periodLabel) {
  const fmt = d => d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  const custTable = ins.top10.map((c,i) =>
    `${i+1}. ${c.name}: ${Math.round(c.recentAvg)}/wk recent (was ${Math.round(c.earlyAvg)}/wk early, trend ${c.trend!==null?(c.trend>0?'+':'')+Math.round(c.trend)+'%':'n/a'})`
  ).join('\n');
  const dormantList = ins.dormantAccounts.length>0
    ? ins.dormantAccounts.map(c=>`- ${c.name}: was ${Math.round(c.earlyAvg)}/wk, now zero for 7+ weeks`).join('\n')
    : 'None identified.';
  const growingList = ins.growingAccounts.length>0
    ? ins.growingAccounts.map(c=>`- ${c.name}: ${Math.round(c.earlyAvg)}/wk → ${Math.round(c.recentAvg)}/wk (+${Math.round(c.trend)}%)`).join('\n')
    : 'None with >15% growth.';
  const decliningList = ins.decliningAccounts.length>0
    ? ins.decliningAccounts.map(c=>`- ${c.name}: ${Math.round(c.earlyAvg)}/wk → ${Math.round(c.recentAvg)}/wk (${Math.round(c.trend)}%)`).join('\n')
    : 'None with >25% decline.';
  const weeklyProd = ins.weekLabels.map((l,i)=>`${l}: ${ins.weeklyProduction[i]}`).join(', ');

  return `You are analysing operational data for SkyHarvest, a Vancouver microgreens business supplying fine-dining restaurants, hotels, and retail grocers.

PERIOD: ${periodLabel || fmt(ins.dateRange.from)+' to '+fmt(ins.dateRange.to)} (${ins.totalWeeks} calendar weeks of combined Wed+Fri data)

WEEKLY PRODUCTION (combined Wed+Fri units):
${weeklyProd}

PRODUCTION STATS:
- Peak week: ${ins.weekLabels[ins.peakWeek]} at ${ins.peakUnits} units
- Early-period average (first 3 weeks): ${ins.earlyProdAvg} units/week
- Recent average (last 7 weeks): ${ins.recentProdAvg} units/week
- Overall change: ${ins.prodChangePct!==null?(ins.prodChangePct>0?'+':'')+ins.prodChangePct+'%':'n/a'}
- Production plateau: ${ins.isPlateaued?'YES — last 7 weeks show <8% variation':'No — volume still moving'}

TOP 10 ACCOUNTS (by total volume):
${custTable}

CONCENTRATION:
- Top account: ${ins.concentration.top1}% of all volume
- Top 5: ${ins.concentration.top5}% · Top 10: ${ins.concentration.top10}%
- Total active accounts: ${ins.totalCustomers}

DORMANT ACCOUNTS (had meaningful orders, now zero 7+ weeks):
${dormantList}

GROWING ACCOUNTS (>15% increase, early vs recent):
${growingList}

DECLINING ACCOUNTS (>25% reduction, not yet zero):
${decliningList}

---

Write a business insights narrative for SkyHarvest's management team. Write in the style of a senior analyst presenting findings to a business owner — direct, evidence-based, specific numbers throughout, no hedging language, no bullet lists except in Recommended Actions.

Structure exactly as follows:

## This report covers
One sentence naming the exact period and data source.

## Production Trend
What is the overall volume trajectory? Explain the peak-to-recent shift clearly. If there is a plateau, name it and quantify it. What does this tell us about supply capacity or demand?

## Account Health
Work through the data systematically: name the dormant accounts and their combined lost volume. Name the declining accounts and what the trend means. Name the growing accounts and what momentum exists. Be specific — use actual account names and numbers throughout.

## Concentration & Risk
Is the business dangerously dependent on any single account or group? What does the tail look like? What is the revenue risk if the top account were lost?

## Recommended Actions
Three to five numbered, specific actions derivable directly from this data. One sentence each. No vague strategy.

UK English. Never say "it is worth noting" or "it is important to". Lead every section with the most important finding.`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Spark({ data, color=T.sky, height=28, width=80 }) {
  if (!data || data.length<2) return null;
  const max = Math.max(...data,1);
  const pts = data.map((v,i)=>`${((i/(data.length-1))*width).toFixed(1)},${(height-(v/max)*height).toFixed(1)}`).join(' ');
  return <svg width={width} height={height} style={{display:'block'}}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

function StatCard({ label, value, sub, color=T.sky }) {
  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,
      padding:'14px 18px',minWidth:130,flex:'1 1 130px'}}>
      <div style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:'uppercase',
        letterSpacing:'0.06em',marginBottom:6}}>{label}</div>
      <div style={{fontSize:26,fontWeight:900,color,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11,color:T.textSub,marginTop:4}}>{sub}</div>}
    </div>
  );
}

function AccountRow({ c, rank }) {
  const col = c.trend===null?T.textSub:c.trend>15?T.green:c.trend<-25?T.rust:T.amber;
  const lbl = c.trend===null?'—':(c.trend>0?'+':'')+Math.round(c.trend)+'%';
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:`1px solid ${T.border}`}}>
      <div style={{width:20,fontSize:11,fontWeight:700,color:T.textSub,textAlign:'right',flexShrink:0}}>{rank}</div>
      <div style={{flex:1,fontSize:12,fontWeight:600,color:T.textMain,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
      <Spark data={c.weekly} color={col} width={60} height={20}/>
      <div style={{width:44,fontSize:11,fontWeight:700,color:col,textAlign:'right',flexShrink:0}}>{lbl}</div>
      <div style={{width:52,fontSize:12,fontWeight:700,color:T.textMain,textAlign:'right',flexShrink:0}}>
        {Math.round(c.recentAvg)}<span style={{fontSize:10,fontWeight:400,color:T.textSub}}>/wk</span>
      </div>
    </div>
  );
}

function ProdChart({ labels, data }) {
  const max = Math.max(...data,1);
  const n = data.length;
  const barW = Math.max(8, Math.floor(540/n)-3);
  return (
    <div style={{overflowX:'auto'}}>
      <div style={{display:'flex',alignItems:'flex-end',gap:3,height:80,padding:'0 4px',minWidth:n*(barW+3)}}>
        {data.map((v,i)=>(
          <div key={i} title={`${labels[i]}: ${v} units`}
            style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,flex:'0 0 auto'}}>
            <div style={{width:barW,height:Math.max(2,(v/max)*72),borderRadius:'3px 3px 0 0',
              background:i>=n-7?T.sky:'#c8dce8'}}/>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:3,padding:'3px 4px',minWidth:n*(barW+3)}}>
        {labels.map((l,i)=>{
          const p = l.split(' ');
          return <div key={i} style={{width:barW,fontSize:8,color:T.textSub,textAlign:'center',lineHeight:1.2,flex:'0 0 auto',overflow:'hidden'}}>
            {p[0]}<br/>{p[1]||''}
          </div>;
        })}
      </div>
      <div style={{display:'flex',gap:12,marginTop:6,fontSize:10,color:T.textSub}}>
        <span><span style={{color:T.sky}}>■</span> Last 7 weeks</span>
        <span><span style={{color:'#c8dce8'}}>■</span> Earlier weeks</span>
      </div>
    </div>
  );
}

function SidePanel({ icon, title, explanation, items, valueKey='earlyAvg', valueLabel='was', color, emptyText }) {
  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 18px'}}>
      <div style={{fontSize:12,fontWeight:700,color:T.textMain,marginBottom:3}}>
        {icon} {title}
      </div>
      <div style={{fontSize:11,color:T.textSub,marginBottom:10,lineHeight:1.5,
        paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
        {explanation}
      </div>
      {items.length===0
        ? <div style={{fontSize:12,color:T.textSub,fontStyle:'italic'}}>{emptyText}</div>
        : items.map(c=>(
          <div key={c.name} style={{display:'flex',justifyContent:'space-between',
            alignItems:'baseline',padding:'4px 0',borderBottom:`1px solid #f4f6f8`}}>
            <div style={{fontSize:12,color:T.textMain,flex:1,overflow:'hidden',
              textOverflow:'ellipsis',whiteSpace:'nowrap',marginRight:8}}>{c.name}</div>
            <div style={{fontSize:11,color,flexShrink:0,fontWeight:700}}>
              {valueKey==='earlyAvg'
                ? `${valueLabel} ${Math.round(c.earlyAvg)}/wk`
                : valueKey==='trend'
                ? (c.trend>0?'+':'')+Math.round(c.trend)+'%'
                : ''}
            </div>
          </div>
        ))
      }
    </div>
  );
}

function ReportRenderer({ text }) {
  if (!text) return null;
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {text.split(/^## /m).filter(Boolean).map((sec,i)=>{
        const [heading,...body] = sec.split('\n');
        const paras = body.join('\n').trim().split(/\n\n+/).filter(Boolean);
        return (
          <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,
            borderRadius:10,padding:'16px 20px'}}>
            <h3 style={{margin:'0 0 10px',fontSize:14,fontWeight:800,color:T.sidebar,
              borderBottom:`2px solid ${T.sky}`,paddingBottom:6}}>{heading.trim()}</h3>
            {paras.map((p,j)=>{
              if (p.startsWith('- ')||p.startsWith('* ')||/^\d+\./.test(p.trim())) {
                return <ul key={j} style={{margin:'6px 0',paddingLeft:18}}>
                  {p.split('\n').map(l=>l.replace(/^[-*\d.]\s*/,'').trim()).filter(Boolean).map((item,k)=>(
                    <li key={k} style={{fontSize:13,color:T.textMain,lineHeight:1.6,marginBottom:4}}>{item}</li>
                  ))}
                </ul>;
              }
              return <p key={j} style={{margin:'0 0 8px',fontSize:13,color:T.textMain,lineHeight:1.65}}>{p}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BusinessInsights({ sheets }) {
  const [aiReport, setAiReport] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [elapsed, setElapsed]   = useState(0);

  const { periodLabel='' } = (() => { try { return useReportingSheets(); } catch(e) { return {}; } })();

  // Elapsed timer — resets on each generate call
  React.useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    setElapsed(0);
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const ins = useMemo(()=>{ try { return computeInsights(sheets); } catch(e){ console.error(e); return null; } },[sheets]);

  const generateReport = useCallback(async()=>{
    if (!ins) return;
    setLoading(true); setError(''); setAiReport('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);
    try {
      const res = await fetch('/.netlify/functions/generate-insights',{
        method:'POST',
        signal: controller.signal,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ prompt: buildPrompt(ins,periodLabel) })
      });
      if (!res.ok) throw new Error(`Server error ${res.status} — check Netlify function logs`);
      const data = await res.json();
      if (data.error) throw new Error(typeof data.error==='string' ? data.error : JSON.stringify(data.error));
      const text = data.content?.filter(b=>b.type==='text').map(b=>b.text).join('\n') || '';
      if (!text) throw new Error('Empty response received — try again');
      setAiReport(text);
    } catch(e) {
      setError(e.name==='AbortError'
        ? 'Request timed out after 50 seconds — check your connection and try again'
        : 'Error: ' + e.message);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  },[ins,periodLabel]);

  if (!sheets||sheets.length===0) return (
    <div style={{textAlign:'center',padding:'60px 20px',color:T.textSub}}>
      <div style={{fontSize:36,marginBottom:8}}>📊</div>
      <div style={{fontSize:14,fontWeight:600,color:T.textMain}}>No data loaded</div>
      <div style={{fontSize:12,marginTop:4}}>Upload harvest sheets in the Reporting tab to see Business Insights.</div>
    </div>
  );
  if (!ins) return <div style={{padding:24,color:T.rust,fontSize:13}}>Could not compute insights from this data.</div>;

  const fmtDate = d=>d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  const prodChg = ins.prodChangePct;
  const prodChgColor = prodChg===null?T.textSub:prodChg>0?T.green:T.rust;

  return (
    <div style={{padding:'0 0 32px'}}>

      {/* Header */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,
        padding:'14px 20px',marginBottom:12,display:'flex',alignItems:'center',
        justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontSize:15,fontWeight:800,color:T.sidebar}}>Business Insights</div>
          <div style={{fontSize:11,color:T.textSub,marginTop:2}}>
            {fmtDate(ins.dateRange.from)} → {fmtDate(ins.dateRange.to)}
            {' · '}{ins.totalWeeks} weeks · {ins.totalCustomers} active accounts
            {ins.weeklyProduction.some((_,i,a)=>i>0)?` · Wed+Fri combined`:''}
          </div>
        </div>
        <button onClick={generateReport} disabled={loading}
          style={{padding:'7px 16px',fontSize:12,fontWeight:700,border:'none',
            borderRadius:8,cursor:loading?'wait':'pointer',
            background:loading?'#c8dce8':T.green,color:'#fff'}}>
          {loading?'⏳ Generating…':'✨ Generate AI Insights'}
        </button>
      </div>

      {/* Cost note + period pill */}
      <div style={{background:'#f0f6fb',border:'1px solid #d0e4f0',borderRadius:8,
        padding:'7px 14px',marginBottom:14,display:'flex',alignItems:'center',
        justifyContent:'space-between',flexWrap:'wrap',gap:6}}>
        <span style={{fontSize:11,color:T.textSub}}>
          <strong style={{color:T.sky}}>AI report cost: ~1p per run</strong>
          {' '}(£0.52/yr weekly · £0.12/yr monthly) · Claude Sonnet · ~1,700 tokens
        </span>
        {periodLabel&&periodLabel!=='No data'&&(
          <span style={{fontSize:11,fontWeight:700,color:T.sky,
            background:'#dbeeff',padding:'2px 9px',borderRadius:10,flexShrink:0}}>
            📅 {periodLabel}
          </span>
        )}
      </div>

      {/* Overview — always visible */}
      <div style={{display:'flex',flexDirection:'column',gap:14}}>

          {/* Stat cards */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <StatCard label="Peak Weekly Output" value={ins.peakUnits}
              sub={`Week of ${ins.weekLabels[ins.peakWeek]}`} color={T.sky}/>
            <StatCard label="Recent Average" value={ins.recentProdAvg}
              sub="units/week (last 7 weeks)" color={T.sky}/>
            <StatCard label="Volume Change"
              value={(prodChg>0?'+':'')+(prodChg??'—')+(prodChg!==null?'%':'')}
              sub="early period vs recent" color={prodChgColor}/>
            <StatCard label="Active Accounts" value={ins.totalCustomers}
              sub={`Top 1 = ${ins.concentration.top1}% of volume`} color={T.purple}/>
            <StatCard label="Dormant Accounts" value={ins.dormantAccounts.length}
              sub={ins.dormantAccounts.length>0
                ?`~${Math.round(ins.dormantAccounts.reduce((s,c)=>s+c.earlyAvg,0))}/wk lost`
                :'none identified'}
              color={ins.dormantAccounts.length>0?T.rust:T.green}/>
            <StatCard label="Growing Accounts" value={ins.growingAccounts.length}
              sub={ins.growingAccounts.length>0
                ?`+${Math.round(ins.growingAccounts.reduce((s,c)=>s+(c.recentAvg-c.earlyAvg),0))}/wk added`
                :'none >15% growth'}
              color={T.green}/>
          </div>

          {/* Production chart */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 20px'}}>
            <div style={{fontSize:12,fontWeight:700,color:T.textMain,marginBottom:12}}>
              Weekly Production Volume (combined Wed + Fri)
              {ins.isPlateaued&&<span style={{marginLeft:8,fontSize:10,fontWeight:700,
                color:'#7c5cbf',background:'#f0eaf8',padding:'2px 7px',borderRadius:8}}>PLATEAU</span>}
            </div>
            <ProdChart labels={ins.weekLabels} data={ins.weeklyProduction}/>
          </div>

          {/* Two-column: top accounts + 4 panels */}
          <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>

            {/* Top 10 accounts */}
            <div style={{flex:'2 1 320px',background:T.surface,border:`1px solid ${T.border}`,
              borderRadius:10,padding:'16px 20px'}}>
              <div style={{fontSize:12,fontWeight:700,color:T.textMain,marginBottom:4}}>
                Top 10 Accounts
              </div>
              <div style={{fontSize:11,color:T.textSub,marginBottom:10,lineHeight:1.5,
                paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                Sparkline = weekly order volume (oldest → newest). Trend % compares the last 7 weeks against weeks 4–7 as a stable baseline, skipping January which was elevated by Dine Out Vancouver. Colour: <span style={{color:T.green,fontWeight:700}}>green</span> = growing &gt;15%, <span style={{color:T.rust,fontWeight:700}}>red</span> = declining &gt;25%, <span style={{color:T.amber,fontWeight:700}}>amber</span> = in between.
              </div>
              {ins.top10.map((c,i)=><AccountRow key={c.name} c={c} rank={i+1}/>)}
              {/* Narrative — generated inline below accounts */}
              {(loading || error || aiReport) && (
                <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
                  {loading&&(
                    <div style={{padding:'16px 0'}}>
                      {/* Progress bar */}
                      <div style={{height:4,background:'#e2e8ed',borderRadius:4,overflow:'hidden',marginBottom:14}}>
                        <div style={{
                          height:'100%',
                          borderRadius:4,
                          background: elapsed > 45 ? T.amber : T.sky,
                          width: `${Math.min(92, elapsed < 20 ? (elapsed/20)*75 : 75 + ((elapsed-20)/25)*17)}%`,
                          transition:'width 1s linear, background 0.3s'
                        }}/>
                      </div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{fontSize:12,color:T.textSub}}>
                          {elapsed < 10  && <span>Analysing account data…</span>}
                          {elapsed >= 10 && elapsed < 20 && <span>Building narrative…</span>}
                          {elapsed >= 20 && elapsed < 35 && <span>Almost there…</span>}
                          {elapsed >= 35 && elapsed < 50 && <span style={{color:T.amber}}>Taking longer than usual — still running</span>}
                          {elapsed >= 50 && <span style={{color:T.rust}}>Still waiting — if this stalls, click Generate again</span>}
                        </div>
                        <div style={{fontSize:11,fontWeight:700,color:elapsed>45?T.amber:T.textSub,
                          background:'#f4f6f8',padding:'2px 8px',borderRadius:6,flexShrink:0}}>
                          {elapsed}s
                        </div>
                      </div>
                    </div>
                  )}
                  {error&&<div style={{background:'#fef2f2',border:`1px solid #fca5a5`,
                    borderRadius:8,padding:'12px 16px',color:T.rust,fontSize:12}}>{error}</div>}
                  {aiReport&&<ReportRenderer text={aiReport}/>}
                </div>
              )}
            </div>

            {/* Right panels — order: Concentration, Growing, Declining, Dormant */}
            <div style={{flex:'1 1 240px',display:'flex',flexDirection:'column',gap:12}}>

              {/* Concentration */}
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 18px'}}>
                <div style={{fontSize:12,fontWeight:700,color:T.textMain,marginBottom:3}}>📊 Concentration</div>
                <div style={{fontSize:11,color:T.textSub,marginBottom:10,lineHeight:1.5,
                  paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                  How dependent the business is on its largest accounts. High concentration means significant revenue risk if a key account reduces or leaves.
                </div>
                {[
                  ['Top 1', ins.concentration.top1+'%', ins.top10[0]?.name||''],
                  ['Top 5', ins.concentration.top5+'%', 'of total volume'],
                  ['Top 10',ins.concentration.top10+'%','of total volume'],
                ].map(([lbl,val,sub])=>(
                  <div key={lbl} style={{display:'flex',justifyContent:'space-between',
                    alignItems:'center',padding:'5px 0',borderBottom:`1px solid #f4f6f8`}}>
                    <div style={{fontSize:11,fontWeight:700,color:T.textSub}}>{lbl}</div>
                    <div style={{fontSize:13,fontWeight:800,color:T.sky}}>{val}</div>
                    <div style={{fontSize:10,color:T.textSub,maxWidth:110,textAlign:'right',
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Growing */}
              <SidePanel icon="🟢" title="Growing"
                explanation="Active accounts whose recent 7-week average is more than 15% above their early baseline. Genuine demand momentum worth protecting and building on."
                items={ins.growingAccounts} valueKey="trend" color={T.green}
                emptyText="No accounts showing >15% growth."/>

              {/* Declining */}
              <SidePanel icon="🟡" title="Declining"
                explanation="Active accounts whose recent volume is more than 25% below their early baseline but still ordering. Each one is a retention risk — the trend matters more than the current volume."
                items={ins.decliningAccounts} valueKey="trend" color={T.amber}
                emptyText="No accounts with >25% decline."/>

              {/* Dormant */}
              <SidePanel icon="🔴" title="Dormant"
                explanation="Accounts with meaningful order history that have placed no orders in the last 7 weeks. Not confirmed lost — could be seasonal, a chef change, or a service issue — but each needs a direct conversation."
                items={ins.dormantAccounts} valueKey="earlyAvg" valueLabel="was" color={T.rust}
                emptyText="No dormant accounts identified."/>

            </div>
          </div>
        </div>
    </div>
  );
}
