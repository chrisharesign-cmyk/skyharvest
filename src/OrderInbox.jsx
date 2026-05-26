import { useState, useEffect } from "react";
import { confirmOrderLines, cancelOrder, subscribe, getState } from "./lib/workflowStore";

const T = {
  sidebar:"#0f2535",activeBg:"#1a3d54",label:"#4a7a96",text:"#c8dce8",textDim:"#5a8aaa",
  green:"#86b955",sky:"#3e7da1",amber:"#d4890a",rust:"#c0432b",
  bg:"#f4f6f8",surface:"#ffffff",border:"#e2e8ed",textMain:"#1a2e3b",textSub:"#5a7080",
};

const STANDING_EMAILS = [
  {
    customer:"SPUD Vancouver",sent:"Mon 26 May, 07:00",
    subject:"Your Sky Harvest standing order — Wednesday 28 May",
    body:`Hi SPUD Team,\n\nYour standing order is confirmed for Wednesday 28 May delivery.\n\n• Pea Shoots (M) × 49 — $185.82\n• Pea Shoots (SPUD Label) (M) × 24 — $91.20\n• Sunflower Shoots (RETAIL) (M) × 43 — $167.70\n• Radish Blend (SPUD Label) (S) × 16 — $60.80\n\nTotal: $505.52 + GST\n\nReply by Tuesday 10am to make any changes.\nNo reply needed if everything looks good.\n\nChris & the Sky Harvest team`,
    reply:null,status:"auto-confirmed",
    parsed:{delivery:"2026-05-28",confidence:"high",items:[
      {product:"Pea Shoots (M)",qty:49,match:"high"},
      {product:"Pea Shoots (SPUD Label) (M)",qty:24,match:"high"},
      {product:"Sunflower Shoots (RETAIL) (M)",qty:43,match:"high"},
      {product:"Radish Blend (SPUD Label) (S)",qty:16,match:"high"},
    ]}
  },
  {
    customer:"Choices North Van",sent:"Mon 26 May, 07:00",
    subject:"Your Sky Harvest standing order — Wednesday 28 May",
    body:`Hi Choices North Van,\n\nYour standing order is confirmed for Wednesday 28 May delivery.\n\n• Pea Shoots (M) × 12 — $45.48\n• Sunflower Shoots (M) × 8 — $31.20\n• Radish Blend (M) × 6 — $22.80\n• Kale (S) × 4 — $9.60\n\nTotal: $109.08 + GST\n\nReply by Tuesday 10am to make any changes.\n\nChris & the Sky Harvest team`,
    reply:{from:"buying@choices.ca",time:"Mon 26 May, 09:14",text:"Hi Chris! Could you add 2 extra Pea Shoots (M) this week? We've got a big event Wednesday evening. Thanks!"},
    status:"amended",
    parsedAmendment:{product:"Pea Shoots (M)",change:"+2",newQty:14},
    parsed:{delivery:"2026-05-28",confidence:"high",items:[
      {product:"Pea Shoots (M)",qty:14,match:"high"},
      {product:"Sunflower Shoots (M)",qty:8,match:"high"},
      {product:"Radish Blend (M)",qty:6,match:"high"},
      {product:"Kale (S)",qty:4,match:"high"},
    ]}
  },
  {
    customer:"Terminal City Club",sent:"Mon 26 May, 07:00",
    subject:"Your Sky Harvest standing order — Wednesday 28 May",
    body:`Hi Terminal City Club,\n\nYour standing order is confirmed for Wednesday 28 May delivery.\n\n• Pea Shoots (M) × 8 — $30.32\n• Sunflower Shoots (L) × 4 — $31.60\n• Mellow Mix (L) × 3 — $27.48\n• Cilantro (M) × 2 — $5.30\n\nTotal: $94.70 + GST\n\nReply by Tuesday 10am for any changes.\n\nChris & the Sky Harvest team`,
    reply:null,status:"no-reply-confirmed",
    parsed:{delivery:"2026-05-28",confidence:"high",items:[
      {product:"Pea Shoots (M)",qty:8,match:"high"},
      {product:"Sunflower Shoots (L)",qty:4,match:"high"},
      {product:"Mellow Mix (L)",qty:3,match:"high"},
      {product:"Cilantro (M)",qty:2,match:"high"},
    ]}
  },
];

