import { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

const T = {
  sky:"#3e7da1",green:"#86b955",amber:"#d4890a",rust:"#c0432b",
  bg:"#f4f6f8",surface:"#ffffff",border:"#e2e8ed",textMain:"#1a2e3b",textSub:"#5a7080",
};

// ── Parse engine ─────────────────────────────────────────────────────────────
const SKIP = [/WEIGHT NEEDED/i,/NON-RADISH WEIGHT/i,/RADISH WEIGHT FOR BOOST/i,
  /^Approx\s/i,/^Total Sunflower/i,/^Total Pea/i,/^TOTAL\s/i,
  /^Gourmet Garnish/i,/^#REF/i,/^Check\s/i];

// ── Crop naming rules (from Sky Harvest spec) ──────────────────────────────
// These must be applied BEFORE any grouping or decomposition
const RENAME_MAP = {
  "Sky Hearts":       "Red Veined Sorrel",
  "Baby Sky Hearts":  "Red Veined Sorrel",
  "Purple Cabbage":   "Purple Kohlrabi",
};

// Shiso sub-classification (by product name keyword)
function classifyShiso(name) {
  const n = name.toLowerCase();
  if (n.includes("britton"))  return "Britton Shiso";
  if (n.includes("purple"))   return "Purple Perilla";
  if (n.includes("green"))    return "Green Perilla";
  return "Shiso"; // fallback if no variant specified
}

// Basil sub-classification
function classifyBasil(name) {
  const n = name.toLowerCase();
  if (n.includes("purple") || n.includes("dark opal")) return "Purple Basil";
  if (n.includes("thai") || n.includes("anise"))       return "Thai Basil";
  return "Green Basil"; // default
}

// True mixes — decompose into component crops
const MIX_SPLITS = {
  "Mellow Mix":   {"Broccoli":0.45,"Purple Kohlrabi":0.45,"Beets":0.10},
  "Spicy Mix":    {"Mustard":0.80,"Purple Kohlrabi":0.20},
  "Radish Blend": {"Radish":1.00},
  "Salad Boost":  {"Radish":0.70,"Arugula":0.09,"Broccoli":0.21},
  "Peppercress (70%) & Beet (30%) blend": {"Peppercress":0.70,"Beets":0.30},
};

// Fixed blends — report as-is, do NOT decompose
const FIXED_BLENDS = new Set(["Brilliant Blend","Haute Blend","Violet Mosaic"]);


function getMixFamily(n){
  // Fixed blends are never decomposed
  for(const fb of FIXED_BLENDS) if(n.startsWith(fb)) return null;
  for(const p of Object.keys(MIX_SPLITS)) if(n.startsWith(p)) return p;
  return null;
}

function getProductFamily(rawName){
  if(!rawName)return null;
  let n=rawName.trim()
    .replace(/\s*(SPUD Label|SPUD 100g bag|1 lb bag|RETAIL)\s*/gi," ")
    .replace(/\s*\((XS|S|M|L|XL)\)\s*$/,"")
    .replace(/\s*-\s*LABEL:.*$/i,"")    // strip label suffixes
    .replace(/\s*-\s*\d+\.\d+.*$/,"") // strip dimension suffixes
    .trim();

  // Fixed blends — keep as-is
  for(const fb of FIXED_BLENDS){
    if(n.startsWith(fb)) return fb;
  }
  // Apply rename map
  for(const[from,to]of Object.entries(RENAME_MAP)){
    if(n.toLowerCase().startsWith(from.toLowerCase())) return to;
  }
  // Shiso sub-types
  if(/^Shiso/i.test(n)) return classifyShiso(n);
  // Basil sub-types
  if(/^Basil/i.test(n)||/^Baby Basil/i.test(n)||/^Mini Micro Basil/i.test(n)) return classifyBasil(n);
  if(/^Thai Basil/i.test(n)) return "Thai Basil";
  // Other groupings
  if(/^Cilantro/i.test(n))        return "Cilantro";
  if(/^Sunflower Shoots/i.test(n))return "Sunflower Shoots";
  if(/^Pea Shoots/i.test(n))      return "Pea Shoots";
  if(/^Snap Peas/i.test(n))       return "Pea Shoots";
  if(/^Pea Tops/i.test(n))        return "Pea Shoots";
  if(/^(Red |White |Ruby Stem )?Radish/i.test(n)) return "Radish";
  if(/^Arugula/i.test(n))         return "Arugula";
  if(/^Kale/i.test(n))            return "Kale";
  if(/^Mustard/i.test(n))         return "Mustard";
  if(/^Beets?/i.test(n))          return "Beets";
  if(/^Broccoli/i.test(n))        return "Broccoli";
  if(/^Peppercress/i.test(n))     return "Peppercress";
  if(/^Nasturtium/i.test(n))      return "Nasturtium";
  if(/^Mint/i.test(n))            return "Mint";
  if(/^Lemon Balm/i.test(n))      return "Lemon Balm";
  if(/^Amaranth/i.test(n))        return "Amaranth";
  if(/^Purslane/i.test(n))        return "Purslane";
  return n;
}

function getBaseCrop(name){
  const f=getProductFamily(name);if(!f)return null;
  if(/^(Red Radish|White Radish|Ruby Stem Radish)/.test(f))return"Radish";
  return f;
}

function parseSheetDate(name){
  let s=name.trim().replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i,"").replace(/\bSPL\b\s*/i,"").trim();
  const M={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  const m=s.match(/^([A-Za-z]+)\s+(\d+)\s+(\d+)/);
  if(!m)return null;
  const mo=M[m[1]],d=parseInt(m[2]),y=2000+parseInt(m[3]);
  if(!mo||!d||!y)return null;
  return new Date(y,mo-1,d);
}

function isFriday(sheetName){
  return /^Fri/i.test(sheetName.trim());
}

// Full parse — products + customer columns
function parseXlsxFull(buffer){
  const wb=XLSX.read(buffer,{type:"array",cellFormula:false});
  const sheets=[];
  for(const sn of wb.SheetNames){
    const date=parseSheetDate(sn);
    if(!date)continue;
    const ws=wb.Sheets[sn];
    const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});

    // Find header row (row with customer names, col 22+)
    let headerRow=4;
    for(let i=0;i<Math.min(8,raw.length);i++){
      if(raw[i]&&String(raw[i][2]||"").includes("AI Calc")){headerRow=i;break;}
    }

    // Build customer column map from header row
    const custCols={};
    const hdr=raw[headerRow]||[];
    for(let col=20;col<hdr.length;col++){
      const v=hdr[col];
      if(v&&typeof v==="string"&&v.trim().length>1){
        custCols[col]=v.trim().replace(/\s*\(QB\)\s*/g,"").trim();
      }
    }

    const cropRows=[];
    const customerOrders={}; // customer → {product → qty}

    for(let i=headerRow+1;i<raw.length;i++){
      const r=raw[i];if(!r)continue;
      const nm=r[1],wg=r[2],u=r[3];
      if(!nm||typeof nm!=="string")continue;
      if(SKIP.some(p=>p.test(nm.trim())))continue;
      if(typeof wg!=="number"||wg<=0)continue;
      if(typeof u==="number"&&u>0){
        cropRows.push({name:String(nm).trim(),weightG:Number(wg),units:Number(u)});
      }
      // Customer columns
      const prodName=String(nm).trim();
      for(const[col,cust]of Object.entries(custCols)){
        const qty=r[parseInt(col)];
        if(typeof qty==="number"&&qty>0&&qty<500){
          if(!customerOrders[cust])customerOrders[cust]={};
          customerOrders[cust][prodName]=(customerOrders[cust][prodName]||0)+qty;
        }
      }
    }

    // F134 control total (row 134, col F = index 5)
    // Row 134 = index 133 in 0-based array
    let f134 = null;
    if(raw[133]){
      const v=raw[133][5];
      if(typeof v==="number"&&v>0) f134=v;
    }
    // Also check nearby rows (F134 position can vary slightly)
    if(f134===null){
      for(let r=130;r<Math.min(140,raw.length);r++){
        if(raw[r]){
          const v=raw[r][5];
          if(typeof v==="number"&&v>50000) {f134=v; break;} // total should be >50g
        }
      }
    }

    if(cropRows.length>0||Object.keys(customerOrders).length>0){
      sheets.push({
        date,
        sheetName:sn,
        isFriday:isFriday(sn),
        cropRows,
        customerOrders,
        f134,  // control total for validation
      });
    }
  }
  return sheets.sort((a,b)=>a.date-b.date);
}

