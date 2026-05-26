import { useState, useEffect, useCallback } from "react";
import { supabase, getProducts, getCustomers, getHarvestEvents, getOrderLines, upsertOrderLine, createHarvestEvent, updateHarvestEventStatus } from "./lib/supabase";

const T = {
  sidebar:"#0f2535", activeBg:"#1a3d54", label:"#4a7a96", text:"#c8dce8", textDim:"#5a8aaa",
  green:"#86b955", sky:"#3e7da1", amber:"#d4890a", rust:"#c0432b",
  bg:"#f4f6f8", surface:"#ffffff", border:"#e2e8ed", textMain:"#1a2e3b", textSub:"#5a7080",
};

const StatusPill = ({s}) => {
  const m = {confirmed:{bg:"#e8f6dc",c:"#2a6010"},complete:{bg:"#e8eef5",c:"#2a4060"},draft:{bg:"#fef3dc",c:"#7a5000"},harvesting:{bg:"#fde8e8",c:"#7a1010"}};
  const st = m[s]||{bg:"#f0f0f0",c:"#444"};
  return <span style={{background:st.bg,color:st.c,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,textTransform:"capitalize"}}>{s}</span>;
};

function Loading() {
  return <div style={{padding:40,textAlign:"center",color:T.textSub,fontSize:13}}>Loading from Supabase…</div>;
}

function EmptyState({msg, action}) {
  return (
    <div style={{padding:40,textAlign:"center"}}>
      <p style={{color:T.textSub,fontSize:13,marginBottom:16}}>{msg}</p>
      {action}
    </div>
  );
}