const STANDING_ORDERS = [
  {customer:"SPUD Vancouver",delivery:"Wed+Fri",items:6,lastChanged:"Apr 3",status:"active"},
  {customer:"Choices North Van",delivery:"Wed+Fri",items:4,lastChanged:"Mar 18",status:"active"},
  {customer:"Stongs North Van",delivery:"Wed",items:5,lastChanged:"May 6",status:"active"},
  {customer:"Greens Market",delivery:"Wed+Fri",items:7,lastChanged:"Apr 22",status:"active"},
  {customer:"Terminal City Club",delivery:"Wed",items:4,lastChanged:"Apr 8",status:"active"},
  {customer:"Okini",delivery:"Fri",items:3,lastChanged:"May 13",status:"active"},
  {customer:"Plaza Premium",delivery:"Wed+Fri",items:5,lastChanged:"Mar 25",status:"active"},
  {customer:"Ancora Waterfront",delivery:"Wed",items:4,lastChanged:"Apr 29",status:"watch"},
  {customer:"Masayoshi",delivery:"Wed",items:3,lastChanged:"Apr 15",status:"active"},
  {customer:"Kingyo Izakaya",delivery:"Wed",items:3,lastChanged:"Apr 1",status:"active"},
];

const INBOX = [
  {
    id:"msg-001",channel:"email",from:"Chef Haru <haru@kingyo.ca>",customer:"Kingyo Izakaya",
    subject:"Order for Wednesday",received:"Mon 26 May, 08:14",
    body:`Hi Chris,\n\nHope you're well. Could you send us over for Wednesday:\n- 4 of the shiso green medium\n- 2 pea shoots large\n- 1 purple basil small\n\nThanks!\nHaru`,
    parsed:{delivery:"2026-05-28",confidence:"high",items:[
      {raw:"4 of the shiso green medium",product:"Shiso, Green (M)",qty:4,match:"high"},
      {raw:"2 pea shoots large",product:"Pea Shoots (L)",qty:2,match:"high"},
      {raw:"1 purple basil small",product:"Basil, Purple (S)",qty:1,match:"high"},
    ]}
  },
  {
    id:"msg-002",channel:"email",from:"kitchen@ancora.ca",customer:"Ancora Waterfront",
    subject:"Re: Wednesday delivery",received:"Mon 26 May, 09:02",
    body:`Hi — usual order please for Wednesday but drop the mellow mix this week, we're changing the menu. Add 3 extra pea shoots medium instead.\n\nThanks`,
    parsed:{delivery:"2026-05-28",confidence:"medium",
      note:"References standing order. Removing Mellow Mix, adding 3 Pea Shoots (M).",
      items:[
        {raw:"usual order",product:"[Standing order]",qty:null,match:"standing"},
        {raw:"drop the mellow mix this week",product:"Mellow Mix (M)",qty:0,match:"high",remove:true},
        {raw:"3 extra pea shoots medium",product:"Pea Shoots (M)",qty:3,match:"high",delta:true},
        {raw:"sunflower shoots medium",product:"Sunflower Shoots (M)",qty:6,match:"standing"},
        {raw:"radish blend large",product:"Radish Blend (L)",qty:2,match:"standing"},
      ]}
  },
  {
    id:"msg-003",channel:"voicemail",from:"+1 604 555 0182",customer:"Terminal City Club",
    subject:"Voicemail 1m 14s",received:"Mon 26 May, 09:31",
    transcript:`Hi this is James from Terminal City, just calling to place this week's order for Wednesday. We'd like uh... 8 pea shoots medium, 4 sunflower large, and can you do us 3 of the mellow mix large please? Oh and if you've got any sky hearts this week we'd take 2 of the small. Thanks, bye.`,
    parsed:{delivery:"2026-05-28",confidence:"high",items:[
      {raw:"8 pea shoots medium",product:"Pea Shoots (M)",qty:8,match:"high"},
      {raw:"4 sunflower large",product:"Sunflower Shoots (L)",qty:4,match:"high"},
      {raw:"3 of the mellow mix large",product:"Mellow Mix (L)",qty:3,match:"high"},
      {raw:"2 of the small sky hearts",product:"Sky Hearts (S)",qty:2,match:"high",conditional:true},
    ]}
  },
  {
    id:"msg-004",channel:"whatsapp",from:"+1 604 555 0241",customer:"Masayoshi",
    subject:"WhatsApp message",received:"Mon 26 May, 10:15",
    body:`Hey Chris, we need Friday delivery this week not Wednesday — same as usual. Also add 2 shiso britton medium if you have them`,
    parsed:{delivery:"2026-05-30",confidence:"medium",
      note:"Delivery day changed to Friday. Stock check needed for Shiso Britton.",
      items:[
        {raw:"same as usual — Pea Shoots M",product:"Pea Shoots (M)",qty:6,match:"standing"},
        {raw:"Arugula M usual",product:"Arugula (M)",qty:3,match:"standing"},
        {raw:"2 shiso britton medium",product:"Shiso, Britton (M)",qty:2,match:"high",checkStock:true},
      ]}
  },
  {
    id:"msg-005",channel:"email",from:"procurement@compass.ca",customer:"Compass",
    subject:"Cancel this week",received:"Mon 26 May, 11:04",
    body:`Hi, please cancel our delivery this week. We'll be back on the following week.`,
    parsed:{delivery:"2026-05-28",confidence:"high",cancellation:true,note:"Order cancellation for this week only. Standing order resumes next week.",items:[]}
  },
];