// ── Insight computations ──────────────────────────────────────────────────────
function computeProductInsights(sheets){
  const prodKg={},prodPacks={},wedPacks={},friPacks={};
  const monthly={}; // "YYYY-MM" → {product → kg}

  for(const{date,cropRows,isFriday:isFri}of sheets){
    const mo=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
    if(!monthly[mo])monthly[mo]={};
    for(const{name,weightG,units}of cropRows){
      const f=getProductFamily(name);if(!f)continue;
      const kg=(weightG*units)/1000;
      prodKg[f]=(prodKg[f]||0)+kg;
      prodPacks[f]=(prodPacks[f]||0)+units;
      monthly[mo][f]=(monthly[mo][f]||0)+kg;
      if(isFri)friPacks[f]=(friPacks[f]||0)+units;
      else wedPacks[f]=(wedPacks[f]||0)+units;
    }
  }

  // Trend: last 4 runs vs preceding 4 runs (meaningful recent signal)
  const sortedSheets=[...sheets].sort((a,b)=>a.date-b.date);
  const recent4=sortedSheets.slice(-4);
  const prev4=sortedSheets.slice(-8,-4);
  const firstKg={},secondKg={};
  for(const{cropRows}of prev4)for(const{name,weightG,units}of cropRows){
    const f=getProductFamily(name);if(!f)continue;
    firstKg[f]=(firstKg[f]||0)+(weightG*units)/1000;
  }
  for(const{cropRows}of recent4)for(const{name,weightG,units}of cropRows){
    const f=getProductFamily(name);if(!f)continue;
    secondKg[f]=(secondKg[f]||0)+(weightG*units)/1000;
  }

  // Decompose mixes for base crop view
  const baseCropKg={};
  for(const{cropRows}of sheets){
    for(const{name,weightG,units}of cropRows){
      const kg=(weightG*units)/1000;
      const mix=getMixFamily(name);
      if(mix&&MIX_SPLITS[mix]){
        for(const[crop,pct]of Object.entries(MIX_SPLITS[mix])){
          baseCropKg[crop]=(baseCropKg[crop]||0)+kg*pct;
        }
      } else {
        const bc=getBaseCrop(name);if(!bc)continue;
        baseCropKg[bc]=(baseCropKg[bc]||0)+kg;
      }
    }
  }

  const products=Object.entries(prodKg)
    .map(([name,totalKg])=>{
      const f=firstKg[name]||0,s=secondKg[name]||0;
      const trend=f>1?((s-f)/f*100):0;
      const wedP=wedPacks[name]||0,friP=friPacks[name]||0;
      const total=wedP+friP;
      return{name,totalKg,totalPacks:prodPacks[name]||0,
        trend,firstKg:f,secondKg:s,
        wedPct:total>0?Math.round(wedP/total*100):50,
        friPct:total>0?Math.round(friP/total*100):50,
      };
    })
    .sort((a,b)=>b.totalKg-a.totalKg);

  const baseCrops=Object.entries(baseCropKg)
    .map(([name,kg])=>({name,kg}))
    .sort((a,b)=>b.kg-a.kg);

  return{products,baseCrops,monthly};
}

