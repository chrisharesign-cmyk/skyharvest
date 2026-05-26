import { useState, useEffect, useCallback } from "react";
import { supabase, getProducts, getCustomers, getHarvestEvents, getOrderLines, upsertOrderLine, createHarvestEvent, updateHarvestEventStatus } from "./lib/supabase";

const T = {
  sidebar:"#0f2535",activeBg:"#1a3d54",label:"#4a7a96",text:"#c8dce8",textDim:"#5a8aaa",
  green:"#86b955",sky:"#3e7da1",amber:"#d4890a",rust:"#c0432b",
  bg:"#f4f6f8",surface:"#ffffff",border:"#e2e8ed",textMain:"#1a2e3b",textSub:"#5a7080",
};

const StatusPill = ({s}) => {
  const m = {confirmed:{bg:"#e8f6dc",c:"#2a6010"},complete:{bg:"#e8eef5",c:"#2a4060"},draft:{bg:"#fef3dc",c:"#7a5000"},harvesting:{bg:"#fde8e8",c:"#7a1010"}};
  const st = m[s]||{bg:"#f0f0f0",c:"#444"};
  return <span style={{background:st.bg,color:st.c,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,textTransform:"capitalize"}}>{s}</span>;
};

export default function HarvestManager() {
  const [events, setEvents]         = useState([]);
  const [products, setProducts]     = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [orderLines, setOrderLines] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);
  const [view, setView]             = useState("grid");
  const [filterFamily, setFilterFamily] = useState("all");
  const [search, setSearch]         = useState("");
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue]   = useState("");
  const [dbStatus, setDbStatus]     = useState("checking");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ev, pr, cu] = await Promise.all([getHarvestEvents(), getProducts(), getCustomers()]);
        setEvents(ev); setProducts(pr); setCustomers(cu);
        if (ev.length > 0) setSelectedEvent(ev[0]);
        setDbStatus(pr.length > 0 ? "connected" : "empty");
      } catch(e) { setDbStatus("error"); }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    async function loadLines() {
      setOrderLoading(true);
      const lines = await getOrderLines(selectedEvent.id);
      setOrderLines(lines);
      setOrderLoading(false);
    }
    loadLines();
  }, [selectedEvent]);

  const getQty = useCallback((productId, customerId) => {
    const line = orderLines.find(l => l.product?.id === productId && l.customer?.id === customerId);
    return line?.quantity || 0;
  }, [orderLines]);

  const getProductTotal = useCallback((productId) => {
    return orderLines.filter(l => l.product?.id === productId).reduce((s,l) => s+(l.quantity||0), 0);
  }, [orderLines]);

  const handleCellSave = async (productId, customerId) => {
    const qty = parseInt(cellValue) || 0;
    setEditingCell(null);
    setOrderLines(prev => {
      const ex = prev.find(l => l.product?.id === productId && l.customer?.id === customerId);
      if (ex) return prev.map(l => l.product?.id===productId && l.customer?.id===customerId ? {...l,quantity:qty} : l);
      else if (qty > 0) {
        const prod = products.find(p=>p.id===productId);
        const cust = customers.find(c=>c.id===customerId);
        return [...prev, {product:prod,customer:cust,quantity:qty,harvest_event_id:selectedEvent.id}];
      }
      return prev;
    });
    await upsertOrderLine(selectedEvent.id, customerId, productId, qty);
  };

  const handleNewRun = async () => {
    const date = new Date();
    const dow = date.getDay();
    const daysToWed = (3-dow+7)%7||7;
    const daysToFri = (5-dow+7)%7||7;
    const next = daysToWed < daysToFri ? 3 : 5;
    date.setDate(date.getDate() + (next===3?daysToWed:daysToFri));
    const dateStr = date.toISOString().slice(0,10);
    const {data} = await createHarvestEvent(dateStr, next===3?"wednesday":"friday");
    if (data) { setEvents(prev=>[data,...prev]); setSelectedEvent(data); }
  };

  const families = ["all", ...Array.from(new Set(products.map(p=>p.crop_family).filter(Boolean)))];
  const visibleProducts = products.filter(p => {
    if (filterFamily !== "all" && p.crop_family !== filterFamily) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const runTotalUnits = orderLines.reduce((s,l)=>s+(l.quantity||0), 0);
  const runTotalKg = orderLines.reduce((s,l)=>s+((l.quantity||0)*(l.product?.weight_g||0)/1000), 0);

  if (loading) return <div style={{padding:40,textAlign:"center",color:T.textSub,fontSize:13}}>Loading from Supabase…</div>;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",fontFamily:"'DM Sans','Segoe UI',sans-serif",overflow:"hidden"}}>

      {/* Event tabs — horizontal selector, no sidebar */}
      <div style={{background:T.sidebar,flexShrink:0,display:"flex",alignItems:"stretch",overflowX:"auto",borderBottom:"2px solid rgba(255,255,255,0.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:4,padding:"0 12px",flexShrink:0}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:dbStatus==="connected"?T.green:dbStatus==="empty"?T.amber:T.rust}}/>
          <span style={{fontSize:10,color:T.textDim,whiteSpace:"nowrap"}}>{dbStatus==="connected"?"DB connected":dbStatus==="empty"?"Run schema SQL":"Error"}</span>
        </div>
        <div style={{width:1,background:"rgba(255,255,255,0.1)",margin:"8px 0",flexShrink:0}}/>
        {events.slice(0,12).map(ev => (
          <button key={ev.id} onClick={()=>setSelectedEvent(ev)}
            style={{padding:"10px 14px",border:"none",background:"transparent",cursor:"pointer",
              borderBottom:selectedEvent?.id===ev.id?`2px solid ${T.green}`:"2px solid transparent",
              color:selectedEvent?.id===ev.id?"#fff":T.textDim,fontWeight:selectedEvent?.id===ev.id?700:400,
              fontSize:12,whiteSpace:"nowrap",flexShrink:0,transition:"all 0.15s",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:13}}>{ev.day_of_week==="wednesday"?"🌿":"🌱"}</span>
            {new Date(ev.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}
            <StatusPill s={ev.status}/>
          </button>
        ))}
        <button onClick={handleNewRun}
          style={{padding:"8px 14px",border:"none",background:"transparent",cursor:"pointer",
            color:T.green,fontSize:12,fontWeight:700,flexShrink:0,marginLeft:"auto",whiteSpace:"nowrap"}}>
          + New Run
        </button>
      </div>

      {/* Header */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"10px 20px",display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
        {selectedEvent ? (
          <>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <h2 style={{fontSize:16,fontWeight:900,color:T.textMain,margin:0}}>
                  {new Date(selectedEvent.date).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                </h2>
                <StatusPill s={selectedEvent.status}/>
              </div>
              <p style={{fontSize:11,color:T.textSub,margin:"2px 0 0"}}>
                {orderLoading?"Loading…":`${runTotalUnits} packs · ${runTotalKg.toFixed(1)} kg · ${new Set(orderLines.map(l=>l.customer?.id)).size} customers`}
              </p>
            </div>
            <div style={{display:"flex",gap:8}}>
              {[["grid","📊 Order Grid"],["picklist","✅ Pick List"]].map(([v,l])=>(
                <button key={v} onClick={()=>setView(v)}
                  style={{padding:"6px 12px",fontSize:11,fontWeight:700,borderRadius:7,border:`1px solid ${T.border}`,cursor:"pointer",
                    background:view===v?T.sky:"#fff",color:view===v?"#fff":T.textMain}}>
                  {l}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p style={{color:T.textSub,fontSize:13}}>
            {events.length === 0 ? "No harvest runs yet. Run the schema SQL in Supabase to get started." : "Select a run above."}
          </p>
        )}
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {dbStatus === "empty" ? (
          <div style={{padding:24,maxWidth:600}}>
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:20}}>
              <h3 style={{color:"#92400e",margin:"0 0 10px",fontSize:14}}>⚠ Database empty — run schema SQL first</h3>
              <ol style={{color:"#78350f",fontSize:12,lineHeight:2,paddingLeft:20,margin:0}}>
                <li>Go to <strong>supabase.com</strong> → your project → <strong>SQL Editor</strong></li>
                <li>Paste sky_harvest_schema.sql and click <strong>Run</strong></li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>
        ) : view === "grid" && selectedEvent ? (
          <>
            {/* Filters */}
            <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"6px 16px",display:"flex",alignItems:"center",gap:8,flexShrink:0,overflowX:"auto"}}>
              <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{padding:"5px 10px",border:`1px solid ${T.border}`,borderRadius:7,fontSize:11,outline:"none",width:140,flexShrink:0}}/>
              {families.slice(0,8).map(f=>(
                <button key={f} onClick={()=>setFilterFamily(f)}
                  style={{padding:"3px 9px",fontSize:10,fontWeight:700,borderRadius:6,border:`1px solid ${f===filterFamily?T.sky:T.border}`,
                    cursor:"pointer",background:f===filterFamily?T.sky:"#fff",color:f===filterFamily?"#fff":T.textSub,whiteSpace:"nowrap",flexShrink:0}}>
                  {f==="all"?"All":f}
                </button>
              ))}
              <span style={{fontSize:10,color:T.textSub,marginLeft:"auto",flexShrink:0,fontStyle:"italic"}}>Click cell to edit · saves to Supabase</span>
            </div>
            {/* Grid */}
            <div style={{flex:1,overflow:"auto"}}>
              {customers.length===0 ? (
                <div style={{padding:24,textAlign:"center",color:T.textSub,fontSize:13}}>No customers yet — run the schema SQL to seed data.</div>
              ) : (
                <table style={{borderCollapse:"collapse",fontSize:11,minWidth:"100%"}}>
                  <thead>
                    <tr style={{background:T.textMain,position:"sticky",top:0,zIndex:10}}>
                      <th style={{textAlign:"left",padding:"9px 14px",color:"#fff",fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em",position:"sticky",left:0,background:T.textMain,minWidth:170,boxShadow:"2px 0 4px rgba(0,0,0,0.2)"}}>Product</th>
                      <th style={{padding:"9px 8px",color:"rgba(255,255,255,0.5)",fontWeight:600,fontSize:10,textAlign:"center",minWidth:42}}>g</th>
                      <th style={{padding:"9px 10px",color:T.green,fontWeight:800,fontSize:10,textAlign:"center",background:"#122030",minWidth:50}}>TOTAL</th>
                      <th style={{padding:"9px 10px",color:T.green,fontWeight:800,fontSize:10,textAlign:"center",background:"#122030",minWidth:46}}>kg</th>
                      {customers.map(c=>(
                        <th key={c.id} style={{padding:"4px 3px 0",color:"rgba(255,255,255,0.8)",fontWeight:600,fontSize:9,textAlign:"center",minWidth:40}}>
                          <div style={{transform:"rotate(-40deg)",transformOrigin:"bottom left",display:"inline-block",paddingLeft:3,marginBottom:-4,marginTop:16,whiteSpace:"nowrap",maxWidth:70,overflow:"hidden",textOverflow:"ellipsis"}}>
                            {c.name.split(" ").slice(0,2).join(" ")}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set(visibleProducts.map(p=>p.crop_family))).map(family=>{
                      const fps=visibleProducts.filter(p=>p.crop_family===family);
                      return fps.map((p,pi)=>{
                        const total=getProductTotal(p.id);
                        const kg=(total*p.weight_g/1000).toFixed(2);
                        return(
                          <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`,background:pi%2===0?"#fff":"#fafbfc"}}
                            onMouseEnter={e=>e.currentTarget.style.background="#f0f7ff"}
                            onMouseLeave={e=>e.currentTarget.style.background=pi%2===0?"#fff":"#fafbfc"}>
                            <td style={{padding:"6px 14px",fontWeight:600,color:T.textMain,position:"sticky",left:0,background:"inherit",boxShadow:"2px 0 3px rgba(0,0,0,0.04)",fontSize:11}}>
                              {pi===0&&<span style={{fontSize:9,fontWeight:800,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:1}}>{family}</span>}
                              {p.name}
                            </td>
                            <td style={{padding:"6px 8px",color:T.textSub,textAlign:"center",fontSize:10}}>{p.weight_g}</td>
                            <td style={{padding:"6px 10px",fontWeight:900,textAlign:"center",background:"#f0f8ea",color:total>0?"#2a6010":"#ccc",borderRight:`1px solid ${T.border}`}}>{total||"—"}</td>
                            <td style={{padding:"6px 10px",fontWeight:700,textAlign:"center",background:"#f0f8ea",color:T.sky,borderRight:`2px solid ${T.border}`,fontSize:10}}>{total>0?kg:"—"}</td>
                            {customers.map(c=>{
                              const qty=getQty(p.id,c.id);
                              const cellKey=`${p.id}|${c.id}`;
                              const isEditing=editingCell===cellKey;
                              return(
                                <td key={c.id} style={{padding:"3px",textAlign:"center",minWidth:40}}>
                                  {isEditing?(
                                    <input autoFocus value={cellValue} onChange={e=>setCellValue(e.target.value)}
                                      onBlur={()=>handleCellSave(p.id,c.id)}
                                      onKeyDown={e=>{if(e.key==="Enter")handleCellSave(p.id,c.id);if(e.key==="Escape")setEditingCell(null);}}
                                      style={{width:34,padding:"2px 3px",fontSize:11,fontWeight:700,textAlign:"center",border:`2px solid ${T.sky}`,borderRadius:4,outline:"none"}}/>
                                  ):(
                                    <span onClick={()=>{setEditingCell(cellKey);setCellValue(String(qty||""));}}
                                      style={{display:"inline-block",minWidth:26,padding:"2px 4px",borderRadius:4,fontSize:11,fontWeight:qty>0?700:400,
                                        background:qty>0?"#e8f4ff":"transparent",color:qty>0?T.sky:"#d1d5db",cursor:"pointer",border:`1px solid ${qty>0?"#bfdbfe":"transparent"}`}}>
                                      {qty||"·"}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });
                    })}
                    <tr style={{background:T.textMain,position:"sticky",bottom:0}}>
                      <td style={{padding:"9px 14px",fontWeight:800,color:"#fff",position:"sticky",left:0,background:T.textMain}}>TOTAL</td>
                      <td/><td style={{padding:"9px 10px",fontWeight:900,textAlign:"center",color:T.green}}>{runTotalUnits}</td>
                      <td style={{padding:"9px 10px",fontWeight:900,textAlign:"center",color:T.green}}>{runTotalKg.toFixed(1)}</td>
                      {customers.map(c=>{
                        const t=orderLines.filter(l=>l.customer?.id===c.id).reduce((s,l)=>s+(l.quantity||0),0);
                        return <td key={c.id} style={{padding:"9px 3px",textAlign:"center",fontWeight:700,color:t>0?"#fff":"rgba(255,255,255,0.2)",fontSize:11}}>{t||"—"}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : view === "picklist" && selectedEvent ? (
          <div style={{flex:1,overflow:"auto",padding:16}}>
            <div style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden",maxWidth:640}}>
              <div style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}`,background:"#f8fafb",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{fontSize:13,fontWeight:800,color:T.textMain,margin:0}}>
                    {new Date(selectedEvent.date).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})} — Pick List
                  </p>
                  <p style={{fontSize:11,color:T.textSub,margin:"2px 0 0"}}>{runTotalUnits} units · {runTotalKg.toFixed(1)} kg · Pack by 6:30 AM</p>
                </div>
                <button style={{padding:"5px 12px",fontSize:11,fontWeight:700,borderRadius:7,border:`1px solid ${T.border}`,cursor:"pointer",background:"#fff",color:T.textMain}}>🖨 Print</button>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:"#f8fafb"}}>
                  {["","Crop / Pack","Units","g","Total (g)","kg"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"7px 14px",fontSize:9,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {Array.from(new Set(orderLines.map(l=>l.product?.crop_family))).map(family=>{
                    const lines=orderLines.filter(l=>l.product?.crop_family===family);
                    const byProduct={};
                    lines.forEach(l=>{const k=l.product?.id;if(!byProduct[k])byProduct[k]={product:l.product,total:0};byProduct[k].total+=(l.quantity||0);});
                    return Object.values(byProduct).map((row,i)=>(
                      <tr key={row.product?.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?"#fff":"#fafbfc"}}>
                        <td style={{padding:"9px 14px"}}><div style={{width:16,height:16,borderRadius:3,border:`2px solid #c8d8e8`}}/></td>
                        <td style={{padding:"9px 14px",fontWeight:600,color:T.textMain}}>{row.product?.name}</td>
                        <td style={{padding:"9px 14px",fontWeight:800,color:T.textMain}}>{row.total}</td>
                        <td style={{padding:"9px 14px",color:T.textSub}}>{row.product?.weight_g}</td>
                        <td style={{padding:"9px 14px",color:T.textSub}}>{(row.total*(row.product?.weight_g||0)).toLocaleString()}</td>
                        <td style={{padding:"9px 14px",fontWeight:700,color:T.sky}}>{(row.total*(row.product?.weight_g||0)/1000).toFixed(2)}</td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
