import { useState } from "react";

const T = {
  sidebar:"#0f2535",sky:"#3e7da1",green:"#86b955",amber:"#d4890a",rust:"#c0432b",
  bg:"#f4f6f8",surface:"#ffffff",border:"#e2e8ed",textMain:"#1a2e3b",textSub:"#5a7080",
};

// ── DEMO PROVENANCE DATA ──────────────────────────────────────────────────────
// Fully fabricated but structurally correct — shows every step in the chain.
// When real data exists in Supabase, this is replaced by a query to provenance_chain view.

const DEMO_TRAILS = [
  {
    id:"trail-001",
    customer:"SPUD Vancouver",
    product:"Pea Shoots (M)",
    deliveryDate:"2026-05-20",
    packsOrdered:49,
    totalKgSold:4.56,
    chainStatus:"COMPLETE",
    fab:true,
    steps:[
      {
        step:"seed_purchase",
        label:"Seed Purchase",
        icon:"🌾",
        status:"complete",
        date:"2026-01-15",
        entity:"West Coast Seeds",
        reference:"WCS-ORG-2026-001",
        detail:"Pea Shoots · 500g · CAD $22.00",
        certBody:"Pro-Cert Organic Systems",
        certNumber:"PRO-2026-WCS-001",
        certExpiry:"2027-06-30",
        certUploaded:true,
        isOrganic:true,
        notes:"Lot verified organic. Certificate on file.",
      },
      {
        step:"soil_purchase",
        label:"Growing Media",
        icon:"🪴",
        status:"complete",
        date:"2026-04-01",
        entity:"Pacific Rim Horticulture",
        reference:"SOIL-2026-M3-007",
        detail:"Premium Microgreen Mix · 60kg · CAD $220.00",
        certBody:"COABC / PACS",
        certNumber:"PAC-SOIL-2026-001",
        certExpiry:"2027-03-31",
        certUploaded:true,
        isOrganic:true,
        notes:"Coco coir based. No prohibited substances.",
      },
      {
        step:"planting",
        label:"Tray Planted",
        icon:"🌱",
        status:"complete",
        date:"2026-05-05",
        entity:"Maria Chen",
        reference:"SH-260505-PEA-0001",
        detail:"4 trays · Shelf A-1 · Soil Mix 3",
        seedLot:"WCS-ORG-2026-001-PEA",
        soilBatch:"SOIL-2026-M3-007",
        certUploaded:true,
        notes:"Good germination rate. Even spread.",
      },
      {
        step:"health_check",
        label:"Health Assessment",
        icon:"🤖",
        status:"complete",
        date:"2026-05-15",
        entity:"Maria Chen",
        reference:"SH-260505-PEA-0001",
        detail:"Health score 88/100 · Cotyledon expansion · Day 10",
        notes:"Dense, uniform germination. Excellent colour. No issues.",
      },
      {
        step:"harvest",
        label:"Harvested",
        icon:"✂️",
        status:"complete",
        date:"2026-05-19",
        entity:"Maria Chen",
        reference:"SH-20260520-PEA-LOT001",
        detail:"68 units · 6.32 kg · Cut day: Tuesday",
        startTime:"06:30",
        finishTime:"09:15",
        notes:"Slightly below planned 70 units — 2 trays had soft stems. Yield per tray: 1.58kg avg.",
      },
      {
        step:"packing",
        label:"Packed & Labelled",
        icon:"📦",
        status:"complete",
        date:"2026-05-19",
        entity:"Maria Chen",
        reference:"SH-20260520-PEA-LOT001",
        detail:"68 packs · 93g each · 4°C cold store",
        areaSanitised:true,
        equipmentCleaned:true,
        lotRef:"SH-20260520-PEA-LOT001",
        notes:"Labels printed. QR code references lot. Area sanitised at 11:00.",
      },
      {
        step:"delivery",
        label:"Delivered",
        icon:"🚐",
        status:"complete",
        date:"2026-05-20",
        entity:"Sam Wright",
        reference:"North Shore Run",
        detail:"49 of 68 packs · SPUD Vancouver · Stongs North Van",
        driver:"Sam Wright",
        transport:"🚗 Car",
        departTime:"7:00 AM",
        confirmedAt:"2026-05-20 07:48",
        recipientName:"Manager on duty",
        photoTaken:true,
        notes:"Delivered to loading dock. Signed by manager.",
      },
      {
        step:"invoice",
        label:"Invoiced",
        icon:"🧾",
        status:"complete",
        date:"2026-05-20",
        entity:"QuickBooks",
        reference:"INV-2026-0842",
        detail:"49 × Pea Shoots M · CAD $185.82 + GST",
        notes:"Auto-generated on delivery confirmation.",
      },
    ]
  },
  {
    id:"trail-002",
    customer:"Kingyo Izakaya",
    product:"Shiso, Green (M)",
    deliveryDate:"2026-05-28",
    packsOrdered:4,
    totalKgSold:0.14,
    chainStatus:"PARTIAL",
    fab:true,
    steps:[
      {
        step:"seed_purchase",
        label:"Seed Purchase",
        icon:"🌾",
        status:"complete",
        date:"2026-02-01",
        entity:"OSC Seeds",
        reference:"OSC-ORG-2026-018-SHI",
        detail:"Shiso Green · 100g · CAD $14.00",
        certBody:"Pro-Cert Organic",
        certNumber:"PRO-2026-OSC-018",
        certExpiry:"2027-01-15",
        certUploaded:true,
        isOrganic:true,
        notes:"Certified organic. Certificate on file.",
      },
      {
        step:"soil_purchase",
        label:"Growing Media",
        icon:"🪴",
        status:"complete",
        date:"2026-04-01",
        entity:"Pacific Rim Horticulture",
        reference:"SOIL-2026-M2-003",
        detail:"Coco Coir / Vermiculite 80/20 · 40kg",
        certUploaded:true,
        isOrganic:true,
      },
      {
        step:"planting",
        label:"Tray Planted",
        icon:"🌱",
        status:"complete",
        date:"2026-05-03",
        entity:"Jake Okafor",
        reference:"SH-260503-SHI-0009",
        detail:"2 trays · Shelf C-4 · Soil Mix 2",
        notes:"Standard planting. 28 day cycle expected.",
      },
      {
        step:"health_check",
        label:"Health Assessment",
        icon:"🤖",
        status:"pending",
        date:null,
        entity:null,
        reference:null,
        detail:"Not yet assessed",
        notes:"Tray due for assessment — go to Tray Health AI",
      },
      {
        step:"harvest",
        label:"Harvest Scheduled",
        icon:"✂️",
        status:"scheduled",
        date:"2026-05-28",
        entity:"TBC",
        reference:"Wed 28 May harvest run",
        detail:"Planned for Wednesday morning",
        notes:"Order confirmed via email from Chef Haru.",
      },
      {
        step:"packing",
        label:"Packing",
        icon:"📦",
        status:"pending",
        detail:"Awaiting harvest",
      },
      {
        step:"delivery",
        label:"Delivery",
        icon:"🚐",
        status:"scheduled",
        date:"2026-05-28",
        entity:"Downtown run",
        detail:"Downtown run — Leo Park (🚲 Bike) · 9:00 AM",
      },
      {
        step:"invoice",
        label:"Invoice",
        icon:"🧾",
        status:"pending",
        detail:"Will auto-generate on delivery confirmation",
      },
    ]
  },
];

