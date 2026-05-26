import { useState } from "react";

const T = {
  sidebar:"#0f2535",activeBg:"#1a3d54",label:"#4a7a96",text:"#c8dce8",textDim:"#5a8aaa",
  green:"#86b955",greenDark:"#5a8a2e",sky:"#3e7da1",amber:"#d4890a",rust:"#c0432b",
  bg:"#f4f6f8",surface:"#ffffff",border:"#e2e8ed",textMain:"#1a2e3b",textSub:"#5a7080",
};

// ── Fabricated incoming orders (red = invented) ───────────────────────────────

const STANDING_EMAILS = [
  {
    customer:"SPUD Vancouver",
    sent:"Mon 26 May, 07:00",
    subject:"Your Sky Harvest standing order — Wednesday 28 May",
    body:`Hi SPUD Team,

Your standing order is confirmed for Wednesday 28 May delivery.

Here's what we have scheduled:
• Pea Shoots (M) × 49 — $185.82
• Pea Shoots (SPUD Label) × 24 — $91.20  
• Sunflower Shoots (RETAIL) × 43 — $167.70
• Radish Blend (SPUD Label) × 16 — $60.80

Total: $505.52 + GST

Reply to this email by Tuesday 10am to make any changes.
No reply needed if everything looks good — we'll see you Wednesday morning.

Chris & the Sky Harvest team
orders@skyharvest.ca`,
    reply:null,
    status:"auto-confirmed"
  },
  {
    customer:"Choices North Van",
    sent:"Mon 26 May, 07:00",
    subject:"Your Sky Harvest standing order — Wednesday 28 May",
    body:`Hi Choices North Van,

Your standing order is confirmed for Wednesday 28 May delivery.

Here's what we have scheduled:
• Pea Shoots (M) × 12 — $45.48
• Sunflower Shoots (M) × 8 — $31.20
• Radish Blend (M) × 6 — $22.80
• Kale (S) × 4 — $9.60

Total: $109.08 + GST

Reply to this email by Tuesday 10am to make any changes.

Chris & the Sky Harvest team`,
    reply:{
      from:"buying@choices.ca",
      time:"Mon 26 May, 09:14",
      text:"Hi Chris! Could you add 2 extra Pea Shoots (M) this week? We've got a big event Wednesday evening. Thanks!"
    },
    status:"amended",
    parsedAmendment:{product:"Pea Shoots (M)", change:"+2", newQty:14}
  },
  {
    customer:"Terminal City Club",
    sent:"Mon 26 May, 07:00",
    subject:"Your Sky Harvest standing order — Wednesday 28 May",
    body:`Hi Terminal City Club,

Your standing order is confirmed for Wednesday 28 May delivery.

Here's what we have scheduled:
• Pea Shoots (M) × 8 — $30.32
• Sunflower Shoots (L) × 4 — $31.60
• Mellow Mix (L) × 3 — $27.48
• Cilantro (M) × 2 — $5.30

Total: $94.70 + GST

Reply by Tuesday 10am for any changes.

Chris & the Sky Harvest team`,
    reply:null,
    status:"no-reply-confirmed"
  },
];