function computeCustomerInsights(sheets){
  const custFreq={};  // customer → sheets count
  const custPacks={}; // customer → total packs
  const custWed={};   // customer → wed packs
  const custFri={};   // customer → fri packs
  const custFirst={}; // customer → first date

  for(const{date,customerOrders,isFriday:isFri}of sheets){
    for(const[cust,prods]of Object.entries(customerOrders)){
      const packs=Object.values(prods).reduce((s,v)=>s+v,0);
      if(packs===0)continue;
      custFreq[cust]=(custFreq[cust]||0)+1;
      custPacks[cust]=(custPacks[cust]||0)+packs;
      if(isFri)custFri[cust]=(custFri[cust]||0)+packs;
      else custWed[cust]=(custWed[cust]||0)+packs;
      if(!custFirst[cust]||date<custFirst[cust])custFirst[cust]=date;
    }
  }

  const totalSheets=sheets.length;
  const customers=Object.entries(custFreq).map(([name,freq])=>{
    const packs=custPacks[name]||0;
    const wed=custWed[name]||0;
    const fri=custFri[name]||0;
    const pct=Math.round(freq/totalSheets*100);
    const tier=pct>=70?"Core":pct>=40?"Regular":pct>=15?"Occasional":"Lapsed";
    return{name,freq,packs,pct,tier,wed,fri,firstDate:custFirst[name]};
  }).sort((a,b)=>b.packs-a.packs);

  // Tier counts
  const tiers=customers.reduce((acc,c)=>{
    acc[c.tier]=(acc[c.tier]||0)+1; return acc;
  },{});

  // Concentration: % of total packs in top 5
  const total=customers.reduce((s,c)=>s+c.packs,0);
  const top5=customers.slice(0,5).reduce((s,c)=>s+c.packs,0);
  const conc=total>0?Math.round(top5/total*100):0;

  return{customers,tiers,totalSheets,totalPacks:total,top5Concentration:conc};
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const TrendBadge=({pct})=>{
  if(Math.abs(pct)<5)return <span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:8,background:"#f0f0f0",color:"#666"}}>→ Stable</span>;
  if(pct>0)return <span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:8,background:"#e8f6dc",color:"#2a6010"}}>▲ {pct.toFixed(0)}%</span>;
  return <span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:8,background:"#fde8e8",color:"#b91c1c"}}>▼ {Math.abs(pct).toFixed(0)}%</span>;
};

const TierBadge=({tier})=>{
  const styles={
    Core:      {bg:"#e8f6dc",text:"#2a6010"},
    Regular:   {bg:"#e8f0fb",text:"#1a3a7a"},
    Occasional:{bg:"#fef3dc",text:"#7a5000"},
    Lapsed:    {bg:"#fde8e8",text:"#b91c1c"},
  };
  const s=styles[tier]||{bg:"#f0f0f0",text:"#444"};
  return <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,...s}}>{tier}</span>;
};