// ── Step status styles ─────────────────────────────────────────────────────────
const STEP_STYLE = {
  complete:  {bg:"#e8f6dc",border:"#86b955",text:"#2a6010",dot:"#86b955",   label:"✓ Complete"},
  scheduled: {bg:"#e8f0fb",border:"#3e7da1",text:"#1a3a7a",dot:"#3e7da1",   label:"📅 Scheduled"},
  pending:   {bg:"#f5f5f5",border:"#c8d8e8",text:"#5a7080",dot:"#c8d8e8",   label:"⏳ Pending"},
  warning:   {bg:"#fff7ed",border:"#d4890a",text:"#7a5000",dot:"#d4890a",   label:"⚠ Action needed"},
  missing:   {bg:"#fde8e8",border:"#c0432b",text:"#7a1a1a",dot:"#c0432b",   label:"✕ Missing"},
};

const CHAIN_BADGE = {
  "COMPLETE":           {bg:"#e8f6dc",text:"#2a6010",label:"✓ Chain complete"},
  "PARTIAL":            {bg:"#e8f0fb",text:"#1a3a7a",label:"🔄 In progress"},
  "MISSING DATA":       {bg:"#fde8e8",text:"#7a1a1a",label:"⚠ Missing data"},
  "DELIVERY UNCONFIRMED":{bg:"#fff7ed",text:"#7a5000",label:"⏳ Awaiting delivery"},
};