const INBOX = [
  {
    id:"msg-001",
    channel:"email",
    from:"Chef Haru <haru@kingyo.ca>",
    customer:"Kingyo Izakaya",
    subject:"Order for Wednesday",
    body:`Hi Chris,

Hope you're well. Could you send us over for Wednesday:
- 4 of the shiso green medium
- 2 pea shoots large
- 1 purple basil small

Thanks!
Haru`,
    received:"Mon 26 May, 08:14",
    status:"parsed",
    fab:true,
    parsed:{
      delivery:"2026-05-28",
      confidence:"high",
      items:[
        {raw:"4 of the shiso green medium",     product:"Shiso, Green (M)",  qty:4,  match:"high"},
        {raw:"2 pea shoots large",              product:"Pea Shoots (L)",    qty:2,  match:"high"},
        {raw:"1 purple basil small",            product:"Basil, Purple (S)", qty:1,  match:"high"},
      ]
    }
  },
  {
    id:"msg-002",
    channel:"email",
    from:"kitchen@ancora.ca",
    customer:"Ancora Waterfront",
    subject:"Re: Wednesday delivery",
    body:`Hi — usual order please for Wednesday but drop the mellow mix this week, we're changing the menu. Add 3 extra pea shoots medium instead.

Thanks`,
    received:"Mon 26 May, 09:02",
    status:"parsed",
    fab:true,
    parsed:{
      delivery:"2026-05-28",
      confidence:"medium",
      note:"References standing order. Removing Mellow Mix, adding 3 Pea Shoots (M).",
      items:[
        {raw:"usual order",                     product:"[Standing order]",  qty:null,match:"standing"},
        {raw:"drop the mellow mix this week",   product:"Mellow Mix (M)",    qty:0,  match:"high",  remove:true},
        {raw:"3 extra pea shoots medium",       product:"Pea Shoots (M)",    qty:"+3",match:"high", delta:true},
      ]
    }
  },
  {
    id:"msg-003",
    channel:"voicemail",
    from:"+1 604 555 0182",
    customer:"Terminal City Club",
    subject:"Voicemail 1m 14s",
    transcript:`Hi this is James from Terminal City, just calling to place this week's order for Wednesday. We'd like uh... 8 pea shoots medium, 4 sunflower large, and can you do us 3 of the mellow mix large please? Oh and if you've got any sky hearts this week we'd take 2 of the small. Thanks, bye.`,
    received:"Mon 26 May, 09:31",
    status:"needs_review",
    fab:true,
    parsed:{
      delivery:"2026-05-28",
      confidence:"high",
      items:[
        {raw:"8 pea shoots medium",             product:"Pea Shoots (M)",    qty:8,  match:"high"},
        {raw:"4 sunflower large",               product:"Sunflower Shoots (L)",qty:4, match:"high"},
        {raw:"3 of the mellow mix large",       product:"Mellow Mix (L)",    qty:3,  match:"high"},
        {raw:"2 of the small sky hearts",       product:"Sky Hearts (S)",    qty:2,  match:"high", conditional:true},
      ]
    }
  },
  {
    id:"msg-004",
    channel:"whatsapp",
    from:"+1 604 555 0241",
    customer:"Masayoshi",
    subject:"WhatsApp message",
    body:`Hey Chris, we need Friday delivery this week not Wednesday — same as usual. Also add 2 shiso britton medium if you have them`,
    received:"Mon 26 May, 10:15",
    status:"needs_review",
    fab:true,
    parsed:{
      delivery:"2026-05-30",
      confidence:"medium",
      note:"Delivery day changed from Wednesday to Friday. Stock check needed for Shiso Britton.",
      items:[
        {raw:"same as usual",                   product:"[Standing order]",  qty:null,match:"standing"},
        {raw:"delivery this week Friday not Wednesday",product:"[Delivery date change]",qty:null,match:"high",dateChange:true},
        {raw:"2 shiso britton medium",          product:"Shiso, Britton (M)",qty:2,  match:"high", checkStock:true},
      ]
    }
  },
  {
    id:"msg-005",
    channel:"email",
    from:"orders@spud.ca",
    customer:"SPUD Vancouver",
    subject:"Weekly order — auto-confirmed",
    body:`Standing order auto-confirmed for Wednesday 28 May:
Pea Shoots (M) × 49
Pea Shoots (SPUD Label) × 24
Sunflower Shoots (RETAIL) × 43
Radish Blend (SPUD Label) × 16

No changes this week.`,
    received:"Mon 26 May, 07:00",
    status:"confirmed",
    fab:true,
    autoConfirmed:true,
    parsed:{
      delivery:"2026-05-28",
      confidence:"high",
      items:[
        {raw:"",product:"Pea Shoots (M)",              qty:49, match:"high"},
        {raw:"",product:"Pea Shoots (SPUD Label) (M)", qty:24, match:"high"},
        {raw:"",product:"Sunflower Shoots (RETAIL) (M)",qty:43,match:"high"},
        {raw:"",product:"Radish Blend (SPUD Label) (S)",qty:16,match:"high"},
      ]
    }
  },
  {
    id:"msg-006",
    channel:"email",
    from:"procurement@compass.ca",
    customer:"Compass",
    subject:"Cancel this week",
    body:`Hi, please cancel our delivery this week. We'll be back on the following week.`,
    received:"Mon 26 May, 11:04",
    status:"action_needed",
    fab:true,
    parsed:{
      delivery:"2026-05-28",
      confidence:"high",
      cancellation:true,
      note:"Order cancellation for this week only. Standing order resumes next week.",
      items:[]
    }
  },
];