// ── Harvest Report tab (original) ─────────────────────────────────────────────
function monthKey(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function computeA(sheets,pkFn){
  const data={},periods=new Set();
  for(const{date,cropRows}of sheets){
    const pk=pkFn(date);periods.add(pk);
    for(const{name,weightG,units}of cropRows){
      const f=getProductFamily(name);if(!f)continue;
      const kg=(weightG*units)/1000;
      if(!data[f])data[f]={};data[f][pk]=(data[f][pk]||0)+kg;
    }
  }
  return{data,periods:[...periods].sort()};
}
function computeB(sheets,pkFn){
  const data={},periods=new Set(),unresolved=new Set();
  for(const{date,cropRows}of sheets){
    const pk=pkFn(date);periods.add(pk);
    for(const{name,weightG,units}of cropRows){
      const kg=(weightG*units)/1000;
      // Fixed blends: report as-is
      const fam=getProductFamily(name);
      if(FIXED_BLENDS.has(fam)){
        if(!data[fam])data[fam]={};data[fam][pk]=(data[fam][pk]||0)+kg;
        continue;
      }
      const mix=getMixFamily(name);
      if(mix){const sp=MIX_SPLITS[mix];
        if(sp)for(const[c,p]of Object.entries(sp)){if(!data[c])data[c]={};data[c][pk]=(data[c][pk]||0)+kg*p;}
        else{const lb=mix+" (undivided)";unresolved.add(mix);if(!data[lb])data[lb]={};data[lb][pk]=(data[lb][pk]||0)+kg;}
      }else{const c=getBaseCrop(name);if(!c)continue;if(!data[c])data[c]={};data[c][pk]=(data[c][pk]||0)+kg;}
    }
  }
  return{data,periods:[...periods].sort(),unresolved:[...unresolved]};
}

function HarvestReportTab({sheets}){
  const [view,setView]=useState("A");
  const [groupBy,setGroupBy]=useState("month");
  const pkFn=groupBy==="month"?monthKey:d=>d.toISOString().slice(0,10);
  const periodLabel=groupBy==="month"
    ?pk=>{const[y,m]=pk.split("-");return new Date(y,m-1).toLocaleString("default",{month:"short",year:"2-digit"});}
    :pk=>pk;
  const report=useMemo(()=>{
    if(!sheets.length)return null;
    return view==="A"?computeA(sheets,pkFn):computeB(sheets,pkFn);
  },[sheets,view,groupBy]);

  // Compute validation checks
  const validation = useMemo(()=>{
    if(!sheets.length) return null;
    return sheets.map(s=>{
      const calcTotal = s.cropRows.reduce((sum,r)=>sum+(r.weightG*r.units),0);
      const match = s.f134 !== null ? Math.abs(calcTotal - s.f134) < 1 : null;
      return {
        sheet: s.sheetName,
        date: s.date,
        isFriday: s.isFriday,
        calcTotal,
        f134: s.f134,
        match,
      };
    });
  },[sheets]);

  if(!sheets.length)return(
    <div style={{textAlign:"center",padding:"60px 20px",color:T.textSub}}>
      <p style={{fontSize:48,margin:"0 0 12px"}}>📊</p>
      <p style={{fontSize:15,fontWeight:700,color:T.textMain,margin:"0 0 6px"}}>Upload harvest files to see the report</p>
      <p style={{fontSize:13,margin:0}}>Wednesday and Friday xlsx files — any number at once</p>
    </div>
  );

  return(
    <div>
      {/* Validation panel */}
      {validation && validation.length > 0 && (
        <div style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,padding:"12px 16px",marginBottom:14}}>
          <p style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 8px"}}>F134 Validation Checks</p>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {validation.map((v,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,fontSize:12}}>
                <span style={{fontSize:13}}>{v.match===true?"✅":v.match===false?"❌":"⚠️"}</span>
                <span style={{fontWeight:600,color:T.textMain,minWidth:160}}>{v.sheetName||v.sheet}</span>
                <span style={{color:T.textSub}}>Calculated: {(v.calcTotal/1000).toFixed(2)}kg</span>
                {v.f134!==null&&<span style={{color:T.textSub}}>· F134: {(v.f134/1000).toFixed(2)}kg</span>}
                {v.match===null&&<span style={{color:T.amber,fontSize:11}}>F134 not found in sheet</span>}
                {v.match===false&&<span style={{color:T.rust,fontWeight:700,fontSize:11}}>MISMATCH — recalculate</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
          {[["A","By Product"],["B","By Base Crop"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"8px 16px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",background:view===v?T.sky:"#fff",color:view===v?"#fff":T.textMain}}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
          {[["month","Monthly"],["week","Weekly"]].map(([g,l])=>(
            <button key={g} onClick={()=>setGroupBy(g)} style={{padding:"8px 16px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",background:groupBy===g?T.green:"#fff",color:groupBy===g?"#fff":T.textMain}}>{l}</button>
          ))}
        </div>
      </div>
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
                  {periods.map(p=><td key={p} style={{textAlign:"right",padding:"9px 12px",color:(data[crop][p]||0)>0?T.textMain:"#ddd"}}>{(data[crop][p]||0)>0?(data[crop][p]).toFixed(2):"—"}</td>)}
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
  );
}

// ── Product Insights tab ──────────────────────────────────────────────────────
function ProductInsightsTab({sheets,dateRange}){
  const [sortBy,setSortBy]=useState("volume");
  const [unit,setUnit]=useState("kg"); // kg | packs
  const insights=useMemo(()=>sheets.length?computeProductInsights(sheets):null,[sheets]);
  if(!insights)return<EmptyState/>;

  const sorted=useMemo(()=>[...insights.products].sort((a,b)=>{
    if(sortBy==="trend")  return b.trend-a.trend;
    if(sortBy==="wedFri") return b.wedPct-a.wedPct;
    if(sortBy==="packs")  return b.totalPacks-a.totalPacks;
    return b.totalKg-a.totalKg; // default: kg
  }),[insights,sortBy]);

  const maxVal=unit==="packs"?sorted[0]?.totalPacks||1:sorted[0]?.totalKg||1;

  const maxKg=sorted[0]?.totalKg||1;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {[
          {label:"Total products tracked",value:insights.products.length,sub:"across all uploads"},
          {label:"Biggest mover (growth)",value:insights.products.filter(p=>p.trend>20).sort((a,b)=>b.trend-a.trend)[0]?.name||"—",sub:"vs first half of period",isText:true},
          {label:"Biggest mover (decline)",value:insights.products.filter(p=>p.trend<-20).sort((a,b)=>a.trend-b.trend)[0]?.name||"—",sub:"vs first half of period",isText:true},
        ].map(kpi=>(
          <div key={kpi.label} style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,padding:"14px 16px"}}>
            <p style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 6px"}}>{kpi.label}</p>
            <p style={{fontSize:kpi.isText?14:24,fontWeight:900,color:T.textMain,margin:"0 0 3px",letterSpacing:"-0.02em",wordBreak:"break-word"}}>{kpi.value}</p>
            <p style={{fontSize:11,color:T.textSub,margin:0}}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Product volume ranking */}
      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <p style={{fontSize:13,fontWeight:800,color:T.textMain,margin:0}}>Product Rankings</p>
            <p style={{fontSize:11,color:T.textSub,margin:"2px 0 0"}}>
              {insights.products.length} products · sorted by {sortBy==="volume"?"total volume":sortBy==="trend"?"growth trend":"Wed/Fri split"}
            </p>
          </div>
          <div style={{display:"flex",gap:8}}>
            <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
              {[["volume","kg ↓"],["packs","Packs ↓"],["trend","Trend"],["wedFri","Wed/Fri"]].map(([k,l])=>(
                <button key={k} onClick={()=>setSortBy(k)}
                  style={{padding:"6px 11px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",
                    background:sortBy===k?T.sky:"#fff",color:sortBy===k?"#fff":T.textMain}}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
              {[["kg","kg"],["packs","Packs"]].map(([k,l])=>(
                <button key={k} onClick={()=>setUnit(k)}
                  style={{padding:"6px 10px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",
                    background:unit===k?T.green:"#fff",color:unit===k?"#fff":T.textMain}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{maxHeight:420,overflowY:"auto"}}>
          {sorted.filter(p=>p.totalKg>0.01).map((p,i)=>(
            <div key={p.name} style={{padding:"10px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,
              background:i%2===0?"#fff":"#fafbfc"}}>
              <span style={{fontSize:11,fontWeight:800,color:T.textSub,width:22,flexShrink:0}}>{i+1}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:4}}>
                  <span style={{fontSize:12,fontWeight:700,color:T.textMain}}>{p.name}</span>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                    <TrendBadge pct={p.trend}/>
                    <span style={{fontSize:12,fontWeight:800,color:T.sky}}>{p.totalKg.toFixed(1)}kg</span>
                  </div>
                </div>
                {/* Volume bar */}
                <div style={{display:"grid",gridTemplateColumns:`${p.wedPct}fr ${p.friPct}fr`,gap:2,height:6,borderRadius:4,overflow:"hidden"}}>
                  <div style={{background:T.sky,borderRadius:"4px 0 0 4px",opacity:0.8}}/>
                  <div style={{background:T.green,borderRadius:"0 4px 4px 0",opacity:0.8}}/>
                </div>
                <div style={{display:"flex",gap:10,marginTop:2}}>
                  <span style={{fontSize:9,color:T.textSub}}>Wed {p.wedPct}%</span>
                  <span style={{fontSize:9,color:T.textSub}}>Fri {p.friPct}%</span>
                  <span style={{fontSize:9,color:T.textSub,marginLeft:"auto"}}>{p.totalPacks} packs</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Base crop demand */}
      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
          <p style={{fontSize:13,fontWeight:800,color:T.textMain,margin:0}}>True Base Crop Demand</p>
          <p style={{fontSize:11,color:T.textSub,margin:"2px 0 0"}}>
            After decomposing mixes (Mellow Mix, Spicy Mix etc.) into their component crops — this drives planting decisions
          </p>
        </div>
        <div style={{padding:"12px 20px",display:"flex",flexDirection:"column",gap:8}}>
          {insights.baseCrops.filter(c=>c.kg>0.5).map((c,i)=>{
            const maxKgBase=insights.baseCrops[0]?.kg||1;
            const pct=Math.round(c.kg/maxKgBase*100);
            return(
              <div key={c.name} style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:11,fontWeight:600,color:T.textMain,width:130,flexShrink:0}}>{c.name}</span>
                <div style={{flex:1,background:"#e8eef2",borderRadius:6,height:14,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:14,
                    background:i===0?T.sky:i===1?T.green:i===2?T.amber:"#94a3b8",
                    borderRadius:6,transition:"width 0.3s"}}/>
                </div>
                <span style={{fontSize:12,fontWeight:800,color:T.textMain,width:52,textAlign:"right",flexShrink:0}}>{c.kg.toFixed(1)}kg</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Customer Insights tab ─────────────────────────────────────────────────────
function SortHeader({label,col,sortConfig,onSort}){
  const active=sortConfig.col===col;
  const dir=active?sortConfig.dir:"";
  return(
    <th onClick={()=>onSort(col)}
      style={{textAlign:"left",padding:"8px 14px",fontSize:10,fontWeight:700,
        color:active?T.sky:T.textSub,textTransform:"uppercase",letterSpacing:"0.05em",
        whiteSpace:"nowrap",cursor:"pointer",userSelect:"none"}}>
      {label}{active?(dir==="asc"?" ↑":" ↓"):" ↕"}
    </th>
  );
}

function CustomerInsightsTab({sheets,dateRange}){
  const [filterTier,setFilterTier]=useState("All");
  const [unit,setUnit]=useState("packs"); // packs | kg
  const [sortConfig,setSortConfig]=useState({col:"packs",dir:"desc"});

  const handleSort=(col)=>{
    setSortConfig(prev=>({col,dir:prev.col===col&&prev.dir==="desc"?"asc":"desc"}));
  };
  const insights=useMemo(()=>sheets.length?computeCustomerInsights(sheets):null,[sheets]);
  if(!insights)return<EmptyState/>;

  const tierColors={
    Core:{bg:"#e8f6dc",text:"#2a6010",desc:"Orders 70%+ of dates"},
    Regular:{bg:"#e8f0fb",text:"#1a3a7a",desc:"Orders 40–69% of dates"},
    Occasional:{bg:"#fef3dc",text:"#7a5000",desc:"Orders 15–39% of dates"},
    Lapsed:{bg:"#fde8e8",text:"#b91c1c",desc:"Orders <15% of dates"},
  };

  const filtered=useMemo(()=>{
    if(!insights) return [];
    const arr=insights.customers.filter(c=>filterTier==="All"||c.tier===filterTier);
    const {col,dir}=sortConfig;
    const m=dir==="asc"?1:-1;
    return [...arr].sort((a,b)=>{
      if(col==="name")    return m*a.name.localeCompare(b.name);
      if(col==="tier")    return m*["Core","Regular","Occasional","Lapsed"].indexOf(a.tier)-["Core","Regular","Occasional","Lapsed"].indexOf(b.tier);
      if(col==="freq")    return m*(a.freq-b.freq);
      if(col==="pct")     return m*(a.pct-b.pct);
      if(col==="packs")   return m*(a.packs-b.packs);
      if(col==="wed")     return m*(a.wed-b.wed);
      if(col==="fri")     return m*(a.fri-b.fri);
      return 0;
    });
  },[insights,filterTier,sortConfig]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Tier summary */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {Object.entries(tierColors).map(([tier,style])=>{
          const count=insights.tiers[tier]||0;
          return(
            <div key={tier} onClick={()=>setFilterTier(filterTier===tier?"All":tier)}
              style={{background:filterTier===tier?style.bg:T.surface,borderRadius:10,
                border:`2px solid ${filterTier===tier?style.text:T.border}`,
                padding:"12px 14px",cursor:"pointer",transition:"all 0.15s"}}>
              <p style={{fontSize:24,fontWeight:900,color:style.text,margin:"0 0 2px"}}>{count}</p>
              <p style={{fontSize:12,fontWeight:700,color:T.textMain,margin:"0 0 2px"}}>{tier}</p>
              <p style={{fontSize:10,color:T.textSub,margin:0}}>{style.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Concentration risk */}
      <div style={{background:"#fffbeb",borderRadius:10,border:"1px solid #fde68a",padding:"12px 16px",display:"flex",gap:12,alignItems:"center"}}>
        <span style={{fontSize:24,flexShrink:0}}>⚠</span>
        <div>
          <p style={{fontSize:13,fontWeight:700,color:"#92400e",margin:0}}>
            Top 5 customers account for <strong>{insights.top5Concentration}%</strong> of total pack volume
          </p>
          <p style={{fontSize:11,color:"#78350f",margin:"2px 0 0"}}>
            {insights.top5Concentration>60
              ?"High concentration — consider customer diversification strategy"
              :insights.top5Concentration>40
              ?"Moderate concentration — healthy but watch for account losses"
              :"Well distributed — good customer base resilience"}
          </p>
        </div>
      </div>

      {/* Customer table */}
      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <p style={{fontSize:13,fontWeight:800,color:T.textMain,margin:0}}>
              {filterTier==="All"?`All ${insights.customers.length} customers`:`${filtered.length} ${filterTier} customers`}
            </p>
            <p style={{fontSize:11,color:T.textSub,margin:"2px 0 0"}}>
              Click a tier card above to filter · {insights.totalSheets} dates analysed
            </p>
          </div>
          <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
            {[["packs","Packs"],["kg","Weight (kg)"]].map(([k,l])=>(
              <button key={k} onClick={()=>setUnit(k)}
                style={{padding:"6px 12px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",
                  background:unit===k?T.sky:"#fff",color:unit===k?"#fff":T.textMain}}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div style={{maxHeight:480,overflowY:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"#f8fafb",position:"sticky",top:0,zIndex:5}}>
              <th style={{textAlign:"left",padding:"8px 14px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase"}}>#</th>
              <SortHeader label="Customer"     col="name"  sortConfig={sortConfig} onSort={handleSort}/>
              <SortHeader label="Tier"         col="tier"  sortConfig={sortConfig} onSort={handleSort}/>
              <SortHeader label="Dates ordered"col="freq"  sortConfig={sortConfig} onSort={handleSort}/>
              <SortHeader label="% of dates"   col="pct"   sortConfig={sortConfig} onSort={handleSort}/>
              <SortHeader label="Packs"        col="packs" sortConfig={sortConfig} onSort={handleSort}/>
              <SortHeader label="Wed"          col="wed"   sortConfig={sortConfig} onSort={handleSort}/>
              <SortHeader label="Fri"          col="fri"   sortConfig={sortConfig} onSort={handleSort}/>
            </tr></thead>
            <tbody>{filtered.map((c,i)=>(
              <tr key={c.name} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?"#fff":"#fafbfc"}}
                onMouseEnter={e=>e.currentTarget.style.background="#f0f7ff"}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#fafbfc"}>
                <td style={{padding:"9px 14px",color:T.textSub,fontWeight:700}}>{i+1}</td>
                <td style={{padding:"9px 14px",fontWeight:600,color:T.textMain}}>{c.name}</td>
                <td style={{padding:"9px 14px"}}><TierBadge tier={c.tier}/></td>
                <td style={{padding:"9px 14px",fontWeight:700,color:T.textMain}}>{c.freq}</td>
                <td style={{padding:"9px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:50,height:6,background:"#e8eef2",borderRadius:4,overflow:"hidden"}}>
                      <div style={{width:`${c.pct}%`,height:6,background:T.sky,borderRadius:4}}/>
                    </div>
                    <span style={{fontSize:11,color:T.textSub}}>{c.pct}%</span>
                  </div>
                </td>
                <td style={{padding:"9px 14px",fontWeight:800,color:T.sky}}>{c.packs}</td>
                <td style={{padding:"9px 14px",color:T.textSub,fontSize:11}}>{c.wed}</td>
                <td style={{padding:"9px 14px",color:T.textSub,fontSize:11}}>{c.fri}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmptyState(){
  return(
    <div style={{textAlign:"center",padding:"60px 20px",color:T.textSub}}>
      <p style={{fontSize:48,margin:"0 0 12px"}}>📈</p>
      <p style={{fontSize:15,fontWeight:700,color:T.textMain,margin:"0 0 6px"}}>Upload harvest files above to generate insights</p>
      <p style={{fontSize:13,margin:0}}>Wednesday and Friday xlsx files — the more dates, the richer the analysis</p>
    </div>
  );
}

// ── Main Reporting component ──────────────────────────────────────────────────
export default function Reporting(){
  const [activeTab,setActiveTab]=useState("report");
  const [sheets,setSheets]=useState([]);
  const [loading,setLoading]=useState(false);
  const [loadedFiles,setLoadedFiles]=useState([]);
  const [showDriveInfo,setShowDriveInfo]=useState(false);
  const [periodFilter,setPeriodFilter]=useState("all"); // all | 4w | 8w | 12w | ytd
  const [customRange,setCustomRange]=useState({from:"",to:""});

  // Filter sheets by selected period
  const filteredSheets=useMemo(()=>{
    if(!sheets.length) return sheets;
    const sorted=[...sheets].sort((a,b)=>b.date-a.date);
    const latest=sorted[0]?.date||new Date();
    if(periodFilter==="4w") {
      const cutoff=new Date(latest); cutoff.setDate(cutoff.getDate()-28);
      return sheets.filter(s=>s.date>=cutoff);
    }
    if(periodFilter==="8w") {
      const cutoff=new Date(latest); cutoff.setDate(cutoff.getDate()-56);
      return sheets.filter(s=>s.date>=cutoff);
    }
    if(periodFilter==="12w") {
      const cutoff=new Date(latest); cutoff.setDate(cutoff.getDate()-84);
      return sheets.filter(s=>s.date>=cutoff);
    }
    if(periodFilter==="ytd") {
      const cutoff=new Date(latest.getFullYear(),0,1);
      return sheets.filter(s=>s.date>=cutoff);
    }
    if(periodFilter==="custom"&&customRange.from&&customRange.to) {
      const from=new Date(customRange.from);
      const to=new Date(customRange.to);
      return sheets.filter(s=>s.date>=from&&s.date<=to);
    }
    return sheets;
  },[sheets,periodFilter,customRange]);

  const handleFiles=useCallback(async(files)=>{
    setLoading(true);
    const incoming=[],names=[];
    for(const f of files){
      try{
        const buf=await f.arrayBuffer();
        const parsed=parseXlsxFull(new Uint8Array(buf));
        incoming.push(...parsed);
        names.push(`${f.name} (${parsed.length} sheets)`);
      }catch(e){console.error(e);}
    }
    setLoadedFiles(prev=>[...prev,...names]);
    setSheets(prev=>{
      const ex=new Set(prev.map(s=>s.sheetName));
      return[...prev,...incoming.filter(s=>!ex.has(s.sheetName))].sort((a,b)=>a.date-b.date);
    });
    setLoading(false);
  },[]);

  const TABS=[
    {id:"report",   label:"📊 Harvest Report"},
    {id:"customers",label:"👥 Customer Insights"},
    {id:"products", label:"🌱 Product Insights"},
  ];

  return(
    <div>
      {/* Page header — title + tabs on same row */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:T.textMain,margin:0}}>Reporting</h1>
          <p style={{fontSize:13,color:T.textSub,margin:"3px 0 0"}}>Upload harvest files for instant analysis across all three views</p>
        </div>
        {/* Tabs — inline with title */}
        <div style={{display:"flex",gap:0,background:T.surface,borderRadius:10,
          border:`1px solid ${T.border}`,padding:4}}>
          {TABS.map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              style={{padding:"8px 18px",fontSize:13,fontWeight:700,border:"none",
                borderRadius:8,cursor:"pointer",transition:"all 0.15s",
                background:activeTab===tab.id?T.sky:"transparent",
                color:activeTab===tab.id?"#fff":T.textSub}}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload card */}
      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:"16px 20px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",flexShrink:0}}>
            <span style={{padding:"8px 16px",background:T.sky,color:"#fff",borderRadius:8,fontSize:13,fontWeight:700,flexShrink:0}}>
              Choose files
            </span>
            <span style={{fontSize:13,color:T.textSub}}>Wednesday and Friday xlsx — any number</span>
            <input type="file" multiple accept=".xlsx" style={{display:"none"}}
              onChange={e=>{if(e.target.files.length)handleFiles([...e.target.files]);e.target.value="";}}/>
          </label>
          {sheets.length>0&&(
            <>
              <span style={{fontSize:13,fontWeight:700,color:T.green}}>
                {sheets.length} sheets · {sheets[0].date.toLocaleDateString("en-GB",{day:"numeric",month:"short"})} → {sheets[sheets.length-1].date.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
              </span>
              <button onClick={()=>{setSheets([]);setLoadedFiles([]);}}
                style={{padding:"6px 12px",fontSize:11,fontWeight:700,borderRadius:7,border:"1px solid #fca5a5",color:T.rust,background:"#fff",cursor:"pointer",marginLeft:"auto"}}>
                Clear
              </button>
            </>
          )}
          {loading&&<span style={{fontSize:13,color:T.sky,fontWeight:600}}>Reading files…</span>}
          <div style={{position:"relative",flexShrink:0}} title="Google Drive auto-load requires one-time OAuth setup in Netlify — contact Chris H to enable">
            <button
              onClick={()=>setShowDriveInfo(s=>!s)}
              style={{padding:"8px 14px",background:"#fff",color:T.textSub,
                border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,
                fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              <span>📂</span> Load from Google Drive
              <span style={{fontSize:10,background:"#fef3dc",color:"#92400e",
                padding:"1px 5px",borderRadius:6,fontWeight:800}}>Setup needed</span>
            </button>
            {showDriveInfo&&(
              <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:300,
                background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,
                padding:14,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:50}}>
                <p style={{fontSize:12,fontWeight:700,color:T.textMain,margin:"0 0 8px"}}>
                  📂 Google Drive auto-load
                </p>
                <p style={{fontSize:11,color:T.textSub,margin:"0 0 10px",lineHeight:1.6}}>
                  To load files automatically from Google Drive, the Netlify deployment needs a one-time OAuth credential setup. Until then, use the Choose files button above.
                </p>
                <p style={{fontSize:11,fontWeight:700,color:T.sky,margin:"0 0 6px"}}>How to enable it:</p>
                <ol style={{fontSize:11,color:T.textSub,margin:0,paddingLeft:16,lineHeight:2}}>
                  <li>Chris Arthur shares his harvest folder with chris.haresign@gmail.com (Viewer)</li>
                  <li>Add Google OAuth token to Netlify environment variables</li>
                  <li>Button becomes live — no upload needed</li>
                </ol>
                <button onClick={()=>setShowDriveInfo(false)}
                  style={{marginTop:10,width:"100%",padding:"7px",background:T.sky,
                    color:"#fff",border:"none",borderRadius:7,fontSize:12,
                    fontWeight:700,cursor:"pointer"}}>Got it</button>
              </div>
            )}
          </div>
        </div>
        {loadedFiles.length>0&&(
          <div style={{marginTop:8,display:"flex",gap:8,flexWrap:"wrap"}}>
            {loadedFiles.map((f,i)=>(
              <span key={i} style={{fontSize:11,color:T.textSub,background:"#f0f6fb",
                padding:"3px 9px",borderRadius:6,border:`1px solid ${T.border}`}}>✓ {f}</span>
            ))}
          </div>
        )}
      </div>

      {/* Period filter */}
      {sheets.length>0&&(
        <div style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,
          padding:"10px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",
            letterSpacing:"0.06em",flexShrink:0}}>Period:</span>
          <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
            {[["all","All data"],["4w","4 weeks"],["8w","8 weeks"],["12w","12 weeks"],["ytd","Year to date"],["custom","Custom"]].map(([k,l])=>(
              <button key={k} onClick={()=>setPeriodFilter(k)}
                style={{padding:"5px 11px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",
                  background:periodFilter===k?T.sky:"#fff",color:periodFilter===k?"#fff":T.textMain}}>
                {l}
              </button>
            ))}
          </div>
          {periodFilter==="custom"&&(
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input type="date" value={customRange.from}
                onChange={e=>setCustomRange(p=>({...p,from:e.target.value}))}
                style={{padding:"4px 8px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12}}/>
              <span style={{fontSize:12,color:T.textSub}}>to</span>
              <input type="date" value={customRange.to}
                onChange={e=>setCustomRange(p=>({...p,to:e.target.value}))}
                style={{padding:"4px 8px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12}}/>
            </div>
          )}
          <span style={{fontSize:11,color:T.textSub,marginLeft:4}}>
            {filteredSheets.length} of {sheets.length} sheets
            {filteredSheets.length>0&&` · ${filteredSheets[0].date.toLocaleDateString("en-GB",{day:"numeric",month:"short"})} → ${filteredSheets[filteredSheets.length-1].date.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}`}
          </span>
        </div>
      )}

      {/* Tab content */}
      {activeTab==="report"    && <HarvestReportTab    sheets={filteredSheets}/>}
      {activeTab==="customers" && <CustomerInsightsTab sheets={filteredSheets}/>}
      {activeTab==="products"  && <ProductInsightsTab  sheets={filteredSheets}/>}
    </div>
  );
}