export default function HarvestManager() {
  const [events, setEvents]       = useState([]);
  const [products, setProducts]   = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orderLines, setOrderLines] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);
  const [view, setView]           = useState("grid");
  const [filterFamily, setFilterFamily] = useState("all");
  const [search, setSearch]       = useState("");
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue] = useState("");
  const [dbStatus, setDbStatus]   = useState("checking");

  // Initial load
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ev, pr, cu] = await Promise.all([getHarvestEvents(), getProducts(), getCustomers()]);
        setEvents(ev);
        setProducts(pr);
        setCustomers(cu);
        if (ev.length > 0) setSelectedEvent(ev[0]);
        setDbStatus(pr.length > 0 ? "connected" : "empty");
      } catch(e) {
        setDbStatus("error");
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Load order lines when event changes
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
    return orderLines.filter(l => l.product?.id === productId).reduce((s,l) => s + (l.quantity||0), 0);
  }, [orderLines]);

  const handleCellClick = (productId, customerId, currentQty) => {
    setEditingCell(`${productId}|${customerId}`);
    setCellValue(String(currentQty || ""));
  };

  const handleCellSave = async (productId, customerId) => {
    const qty = parseInt(cellValue) || 0;
    setEditingCell(null);
    // Optimistic update
    setOrderLines(prev => {
      const existing = prev.find(l => l.product?.id === productId && l.customer?.id === customerId);
      if (existing) {
        return prev.map(l => l.product?.id === productId && l.customer?.id === customerId ? {...l, quantity: qty} : l);
      } else if (qty > 0) {
        const prod = products.find(p => p.id === productId);
        const cust = customers.find(c => c.id === customerId);
        return [...prev, { product: prod, customer: cust, quantity: qty, harvest_event_id: selectedEvent.id }];
      }
      return prev;
    });
    // Save to Supabase
    await upsertOrderLine(selectedEvent.id, customerId, productId, qty);
  };

  const handleNewRun = async () => {
    const date = new Date();
    const dow = date.getDay();
    // Next Wednesday or Friday
    const daysToWed = (3 - dow + 7) % 7 || 7;
    const daysToFri = (5 - dow + 7) % 7 || 7;
    const next = daysToWed < daysToFri ? 3 : 5;
    date.setDate(date.getDate() + (next === 3 ? daysToWed : daysToFri));
    const dateStr = date.toISOString().slice(0,10);
    const day = next === 3 ? "wednesday" : "friday";
    const { data, error } = await createHarvestEvent(dateStr, day);
    if (data) {
      setEvents(prev => [data, ...prev]);
      setSelectedEvent(data);
    }
  };

  const families = ["all", ...Array.from(new Set(products.map(p => p.crop_family).filter(Boolean)))];

  const visibleProducts = products.filter(p => {
    if (filterFamily !== "all" && p.crop_family !== filterFamily) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const runTotalUnits = orderLines.reduce((s,l) => s + (l.quantity||0), 0);
  const runTotalKg = orderLines.reduce((s,l) => s + ((l.quantity||0) * (l.product?.weight_g||0) / 1000), 0);

  if (loading) return <Loading/>;

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'DM Sans','Segoe UI',sans-serif",background:T.bg,overflow:"hidden"}}>

      {/* Sidebar — event list */}
      <div style={{width:230,background:T.sidebar,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"16px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <div style={{width:32,height:32,borderRadius:7,background:`linear-gradient(135deg,${T.green},${T.sky})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#fff"}}>SH</div>
            <div>
              <p style={{color:"#fff",fontWeight:800,fontSize:13,margin:0}}>Sky Harvest</p>
              <p style={{color:T.textDim,fontSize:10,margin:0}}>Harvest Runs</p>
            </div>
          </div>
          {/* DB status indicator */}
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:6,background:"rgba(255,255,255,0.06)"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:dbStatus==="connected"?T.green:dbStatus==="error"?T.rust:T.amber,flexShrink:0}}/>
            <span style={{fontSize:10,color:T.textDim}}>{dbStatus==="connected"?"Supabase connected":dbStatus==="empty"?"DB empty — run schema SQL":dbStatus==="error"?"Connection error":"Checking…"}</span>
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
          {events.length === 0 ? (
            <p style={{fontSize:11,color:T.textDim,padding:"16px 12px"}}>No harvest runs yet. Create one below or run the schema SQL in Supabase.</p>
          ) : (
            events.map(ev => (
              <button key={ev.id} onClick={() => setSelectedEvent(ev)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:selectedEvent?.id===ev.id?T.activeBg:"transparent",border:"none",cursor:"pointer",textAlign:"left",transition:"background 0.15s"}}>
                <span style={{fontSize:15}}>{ev.day_of_week==="wednesday"?"🌿":"🌱"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:selectedEvent?.id===ev.id?700:500,color:selectedEvent?.id===ev.id?"#fff":T.text,margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {new Date(ev.date).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"2-digit"})}
                  </p>
                </div>
                <StatusPill s={ev.status}/>
              </button>
            ))
          )}
        </div>

        <div style={{padding:12,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <button onClick={handleNewRun} style={{width:"100%",padding:"8px",background:T.sky,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            + New Run
          </button>
          <p style={{fontSize:9,color:T.textDim,textAlign:"center",margin:"6px 0 0"}}>Creates next Wed or Fri automatically</p>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
          {selectedEvent ? (
            <>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <h2 style={{fontSize:18,fontWeight:900,color:T.textMain,margin:0}}>
                    {new Date(selectedEvent.date).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                  </h2>
                  <StatusPill s={selectedEvent.status}/>
                </div>
                <p style={{fontSize:12,color:T.textSub,margin:"3px 0 0"}}>
                  {orderLoading ? "Loading orders…" : `${runTotalUnits} packs  ·  ${runTotalKg.toFixed(1)} kg  ·  ${new Set(orderLines.map(l=>l.customer?.id)).size} customers`}
                </p>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                {["grid","picklist"].map(v=>(
                  <button key={v} onClick={()=>setView(v)}
                    style={{padding:"6px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:`1px solid ${T.border}`,cursor:"pointer",background:view===v?T.sky:"#fff",color:view===v?"#fff":T.textMain,transition:"all 0.15s"}}>
                    {v==="grid"?"📊 Order Grid":"✅ Pick List"}
                  </button>
                ))}
                {selectedEvent.status === "confirmed" && (
                  <button onClick={() => updateHarvestEventStatus(selectedEvent.id, "harvesting")}
                    style={{padding:"6px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:`1px solid ${T.green}`,cursor:"pointer",background:T.green,color:"#fff"}}>
                    Start Harvest
                  </button>
                )}
              </div>
            </>
          ) : (
            <p style={{color:T.textSub,fontSize:13}}>Select a run from the left panel or create a new one</p>
          )}
        </div>

        {!selectedEvent ? (
          <EmptyState msg="No harvest run selected." action={
            <button onClick={handleNewRun} style={{padding:"8px 20px",background:T.sky,color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>
              Create first run
            </button>
          }/>
        ) : dbStatus === "empty" ? (
          <div style={{padding:32,maxWidth:600}}>
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:24}}>
              <h3 style={{color:"#92400e",margin:"0 0 12px",fontSize:15}}>⚠ Database is empty</h3>
              <p style={{color:"#78350f",fontSize:13,lineHeight:1.6,margin:"0 0 16px"}}>
                The Supabase project is connected but no tables exist yet. Run the schema SQL to create the tables and seed the real data from the harvest spreadsheets.
              </p>
              <ol style={{color:"#78350f",fontSize:13,lineHeight:2,paddingLeft:20,margin:0}}>
                <li>Go to <strong>supabase.com</strong> → your project → <strong>SQL Editor</strong></li>
                <li>Paste the contents of <strong>sky_harvest_schema.sql</strong></li>
                <li>Click <strong>Run</strong></li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>
        ) : view === "grid" ? (
          <>
            {/* Filters */}
            <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"8px 20px",display:"flex",alignItems:"center",gap:10,flexShrink:0,overflowX:"auto"}}>
              <input placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{padding:"6px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,outline:"none",width:160,flexShrink:0}}/>
              {families.slice(0,10).map(f=>(
                <button key={f} onClick={()=>setFilterFamily(f)}
                  style={{padding:"4px 10px",fontSize:11,fontWeight:700,borderRadius:6,border:`1px solid ${f===filterFamily?T.sky:T.border}`,cursor:"pointer",background:f===filterFamily?T.sky:"#fff",color:f===filterFamily?"#fff":T.textSub,whiteSpace:"nowrap",flexShrink:0,transition:"all 0.12s"}}>
                  {f==="all"?"All crops":f}
                </button>
              ))}
              <p style={{fontSize:10,color:T.textSub,marginLeft:"auto",whiteSpace:"nowrap",flexShrink:0}}>Click any cell to edit. Changes save to Supabase instantly.</p>
            </div>

            {/* Grid */}
            <div style={{flex:1,overflow:"auto"}}>
              {orderLoading ? <Loading/> : customers.length === 0 ? (
                <EmptyState msg="No customers in database yet. Run the schema SQL first."/>
              ) : (
                <table style={{borderCollapse:"collapse",fontSize:12,minWidth:"100%"}}>
                  <thead>
                    <tr style={{background:T.textMain,position:"sticky",top:0,zIndex:10}}>
                      <th style={{textAlign:"left",padding:"10px 16px",color:"#fff",fontWeight:700,fontSize:11,letterSpacing:"0.06em",textTransform:"uppercase",position:"sticky",left:0,background:T.textMain,minWidth:190,boxShadow:"2px 0 4px rgba(0,0,0,0.2)"}}>Product</th>
                      <th style={{padding:"10px 8px",color:"rgba(255,255,255,0.5)",fontWeight:600,fontSize:10,textAlign:"center",minWidth:48}}>g</th>
                      <th style={{padding:"10px 12px",color:T.green,fontWeight:800,fontSize:11,textAlign:"center",background:"#122030",minWidth:56}}>TOTAL</th>
                      <th style={{padding:"10px 12px",color:T.green,fontWeight:800,fontSize:11,textAlign:"center",background:"#122030",minWidth:52}}>kg</th>
                      {customers.map(c=>(
                        <th key={c.id} style={{padding:"4px 4px 0",color:"rgba(255,255,255,0.8)",fontWeight:600,fontSize:10,textAlign:"center",minWidth:44}}>
                          <div style={{transform:"rotate(-40deg)",transformOrigin:"bottom left",display:"inline-block",paddingLeft:4,marginBottom:-6,marginTop:20,whiteSpace:"nowrap",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}}>
                            {c.name.split(" ").slice(0,2).join(" ")}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set(visibleProducts.map(p=>p.crop_family))).map(family => {
                      const fps = visibleProducts.filter(p=>p.crop_family===family);
                      return fps.map((p,pi) => {
                        const total = getProductTotal(p.id);
                        const kg = (total * p.weight_g / 1000).toFixed(2);
                        return (
                          <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`,background:pi%2===0?"#fff":"#fafbfc"}}
                            onMouseEnter={e=>e.currentTarget.style.background="#f0f7ff"}
                            onMouseLeave={e=>e.currentTarget.style.background=pi%2===0?"#fff":"#fafbfc"}>
                            <td style={{padding:"7px 16px",fontWeight:600,color:T.textMain,position:"sticky",left:0,background:"inherit",boxShadow:"2px 0 4px rgba(0,0,0,0.04)"}}>
                              {pi===0 && <span style={{fontSize:9,fontWeight:800,color:T.sky,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:1}}>{family}</span>}
                              {p.name}
                            </td>
                            <td style={{padding:"7px 8px",color:T.textSub,textAlign:"center",fontSize:11}}>{p.weight_g}</td>
                            <td style={{padding:"7px 12px",fontWeight:900,textAlign:"center",background:"#f0f8ea",color:total>0?"#2a6010":"#ccc",borderRight:`1px solid ${T.border}`}}>{total||"—"}</td>
                            <td style={{padding:"7px 12px",fontWeight:700,textAlign:"center",background:"#f0f8ea",color:T.sky,borderRight:`2px solid ${T.border}`,fontSize:11}}>{total>0?kg:"—"}</td>
                            {customers.map(c => {
                              const qty = getQty(p.id, c.id);
                              const cellKey = `${p.id}|${c.id}`;
                              const isEditing = editingCell === cellKey;
                              return (
                                <td key={c.id} style={{padding:"4px",textAlign:"center",minWidth:44}}>
                                  {isEditing ? (
                                    <input autoFocus value={cellValue}
                                      onChange={e=>setCellValue(e.target.value)}
                                      onBlur={()=>handleCellSave(p.id, c.id)}
                                      onKeyDown={e=>{if(e.key==="Enter")handleCellSave(p.id,c.id);if(e.key==="Escape")setEditingCell(null);}}
                                      style={{width:36,padding:"2px 4px",fontSize:12,fontWeight:700,textAlign:"center",border:`2px solid ${T.sky}`,borderRadius:4,outline:"none"}}/>
                                  ) : (
                                    <span onClick={()=>handleCellClick(p.id, c.id, qty)}
                                      style={{display:"inline-block",minWidth:28,padding:"2px 5px",borderRadius:5,fontSize:12,fontWeight:qty>0?700:400,
                                        background:qty>0?"#e8f4ff":"transparent",color:qty>0?T.sky:"#d1d5db",cursor:"pointer",
                                        border:`1px solid ${qty>0?"#bfdbfe":"transparent"}`,transition:"all 0.1s"}}>
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
                      <td style={{padding:"10px 16px",fontWeight:800,color:"#fff",position:"sticky",left:0,background:T.textMain}}>TOTAL</td>
                      <td/>
                      <td style={{padding:"10px 12px",fontWeight:900,textAlign:"center",color:T.green}}>{runTotalUnits}</td>
                      <td style={{padding:"10px 12px",fontWeight:900,textAlign:"center",color:T.green}}>{runTotalKg.toFixed(1)}</td>
                      {customers.map(c=>{
                        const t = orderLines.filter(l=>l.customer?.id===c.id).reduce((s,l)=>s+(l.quantity||0),0);
                        return <td key={c.id} style={{padding:"10px 4px",textAlign:"center",fontWeight:700,color:t>0?"#fff":"rgba(255,255,255,0.2)",fontSize:12}}>{t||"—"}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          /* Pick list view */
          <div style={{flex:1,overflow:"auto",padding:20}}>
            <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden",maxWidth:680}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,background:"#f8fafb",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{fontSize:13,fontWeight:800,color:T.textMain,margin:0}}>
                    {new Date(selectedEvent.date).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})} — Pick List
                  </p>
                  <p style={{fontSize:11,color:T.textSub,margin:"2px 0 0"}}>{runTotalUnits} units · {runTotalKg.toFixed(1)} kg · Pack by 6:30 AM</p>
                </div>
                <button style={{padding:"6px 14px",fontSize:11,fontWeight:700,borderRadius:8,border:`1px solid ${T.border}`,cursor:"pointer",background:"#fff",color:T.textMain}}>
                  🖨 Print
                </button>
              </div>
              {orderLoading ? <Loading/> : (
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr style={{borderBottom:`1px solid ${T.border}`,background:"#f8fafb"}}>
                    {["","Crop / Pack","Units","Pack wt (g)","Total (g)","kg"].map(h=>(
                      <th key={h} style={{textAlign:"left",padding:"8px 16px",fontSize:10,fontWeight:700,color:T.textSub,letterSpacing:"0.06em",textTransform:"uppercase"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {Array.from(new Set(orderLines.map(l=>l.product?.crop_family))).map(family => {
                      const lines = orderLines.filter(l=>l.product?.crop_family===family);
                      // Aggregate by product
                      const byProduct = {};
                      lines.forEach(l=>{
                        const k = l.product?.id;
                        if(!byProduct[k]) byProduct[k]={product:l.product,total:0};
                        byProduct[k].total += (l.quantity||0);
                      });
                      return Object.values(byProduct).map((row,i)=>(
                        <tr key={row.product?.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?"#fff":"#fafbfc"}}>
                          <td style={{padding:"10px 16px"}}>
                            <div style={{width:17,height:17,borderRadius:4,border:`2px solid #c8d8e8`,background:"transparent"}}/>
                          </td>
                          <td style={{padding:"10px 16px",fontWeight:600,color:T.textMain}}>{row.product?.name}</td>
                          <td style={{padding:"10px 16px",fontWeight:800,color:T.textMain}}>{row.total}</td>
                          <td style={{padding:"10px 16px",color:T.textSub}}>{row.product?.weight_g}</td>
                          <td style={{padding:"10px 16px",color:T.textSub}}>{(row.total*(row.product?.weight_g||0)).toLocaleString()}</td>
                          <td style={{padding:"10px 16px",fontWeight:700,color:T.sky}}>{(row.total*(row.product?.weight_g||0)/1000).toFixed(2)}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