const STANDING_ORDERS = [
  {customer:"SPUD Vancouver",       delivery:"Wed+Fri",items:6, lastChanged:"Apr 3",  status:"active"},
  {customer:"Choices North Van",    delivery:"Wed+Fri",items:4, lastChanged:"Mar 18", status:"active"},
  {customer:"Stongs North Van",     delivery:"Wed",    items:5, lastChanged:"May 6",  status:"active"},
  {customer:"Greens Market",        delivery:"Wed+Fri",items:7, lastChanged:"Apr 22", status:"active"},
  {customer:"Terminal City Club",   delivery:"Wed",    items:4, lastChanged:"Apr 8",  status:"active"},
  {customer:"Okini",                delivery:"Fri",    items:3, lastChanged:"May 13", status:"active"},
  {customer:"Plaza Premium",        delivery:"Wed+Fri",items:5, lastChanged:"Mar 25", status:"active"},
  {customer:"Ancora Waterfront",    delivery:"Wed",    items:4, lastChanged:"Apr 29", status:"watch"},
  {customer:"Masayoshi",            delivery:"Wed",    items:3, lastChanged:"Apr 15", status:"active"},
  {customer:"Kingyo Izakaya",       delivery:"Wed",    items:3, lastChanged:"Apr 1",  status:"active"},
];

const CHANNEL_ICONS = {email:"✉️",voicemail:"📞",whatsapp:"💬",portal:"🌐",phone:"📱"};
const CHANNEL_COLORS = {email:"#dbeafe",voicemail:"#fce7f3",whatsapp:"#dcfce7",portal:"#f0fdf4",phone:"#fef3c7"};
const STATUS_STYLES = {
  parsed:        {bg:"#e8f0fb",text:"#1a3a7a",label:"Parsed — review"},
  needs_review:  {bg:"#fef3dc",text:"#7a5000",label:"Needs review"},
  confirmed:     {bg:"#e8f6dc",text:"#2a6010",label:"Confirmed"},
  action_needed: {bg:"#fde8e8",text:"#7a1a1a",label:"Action needed"},
};

function ConfidenceDot({level}) {
  const c = level==="high"?"#86b955":level==="medium"?"#d4890a":"#c0432b";
  return <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:c,marginRight:4}}/>;
}

function MatchBadge({match,remove,delta,dateChange,checkStock,conditional}) {
  if (remove) return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#fde8e8",color:"#b91c1c"}}>Remove</span>;
  if (delta) return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#fef3dc",color:"#7a5000"}}>Delta</span>;
  if (dateChange) return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#e8f0fb",color:"#1a3a7a"}}>Date change</span>;
  if (checkStock) return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#fef3dc",color:"#7a5000"}}>Check stock</span>;
  if (conditional) return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#f5f5f5",color:"#666"}}>If available</span>;
  if (match==="standing") return <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"#e8f6dc",color:"#2a6010"}}>Standing order</span>;
  return null;
}