export default function ProvenanceTrail() {
  const [selectedTrail, setSelectedTrail] = useState(DEMO_TRAILS[0]);
  const [expandedStep, setExpandedStep] = useState(null);
  const [activeTab, setActiveTab] = useState("trail"); // trail | massbalance | certdocs

  const trailBadge = CHAIN_BADGE[selectedTrail.chainStatus] || CHAIN_BADGE["PARTIAL"];

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:T.textMain,margin:0}}>Provenance Trail</h1>
          <p style={{fontSize:13,color:T.textSub,margin:"4px 0 0"}}>Complete seed → plate audit trail for BCCOP certification</p>
        </div>
      </div>

      {/* Fabrication warning */}
      <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:8,padding:"8px 14px",marginBottom:16,fontSize:12,color:"#9a3412"}}>
        ⚠ All provenance data shown here is <strong style={{color:"#b91c1c"}}>fabricated for demonstration</strong>. Real data populates as staff plant trays, run harvests, and confirm deliveries.
      </div>

      {/* Trail selector */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {DEMO_TRAILS.map(trail=>(
          <button key={trail.id} onClick={()=>setSelectedTrail(trail)}
            style={{padding:"10px 16px",borderRadius:10,border:`2px solid ${selectedTrail.id===trail.id?T.sky:T.border}`,
              background:selectedTrail.id===trail.id?"#f0f7ff":"#fff",cursor:"pointer",textAlign:"left",flex:"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
              <span style={{fontSize:13,fontWeight:700,color:T.textMain}}>{trail.customer}</span>
              <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,...(CHAIN_BADGE[trail.chainStatus]||{})}}>
                {(CHAIN_BADGE[trail.chainStatus]||{label:trail.chainStatus}).label}
              </span>
            </div>
            <p style={{fontSize:11,color:T.textSub,margin:0}}>{trail.product} · {trail.packsOrdered} packs · {trail.deliveryDate}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`1px solid ${T.border}`}}>
        {[["trail","🔗 Chain of Custody"],["massbalance","⚖ Mass Balance"],["certdocs","📋 Cert Documents"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)}
            style={{padding:"10px 18px",fontSize:12,fontWeight:700,border:"none",
              borderBottom:`2px solid ${activeTab===id?T.sky:"transparent"}`,
              background:"transparent",color:activeTab===id?T.sky:T.textSub,cursor:"pointer"}}>
            {label}
          </button>
        ))}
      </div>

      {/* Chain of Custody tab */}
      {activeTab==="trail" && (
        <div>
          {/* Summary bar */}
          <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:"14px 20px",marginBottom:20,
            display:"flex",gap:24,flexWrap:"wrap",alignItems:"center"}}>
            {[
              ["Customer",selectedTrail.customer],
              ["Product",selectedTrail.product],
              ["Delivery",selectedTrail.deliveryDate],
              ["Packs",selectedTrail.packsOrdered],
              ["Total kg",selectedTrail.totalKgSold],
            ].map(([label,val])=>(
              <div key={label}>
                <p style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 2px"}}>{label}</p>
                <p style={{fontSize:14,fontWeight:800,color:T.textMain,margin:0}}>{val}</p>
              </div>
            ))}
            <div style={{marginLeft:"auto"}}>
              <span style={{fontSize:11,fontWeight:700,padding:"5px 14px",borderRadius:10,
                background:trailBadge.bg,color:trailBadge.text,fontSize:12}}>{trailBadge.label}</span>
            </div>
          </div>

          {/* The chain — vertical timeline */}
          <div style={{position:"relative"}}>
            {/* Vertical line */}
            <div style={{position:"absolute",left:27,top:20,bottom:20,width:2,background:`linear-gradient(${T.green},#e2e8ed)`,zIndex:0}}/>

            {selectedTrail.steps.map((step,i)=>{
              const ss = STEP_STYLE[step.status] || STEP_STYLE.pending;
              const isExpanded = expandedStep===i;
              return (
                <div key={i} style={{display:"flex",gap:16,marginBottom:12,position:"relative",zIndex:1}}>
                  {/* Node */}
                  <div style={{width:56,display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                    <div style={{width:56,height:56,borderRadius:28,
                      background:ss.bg,border:`2px solid ${ss.border}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:24,cursor:"pointer",transition:"transform 0.15s",flexShrink:0}}
                      onClick={()=>setExpandedStep(isExpanded?null:i)}>
                      {step.icon}
                    </div>
                    <div style={{width:2,flex:1,background:i<selectedTrail.steps.length-1?ss.dot:"transparent",minHeight:12}}/>
                  </div>

                  {/* Content */}
                  <div style={{flex:1,paddingBottom:8}}>
                    <div style={{background:T.surface,borderRadius:10,border:`1px solid ${isExpanded?ss.border:T.border}`,
                      overflow:"hidden",cursor:"pointer",transition:"all 0.15s"}}
                      onClick={()=>setExpandedStep(isExpanded?null:i)}>
                      <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:isExpanded?ss.bg:"#fff"}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
                            <span style={{fontSize:13,fontWeight:800,color:T.textMain}}>{step.label}</span>
                            <span style={{fontSize:10,fontWeight:700,padding:"1px 8px",borderRadius:8,background:ss.bg,color:ss.text}}>{ss.label}</span>
                          </div>
                          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                            {step.date && <span style={{fontSize:11,color:T.textSub}}>{step.date}</span>}
                            {step.entity && <span style={{fontSize:11,color:T.textMain,fontWeight:600}}>{step.entity}</span>}
                            {step.detail && <span style={{fontSize:11,color:T.textSub,overflow:"hidden",textOverflow:"ellipsis",maxWidth:300,whiteSpace:"nowrap"}}>{step.detail}</span>}
                          </div>
                        </div>
                        <span style={{color:T.textSub,fontSize:14,flexShrink:0,marginLeft:8}}>{isExpanded?"▲":"▼"}</span>
                      </div>

                      {isExpanded && (
                        <div style={{padding:"12px 16px",borderTop:`1px solid ${ss.border}`,background:ss.bg}}>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 24px",marginBottom:step.notes?10:0}}>
                            {step.reference && <DetailRow label="Reference" value={step.reference} mono/>}
                            {step.certBody && <DetailRow label="Certifier" value={step.certBody}/>}
                            {step.certNumber && <DetailRow label="Cert number" value={step.certNumber} mono/>}
                            {step.certExpiry && <DetailRow label="Cert expiry" value={step.certExpiry}/>}
                            {step.seedLot && <DetailRow label="Seed lot" value={step.seedLot} mono/>}
                            {step.soilBatch && <DetailRow label="Soil batch" value={step.soilBatch} mono/>}
                            {step.driver && <DetailRow label="Driver" value={`${step.transport} ${step.driver}`}/>}
                            {step.departTime && <DetailRow label="Departed" value={step.departTime}/>}
                            {step.confirmedAt && <DetailRow label="Confirmed" value={step.confirmedAt}/>}
                            {step.recipientName && <DetailRow label="Received by" value={step.recipientName}/>}
                            {step.areaSanitised !== undefined && <DetailRow label="Area sanitised" value={step.areaSanitised?"✓ Yes":"✕ No"} good={step.areaSanitised}/>}
                            {step.equipmentCleaned !== undefined && <DetailRow label="Equipment cleaned" value={step.equipmentCleaned?"✓ Yes":"✕ No"} good={step.equipmentCleaned}/>}
                            {step.lotRef && <DetailRow label="Label lot ref" value={step.lotRef} mono/>}
                            {step.certUploaded !== undefined && <DetailRow label="Certificate" value={step.certUploaded?"✓ Uploaded":"⚠ Not uploaded"} good={step.certUploaded}/>}
                            {step.isOrganic !== undefined && <DetailRow label="Organic status" value={step.isOrganic?"✓ Certified organic":"⚠ Conventional"} good={step.isOrganic}/>}
                          </div>
                          {step.notes && (
                            <div style={{padding:"8px 10px",background:"rgba(255,255,255,0.6)",borderRadius:7,border:`1px solid ${ss.border}`,fontSize:12,color:T.textMain}}>
                              <strong style={{color:T.textSub,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Notes: </strong>
                              {step.notes}
                            </div>
                          )}
                          {step.photoTaken && (
                            <div style={{marginTop:8,padding:"8px 10px",background:"rgba(255,255,255,0.6)",borderRadius:7,border:`1px solid ${ss.border}`,fontSize:12,display:"flex",gap:8,alignItems:"center"}}>
                              <span style={{fontSize:16}}>📷</span>
                              <span style={{color:T.textMain}}>Delivery photo captured · timestamped proof of delivery</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mass Balance tab */}
      {activeTab==="massbalance" && (
        <div>
          <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,background:"#f8fafb"}}>
              <p style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Mass Balance — BCCOP Section 4.4</p>
              <p style={{fontSize:12,color:T.textSub,margin:"4px 0 0"}}>Seed purchased must justify product sold. Inspector verifies this during annual audit.</p>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:"#f8fafb"}}>
                {["Seed Lot","Crop","Seed Purchased","Trays Planted","Kg Harvested","Kg Sold","% Sold","Wasted","Status"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"8px 14px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{[
                {lot:"WCS-ORG-2026-001-PEA",crop:"Pea Shoots",   seedKg:0.50,trays:4,harvKg:6.32,soldKg:4.56,wasted:0.18},
                {lot:"MSS-ORG-2026-007-RAD",crop:"Red Radish",   seedKg:0.50,trays:2,harvKg:2.84,soldKg:2.06,wasted:0.10},
                {lot:"WCS-ORG-2026-001-SUN",crop:"Sunflower",    seedKg:0.25,trays:3,harvKg:4.75,soldKg:3.80,wasted:0.28},
                {lot:"OSC-ORG-2026-018-ARU",crop:"Arugula",      seedKg:0.25,trays:2,harvKg:1.92,soldKg:1.42,wasted:0.15},
                {lot:"OSC-ORG-2026-018-SHI",crop:"Shiso Green",  seedKg:0.10,trays:2,harvKg:null,soldKg:null,wasted:null},
              ].map((r,i)=>{
                const pct = r.harvKg ? ((r.soldKg||0)/r.harvKg*100).toFixed(0) : null;
                return (
                  <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?"#fff":"#fafbfc"}}>
                    <td style={{padding:"9px 14px",fontFamily:"monospace",fontSize:11,color:T.sky,fontStyle:"italic"}}>{r.lot}</td>
                    <td style={{padding:"9px 14px",fontWeight:600,color:T.textMain}}>{r.crop}</td>
                    <td style={{padding:"9px 14px",color:T.textSub}}>{r.seedKg}kg</td>
                    <td style={{padding:"9px 14px",fontWeight:700}}>{r.trays}</td>
                    <td style={{padding:"9px 14px",color:T.textMain}}>{r.harvKg?`${r.harvKg}kg`:<span style={{color:T.textSub}}>—</span>}</td>
                    <td style={{padding:"9px 14px",fontWeight:700,color:T.sky}}>{r.soldKg?`${r.soldKg}kg`:<span style={{color:T.textSub}}>—</span>}</td>
                    <td style={{padding:"9px 14px"}}>
                      {pct ? <span style={{fontWeight:700,color:+pct>90?T.green:+pct>70?T.amber:T.rust}}>{pct}%</span> : <span style={{color:T.textSub}}>—</span>}
                    </td>
                    <td style={{padding:"9px 14px",color:T.textSub}}>{r.wasted?`${r.wasted}kg`:<span>—</span>}</td>
                    <td style={{padding:"9px 14px"}}>
                      {r.harvKg ? <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,background:"#e8f6dc",color:"#2a6010"}}>✓ Balanced</span>
                        : <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,background:"#e8f0fb",color:"#1a3a7a"}}>📅 Pending</span>}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <div style={{padding:12,background:"#f0f6fb",borderRadius:8,border:`1px solid ${T.border}`,fontSize:12,color:T.textSub}}>
            💡 The inspector picks a product from an invoice and asks you to trace it back to the seed lot. The mass balance verifies that the quantity of seed purchased is consistent with the quantity of product sold. Any large unexplained discrepancy triggers further scrutiny.
          </div>
        </div>
      )}

      {/* Cert documents tab */}
      {activeTab==="certdocs" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[
              {icon:"🌾",title:"West Coast Seeds",type:"Seed Supplier",cert:"Pro-Cert Organic PRO-2026-WCS-001",expiry:"Jun 2027",crops:"Pea Shoots, Sunflower, Basil",status:"valid"},
              {icon:"🌾",title:"Johnny's Selected Seeds",type:"Seed Supplier",cert:"MOFGA MOF-2026-JSS-042",expiry:"Aug 2027",crops:"Pea Shoots, Cilantro",status:"valid"},
              {icon:"🌾",title:"OSC Seeds",type:"Seed Supplier",cert:"Pro-Cert PRO-2026-OSC-018",expiry:"Jan 2027",crops:"Arugula, Shiso, Kale",status:"valid"},
              {icon:"🌾",title:"Mumm's Sprouting Seeds",type:"Seed Supplier",cert:"COABC/PACS PAC-2026-MSS-007",expiry:"Mar 2027",crops:"Radish, Broccoli, Beets",status:"valid"},
              {icon:"🪴",title:"Pacific Rim Horticulture",type:"Soil Supplier",cert:"COABC/PACS PAC-SOIL-2026-001",expiry:"Mar 2027",crops:"All soil batches",status:"valid"},
              {icon:"🪴",title:"BC Coir Products",type:"Soil Supplier",cert:"Pro-Cert PRO-SOIL-2026-014",expiry:"Jan 2027",crops:"Coco coir",status:"valid"},
              {icon:"🏷️",title:"Pea Shoots M — SH-20260520-PEA-LOT001",type:"Label Approval",cert:"PACS approved 2026-04-15",expiry:"2027-04-15",crops:"Pea Shoots (M) label design",status:"valid"},
              {icon:"📋",title:"PACS Annual Inspection 2026",type:"Inspection Report",cert:"PACS Kelowna — Inspector: R. Morrison",expiry:"Due Aug 2027",crops:"Full facility — all crops",status:"due"},
            ].map((d,i)=>(
              <div key={i} style={{background:T.surface,borderRadius:10,border:`1px solid ${d.status==="valid"?T.border:"#fde68a"}`,padding:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:20}}>{d.icon}</span>
                    <div>
                      <p style={{fontSize:12,fontWeight:800,color:T.textMain,margin:0}}>{d.title}</p>
                      <p style={{fontSize:10,color:T.textSub,margin:"1px 0 0"}}>{d.type}</p>
                    </div>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,
                    background:d.status==="valid"?"#e8f6dc":"#fff7ed",
                    color:d.status==="valid"?"#2a6010":"#92400e"}}>
                    {d.status==="valid"?"✓ Valid":"📅 Due"}
                  </span>
                </div>
                <p style={{fontSize:11,color:T.textSub,margin:"0 0 4px",fontStyle:"italic"}}>{d.cert}</p>
                <p style={{fontSize:11,color:T.textSub,margin:"0 0 8px"}}>Crops: {d.crops}</p>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:10,color:T.textSub}}>Expires: {d.expiry}</span>
                  <button style={{marginLeft:"auto",padding:"4px 10px",fontSize:11,fontWeight:700,borderRadius:6,
                    border:`1px solid ${T.border}`,background:"#fff",color:T.sky,cursor:"pointer"}}>
                    View PDF ↗
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,padding:12,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,fontSize:12,color:"#92400e"}}>
            <strong>Note:</strong> All certificate documents above are fabricated for demonstration. Chris Arthur must upload real supplier certificates via the Planting Records workflow before certification.
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({label,value,mono,good}) {
  return (
    <div>
      <p style={{fontSize:9,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 2px"}}>{label}</p>
      <p style={{fontSize:12,fontWeight:600,margin:0,
        fontFamily:mono?"monospace":"inherit",
        color:good===true?"#2a6010":good===false?"#b91c1c":"#1a2e3b"}}>{value}</p>
    </div>
  );
}