const CHANNEL_ICONS = {email:"✉️",voicemail:"📞",whatsapp:"💬",portal:"🌐"};
const STATUS_STYLES = {
  parsed:       {bg:"#e8f0fb",text:"#1a3a7a",label:"Parsed — review"},
  needs_review: {bg:"#fef3dc",text:"#7a5000",label:"Needs review"},
  confirmed:    {bg:"#e8f6dc",text:"#2a6010",label:"Confirmed"},
  action_needed:{bg:"#fde8e8",text:"#7a1a1a",label:"Action needed"},
};

function MatchBadge({match,remove,delta,dateChange,checkStock,conditional}) {
  if (remove) return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#fde8e8",color:"#b91c1c"}}>Remove</span>;
  if (delta) return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#fef3dc",color:"#7a5000"}}>Delta +</span>;
  if (checkStock) return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#fef3dc",color:"#7a5000"}}>Check stock</span>;
  if (conditional) return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#f5f5f5",color:"#666"}}>If available</span>;
  if (match==="standing") return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#e8f6dc",color:"#2a6010"}}>Standing order</span>;
  return null;
}

export default function OrderInbox() {
  const [selectedMsg, setSelectedMsg] = useState(INBOX[0]);
  const [confirmedIds, setConfirmedIds] = useState(new Set());
  const [tab, setTab] = useState("inbox");
  const [workflowState, setWorkflowState] = useState(getState());
  const [notification, setNotification] = useState(null);

  // Subscribe to workflow store updates
  useEffect(() => {
    const unsub = subscribe(s => {
      setWorkflowState({...s});
      if (s.notifications.length > 0) setNotification(s.notifications[s.notifications.length-1]);
      else setNotification(null);
    });
    return unsub;
  }, []);

  const isConfirmed = (id) => confirmedIds.has(id) ||
    workflowState.confirmedLines.some(l => l.channel && id.startsWith("msg") &&
      INBOX.find(m=>m.id===id)?.customer === l.customer);

  const handleConfirm = (msg) => {
    const items = msg.parsed.items.filter(i => !i.remove);
    confirmOrderLines(items, msg.customer, msg.channel, msg.parsed.delivery);
    setConfirmedIds(prev => new Set([...prev, msg.id]));
  };

  const handleCancel = (msg) => {
    cancelOrder(msg.customer);
    setConfirmedIds(prev => new Set([...prev, msg.id]));
  };

  const handleStandingConfirm = (email) => {
    confirmOrderLines(email.parsed.items, email.customer, "standing", email.parsed.delivery);
    setConfirmedIds(prev => new Set([...prev, `se-${email.customer}`]));
  };

  const pending = INBOX.filter(m => !isConfirmed(m.id) && m.status !== "confirmed");
  const confirmed = INBOX.filter(m => isConfirmed(m.id) || m.status === "confirmed");

  return (
    <div style={{display:"flex",height:"100%",fontFamily:"'DM Sans','Segoe UI',sans-serif",background:T.bg,overflow:"hidden",position:"relative"}}>

      {/* Toast notification */}
      {notification && (
        <div style={{position:"absolute",top:12,right:12,zIndex:100,padding:"10px 18px",borderRadius:10,
          background:notification.type==="success"?"#1a3d1a":"#3d1a1a",
          color:notification.type==="success"?"#86b955":"#c0432b",
          fontSize:13,fontWeight:700,boxShadow:"0 4px 20px rgba(0,0,0,0.3)",border:"1px solid",
          borderColor:notification.type==="success"?"#2a6010":"#7a1a1a"}}>
          {notification.type==="success"?"✓ ":""}{notification.message}
        </div>
      )}

      {/* Left panel */}
      <div style={{width:300,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"16px 16px 0",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <h2 style={{fontSize:16,fontWeight:900,color:T.textMain,margin:0}}>Orders Inbox</h2>
            {pending.length > 0 && <span style={{background:"#fde8e8",color:T.rust,fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:10}}>{pending.length} pending</span>}
            {workflowState.confirmedLines.length > 0 && (
              <span style={{background:"#e8f6dc",color:"#2a6010",fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:10,marginLeft:4}}>
                {workflowState.confirmedLines.length} lines added
              </span>
            )}
          </div>
          <div style={{display:"flex",marginBottom:-1}}>
            {[["inbox","Incoming"],["standing","Standing"],["settings","Settings"]].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)}
                style={{flex:1,padding:"8px 4px",fontSize:11,fontWeight:700,border:"none",
                  borderBottom:`2px solid ${tab===id?T.sky:"transparent"}`,background:"transparent",
                  color:tab===id?T.sky:T.textSub,cursor:"pointer"}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab==="inbox" && (
          <div style={{flex:1,overflowY:"auto"}}>
            {pending.length > 0 && (
              <>
                <p style={{fontSize:10,fontWeight:700,color:T.label,letterSpacing:"0.08em",padding:"10px 14px 4px",margin:0,textTransform:"uppercase"}}>Pending ({pending.length})</p>
                {pending.map(msg=>(
                  <button key={msg.id} onClick={()=>setSelectedMsg(msg)}
                    style={{width:"100%",textAlign:"left",padding:"10px 14px",background:selectedMsg?.id===msg.id?"#f0f7ff":"#fff",border:"none",borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}>
                    <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                      <span style={{fontSize:14}}>{CHANNEL_ICONS[msg.channel]}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontSize:12,fontWeight:700,color:T.textMain}}>{msg.customer}</span>
                          <span style={{fontSize:10,color:T.textSub}}>{msg.received.split(",")[1]?.trim()}</span>
                        </div>
                        <p style={{fontSize:11,color:T.textSub,margin:"2px 0 4px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{msg.subject}</p>
                        <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:8,...(STATUS_STYLES[msg.status]||STATUS_STYLES.parsed)}}>{(STATUS_STYLES[msg.status]||STATUS_STYLES.parsed).label}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
            {confirmed.length > 0 && (
              <>
                <p style={{fontSize:10,fontWeight:700,color:T.label,letterSpacing:"0.08em",padding:"10px 14px 4px",margin:0,textTransform:"uppercase"}}>Confirmed ({confirmed.length})</p>
                {confirmed.map(msg=>(
                  <button key={msg.id} onClick={()=>setSelectedMsg(msg)}
                    style={{width:"100%",textAlign:"left",padding:"10px 14px",background:selectedMsg?.id===msg.id?"#f0f7ff":"transparent",border:"none",borderBottom:`1px solid ${T.border}`,cursor:"pointer",opacity:0.65}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:14}}>{CHANNEL_ICONS[msg.channel]}</span>
                      <div>
                        <span style={{fontSize:12,fontWeight:600,color:T.textMain}}>{msg.customer}</span>
                        <p style={{fontSize:11,color:"#2a6010",margin:"1px 0 0",fontWeight:600}}>✓ Added to harvest run</p>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {tab==="standing" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <p style={{fontSize:10,fontWeight:700,color:T.label,letterSpacing:"0.08em",padding:"10px 14px 4px",margin:0,textTransform:"uppercase"}}>Monday morning emails sent</p>
            {STANDING_EMAILS.map((email,i)=>(
              <button key={email.customer} onClick={()=>setSelectedMsg({...email,id:`se-${i}`,channel:"email",from:email.customer,status:email.reply?"needs_review":"confirmed",standingEmail:true})}
                style={{width:"100%",textAlign:"left",padding:"10px 14px",background:selectedMsg?.id===`se-${i}`?"#f0f7ff":"transparent",border:"none",borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                  <span style={{fontSize:12,fontWeight:700,color:T.textMain}}>{email.customer}</span>
                  <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:8,
                    background:confirmedIds.has(`se-${i}`)?"#e8f6dc":email.reply?"#fef3dc":"#e8f0fb",
                    color:confirmedIds.has(`se-${i}`)?"#2a6010":email.reply?"#7a5000":"#1a3a7a"}}>
                    {confirmedIds.has(`se-${i}`)?"✓ Confirmed":email.reply?"Reply received":email.status==="auto-confirmed"?"Auto-confirmed":"No reply — confirm"}
                  </span>
                </div>
                <p style={{fontSize:10,color:T.textSub,margin:0}}>{email.sent}</p>
              </button>
            ))}
            <p style={{fontSize:10,fontWeight:700,color:T.label,letterSpacing:"0.08em",padding:"14px 14px 4px",margin:0,textTransform:"uppercase"}}>All standing orders ({STANDING_ORDERS.length})</p>
            {STANDING_ORDERS.map(s=>(
              <div key={s.customer} style={{padding:"9px 14px",borderBottom:`1px solid ${T.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,fontWeight:600,color:T.textMain}}>{s.customer}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:s.status==="watch"?"#fef3dc":"#e8f6dc",color:s.status==="watch"?"#7a5000":"#2a6010"}}>{s.status==="watch"?"Watch":"Active"}</span>
                </div>
                <p style={{fontSize:10,color:T.textSub,margin:"2px 0 0"}}>{s.delivery} · {s.items} products · Updated {s.lastChanged}</p>
              </div>
            ))}
          </div>
        )}

        {tab==="settings" && (
          <div style={{flex:1,padding:16,overflowY:"auto"}}>
            <p style={{fontSize:12,fontWeight:700,color:T.textMain,margin:"0 0 14px"}}>Order channels</p>
            {[
              {icon:"✉️",label:"Gmail",desc:"orders@skyharvest.ca",status:"Connected",color:T.green},
              {icon:"💬",label:"WhatsApp Business",desc:"+1 604 555 0100",status:"Not set up",color:T.textSub},
              {icon:"📞",label:"Voicemail forwarding",desc:"Forward to transcription",status:"Not set up",color:T.textSub},
              {icon:"🌐",label:"Customer portal",desc:"Phase 3",status:"Planned",color:T.amber},
            ].map(ch=>(
              <div key={ch.label} style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:18,width:28,textAlign:"center"}}>{ch.icon}</span>
                <div style={{flex:1}}>
                  <p style={{fontSize:12,fontWeight:700,color:T.textMain,margin:0}}>{ch.label}</p>
                  <p style={{fontSize:11,color:T.textSub,margin:"2px 0 0"}}>{ch.desc}</p>
                </div>
                <span style={{fontSize:10,fontWeight:700,color:ch.color,whiteSpace:"nowrap"}}>{ch.status}</span>
              </div>
            ))}
            <div style={{marginTop:16,padding:12,background:"#f0f6fb",borderRadius:8,border:`1px solid ${T.border}`}}>
              <p style={{fontSize:11,fontWeight:700,color:T.sky,margin:"0 0 6px"}}>Monday morning automation</p>
              <p style={{fontSize:11,color:T.textSub,margin:0,lineHeight:1.5}}>Every Monday at 7am, confirmation emails go to all standing order customers. Their reply updates the order automatically. No reply = confirmed as-is.</p>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — message detail */}
      {selectedMsg && (
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
                <span style={{fontSize:16}}>{CHANNEL_ICONS[selectedMsg.channel]}</span>
                <h3 style={{fontSize:15,fontWeight:900,color:T.textMain,margin:0}}>{selectedMsg.customer}</h3>
                {isConfirmed(selectedMsg.id) && (
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,background:"#e8f6dc",color:"#2a6010"}}>✓ Added to harvest run</span>
                )}
              </div>
              <p style={{fontSize:11,color:T.textSub,margin:0}}>{selectedMsg.received} · {selectedMsg.from}</p>
            </div>
            {!isConfirmed(selectedMsg.id) && !selectedMsg.parsed?.cancellation && (
              <button onClick={()=>selectedMsg.standingEmail?handleStandingConfirm(selectedMsg):handleConfirm(selectedMsg)}
                style={{padding:"9px 20px",background:T.green,color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:800,cursor:"pointer",boxShadow:"0 2px 8px rgba(86,155,63,0.4)"}}>
                ✓ Confirm &amp; Add to Harvest Run
              </button>
            )}
            {!isConfirmed(selectedMsg.id) && selectedMsg.parsed?.cancellation && (
              <button onClick={()=>handleCancel(selectedMsg)}
                style={{padding:"9px 20px",background:T.rust,color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:800,cursor:"pointer"}}>
                ✓ Acknowledge Cancellation
              </button>
            )}
          </div>

          <div style={{flex:1,overflow:"auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
            {/* Original message */}
            <div style={{padding:20,borderRight:`1px solid ${T.border}`}}>
              <p style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 12px"}}>
                {selectedMsg.channel==="voicemail"?"📞 Voicemail transcript":selectedMsg.channel==="whatsapp"?"💬 WhatsApp":"✉️ Email"}
              </p>
              {selectedMsg.channel==="voicemail" && (
                <div style={{background:"#fce7f3",border:"1px solid #f9a8d4",borderRadius:8,padding:10,marginBottom:10,display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:18}}>🎙️</span>
                  <div><p style={{fontSize:11,fontWeight:700,color:"#831843",margin:0}}>Voicemail — 1m 14s</p><p style={{fontSize:10,color:"#9d174d",margin:"2px 0 0"}}>Auto-transcribed · 94% confidence</p></div>
                </div>
              )}
              {selectedMsg.standingEmail && selectedMsg.reply && (
                <div style={{background:"#e8f6dc",border:"1px solid #c8e8a8",borderRadius:8,padding:12,marginBottom:12}}>
                  <p style={{fontSize:11,fontWeight:700,color:"#2a6010",margin:"0 0 4px"}}>↩ Customer replied · {selectedMsg.reply.time}</p>
                  <p style={{fontSize:12,color:T.textMain,margin:"0 0 8px",fontStyle:"italic"}}>"{selectedMsg.reply.text}"</p>
                  {selectedMsg.parsedAmendment && (
                    <div style={{background:"#fff",borderRadius:6,padding:"7px 10px",fontSize:12}}>
                      <span style={{fontWeight:700}}>Claude parsed: </span>
                      <span style={{color:T.sky}}>{selectedMsg.parsedAmendment.product}</span>
                      <span style={{color:T.amber,fontWeight:700}}> {selectedMsg.parsedAmendment.change}</span>
                      <span style={{color:T.textSub}}> → qty: {selectedMsg.parsedAmendment.newQty}</span>
                    </div>
                  )}
                </div>
              )}
              <div style={{background:"#f8fafb",borderRadius:8,border:`1px solid ${T.border}`,padding:14}}>
                <p style={{fontSize:13,color:T.textSub,margin:0,lineHeight:1.7,whiteSpace:"pre-wrap",fontStyle:"italic"}}>
                  {selectedMsg.transcript||selectedMsg.body}
                </p>
              </div>
            </div>

            {/* Parsed order */}
            <div style={{padding:20}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{fontSize:14}}>🤖</span>
                <p style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Claude parsed this as</p>
                <span style={{marginLeft:"auto",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,
                  background:selectedMsg.parsed?.confidence==="high"?"#e8f6dc":"#fef3dc",
                  color:selectedMsg.parsed?.confidence==="high"?"#2a6010":"#7a5000"}}>
                  {selectedMsg.parsed?.confidence} confidence
                </span>
              </div>

              <div style={{background:"#f0f6fb",borderRadius:8,border:`1px solid ${T.border}`,padding:10,marginBottom:12,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:16}}>📅</span>
                <div>
                  <p style={{fontSize:11,fontWeight:700,color:T.textMain,margin:0}}>
                    {new Date(selectedMsg.parsed?.delivery||"2026-05-28").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}
                  </p>
                  {selectedMsg.parsed?.note && <p style={{fontSize:11,color:T.amber,margin:"2px 0 0",fontWeight:600}}>⚠ {selectedMsg.parsed.note}</p>}
                </div>
              </div>

              {selectedMsg.parsed?.cancellation ? (
                <div style={{background:"#fde8e8",borderRadius:8,border:"1px solid #fca5a5",padding:16,textAlign:"center"}}>
                  <p style={{fontSize:24,margin:"0 0 8px"}}>🚫</p>
                  <p style={{fontSize:13,fontWeight:700,color:"#7a1a1a",margin:0}}>Order cancellation this week</p>
                  <p style={{fontSize:12,color:"#9a3412",margin:"4px 0 0"}}>Standing order resumes next week automatically</p>
                </div>
              ) : (
                <>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:12}}>
                    <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>
                      <th style={{textAlign:"left",padding:"6px 8px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase"}}>Product matched</th>
                      <th style={{textAlign:"center",padding:"6px 8px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase"}}>Qty</th>
                      <th style={{textAlign:"left",padding:"6px 8px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase"}}>Note</th>
                    </tr></thead>
                    <tbody>{selectedMsg.parsed?.items?.map((item,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:item.remove?"#fff5f5":item.delta?"#fffbeb":i%2===0?"#fff":"#fafbfc"}}>
                        <td style={{padding:"8px",fontWeight:600,color:item.remove?"#b91c1c":T.textMain}}>
                          {item.product}
                          {item.raw && <div style={{fontSize:10,color:T.textSub,fontWeight:400,fontStyle:"italic",marginTop:1}}>"{item.raw}"</div>}
                        </td>
                        <td style={{textAlign:"center",padding:"8px",fontWeight:900,color:item.remove?"#b91c1c":item.delta?T.amber:T.textMain,fontSize:14}}>
                          {item.remove?"✕":item.qty||"—"}
                        </td>
                        <td style={{padding:"8px"}}><MatchBadge {...item}/></td>
                      </tr>
                    ))}</tbody>
                  </table>

                  {isConfirmed(selectedMsg.id) ? (
                    <div style={{padding:10,background:"#f0f9ec",borderRadius:8,border:"1px solid #c8e8a8",fontSize:12,color:"#2a6010",fontWeight:700}}>
                      ✓ Added to Wednesday 28 May harvest run · Check Harvest Runs to see the grid
                    </div>
                  ) : (
                    <div style={{padding:10,background:"#f5f8fb",borderRadius:8,border:`1px solid ${T.border}`,fontSize:11,color:T.textSub}}>
                      <strong style={{color:T.textMain}}>Review each line before confirming.</strong> Click "Confirm &amp; Add to Harvest Run" to add these quantities to the Wednesday pick list and delivery run.
                    </div>
                  )}
                </>
              )}

              <div style={{marginTop:12,padding:12,background:"#f8f5ff",border:"1px solid #e9d5ff",borderRadius:8}}>
                <p style={{fontSize:10,fontWeight:700,color:"#6b21a8",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 6px"}}>How Claude parsed this</p>
                <ul style={{fontSize:11,color:"#4c1d95",margin:0,paddingLeft:16,lineHeight:1.8}}>
                  <li>Identified customer from {selectedMsg.channel==="email"?"email address":"phone number"} against customer database</li>
                  <li>Extracted quantities and product names from free text</li>
                  <li>Matched products to catalogue using fuzzy matching</li>
                  {selectedMsg.channel==="voicemail"&&<li>Transcribed audio at 94% confidence before parsing</li>}
                  {selectedMsg.parsed?.note&&<li>Flagged ambiguity for manual review</li>}
                  <li>Suggested delivery date from context and standing order schedule</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