export default function OrderInbox() {
  const [selectedMsg, setSelectedMsg] = useState(INBOX[0]);
  const [confirmedIds, setConfirmedIds] = useState(new Set(["msg-005"]));
  const [tab, setTab] = useState("inbox"); // inbox | standing | settings

  const pending = INBOX.filter(m => !confirmedIds.has(m.id) && m.status !== "confirmed");
  const confirmed = INBOX.filter(m => confirmedIds.has(m.id) || m.status === "confirmed");

  const confirmOrder = (id) => {
    setConfirmedIds(prev => new Set([...prev, id]));
  };

  return (
    <div style={{display:"flex",height:"100%",fontFamily:"'DM Sans','Segoe UI',sans-serif",background:T.bg,overflow:"hidden"}}>

      {/* Left — message list */}
      <div style={{width:300,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>

        {/* Header + tabs */}
        <div style={{padding:"16px 16px 0",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h2 style={{fontSize:16,fontWeight:900,color:T.textMain,margin:0}}>Orders Inbox</h2>
            <span style={{background:"#fde8e8",color:T.rust,fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:10}}>{pending.length} pending</span>
          </div>
          <div style={{display:"flex",gap:0,marginBottom:-1}}>
            {[["inbox","Incoming"],["standing","Standing"],["settings","Settings"]].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)}
                style={{flex:1,padding:"8px 4px",fontSize:11,fontWeight:700,border:"none",borderBottom:`2px solid ${tab===id?T.sky:"transparent"}`,background:"transparent",color:tab===id?T.sky:T.textSub,cursor:"pointer",transition:"all 0.15s"}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "inbox" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <p style={{fontSize:10,fontWeight:700,color:T.label,letterSpacing:"0.08em",padding:"10px 14px 4px",margin:0,textTransform:"uppercase"}}>Pending ({pending.length})</p>
            {pending.map(msg => (
              <button key={msg.id} onClick={()=>setSelectedMsg(msg)}
                style={{width:"100%",textAlign:"left",padding:"10px 14px",background:selectedMsg?.id===msg.id?"#f0f7ff":"transparent",border:"none",borderBottom:`1px solid ${T.border}`,cursor:"pointer",transition:"background 0.12s"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:4}}>
                  <span style={{fontSize:14}}>{CHANNEL_ICONS[msg.channel]}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,fontWeight:700,color:T.textMain,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:150}}>{msg.customer}</span>
                      <span style={{fontSize:10,color:T.textSub,flexShrink:0,marginLeft:4}}>{msg.received.split(",")[1]?.trim()}</span>
                    </div>
                    <p style={{fontSize:11,color:T.textSub,margin:"2px 0 4px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{msg.subject}</p>
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      <span style={{...STATUS_STYLES[msg.status],fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:8}}>{STATUS_STYLES[msg.status]?.label}</span>
                      {msg.fab && <span style={{fontSize:9,color:"#9ca3af",fontStyle:"italic"}}>demo data</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            <p style={{fontSize:10,fontWeight:700,color:T.label,letterSpacing:"0.08em",padding:"10px 14px 4px",margin:0,textTransform:"uppercase"}}>Confirmed ({confirmed.length})</p>
            {confirmed.map(msg => (
              <button key={msg.id} onClick={()=>setSelectedMsg(msg)}
                style={{width:"100%",textAlign:"left",padding:"10px 14px",background:selectedMsg?.id===msg.id?"#f0f7ff":"transparent",border:"none",borderBottom:`1px solid ${T.border}`,cursor:"pointer",opacity:0.65}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>{CHANNEL_ICONS[msg.channel]}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <span style={{fontSize:12,fontWeight:600,color:T.textMain}}>{msg.customer}</span>
                    <p style={{fontSize:11,color:T.textSub,margin:"1px 0 0"}}>✓ {msg.autoConfirmed?"Auto-confirmed":"Confirmed"}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {tab === "standing" && (
          <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
            <p style={{fontSize:10,fontWeight:700,color:T.label,letterSpacing:"0.08em",padding:"8px 14px 4px",margin:0,textTransform:"uppercase"}}>Monday morning emails sent</p>
            {STANDING_EMAILS.map((s,i)=>(
              <button key={s.customer} onClick={()=>setSelectedMsg({id:`se-${i}`,channel:"email",from:`${s.customer}`,customer:s.customer,subject:s.subject,body:s.body,received:s.sent,status:s.reply?"needs_review":"confirmed",fab:true,standingEmail:true,reply:s.reply,parsedAmendment:s.parsedAmendment,parsed:{delivery:"2026-05-28",confidence:"high",items:[]}})}
                style={{width:"100%",textAlign:"left",padding:"10px 14px",background:selectedMsg?.id===`se-${i}`?"#f0f7ff":"transparent",border:"none",borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:700,color:T.textMain}}>{s.customer}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,background:s.reply?"#fef3dc":s.status==="auto-confirmed"?"#e8f6dc":"#e8f0fb",color:s.reply?"#7a5000":s.status==="auto-confirmed"?"#2a6010":"#1a3a7a"}}>{s.reply?"Reply received":s.status==="auto-confirmed"?"Auto-confirmed":"No reply — confirmed"}</span>
                </div>
                <p style={{fontSize:10,color:T.textSub,margin:0}}>{s.sent}</p>
              </button>
            ))}
            <p style={{fontSize:10,fontWeight:700,color:T.label,letterSpacing:"0.08em",padding:"14px 14px 4px",margin:0,textTransform:"uppercase"}}>All standing orders</p>
            {STANDING_ORDERS.map((s,i)=>(
              <div key={s.customer} style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,background:i%2===0?"#fff":"#fafbfc"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,fontWeight:600,color:T.textMain}}>{s.customer}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,background:s.status==="watch"?"#fef3dc":"#e8f6dc",color:s.status==="watch"?"#7a5000":"#2a6010"}}>{s.status==="watch"?"Watch":"Active"}</span>
                </div>
                <div style={{display:"flex",gap:10,marginTop:3}}>
                  <span style={{fontSize:10,color:T.textSub}}>{s.delivery}</span>
                  <span style={{fontSize:10,color:T.textSub}}>{s.items} products</span>
                  <span style={{fontSize:10,color:T.textSub}}>Updated {s.lastChanged}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "settings" && (
          <div style={{flex:1,padding:16,overflowY:"auto"}}>
            <p style={{fontSize:12,fontWeight:700,color:T.textMain,margin:"0 0 16px"}}>Order channels</p>
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
            <div style={{marginTop:20,padding:12,background:"#f0f6fb",borderRadius:8,border:`1px solid ${T.border}`}}>
              <p style={{fontSize:11,fontWeight:700,color:T.sky,margin:"0 0 6px"}}>Monday morning automation</p>
              <p style={{fontSize:11,color:T.textSub,margin:0,lineHeight:1.5}}>Every Monday at 7am, confirmation emails go to all standing order customers. Their reply updates the order automatically. No-reply = order confirmed as-is.</p>
            </div>
          </div>
        )}
      </div>

      {/* Right — message detail + parsed order */}
      {selectedMsg && (
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {/* Header */}
          <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
                <span style={{fontSize:16}}>{CHANNEL_ICONS[selectedMsg.channel]}</span>
                <h3 style={{fontSize:15,fontWeight:900,color:T.textMain,margin:0}}>{selectedMsg.customer}</h3>
                <span style={{...STATUS_STYLES[selectedMsg.status],fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8}}>{STATUS_STYLES[selectedMsg.status]?.label}</span>
                {selectedMsg.fab && <span style={{fontSize:10,color:"#b91c1c",fontStyle:"italic"}}>⚠ fabricated demo data</span>}
              </div>
              <p style={{fontSize:11,color:T.textSub,margin:0}}>{selectedMsg.received} · {selectedMsg.from}</p>
            </div>
            {!confirmedIds.has(selectedMsg.id) && selectedMsg.status !== "confirmed" && !selectedMsg.parsed?.cancellation && (
              <button onClick={()=>confirmOrder(selectedMsg.id)}
                style={{padding:"8px 20px",background:T.green,color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:800,cursor:"pointer",boxShadow:"0 2px 8px rgba(86,155,63,0.4)"}}>
                ✓ Confirm Order
              </button>
            )}
            {selectedMsg.parsed?.cancellation && (
              <button style={{padding:"8px 20px",background:T.rust,color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:800,cursor:"pointer"}}>
                ✓ Acknowledge Cancellation
              </button>
            )}
          </div>

          <div style={{flex:1,overflow:"auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>

            {/* Original message */}
            <div style={{padding:20,borderRight:`1px solid ${T.border}`}}>
              <p style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 12px"}}>
                {selectedMsg.channel === "voicemail" ? "📞 Voicemail transcript" :
                 selectedMsg.channel === "whatsapp"  ? "💬 WhatsApp message" : "✉️ Email"}
              </p>

              {selectedMsg.standingEmail && selectedMsg.reply && (
                <div style={{background:"#e8f6dc",border:"1px solid #c8e8a8",borderRadius:8,padding:12,marginBottom:12}}>
                  <p style={{fontSize:11,fontWeight:700,color:"#2a6010",margin:"0 0 4px"}}>↩ Customer replied · {selectedMsg.reply.time}</p>
                  <p style={{fontSize:12,color:T.textMain,margin:"0 0 8px",fontStyle:"italic"}}>"{selectedMsg.reply.text}"</p>
                  {selectedMsg.parsedAmendment && (
                    <div style={{background:"#fff",borderRadius:6,padding:"8px 12px",fontSize:12}}>
                      <span style={{fontWeight:700,color:T.textMain}}>Claude parsed: </span>
                      <span style={{color:T.sky}}>{selectedMsg.parsedAmendment.product}</span>
                      <span style={{color:T.amber,fontWeight:700}}> {selectedMsg.parsedAmendment.change}</span>
                      <span style={{color:T.textSub}}> → new qty: {selectedMsg.parsedAmendment.newQty}</span>
                    </div>
                  )}
                </div>
              )}
              {selectedMsg.channel === "voicemail" && (
                <div style={{background:"#fce7f3",border:"1px solid #f9a8d4",borderRadius:8,padding:12,marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>🎙️</span>
                  <div>
                    <p style={{fontSize:11,fontWeight:700,color:"#831843",margin:0}}>Voicemail — 1m 14s</p>
                    <p style={{fontSize:10,color:"#9d174d",margin:"2px 0 0"}}>Auto-transcribed · Confidence 94%</p>
                  </div>
                </div>
              )}

              <div style={{background:"#f8fafb",borderRadius:8,border:`1px solid ${T.border}`,padding:16}}>
                <p style={{fontSize:13,color:T.textMain,margin:0,lineHeight:1.7,whiteSpace:"pre-wrap",fontStyle:"italic",color:T.textSub}}>
                  {selectedMsg.transcript || selectedMsg.body}
                </p>
              </div>
            </div>

            {/* Claude's parsed order */}
            <div style={{padding:20}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{fontSize:14}}>🤖</span>
                <p style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Claude parsed this as</p>
                <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
                  <ConfidenceDot level={selectedMsg.parsed.confidence}/>
                  <span style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"capitalize"}}>{selectedMsg.parsed.confidence} confidence</span>
                </div>
              </div>

              <div style={{background:"#f0f6fb",borderRadius:8,border:`1px solid ${T.border}`,padding:12,marginBottom:12,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:16}}>📅</span>
                <div>
                  <p style={{fontSize:11,fontWeight:700,color:T.textMain,margin:0}}>
                    Delivery: {new Date(selectedMsg.parsed.delivery).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}
                  </p>
                  {selectedMsg.parsed.note && <p style={{fontSize:11,color:T.amber,margin:"3px 0 0",fontWeight:600}}>⚠ {selectedMsg.parsed.note}</p>}
                </div>
              </div>

              {selectedMsg.parsed.cancellation ? (
                <div style={{background:"#fde8e8",borderRadius:8,border:"1px solid #fca5a5",padding:16,textAlign:"center"}}>
                  <p style={{fontSize:24,margin:"0 0 8px"}}>🚫</p>
                  <p style={{fontSize:13,fontWeight:700,color:"#7a1a1a",margin:0}}>Order cancellation this week</p>
                  <p style={{fontSize:12,color:"#9a3412",margin:"4px 0 0"}}>Standing order resumes next week automatically</p>
                </div>
              ) : (
                <div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${T.border}`}}>
                        <th style={{textAlign:"left",padding:"6px 8px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em"}}>Product matched</th>
                        <th style={{textAlign:"center",padding:"6px 8px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase"}}>Qty</th>
                        <th style={{textAlign:"left",padding:"6px 8px",fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase"}}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMsg.parsed.items.map((item,i)=>(
                        <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:item.remove?"#fff5f5":item.delta?"#fffbeb":i%2===0?"#fff":"#fafbfc"}}>
                          <td style={{padding:"8px",fontWeight:600,color:item.remove?"#b91c1c":T.textMain}}>
                            {item.product}
                            <div style={{fontSize:10,color:T.textSub,fontWeight:400,marginTop:1,fontStyle:"italic"}}>"{item.raw}"</div>
                          </td>
                          <td style={{textAlign:"center",padding:"8px",fontWeight:900,color:item.remove?"#b91c1c":item.delta?T.amber:T.textMain,fontSize:14}}>
                            {item.remove?"—":item.qty||"—"}
                          </td>
                          <td style={{padding:"8px"}}>
                            <MatchBadge {...item}/>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Editable before confirming */}
                  {!confirmedIds.has(selectedMsg.id) && selectedMsg.status !== "confirmed" && (
                    <div style={{marginTop:12,padding:10,background:"#f5f8fb",borderRadius:8,border:`1px solid ${T.border}`,fontSize:11,color:T.textSub}}>
                      <strong style={{color:T.textMain}}>Before confirming:</strong> Review each line. Click any quantity to edit. Starred items need attention.
                    </div>
                  )}

                  {confirmedIds.has(selectedMsg.id) && (
                    <div style={{marginTop:12,padding:10,background:"#f0f9ec",borderRadius:8,border:"1px solid #c8e8a8",fontSize:12,color:"#2a6010",fontWeight:600}}>
                      ✓ Order confirmed and added to Wednesday 28 May harvest run
                    </div>
                  )}
                </div>
              )}

              {/* What Claude actually did */}
              <div style={{marginTop:16,padding:12,background:"#f8f5ff",border:"1px solid #e9d5ff",borderRadius:8}}>
                <p style={{fontSize:10,fontWeight:700,color:"#6b21a8",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 6px"}}>How Claude parsed this</p>
                <ul style={{fontSize:11,color:"#4c1d95",margin:0,paddingLeft:16,lineHeight:1.8}}>
                  <li>Identified customer from email/number against customer database</li>
                  <li>Extracted quantities and product names from free text</li>
                  <li>Matched products to catalogue using fuzzy matching</li>
                  {selectedMsg.channel==="voicemail"&&<li>Transcribed audio with 94% confidence before parsing</li>}
                  {selectedMsg.parsed.note&&<li>Flagged ambiguity: references standing order or date change</li>}
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
