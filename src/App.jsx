import { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL="https://lznaqqjhmawvpvzzwgnc.supabase.co";
const SUPA_KEY="sb_publishable_a9rGWRoY6g99XC9nqSNc-g_XbhpxALh";
const supabase=createClient(SUPA_URL,SUPA_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'mindrisk_auth'}});
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const G="#00d395",R="#ef4444",B="#6366f1",Y="#f59e0b",P="#a855f7",O="#f97316";
const pc=v=>v>0?G:v<0?R:"#8b96b0";
const fd=v=>(v>=0?"+":"-")+"$"+Math.abs(v).toFixed(2);
const fs=v=>(v>=0?"+":"-")+"$"+Math.abs(v).toFixed(0);
const todayISO=()=>new Date().toISOString().split("T")[0];
const nowHHMM=()=>new Date().toTimeString().slice(0,5);
const uid=()=>"t"+Date.now()+Math.random().toString(36).slice(2,5);
const BUFFER=2000;const DAILY_DD_LIMIT=1000;
const DAILY_LIMIT=2;
const OVERTRADING_AT=3;
const PAUSE_MINS=15;


// ============================================================
// FUTURES INSTRUMENTS - Tick & Tickwert Konfiguration
// ============================================================
const INSTRUMENTS = {
  // Nasdaq
  'MNQ': { name:'Micro Nasdaq',    exchange:'CME', tick:0.25, tickValue:0.50,  currency:'USD', micro:true,  full:'NQ' },
  'NQ':  { name:'Nasdaq 100',      exchange:'CME', tick:0.25, tickValue:5.00,  currency:'USD', micro:false, full:'NQ' },
  // S&P 500
  'MES': { name:'Micro S&P 500',   exchange:'CME', tick:0.25, tickValue:1.25,  currency:'USD', micro:true,  full:'ES' },
  'ES':  { name:'S&P 500',         exchange:'CME', tick:0.25, tickValue:12.50, currency:'USD', micro:false, full:'ES' },
  // Dow Jones
  'MYM': { name:'Micro Dow Jones', exchange:'CME', tick:1.00, tickValue:0.50,  currency:'USD', micro:true,  full:'YM' },
  'YM':  { name:'Dow Jones',       exchange:'CME', tick:1.00, tickValue:5.00,  currency:'USD', micro:false, full:'YM' },
  // Russell 2000
  'M2K': { name:'Micro Russell',   exchange:'CME', tick:0.10, tickValue:0.50,  currency:'USD', micro:true,  full:'RTY' },
  'RTY': { name:'Russell 2000',    exchange:'CME', tick:0.10, tickValue:5.00,  currency:'USD', micro:false, full:'RTY' },
  // Gold
  'MGC': { name:'Micro Gold',      exchange:'CME', tick:0.10, tickValue:1.00,  currency:'USD', micro:true,  full:'GC' },
  'GC':  { name:'Gold',            exchange:'CME', tick:0.10, tickValue:10.00, currency:'USD', micro:false, full:'GC' },
  // Silber
  'SIL': { name:'Micro Silber',    exchange:'CME', tick:0.005,tickValue:1.25,  currency:'USD', micro:true,  full:'SI' },
  'SI':  { name:'Silber',          exchange:'CME', tick:0.005,tickValue:25.00, currency:'USD', micro:false, full:'SI' },
  // Crude Oil
  'MCL': { name:'Micro Crude Oil', exchange:'CME', tick:0.01, tickValue:1.00,  currency:'USD', micro:true,  full:'CL' },
  'CL':  { name:'Crude Oil',       exchange:'CME', tick:0.01, tickValue:10.00, currency:'USD', micro:false, full:'CL' },
  // Euro FX
  'M6E': { name:'Micro Euro/USD',  exchange:'CME', tick:0.0001,tickValue:1.25, currency:'USD', micro:true,  full:'6E' },
  '6E':  { name:'Euro/USD',        exchange:'CME', tick:0.0001,tickValue:12.50,currency:'USD', micro:false, full:'6E' },
};

// Helper: Ticks → Dollar
const ticksToDollar = (ticks, symbol, qty=1) => {
  const inst = INSTRUMENTS[symbol] || INSTRUMENTS['MNQ'];
  return Math.round(ticks * inst.tickValue * qty * 100) / 100;
};

// Helper: Dollar → Ticks
const dollarToTicks = (dollar, symbol, qty=1) => {
  const inst = INSTRUMENTS[symbol] || INSTRUMENTS['MNQ'];
  return Math.round(dollar / (inst.tickValue * qty) * 10) / 10;
};

const SETUPS=["Heatmap Correlation SP","Break & Retest","VWAP Bounce","Opening Range Break","Momentum Scalp","Support/Resistance","ICT Concept","Order Block","Fair Value Gap","Liquidity Sweep"];
const RULES=[
  {id:"r1",label:"Geplantes Setup – kein Impuls"},
  {id:"r2",label:"Stop Loss gesetzt"},
  {id:"r3",label:"Take Profit gesetzt"},
  {id:"r4",label:"Emotional ruhig und fokussiert"},
  {id:"r5",label:"Nach 16:15 Uhr getradet"},
  {id:"r6",label:"Max 2. Trade heute (kein 3.)"},
];

const mkT=(raw,pfx)=>{
  const dc={};
  return raw.map((r,i)=>{
    const[ct,dt,tm,pnl,dur,dir]=r;
    const hr=parseInt(tm.split(":")[0]);
    dc[dt]=(dc[dt]||0)+1;
    const tn=dc[dt];
    return{id:pfx+(i+1),acct:"09",contract:ct,date:dt,time:tm,pnl,dur,dir,
      setup:dur<30?"Momentum Scalp":hr>=16?"Heatmap Correlation SP":dur>60?"Break & Retest":"Heatmap Correlation SP",
      notes:dur<10?"Impulstrade "+dur+"s":"",
      rules:{r1:dur>60,r2:dur>=30,r3:dur>60,r4:pnl>0&&tn<=2,r5:hr>=16,r6:tn<=2}};
  });
};

const RAW=[
  ["MNQ","2026-04-30","15:23",-91.20,77,"LONG"],["NQ","2026-04-30","15:25",-307.60,9,"SHORT"],
  ["NQ","2026-04-30","15:25",796.20,260,"SHORT"],["MNQ","2026-04-30","15:30",-96.20,11,"SHORT"],
  ["NQ","2026-04-30","15:30",211.20,9,"SHORT"],["MNQ","2026-04-30","15:31",27.26,12,"SHORT"],
  ["MNQ","2026-04-30","15:31",22.76,33,"SHORT"],["MNQ","2026-04-30","15:31",41.26,40,"SHORT"],
  ["MNQ","2026-04-30","15:31",59.52,49,"SHORT"],["MNQ","2026-05-04","13:04",-81.20,117,"SHORT"],
  ["MNQ","2026-05-04","13:08",21.76,87,"LONG"],["MNQ","2026-05-04","13:08",32.26,152,"LONG"],
  ["MNQ","2026-05-04","13:08",38.26,173,"LONG"],["MNQ","2026-05-04","13:08",60.52,195,"LONG"],
  ["NQ","2026-05-04","13:12",96.20,59,"LONG"],["NQ","2026-05-04","17:11",-128.80,9,"LONG"],
  ["NQ","2026-05-04","17:11",-128.80,17,"LONG"],["NQ","2026-05-04","17:11",261.20,132,"SHORT"],
  ["NQ","2026-05-04","17:14",236.20,29,"SHORT"],["NQ","2026-05-05","13:30",-123.80,55,"SHORT"],
  ["NQ","2026-05-05","13:32",96.20,327,"LONG"],["MNQ","2026-05-05","13:38",-68.70,1373,"LONG"],
  ["NQ","2026-05-05","14:14",61.20,143,"LONG"],["NQ","2026-05-05","14:17",6.20,38,"LONG"],
  ["MNQ","2026-05-05","14:18",-81.20,75,"SHORT"],["NQ","2026-05-05","14:19",86.20,110,"SHORT"],
  ["MNQ","2026-05-05","14:22",-81.20,112,"LONG"],["NQ","2026-05-05","14:25",-128.80,70,"SHORT"],
  ["NQ","2026-05-05","14:28",-128.80,36,"LONG"],["MNQ","2026-05-05","14:32",-6.20,399,"SHORT"],
  ["NQ","2026-05-05","14:39",-33.80,231,"SHORT"],["NQ","2026-05-05","16:52",-63.80,45,"LONG"],
  ["NQ","2026-05-05","16:54",-33.80,205,"LONG"],["NQ","2026-05-05","16:57",-153.80,24,"LONG"],
  ["NQ","2026-05-05","16:58",-148.80,43,"SHORT"],["NQ","2026-05-05","17:00",-138.80,14,"LONG"],
  ["MNQ","2026-05-05","17:00",-27.48,15,"SHORT"],["MNQ","2026-05-05","17:01",-27.48,94,"SHORT"],
  ["MNQ","2026-05-05","17:04",-4.24,5,"SHORT"],["NQ","2026-05-06","17:12",-93.80,191,"SHORT"],
  ["NQ","2026-05-06","17:16",221.20,68,"LONG"],["NQ","2026-05-06","17:20",136.20,322,"LONG"],
  ["NQ","2026-05-06","17:20",21.20,416,"LONG"],["NQ","2026-05-07","13:33",-307.60,89,"SHORT"],
  ["NQ","2026-05-07","13:40",-153.80,231,"SHORT"],["MNQ","2026-05-07","13:44",-81.20,19,"LONG"],
  ["NQ","2026-05-07","13:46",191.20,127,"SHORT"],["MNQ","2026-05-07","13:45",26.76,251,"SHORT"],
  ["MNQ","2026-05-07","13:45",25.26,365,"SHORT"],["MNQ","2026-05-07","13:45",44.28,394,"SHORT"],
  ["NQ","2026-05-07","13:52",6.20,146,"LONG"],["NQ","2026-05-07","16:21",226.20,27,"LONG"],
  ["NQ","2026-05-07","16:21",446.20,43,"LONG"],["MNQ","2026-05-07","16:23",3.80,79,"SHORT"],
  ["MNQ","2026-05-07","16:25",-34.48,33,"LONG"],["MNQ","2026-05-07","16:26",11.52,44,"LONG"],
  ["MNQ","2026-05-08","12:55",-81.20,28,"SHORT"],["NQ","2026-05-08","12:56",-138.80,20,"SHORT"],
  ["NQ","2026-05-08","12:57",-103.80,21,"SHORT"],["NQ","2026-05-08","12:58",291.20,644,"LONG"],
  ["NQ","2026-05-08","13:09",31.20,92,"LONG"],["MNQ","2026-05-08","13:11",7.26,157,"LONG"],
  ["MNQ","2026-05-08","13:11",7.26,171,"LONG"],["MNQ","2026-05-08","13:11",9.76,204,"LONG"],
  ["MNQ","2026-05-08","13:11",33.52,297,"LONG"],["MNQ","2026-05-08","15:12",-86.20,27,"SHORT"],
  ["MNQ","2026-05-08","15:14",-81.20,19,"LONG"],["NQ","2026-05-08","15:15",1.20,125,"SHORT"],
  ["NQ","2026-05-08","15:17",-128.80,25,"SHORT"],["NQ","2026-05-08","15:17",-3.80,63,"SHORT"],
  ["NQ","2026-05-08","15:19",-128.80,22,"LONG"],["NQ","2026-05-08","15:19",76.20,85,"LONG"],
  ["NQ","2026-05-08","15:21",-133.80,22,"SHORT"],["NQ","2026-05-08","15:23",-133.80,97,"SHORT"],
  ["NQ","2026-05-08","15:25",-138.80,104,"LONG"],["MNQ","2026-05-08","15:27",-81.20,13,"SHORT"],
  ["NQ","2026-05-08","15:29",-128.80,5,"SHORT"],["MNQ","2026-05-08","15:28",-30.96,101,"SHORT"],
  ["MNQ","2026-05-08","15:30",9.04,18,"SHORT"],["MNQ","2026-05-08","15:30",-81.20,2,"LONG"],
  ["NQ","2026-05-11","16:27",1.20,53,"SHORT"],["NQ","2026-05-11","16:28",396.20,72,"SHORT"],
  ["NQ","2026-05-12","16:35",-283.80,15,"SHORT"],["NQ","2026-05-12","16:36",-213.80,8,"SHORT"],
  ["NQ","2026-05-12","16:36",-38.80,4,"SHORT"],["NQ","2026-05-12","16:37",831.20,130,"LONG"],
  ["MNQ","2026-05-12","16:40",25.76,29,"LONG"],["MNQ","2026-05-12","16:40",-46.96,37,"LONG"],
  ["MNQ","2026-05-12","16:41",28.26,9,"SHORT"],["MNQ","2026-05-12","16:41",3.04,23,"SHORT"],
  ["MNQ","2026-05-12","16:42",16.76,30,"LONG"],["MNQ","2026-05-12","16:42",41.76,39,"LONG"],
  ["MNQ","2026-05-12","16:42",90.78,52,"LONG"],
  ["NQ","2026-05-13","17:10",-128.80,78,"LONG"],["NQ","2026-05-13","17:11",-103.80,13,"LONG"],
  ["NQ","2026-05-13","17:12",-118.80,16,"SHORT"],["NQ","2026-05-13","17:13",-123.80,36,"SHORT"],
  ["NQ","2026-05-13","17:15",-113.80,14,"SHORT"],["NQ","2026-05-13","17:16",-108.80,26,"LONG"],
  ["NQ","2026-05-13","17:19",-103.80,54,"LONG"],["NQ","2026-05-13","17:23",381.20,184,"SHORT"],
  ["NQ","2026-05-13","17:27",26.20,65,"SHORT"],["NQ","2026-05-13","17:28",-103.80,25,"SHORT"],
  ["NQ","2026-05-13","17:28",-108.80,3,"SHORT"],["NQ","2026-05-13","17:29",-103.80,50,"LONG"],
  ["NQ","2026-05-14","11:38",-327.60,58,"SHORT"],["NQ","2026-05-14","11:40",6.20,149,"LONG"],
  ["NQ","2026-05-14","11:43",686.20,7930,"LONG"],["NQ","2026-05-14","13:57",-103.80,134,"LONG"],
  ["NQ","2026-05-14","13:59",-93.80,57,"SHORT"],["NQ","2026-05-14","14:01",236.20,1065,"LONG"],
  ["MNQ","2026-05-14","15:25",23.76,108,"SHORT"],["MNQ","2026-05-14","15:25",27.76,147,"SHORT"],
  ["MNQ","2026-05-14","15:25",41.26,171,"SHORT"],["MNQ","2026-05-14","15:25",51.52,177,"SHORT"],
  ["MNQ","2026-05-15","15:06",-98.7,99,"SHORT"],["MNQ","2026-05-15","15:08",-88.7,301,"SHORT"],
  ["NQ","2026-05-15","15:13",-13.8,78,"LONG"],["NQ","2026-05-15","15:14",386.2,104,"LONG"],
  ["MNQ","2026-05-15","15:16",-81.2,10,"SHORT"],["MNQ","2026-05-15","15:17",-81.2,8,"SHORT"],
  ["NQ","2026-05-15","15:17",-188.8,31,"LONG"],["NQ","2026-05-15","15:18",-133.8,31,"LONG"],
  ["NQ","2026-05-15","15:19",841.2,78,"SHORT"],
];

const SEED=mkT(RAW,"a");
const emptyRules=()=>({r1:false,r2:false,r3:false,r4:false,r5:false,r6:false});
const emptyForm=()=>({date:todayISO(),time:nowHHMM(),contract:"MNQ",dir:"LONG",pnl:"",setup:SETUPS[0],notes:"",rules:emptyRules()});

const Pill=({bg,color,children})=>(
  <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:bg,color}}>{children}</span>
);
const Card=({children,style,onClick})=>(
  <div onClick={onClick} style={{background:"linear-gradient(145deg,#141e35 0%,#0f1828 100%)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:14,padding:16,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.05)",...style}}>{children}</div>
);
const Bar2=({pct,color})=>(
  <div style={{height:10,borderRadius:5,background:"rgba(255,255,255,0.05)",boxShadow:"inset 0 2px 4px rgba(0,0,0,0.4)"}}>
    <div style={{height:"100%",borderRadius:5,width:Math.min(100,Math.max(0,pct))+"%",background:"linear-gradient(90deg,"+color+"aa,"+color+")",transition:"width .6s ease",boxShadow:"0 0 10px "+color+"55"}}/>
  </div>
);
const Chk=({checked,onClick,label})=>(
  <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid #2d3548",cursor:"pointer"}}>
    <div style={{width:22,height:22,borderRadius:6,border:"2px solid "+(checked?G:"#1e2d48"),background:checked?G:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      {checked&&<span style={{color:"#000",fontSize:14,fontWeight:900}}>✓</span>}
    </div>
    <span style={{fontSize:14}}>{label}</span>
  </div>
);

const Field=({label,children})=>(
  <div style={{background:"#0d1320",borderRadius:10,padding:"10px 12px",border:"1px solid #2d3548"}}>
    <div style={{color:"#8b96b0",fontSize:9,fontWeight:700,letterSpacing:"0.8px",marginBottom:6}}>{label}</div>
    {children}
  </div>
);

const sanitize=s=>typeof s==="string"?s.replace(/[\uD800-\uDFFF]/g,""):s;

export default function App(){
  const[trades,setTrades]=useState(()=>{
    try{
      // New users start empty - no demo data
      const onboardingDone=localStorage.getItem('ttp_onboarding_done');
      if(!onboardingDone) return [];
      const s=localStorage.getItem('ttp_trades');
      if(!s) return [];
      const parsed=JSON.parse(s);
      // Migration: fix imported trades that wrongly have all rules=true
      const migrated=parsed.map(t=>{
        const allTrue=t.rules&&Object.values(t.rules).every(Boolean);
        const isImport=t.setup&&(t.setup.includes('Import')||t.setup==='Chat Import'||t.notes?.includes('Impulstrade')||t.id?.startsWith('a'));
        if(allTrue&&isImport){
          const hr=parseInt(t.time?.split(':')[0]||'0');
          const mn=parseInt(t.time?.split(':')[1]||'0');
          const inWin=(hr===16&&mn>=15)||(hr===17&&mn<=30);
          return{...t,rules:{r1:false,r2:false,r3:false,r4:false,r5:inWin,r6:true}};
        }
        return t;
      });
      return migrated;
    }catch(e){return SEED;}
  });
  const[authUser,setAuthUser]=useState(null);
  const[authLoading,setAuthLoading]=useState(true);
  const[authScreen,setAuthScreen]=useState("login"); // login | register
  const[authEmail,setAuthEmail]=useState("");
  const[authPassword,setAuthPassword]=useState("");
  const[authError,setAuthError]=useState("");
  const[authWorking,setAuthWorking]=useState(false);
  const[showOnboarding,setShowOnboarding]=useState(()=>!localStorage.getItem('ttp_onboarding_done'));
  const[onboardStep,setOnboardStep]=useState(0);
  const[onboardData,setOnboardData]=useState({name:'',firm:'TTP',firmOther:'',size:50000,maxDD:2000,dailyDD:1000,target:54000,number:'',instrument:'MNQ',psychAnswers:{}});
  const[showSplash,setShowSplash]=useState(true);
  const[tab,setTab]=useState("dash");
  const[toast,setToast]=useState("");
  const[delId,setDelId]=useState(null);
  const[expandedMonth,setExpandedMonth]=useState(null);
  const[dateFrom,setDateFrom]=useState("");
  const[dateTo,setDateTo]=useState("");
  const[aiOpen,setAiOpen]=useState(false);
  const[aiMessages,setAiMessages]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem('ttp_chat_history')||'[]');
      if(saved.length>0) return saved.slice(-20); // Load last 20 messages
    }catch(e){}
    return [];
  });
  const[aiInput,setAiInput]=useState("");
  const aiMessagesEndRef=useRef(null);
  const[pendingImage,setPendingImage]=useState(null);
  const[aiLoading,setAiLoading]=useState(false);
  const[aiImage,setAiImage]=useState(null);
  const[aiImagePreview,setAiImagePreview]=useState(null);
  const[isRecording,setIsRecording]=useState(false);
  const[aiAutoShown,setAiAutoShown]=useState({});
  const[showMoreButtons,setShowMoreButtons]=useState(false);
  const[checks,setChecks]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem('ttp_checks')||'{}');
      if(saved.date===todayISO())return saved.data||{c1:false,c2:false,c3:false,c4:false};
    }catch(e){}
    return{c1:false,c2:false,c3:false,c4:false};
  });
  const[form,setForm]=useState(emptyForm());
  const[goals,setGoals]=useState(()=>{
    try{const s=localStorage.getItem('ttp_goals');return s?JSON.parse(s):{pnl:1500,disc:80,targetBalance:53000};}
    catch(e){return{pnl:1500,disc:80,targetBalance:53000};}
  });
  const[settingsOpen,setSettingsOpen]=useState(false);
  const[settingsSection,setSettingsSection]=useState(null);
  const[goalPeriod,setGoalPeriod]=useState('month');
  const[settings,setSettings]=useState(()=>{
    try{
      const s=localStorage.getItem('ttp_settings');
      return s?JSON.parse(s):{maxTrades:2,pauseMins:15,windowStart:"16:15",windowEnd:"17:30",monthlyGoal:1500,riskPerTradePct:2};
    }catch(e){return{maxTrades:2,pauseMins:15,windowStart:"16:15",windowEnd:"17:30",monthlyGoal:1500,riskPerTradePct:2};}
  });
  const saveSettings=(s)=>{setSettings(s);localStorage.setItem('ttp_settings',JSON.stringify(s));}

  const signUp=async()=>{
    if(!authEmail||!authPassword){setAuthError("Email und Passwort eingeben");return;}
    setAuthWorking(true);setAuthError("");
    const{error}=await supabase.auth.signUp({email:authEmail,password:authPassword});
    if(error)setAuthError(error.message);
    else setAuthError("✅ Bestätigungsmail gesendet! Bitte Email bestätigen.");
    setAuthWorking(false);
  };

  const signIn=async()=>{
    if(!authEmail||!authPassword){setAuthError("Email und Passwort eingeben");return;}
    setAuthWorking(true);setAuthError("");
    const{error}=await supabase.auth.signInWithPassword({email:authEmail,password:authPassword});
    if(error)setAuthError("Falsche Email oder Passwort");
    setAuthWorking(false);
  };

  const signOut=async()=>{
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.reload();
  };

  const completeOnboarding=async()=>{
    // Save profile
    const newAcct={
      type:'challenge',
      broker:onboardData.firm==='Andere'?onboardData.firmOther:onboardData.firm,
      number:onboardData.number,
      name:onboardData.name,
      size:onboardData.size,
      maxDD:onboardData.maxDD,
      dailyDD:onboardData.dailyDD,
      target:onboardData.target,
      targetDays:30,
      lotSize:1,
      instrument:onboardData.instrument||'MNQ',
      slTicks:40,
      tpTicks:80
    };
    saveAcct(newAcct);
    setSaldo(onboardData.size);
    localStorage.setItem('ttp_saldo',onboardData.size);
    setMaxDDLevel(onboardData.size-onboardData.maxDD);
    localStorage.setItem('ttp_maxdd_level',onboardData.size-onboardData.maxDD);
    // Save psychology answers as coach profile
    const psychText=Object.entries(onboardData.psychAnswers).map(([k,v])=>k+': '+v).join(' | ');
    setCoachProfile(psychText);
    localStorage.setItem('ttp_coach_profile',psychText);
    // Mark onboarding done
    localStorage.setItem('ttp_onboarding_done','true');
    localStorage.setItem('ttp_challenge_start',new Date().toISOString().split('T')[0]);
    setChallengeStart(new Date().toISOString().split('T')[0]);
    setShowOnboarding(false);
    // Trigger AI welcome analysis
    setTimeout(()=>{
      setAiOpen(true);
      const firmName=onboardData.firm==='Andere'?onboardData.firmOther:onboardData.firm;
      const psychSummary=Object.values(onboardData.psychAnswers).join(', ');
      triggerAiPopupCustom('Neuer Trader '+onboardData.name+' startet bei '+firmName+'. Psychologie-Check: '+psychSummary+'. Konto: $'+onboardData.size+'. Gib eine kurze persönliche Willkommensnachricht und deinen wichtigsten Rat für den Start. Max 3 Sätze.');
    },1000);
  };

  const triggerAiPopupCustom=async(prompt)=>{
    setAiLoading(true);
    setAiMessages([{role:'assistant',content:'Analysiere deinen Profil...'}]);
    try{
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],context:{coachProfile:'',coachMemory:'',chatHistorySummary:''}})});
      const d=await res.json();
      if(d.message)setAiMessages([{role:'assistant',content:d.message}]);
    }catch(e){setAiMessages([{role:'assistant',content:'Willkommen bei MindRisk! Ich bin dein persönlicher Trading Coach.'}]);}
    setAiLoading(false);
  };;
  const[profExpanded,setProfExpanded]=useState(false);
  const[monatExp,setMonatExp]=useState(false);
  const[challengeStart,setChallengeStart]=useState(()=>localStorage.getItem('ttp_challenge_start')||'2000-01-01');
  const[acct,setAcct]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('ttp_account')||'null')||{
      type:'challenge',broker:'',number:'',name:'',propFirm:'TTP',ddType:'eod',profitTargetPct:8,challengeDays:30,
      size:50000,maxDD:2000,dailyDD:1000,target:54000,targetDays:30,lotSize:1,
      instrument:'MNQ',slTicks:40,tpTicks:80
    };}catch(e){return{type:'challenge',broker:'',number:'',size:50000,maxDD:2000,dailyDD:1000,target:54000,targetDays:30};}
  });
  const saveAcct=(a)=>{setAcct(a);localStorage.setItem('ttp_account',JSON.stringify(a));};
  const startChallenge=()=>{
    const today=new Date().toISOString().slice(0,10);
    setChallengeStart(today);
    localStorage.setItem('ttp_challenge_start',today);
    setSaldo(acct.size);
    localStorage.setItem('ttp_saldo',acct.size);
    setMaxDDLevel(acct.size-acct.maxDD);
    localStorage.setItem('ttp_maxdd_level',acct.size-acct.maxDD);
    const newGoals={...goals,targetBalance:acct.target};
    setGoals(newGoals);
    localStorage.setItem('ttp_goals',JSON.stringify(newGoals));
    showToast('✅ Challenge gestartet! $'+acct.size.toLocaleString()+' · Ziel: $'+acct.target.toLocaleString());
  };
  
  const[probExp,setProbExp]=useState(false);
  const[mindCheckIn,setMindCheckIn]=useState({mood:0,energy:0,stress:0});
  const[mindLight,setMindLight]=useState(null); // 'green','yellow','red'
  const[mindMsg,setMindMsg]=useState('');
  const[mindLoading,setMindLoading]=useState(false);
  const[checkedIn,setCheckedIn]=useState(false);
  const[warningDismissed,setWarningDismissed]=useState(false);
  const[selectedRules,setSelectedRules]=useState(()=>{try{return JSON.parse(localStorage.getItem('ttp_selected_rules')||'["r1","r2","r3","r4","r5"]');}catch(e){return["r1","r2","r3","r4","r5"];}});
  const toggleRule=(key)=>{
    setSelectedRules(prev=>{
      const next=prev.includes(key)?prev.filter(k=>k!==key):[...prev,key].slice(0,5);
      localStorage.setItem('ttp_selected_rules',JSON.stringify(next));
      return next;
    });
  };
  const ALL_RULES=[
    {k:"r1",l:"Max 2 Trades pro Tag",icon:"#"},
    {k:"r2",l:"Nur 16:15–17:30 Uhr traden",icon:"⏰"},
    {k:"r3",l:"SL immer vor Entry setzen",icon:"◉"},
    {k:"r4",l:"TP immer vor Entry setzen",icon:"◎"},
    {k:"r5",l:"Kein Trade nach 2 Verlusten",icon:"◆"},
    {k:"r6",l:"15 Min Pause zwischen Trades",icon:"⏸"},
    {k:"r7",l:"Nur MNQ – kein NQ",icon:"▣"},
    {k:"r8",l:"Kein Impuls-Trade – nur Setup",icon:"∿"},
    {k:"r9",l:"Erst Check-in bevor traden",icon:"✓"},
    {k:"r10",l:"Daily DD $1.000 → Rechner aus",icon:"⌥"},
  ];
  const doMindCheckIn=async()=>{
    if(!mindCheckIn.mood||!mindCheckIn.energy||!mindCheckIn.stress){showToast("Bitte alle 3 bewerten!");return;}
    setMindLoading(true);
    // Client-side light calculation (not from AI)
    const focusBad=mindCheckIn.mood<3;
    const energyBad=mindCheckIn.energy<3;
    const stressBad=mindCheckIn.stress>3;
    const badCount=[focusBad,energyBad,stressBad].filter(Boolean).length;
    const light=badCount>=2?'red':badCount===1?'yellow':'green';
    setMindLight(light);
    // AI just gives motivating message
    const statusText=light==='red'?'Heute ist nicht dein Tag für Trades':light==='yellow'?'Heute mit Vorsicht':' Du bist bereit';
    const prompt=light==='red'
      ?"Trader macht seinen Check-in. Fokus "+mindCheckIn.mood+"/5, Energie "+mindCheckIn.energy+"/5, Stress "+mindCheckIn.stress+"/5. Empfehle ihm heute NICHT zu traden. Gib ihm 2-3 kurze motivierende Sätze: dass jeder Tag Chancen hat, dass Pause manchmal der beste Trade ist, und was er stattdessen tun kann (Analyse, Lernen). Klingt ermutigend, nicht negativ."
      :light==='yellow'
      ?"Trader Check-in: Fokus "+mindCheckIn.mood+"/5, Energie "+mindCheckIn.energy+"/5, Stress "+mindCheckIn.stress+"/5. Gib Rat: wenn er tradet dann max 1 Trade mit weniger Risiko. 2 motivierende Sätze."
      :"Trader Check-in: alles gut! Fokus "+mindCheckIn.mood+"/5, Energie "+mindCheckIn.energy+"/5. Gib ihm einen kurzen motivierenden Satz für den Trading-Tag.";
    try{
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],context:{coachProfile:coachProfile||'',coachMemory:coachMemory.slice(0,3).map(m=>m.note).join(' | ')}})});
      const d=await res.json();
      setMindMsg(d.message||statusText);
    }catch(e){setMindMsg(statusText);}
    setCheckedIn(true);
    setWarningDismissed(false);
    setMindLoading(false);
  };
  const[problems,setProblems]=useState(()=>{try{return JSON.parse(localStorage.getItem('ttp_problems')||'{}');}catch{return{};}});
  const[probAnalysis,setProbAnalysis]=useState('');
  const[probLoading,setProbAnalysisLoading]=useState(false);
  const saveProblems=(p)=>{setProblems(p);localStorage.setItem('ttp_problems',JSON.stringify(p));};
  const[coachProfile,setCoachProfile]=useState(()=>{
    try{return localStorage.getItem('ttp_coach_profile')||'';}catch(e){return'';}
  });
  const[coachMemory,setCoachMemory]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('ttp_coach_memory')||'[]');}catch(e){return[];}
  });
  const saveCoachMemory=(note)=>{
    const ts=new Date().toISOString().split('T')[0];
    const newMemory=[{date:ts,note},...coachMemory].slice(0,30);
    setCoachMemory(newMemory);
    localStorage.setItem('ttp_coach_memory',JSON.stringify(newMemory));
  };
  const[journal,setJournal]=useState(()=>{try{return JSON.parse(localStorage.getItem('ttp_journal')||'{}');}catch(e){return{};}});
  const[todayJ,setTodayJ]=useState(()=>{
    try{const j=JSON.parse(localStorage.getItem('ttp_journal')||'{}');return j[todayISO()]||{good:"",bad:"",emotion:""};}
    catch(e){return{good:"",bad:"",emotion:""};}
  });
  const[maxDDLevel,setMaxDDLevel]=useState(()=>parseFloat(localStorage.getItem('ttp_maxdd_level')||'49070.80'));
  const[saldo,setSaldo]=useState(()=>parseFloat(localStorage.getItem('ttp_saldo')||'50433.22'));
  const[lastTradeAt,setLastTradeAt]=useState(null);
  const[tick,setTick]=useState(0);
  const[screenW,setScreenW]=useState(typeof window!=="undefined"?window.innerWidth:520);
  useEffect(()=>{const h=()=>setScreenW(window.innerWidth);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h);},[]);
  const isDesktop=screenW>=800;

  useEffect(()=>{const id=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(id);},[]);

  // Auth listener
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setAuthUser(session?.user||null);
      setAuthLoading(false);
    });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      setAuthUser(session?.user||null);
    });
    return()=>subscription.unsubscribe();
  },[]);

  const userScrolledUp=useRef(false);
  const chatContainerRef=useRef(null);
  useEffect(()=>{
    if(!userScrolledUp.current&&aiMessagesEndRef.current){
      aiMessagesEndRef.current.scrollIntoView({behavior:"smooth"});
    }
  },[aiMessages,aiLoading]);

  useEffect(()=>{
    const t=setTimeout(()=>setShowSplash(false),1800);
    const t2=setTimeout(()=>{
      const DAYS=["So","Mo","Di","Mi","Do","Fr","Sa"];
      const tod=DAYS[new Date().getDay()];
      const h=new Date().getHours();
      const m=new Date().getMinutes();
      const inWindow=(h===16&&m>=15)||(h===17&&m<=30);
      setAiOpen(true);
      const greet=h<12?"Guten Morgen":h<17?"Hi":h<21?"Guten Abend":"Hey";
      setAiMessages([{role:"assistant",content:greet+" "+(acct.name||"Trader")+"! 👋\n\nHeute ist "+tod+". "+(inWindow?"⚡ Trading-Fenster ist OFFEN!":"Trading-Fenster: 16:15–17:30 Uhr.")+"\n\nTippe '☀️ Tages-Briefing' für die volle KI-Analyse – oder stell direkt eine Frage!",auto:true}]);
    },2200);
    return()=>{clearTimeout(t);clearTimeout(t2);};
  },[]);

  useEffect(()=>{
    const h=new Date().getHours(),m=new Date().getMinutes();
    const todayT=t09.filter(t=>t.date===todayISO());
    const key16=todayISO()+"_16";
    const keyOT=todayISO()+"_ot";
    if(h===16&&m>=15&&m<=20&&!aiAutoShown[key16]&&!todayBlocked){
      setAiAutoShown(p=>({...p,[key16]:true}));triggerAiPopup("trading_window");
    }
    if(todayT.length>=OVERTRADING_AT&&!aiAutoShown[keyOT]){
      setAiAutoShown(p=>({...p,[keyOT]:true}));triggerAiPopup("overtrading");
    }
  },[tick]);

  const now=new Date();
  const msSince=lastTradeAt?now-lastTradeAt:999999;
  const pauseSecs=Math.max(0,PAUSE_MINS*60-Math.floor(msSince/1000));
  const inPause=pauseSecs>0;
  const pMin=Math.floor(pauseSecs/60);
  const pSec=pauseSecs%60;
  const pStr=pMin+":"+(pSec<10?"0":"")+pSec;
  const sc=v=>v>=80?G:v>=60?Y:R;

  const allT09=useMemo(()=>trades.filter(t=>t&&typeof t.date==="string").sort((a,b)=>(a.date+a.time)<(b.date+b.time)?-1:1),[trades]);
  const t09=useMemo(()=>allT09.filter(t=>t.date>=challengeStart),[allT09,challengeStart]);
  const netPnl=useMemo(()=>Math.round(t09.reduce((s,t)=>s+t.pnl,0)*100)/100,[t09]);
  const kontoabstand=Math.max(0,Math.round((saldo-maxDDLevel)*100)/100);
  const todT=t09.filter(t=>t.date===todayISO());
  const todPnl=Math.round(todT.reduce((s,t)=>s+t.pnl,0)*100)/100;
  const dailyLoss=Math.abs(Math.min(0,todPnl));
  const dailyDDHit=dailyLoss>=DAILY_DD_LIMIT;
  const tradeCount=todT.length;
  const atLimit=tradeCount>=DAILY_LIMIT;
  const overtradingToday=tradeCount>=OVERTRADING_AT;
  const tradesLeft=Math.max(0,DAILY_LIMIT-tradeCount);
  const dpD=Math.min(100,Math.abs(Math.min(0,todPnl))/1000*100);
  const canTrade=!atLimit&&!overtradingToday&&!inPause;

  const disc=useMemo(()=>{
    if(!t09.length)return 0;
    const tot=t09.reduce((s,t)=>{const rv=t.rules||{},kk=Object.keys(rv);return kk.length?s+kk.filter(k=>rv[k]).length/kk.length:s;},0);
    return Math.round(tot/t09.length*100);
  },[t09]);

  const overtradingDays=useMemo(()=>{
    const m={};t09.forEach(t=>{m[t.date]=(m[t.date]||0)+1;});
    return new Set(Object.entries(m).filter(([,n])=>n>=OVERTRADING_AT).map(([d])=>d));
  },[t09]);

  const blockedDays=useMemo(()=>{
    const s=new Set();
    overtradingDays.forEach(d=>{
      const dt=new Date(d);dt.setDate(dt.getDate()+1);
      if(dt.getDay()===0||dt.getDay()===6)return;
      s.add(dt.toISOString().split("T")[0]);
    });
    return s;
  },[overtradingDays]);

  const todayBlocked=blockedDays.has(todayISO());
  const calMap=useMemo(()=>{const m={};allT09.forEach(t=>{if(!m[t.date])m[t.date]=0;m[t.date]+=t.pnl;});return m;},[allT09]);

  const weekdayStats=useMemo(()=>{
    const DAYS=["So","Mo","Di","Mi","Do","Fr","Sa"];
    const map={};
    t09.forEach(t=>{
      const lbl=DAYS[new Date(t.date).getDay()];
      if(!map[lbl])map[lbl]={pnl:0,days:new Set(),wins:0,n:0};
      map[lbl].pnl+=t.pnl;map[lbl].days.add(t.date);map[lbl].n++;
      if(t.pnl>0)map[lbl].wins++;
    });
    return["Mo","Di","Mi","Do","Fr"].map(d=>({
      label:d,pnl:map[d]?.pnl||0,days:map[d]?.days.size||0,
      wr:map[d]?.n?Math.round(map[d].wins/map[d].n*100):0,
      pct:map[d]?.days.size?Math.round([...map[d].days].filter(date=>t09.filter(t=>t.date===date).reduce((s,t)=>s+t.pnl,0)>0).length/map[d].days.size*100):0,
    }));
  },[t09]);

  const equity=useMemo(()=>{let c=0;return t09.map((t,i)=>({i:i+1,v:Math.round((c+=t.pnl)*100)/100}));},[t09]);
  const monthPnl=useMemo(()=>Math.round(t09.filter(t=>t.date.startsWith(todayISO().slice(0,7))).reduce((s,t)=>s+t.pnl,0)*100)/100,[t09]);
  const profitPlan=useMemo(()=>{
    if(t09.length<2)return null;
    const inst=INSTRUMENTS[acct.instrument||'MNQ']||INSTRUMENTS['MNQ'];
    const ls=acct.lotSize||1;
    const slTicks=acct.slTicks||40;
    const tpTicks=acct.tpTicks||80;
    const slAmt=Math.round(slTicks*inst.tickValue*ls*100)/100;
    const tpAmt=Math.round(tpTicks*inst.tickValue*ls*100)/100;
    const wins=t09.filter(t=>t.pnl>0),losses=t09.filter(t=>t.pnl<=0);
    const wr=wins.length/t09.length;
    const avgW=wins.length?wins.reduce((s,t)=>s+t.pnl,0)/wins.length:0;
    const avgL=losses.length?Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length):1;
    const rr=avgW/avgL;
    // EV basierend auf echten Daten ODER konfigurierten SL/TP
    const evPerTrade=Math.round(wr*avgW-(1-wr)*avgL);
    const evPerTradeConfig=Math.round(wr*tpAmt-(1-wr)*slAmt);
    const dailyEV=Math.round(evPerTrade*(acct.maxTrades||2));
    const monthlyEV=Math.round(dailyEV*22);
    const m={};t09.forEach(t=>{m[t.date]=(m[t.date]||0)+1;});
    const crv=tpTicks/slTicks;
    const neededWR=Math.round(100/(1+crv));
    return{
      wr:Math.round(wr*100),
      rr:rr.toFixed(1),
      crvConfig:crv.toFixed(1),
      neededWR,
      neededWRConfig:neededWR,
      dailyEV,monthlyEV,
      avgW:Math.round(avgW),avgL:Math.round(avgL),
      slAmt,tpAmt,slTicks,tpTicks,
      instrument:acct.instrument||'MNQ',
      instName:inst.name,
      tickValue:inst.tickValue,
      evPerTrade,evPerTradeConfig,
      overtradeDays:Object.values(m).filter(n=>n>3).length,
      totalDays:Object.keys(m).length
    };
  },[t09,acct]);

  const[wzpExp,setWzpExp]=useState(false);
  const[wzpData,setWzpData]=useState(()=>{
    try{const d=JSON.parse(localStorage.getItem('ttp_wzp_data')||'null');
      if(d&&d.date===new Date().toISOString().split('T')[0])return d;
      return null;
    }catch(e){return null;}
  });
  const[wzpLoading,setWzpLoading]=useState(false);

  const wzpCalc=useMemo(()=>{
    const inst=INSTRUMENTS[acct.instrument||'MNQ']||INSTRUMENTS['MNQ'];
    const maxT=acct.maxTrades||settings.maxTrades||2;
    const ddType=acct.ddType||'eod';
    const accountType=acct.type||'challenge';
    // --- Woche ---
    const now=new Date();
    const dow=now.getDay();
    const daysSinceMon=dow===0?6:dow-1;
    const weekStart=new Date(now);weekStart.setDate(now.getDate()-daysSinceMon);weekStart.setHours(0,0,0,0);
    const weekStartISO=weekStart.toISOString().split('T')[0];
    const weekT=t09.filter(t=>t.date>=weekStartISO);
    const weekPnl=Math.round(weekT.reduce((s,t)=>s+t.pnl,0)*100)/100;
    const weekWins=weekT.filter(t=>t.pnl>0).length;
    const weekWR=weekT.length?Math.round(weekWins/weekT.length*100):0;
    const tradDaysLeftWeek=[2,3,4,5].filter(d=>d>dow).length;
    // --- Ziele je Kontotyp ---
    let profitTarget=0,profitSoFar=0,profitNeeded=0,challengeDaysLeft=0,dailyNeeded=0,weeklyTarget=0;
    if(accountType==='challenge'){
      profitTarget=Math.round(acct.size*((acct.profitTargetPct||8)/100));
      profitSoFar=Math.max(0,Math.round(saldo-acct.size));
      profitNeeded=Math.max(0,profitTarget-profitSoFar);
      if(challengeStart&&challengeStart!=='2000-01-01'){
        const cEnd=new Date(challengeStart);cEnd.setDate(cEnd.getDate()+(acct.challengeDays||30));
        for(let d=new Date(now);d<=cEnd;d.setDate(d.getDate()+1)){const dw=d.getDay();if(dw!==0&&dw!==6&&d>now)challengeDaysLeft++;}
      } else {challengeDaysLeft=15;}
      dailyNeeded=challengeDaysLeft>0?Math.ceil(profitNeeded/challengeDaysLeft):profitNeeded;
      weeklyTarget=dailyNeeded*Math.min(5,tradDaysLeftWeek+1);
    } else {
      const mGoal=goals.monthlyGoal||(Math.max(0,goals.targetBalance-saldo))||1500;
      const today2=new Date();const endM=new Date(today2.getFullYear(),today2.getMonth()+1,0);
      let dLeft=0;for(let d=new Date(today2);d<=endM;d.setDate(d.getDate()+1)){if(d.getDay()!==0&&d.getDay()!==6)dLeft++;}
      const mRem=Math.max(0,mGoal-monthPnl);
      dailyNeeded=dLeft>0?Math.ceil(mRem/dLeft):0;
      weeklyTarget=dailyNeeded*5;profitTarget=mGoal;profitSoFar=Math.max(0,Math.round(monthPnl));profitNeeded=Math.round(mRem);
    }
    // --- Kontrakt-Empfehlung ---
    const maxRisk=Math.round((acct.dailyDD||1000)/maxT*0.6);
    const slPerMicro=Math.round((acct.slTicks||40)*inst.tickValue);
    const tpPerMicro=Math.round((acct.tpTicks||80)*inst.tickValue);
    const recMicro=Math.max(1,Math.floor(maxRisk/Math.max(1,slPerMicro)));
    const fullSym=inst.full;const fullInst=INSTRUMENTS[fullSym];
    const slPerFull=fullInst?Math.round((acct.slTicks||40)*fullInst.tickValue):9999;
    const canFull=fullInst&&slPerFull<=maxRisk;
    const recFull=canFull?Math.max(1,Math.floor(maxRisk/slPerFull)):0;
    const recSym=canFull&&recMicro>=8?fullSym:(acct.instrument||'MNQ');
    const recQty=recSym===fullSym?recFull:recMicro;
    const recTickVal=(INSTRUMENTS[recSym]||inst).tickValue;
    const recSL=Math.round((acct.slTicks||40)*recTickVal*recQty);
    const recTP=Math.round((acct.tpTicks||80)*recTickVal*recQty);
    // --- DD Status ---
    const ddUsed=Math.max(0,acct.size-saldo);
    const ddPct=Math.min(100,Math.round(ddUsed/(acct.maxDD||2000)*100));
    const dailyDDUsed=Math.max(0,-todPnl);
    const dailyDDPct=Math.min(100,Math.round(dailyDDUsed/(acct.dailyDD||1000)*100));
    // --- Wochenfortschritt ---
    const weeklyPct=weeklyTarget>0?Math.min(100,Math.max(0,Math.round(weekPnl/weeklyTarget*100))):weekPnl>=0?100:0;
    // --- AMPEL ---
    let ampel='green',ampelMsg='';
    if(ddPct>75||dailyDDPct>65||(accountType==='challenge'&&profitNeeded>0&&challengeDaysLeft<4&&dailyNeeded>200)){
      ampel='red';
      ampelMsg=ddPct>75?`Max-DD ${ddPct}% verbraucht – Kapital schützen!`:dailyDDPct>65?`Tages-DD ${dailyDDPct}% – Heute STOP!`:`Challenge-Deadline kritisch: $${profitNeeded} in ${challengeDaysLeft} Tagen`;
    } else if(ddPct>40||dailyDDPct>35||disc<65||(weekPnl<0&&weekT.length>=3)){
      ampel='yellow';
      ampelMsg=ddPct>40?`DD ${ddPct}% – vorsichtig`:dailyDDPct>35?`Tages-DD ${dailyDDPct}% – aufpassen`:disc<65?`Regelquote ${disc}% – unter Ziel`:`Woche negativ – Setup-Qualität prüfen`;
    } else {
      ampelMsg=accountType==='challenge'?`Challenge auf Kurs – $${profitSoFar} von $${profitTarget} erreicht`:`Alles grün – weiter so!`;
    }
    // --- Top-3 Empfehlungen ---
    const recs=[];
    recs.push({icon:'📊',title:'Empfohlene Größe',text:`${recQty}x ${recSym} — SL $${recSL} / TP $${recTP}. Max. ${maxT} Trades im Fenster ${settings.windowStart||'16:15'}–${settings.windowEnd||'17:30'} Uhr.`});
    if(accountType==='challenge'&&profitNeeded>0){
      const onTrack=dailyNeeded<=recTP*maxT;
      recs.push({icon:onTrack?'🎯':'⚡',title:onTrack?'Pace realistisch':'Pace erhöhen nötig',text:onTrack?`$${dailyNeeded}/Tag nötig. Bei ${maxT} Trades à $${recTP} TP erreichbar. ${challengeDaysLeft} Tage übrig.`:`$${dailyNeeded}/Tag nötig. ${challengeDaysLeft} Tage übrig. Fokus auf A+ Setups – kein Overtrading.`});
    } else {
      recs.push({icon:weekPnl>=0?'📈':'📉',title:`Woche ${weekPnl>=0?'positiv':'negativ'}`,text:`${weekPnl>=0?'+':''}$${weekPnl} diese Woche. Ziel: $${weeklyTarget}. ${weekT.length} Trades, ${tradDaysLeftWeek} Tage noch.`});
    }
    if(ddPct>30||dailyDDPct>20){
      recs.push({icon:'🛡️',title:'DD-Warnung',text:`Max-DD: ${ddPct}% ($${Math.round(ddUsed)} von $${acct.maxDD}). ${ddType==='trailing'?'Trailing DD — vorsicht nach Gewinnen.':'EOD DD — Positionen halten ok.'} Tages-DD: ${dailyDDPct}%.`});
    } else if(disc<70){
      recs.push({icon:'📋',title:'Regelquote verbessern',text:`${disc}% Regelquote. Konsequent im Fenster ${settings.windowStart||'16:15'}–${settings.windowEnd||'17:30'} Uhr + max. ${maxT} Trades = direkt mehr Profit.`});
    } else {
      recs.push({icon:'✅',title:'Risiko im Griff',text:`Max-DD ${ddPct}% verbraucht. ${ddType==='eod'?'EOD DD — du kannst Positionen über den Tag halten.':'Trailing DD — DD-Level steigt mit jedem neuen Gewinn.'}`});
    }
    return{ampel,ampelMsg,weekPnl,weekTradeCount:weekT.length,weekWR,weeklyTarget,weeklyPct,profitTarget,profitSoFar,profitNeeded,challengeDaysLeft,dailyNeeded,recSym,recQty,recSL,recTP,ddPct,dailyDDPct,ddUsed:Math.round(ddUsed),recs,accountType,ddType,tradDaysLeftWeek};
  },[t09,acct,saldo,settings,disc,monthPnl,challengeStart,goals,todPnl]);

  const wzpAnalyze=async()=>{
    if(wzpLoading)return;
    setWzpLoading(true);
    try{
      const inst=INSTRUMENTS[acct.instrument||'MNQ']||INSTRUMENTS['MNQ'];
      const maxT=acct.maxTrades||settings.maxTrades||2;
      // Adaptive SL/TP from real trades
      const wins=t09.filter(t=>t.pnl>0);
      const losses=t09.filter(t=>t.pnl<0);
      const avgWin=wins.length?Math.round(wins.reduce((s,t)=>s+t.pnl,0)/wins.length):0;
      const avgLoss=losses.length?Math.round(Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length)):0;
      const wr=t09.length?Math.round(wins.length/t09.length*100):0;
      // Week trades
      const now=new Date();const dow=now.getDay();const daysSinceMon=dow===0?6:dow-1;
      const wkStart=new Date(now);wkStart.setDate(now.getDate()-daysSinceMon);wkStart.setHours(0,0,0,0);
      const wkISO=wkStart.toISOString().split('T')[0];
      const wkTrades=t09.filter(t=>t.date>=wkISO);
      const wkPnl=Math.round(wkTrades.reduce((s,t)=>s+t.pnl,0)*100)/100;
      const wkWins=wkTrades.filter(t=>t.pnl>0).length;
      const wkWR=wkTrades.length?Math.round(wkWins/wkTrades.length*100):0;
      // Best/worst weekdays
      const dayMap={};
      t09.forEach(t=>{const d=new Date(t.date).getDay();if(!dayMap[d])dayMap[d]={pnl:0,n:0,wins:0};dayMap[d].pnl+=t.pnl;dayMap[d].n++;if(t.pnl>0)dayMap[d].wins++;});
      const dayNames=['So','Mo','Di','Mi','Do','Fr','Sa'];
      const dayStats=Object.entries(dayMap).map(([d,v])=>({day:dayNames[d],n:v.n,wr:Math.round(v.wins/v.n*100),pnl:Math.round(v.pnl)})).sort((a,b)=>b.pnl-a.pnl);
      // Challenge info
      let challengeDaysLeft=0;
      if(acct.type==='challenge'&&challengeStart&&challengeStart!=='2000-01-01'){
        const cEnd=new Date(challengeStart);cEnd.setDate(cEnd.getDate()+(acct.challengeDays||30));
        for(let d=new Date(now);d<=cEnd;d.setDate(d.getDate()+1)){const dw=d.getDay();if(dw!==0&&dw!==6&&d>now)challengeDaysLeft++;}
      }
      const profitTarget=acct.type==='challenge'?Math.round(acct.size*((acct.profitTargetPct||8)/100)):goals.monthlyGoal||1500;
      const profitSoFar=acct.type==='challenge'?Math.max(0,Math.round(saldo-acct.size)):Math.max(0,Math.round(monthPnl));
      const profitNeeded=Math.max(0,profitTarget-profitSoFar);
      const ddUsed=Math.max(0,acct.size-saldo);
      const ddPct=Math.round(ddUsed/(acct.maxDD||2000)*100);
      const maxRiskPerTrade=Math.round((acct.dailyDD||1000)/maxT*0.6);
      const prompt=`Du bist ein professioneller Prop-Firm Trading Risk Manager. Analysiere diese Trader-Daten und antworte NUR mit validem JSON, kein Text davor oder danach.

TRADER DATEN:
- Konto-Typ: ${acct.type==='challenge'?'Challenge':'Performance/Eigenkapital'}
- Prop Firma: ${acct.propFirm||'unbekannt'}
- DD-Typ: ${acct.ddType||'eod'} (${acct.ddType==='eod'?'End-of-Day, Positionen halten ok':'Trailing, DD steigt mit Gewinnen'})
- Kontostand: $${saldo.toFixed(0)} (Start: $${acct.size})
- Max-DD Limit: $${acct.maxDD} → Level: $${acct.size-acct.maxDD} → Verbraucht: ${ddPct}%
- Tages-DD Limit: $${acct.dailyDD}
- Instrument: ${acct.instrument||'MNQ'} (Tick-Wert: $${inst.tickValue})
- Max Trades/Tag: ${maxT}
- Handelsfenster: ${settings.windowStart||'16:15'}–${settings.windowEnd||'17:30'} Uhr
${acct.type==='challenge'?`- Challenge Gewinnziel: ${acct.profitTargetPct||8}% = $${profitTarget}
- Bereits erreicht: $${profitSoFar}
- Noch benötigt: $${profitNeeded}
- Verbleibende Handelstage: ${challengeDaysLeft}`:''}

TRADE-STATISTIKEN (${t09.length} Trades gesamt):
- Win Rate: ${wr}%
- Avg. Win: $${avgWin}
- Avg. Loss: $${avgLoss}
- Regelquote (Disziplin): ${disc}%
- Woche aktuell: ${wkTrades.length} Trades, P&L ${wkPnl>=0?'+':''}$${wkPnl}, WR ${wkWR}%
- Beste Tage: ${dayStats.slice(0,2).map(d=>d.day+' (WR:'+d.wr+'%, P&L:$'+d.pnl+')').join(', ')}
- Schlechteste Tage: ${dayStats.slice(-2).map(d=>d.day+' (WR:'+d.wr+'%, P&L:$'+d.pnl+')').join(', ')}
- Letzte 5 Trades: ${t09.slice(-5).map(t=>(t.pnl>=0?'+':'')+'$'+t.pnl.toFixed(0)).join(', ')}
- Max Risiko/Trade (60% Daily-DD / ${maxT} Trades): $${maxRiskPerTrade}

Berechne basierend auf ECHTEN Trade-Daten:
1. Adaptives SL in Ticks (basierend auf avg Loss $${avgLoss} beim Instrument ${acct.instrument||'MNQ'} Tick-Wert $${inst.tickValue})
2. Adaptives TP in Ticks (basierend auf avg Win $${avgWin})
3. Empfohlene Kontrakt-Anzahl (basierend auf Max-Risiko $${maxRiskPerTrade} und adaptivem SL)
4. Ampel-Status (green/yellow/red)
5. Wochenziel und Tagesziel in $
6. Challenge-Wahrscheinlichkeit % (nur wenn Challenge)
7. 3 konkrete Empfehlungen auf Deutsch

Antworte NUR mit diesem JSON (keine Markdown-Backticks, kein Text):
{"ampel":"green|yellow|red","ampelReason":"kurze Begründung","adaptiveSL":35,"adaptiveTP":68,"recContracts":2,"recSymbol":"MNQ","dailyTarget":80,"weeklyTarget":400,"challengeProb":72,"winRate":${wr},"avgWin":${avgWin},"avgLoss":${avgLoss},"evPerTrade":15,"evPerDay":30,"recs":[{"icon":"📊","title":"Titel","text":"Text"},{"icon":"🎯","title":"Titel","text":"Text"},{"icon":"🛡️","title":"Titel","text":"Text"}],"insight":"Ein konkreter Insight-Satz"}`;
      const res=await fetch('/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:[{role:'user',content:prompt}],context:{coachProfile:'Antworte ausschließlich mit JSON. Kein erklärender Text.'}})
      });
      if(!res.ok){setWzpLoading(false);return;}
      const d=await res.json();
      const raw=(d.message||'').replace(/```json|```/g,'').trim();
      const parsed=JSON.parse(raw);
      const result={...parsed,date:new Date().toISOString().split('T')[0],ts:Date.now()};
      setWzpData(result);
      localStorage.setItem('ttp_wzp_data',JSON.stringify(result));
    }catch(e){console.error('WZP Claude error:',e);}
    setWzpLoading(false);
  };

  const durBuckets=useMemo(()=>{
    const bkts=[{lbl:"<30s",mn:0,mx:30},{lbl:"30s-2m",mn:30,mx:120},{lbl:"2-5m",mn:120,mx:300},{lbl:"5m+",mn:300,mx:999999}];
    return bkts.map(b=>{
      const arr=t09.filter(t=>t.dur>=b.mn&&t.dur<b.mx);
      const w=arr.filter(t=>t.pnl>0);
      return{label:b.lbl,n:arr.length,wr:arr.length?Math.round(w.length/arr.length*100):0,pnl:arr.reduce((s,t)=>s+t.pnl,0)};
    });
  },[t09]);

  const monthlyStats=useMemo(()=>{
    const m={};
    t09.forEach(t=>{
      const mo=t.date.slice(0,7);
      if(!m[mo])m[mo]={pnl:0,trades:0,wins:0,losses:0,days:new Set()};
      m[mo].pnl+=t.pnl;m[mo].trades++;m[mo].days.add(t.date);
      if(t.pnl>0)m[mo].wins++;else m[mo].losses++;
    });
    return Object.entries(m).sort(([a],[b])=>b.localeCompare(a)).map(([mo,v])=>({
      mo,pnl:Math.round(v.pnl*100)/100,trades:v.trades,wins:v.wins,losses:v.losses,
      wr:Math.round(v.wins/v.trades*100),days:v.days.size
    }));
  },[t09]);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2800);};

  const DAILY_QUOTES=[
    "Jeden Tag gibt es Chancen, nicht jeder Trade muss mitgemacht werden.",
    "Disziplin schlaegt Talent. Halte dich an deine Regeln.",
    "Der beste Trade ist manchmal der, den du nicht machst.",
    "Geduld ist deine groesste Staerke. Warte auf dein Setup.",
    "Heute zaehlt jede Regel die du befolgst – mehr als jeder Gewinn.",
    "Konstanz schlaegt schnelle Gewinne. Bleib bei deinem Plan.",
    "Der Markt laeuft nicht weg. Atme tief durch.",
    "Verluste gehoeren dazu. Wichtig ist wie du danach reagierst.",
    "Routine ist langweilig – aber sie macht profitable Trader.",
    "Deine Regeln sind dein Schutz. Bricht sie, bricht dein Konto.",
  ];
  const isWeekend=()=>{const d=new Date().getDay();return d===0||d===6;};
  const getDailyQuote=()=>{
    const dayOfYear=Math.floor((new Date()-new Date(new Date().getFullYear(),0,0))/86400000);
    return DAILY_QUOTES[dayOfYear%DAILY_QUOTES.length];
  };

  const smartCoach=(userMsg,trigger)=>{
    const wins=t09.filter(t=>t.pnl>0).length;
    const wr=t09.length?Math.round(wins/t09.length*100):0;
    const todayT=t09.filter(t=>t.date===todayISO());
    const todPnlV=Math.round(todayT.reduce((s,t)=>s+t.pnl,0)*100)/100;
    const DAYS=["So","Mo","Di","Mi","Do","Fr","Sa"];
    const tod=DAYS[new Date().getDay()];
    const dayMap={};t09.forEach(t=>{const d=DAYS[new Date(t.date).getDay()];if(!dayMap[d])dayMap[d]={w:0,n:0,pnl:0};dayMap[d].n++;dayMap[d].pnl+=t.pnl;if(t.pnl>0)dayMap[d].w++;});
    const dayWR=dayMap[tod]?Math.round(dayMap[tod].w/dayMap[tod].n*100):0;
    const lastT=t09[t09.length-1];
    const hour=new Date().getHours();const min=new Date().getMinutes();
    const inWindow=(hour===16&&min>=15)||(hour===17&&min<=30);
    if(trigger==="daily_motivation"&&isWeekend())return "Guter Morgen "+(acct.name||"Trader")+"! 🌅 Heute ist Ruhetag. Kein Trading — nutze den Tag für Analyse, Review und mentale Erholung. Dein Fenster läuft wieder ab Montag "+settings.windowStart+" Uhr.";
    if(trigger==="daily_motivation"){
      const q=getDailyQuote();
      return "Guten Morgen "+(acct.name||"Trader")+"! \u2600\uFE0F\n\n"+q+"\n\nHeute ("+tod+"): "+todayT.length+"/2 Trades\n"+tod+"-WR historisch: "+dayWR+"%\n\nRoutine: Regeln durchgehen \u2192 Setup warten \u2192 Nur 16:15-17:30 Uhr.";
    }
    if(trigger==="trading_window"){
      if(dayWR<40&&dayMap[tod]&&dayMap[tod].n>=3)return "\u26A0\uFE0F Trading-Fenster offen, aber "+tod+" ist dein schwacher Tag ("+dayWR+"% WR). Empfehlung: Heute Pause oder demo.";
      return "\u2705 Trading-Fenster offen! "+tod+"-WR: "+dayWR+"%. Max 2 Trades, 1 MNQ, Kontoabstand: $"+kontoabstand.toFixed(0)+".";
    }
    if(trigger==="overtrading")return "\uD83D\uDED1 STOPP! "+todayT.length+". Trade heute. MAX 2. Schliesse die Plattform JETZT. Morgen gesperrt. P&L heute: "+(todPnlV>=0?"+":"")+"$"+todPnlV.toFixed(0)+".";
    if(trigger==="after_trade"&&lastT){
      const ok=lastT.pnl>0;
      const ruleScore=Object.values(lastT.rules||{}).filter(Boolean).length;
      const totalRules=Object.keys(lastT.rules||{}).length;
      const rulePct=totalRules?Math.round(ruleScore/totalRules*100):0;
      if(ok&&rulePct>=80)return "\uD83C\uDFAF Stark! "+lastT.contract+" "+lastT.dir+" +$"+lastT.pnl.toFixed(0)+". Regelquote: "+rulePct+"%. Heute: "+todayT.length+"/2 Trades.";
      if(!ok)return "\u274C Verlust $"+lastT.pnl.toFixed(0)+" (Regelquote: "+rulePct+"%). 15 Min Pause sind Pflicht. Kein Rache-Trade!";
      return "\uD83D\uDCC8 Gewinn +$"+lastT.pnl.toFixed(0)+" aber Regelquote nur "+rulePct+"%. Glueck ist keine Strategie.";
    }
    const msg=(userMsg||"").toLowerCase();
    if(msg.includes("hallo")||msg.includes("hi")){const todDow=new Date().getDay();const isWE=todDow===0||todDow===6;return "Hi "+(acct.name||"Trader")+"! 👋 "+t09.length+" Trades, "+wr+"% WR. "+(isWE?"Heute ist "+["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"][todDow]+" — Erholung und Analyse-Tag. Kein Trading heute!":"Heute: "+todayT.length+"/"+maxTrades+" ("+(todPnlV>=0?"+":"")+"$"+todPnlV.toFixed(0)+")");}
    if(msg.includes("heute"))return todayT.length===0?"Heute noch keine Trades. "+tod+"-WR: "+dayWR+"%. "+(inWindow?"Fenster offen!":"Fenster: 16:15-17:30."):"Heute: "+todayT.length+" Trades, P&L: "+(todPnlV>=0?"+":"")+"$"+todPnlV.toFixed(0)+(todayT.length>=2?". LIMIT!":". Noch "+(2-todayT.length)+" Trade moeglich.");
    if(msg.includes("soll ich")||msg.includes("traden")){
      if(todayT.length>=2)return "Nein. Du hast schon "+todayT.length+"/2 Trades. Limit erreicht.";
      if(todayBlocked)return "NEIN. Heute gesperrt wegen Overtrading gestern.";
      if(!inWindow)return "Warte aufs Fenster (16:15-17:30). Jetzt: "+String(hour).padStart(2,"0")+":"+String(min).padStart(2,"0")+" Uhr.";
      return "Wenn Setup da ist: ja. 1 MNQ, SL 40 Ticks, TP 80 Ticks. Regelquote pruefen!";
    }
    if(msg.includes("kontoabstand")||msg.includes("dd"))return "Kontoabstand: $"+kontoabstand.toFixed(0)+" ("+Math.round(kontoabstand/BUFFER*100)+"% frei). Max pro Trade: $"+Math.round(kontoabstand*0.02)+".";
    if(msg.includes("regel"))return "Regeln: Max 2 Trades/Tag, nur 16:15-17:30, 1 MNQ, 15 Min Pause, SL+TP vor Entry. 3 Trades = morgen gesperrt.";
    if(msg.includes("danke"))return "Gerne. Trade smart, nicht hart. \uD83D\uDCAA";
    return "Aktuell: "+t09.length+" Trades, "+wr+"% WR, Saldo $"+saldo.toFixed(0)+". Heute ("+tod+"): "+todayT.length+"/2, "+(todPnlV>=0?"+":"")+"$"+todPnlV.toFixed(0)+". Frag: 'soll ich traden', 'heute', 'kontoabstand', 'regeln'.";
  };

  const triggerAiPopup=async(type,tradeData)=>{
    setAiOpen(true);
    setAiLoading(true);
    setAiMessages([{role:"assistant",content:"⏳ Analysiere...",auto:true}]);
    
    const DAYS=["So","Mo","Di","Mi","Do","Fr","Sa"];
    const tod=DAYS[new Date().getDay()];
    const dayMap={};t09.forEach(t=>{const d=DAYS[new Date(t.date).getDay()];if(!dayMap[d])dayMap[d]={w:0,n:0,pnl:0};dayMap[d].n++;dayMap[d].pnl+=t.pnl;if(t.pnl>0)dayMap[d].w++;});
    const dayWR=dayMap[tod]?Math.round(dayMap[tod].w/dayMap[tod].n*100):0;
    const yesterdayISO=()=>{const d=new Date();d.setDate(d.getDate()-1);while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()-1);return d.toISOString().split("T")[0];};
    const yT=t09.filter(t=>t.date===yesterdayISO());
    const yPnl=Math.round(yT.reduce((s,t)=>s+t.pnl,0)*100)/100;
    const wins=t09.filter(t=>t.pnl>0).length;
    const wr=t09.length?Math.round(wins/t09.length*100):0;
    const streak=()=>{let s=0;const r=[...t09].reverse();for(const t of r){if(t.pnl>0)s>0?s++:s===0?s=1:s=1;else s<0?s--:s===0?s=-1:s=-1;break;}return s;};
    const currentStreak=streak();

    let prompt="";
    if(type==="daily_motivation"){
      const yTradesStr=yT.length?yT.map(t=>"• "+t.time+" "+t.contract+" "+t.dir+" "+(t.pnl>=0?"+":"")+"$"+t.pnl.toFixed(0)).join("\n"):"Kein Trading gestern";
      const statsStr="• "+tod+"-WR historisch: "+dayWR+"% ("+((dayMap[tod]?.n)||0)+" Trades)\n• Gesamt WR: "+wr+"% aus "+t09.length+" Trades\n• Streak: "+(currentStreak>0?"+"+currentStreak+" Gewinne":currentStreak<0?currentStreak+" Verluste":"Neutral")+"\n• Saldo: $"+saldo.toFixed(2)+" | Ziel: $"+goals.targetBalance+" | Fehlt: $"+Math.max(0,goals.targetBalance-saldo).toFixed(0)+"\n• Kontoabstand: $"+kontoabstand.toFixed(0);
      prompt="Gib mir mein persönliches Tages-Briefing für heute ("+tod+").\n\nGESTRIGE TRADES ("+yT.length+" Trades, P&L: "+(yPnl>=0?"+":"")+"$"+yPnl+"):\n"+yTradesStr+"\n\nMEINE STATS:\n"+statsStr+"\n\nAnalysiere gestrige Trades kurz, gib mir eine klare Empfehlung für heute und eine persönliche Motivation. Max 5 Sätze.";
    }
    else if(type==="after_trade"&&tradeData){
      const tod2=t09.filter(t=>t.date===todayISO());
      const ruleScore=Object.values(tradeData.rules||{}).filter(Boolean).length;
      const totalRules=Object.keys(tradeData.rules||{}).length;
      const rulePct=totalRules?Math.round(ruleScore/totalRules*100):0;
      const recentLosses=t09.slice(-5).filter(t=>t.pnl<0).length;
      prompt=`Analysiere meinen Trade und gib mir direktes Feedback:

TRADE: ${tradeData.contract} ${tradeData.dir} um ${tradeData.time}
P&L: ${tradeData.pnl>=0?"+":""}$${tradeData.pnl.toFixed(2)}
Regelquote: ${rulePct}% (${ruleScore}/${totalRules} Regeln)
Setup: ${tradeData.setup||"Nicht angegeben"}
Trade Nr. heute: ${tod2.length}/${DAILY_LIMIT}

KONTEXT:
• Letzte 5 Trades: ${t09.slice(-5).map(t=>t.pnl>=0?"+$"+t.pnl.toFixed(0):"-$"+Math.abs(t.pnl).toFixed(0)).join(", ")}
• Verluste in letzten 5: ${recentLosses}
• Heutige P&L: ${todPnl>=0?"+":""}$${todPnl.toFixed(0)}

Sei direkt und ehrlich. Erkenne Muster wenn du sie siehst. Max 4 Sätze.`;
    }
    else if(type==="overtrading"){
      const tod3=t09.filter(t=>t.date===todayISO());
      const todTradesStr=tod3.map(t=>"• "+t.time+" "+t.contract+" "+(t.pnl>=0?"+":"")+"$"+t.pnl.toFixed(0)).join("\n");
      prompt="NOTFALL: "+(acct.name||"Trader")+" hat gerade seinen "+tod3.length+". Trade gemacht (Limit: "+DAILY_LIMIT+").\n\nHeutige Trades:\n"+todTradesStr+"\nHeutige P&L: "+(todPnl>=0?"+":"")+"$"+todPnl.toFixed(0)+"\n\nGib eine KLARE STOPP-Nachricht. Kurz, direkt, keine Ausreden akzeptieren. Max 3 Sätze.";
    }
    else if(type==="trading_window"){
      prompt=`Das Trading-Fenster (16:15-17:30) ist gerade geöffnet.

HEUTE (${tod}):
• Bisherige Trades: ${tradeCount}/${DAILY_LIMIT}
• P&L heute: ${todPnl>=0?"+":""}$${todPnl.toFixed(0)}
• ${tod}-WR historisch: ${dayWR}%
• Kontoabstand: $${kontoabstand.toFixed(0)}

Soll ich jetzt traden? Klare Ja/Nein Empfehlung mit kurzem Grund. Max 3 Sätze.`;
    }
    else{
      setAiMessages([{role:"assistant",content:smartCoach("",type),auto:true}]);
      setAiLoading(false);
      return;
    }

    try{
      const wins_t=t09.filter(t=>t.pnl>0),losses_t=t09.filter(t=>t.pnl<0);
      const ctx={
        saldo:Math.round(saldo),
        kontoabstand,tradeCount,todPnl,disc,todayBlocked,inPause,tradesLeft,
        overtradingToday,atLimit,
        currentDay:tod,dayWR,monthPnl,
        targetBalance:goals.targetBalance,
        missingToTarget:Math.max(0,goals.targetBalance-saldo),
        totalTrades:allT09.length,
        winRate:t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0,
        allTimeWR:allT09.length?Math.round(allT09.filter(t=>t.pnl>0).length/allT09.length*100):0,
        avgWin:wins_t.length?Math.round(wins_t.reduce((s,t)=>s+t.pnl,0)/wins_t.length):0,
        avgLoss:losses_t.length?Math.round(losses_t.reduce((s,t)=>s+t.pnl,0)/losses_t.length):0,
        allTrades:t09.map(t=>t.date+" "+t.time+" "+t.contract+" "+t.dir+" "+(t.pnl>=0?"+":"")+"$"+t.pnl.toFixed(0)).join("\n"),
        todayTrades:(todT.map(t=>t.time+' '+t.dir+' $'+Math.round(t.pnl)).join(', ')||'Keine Trades heute'),
        coachProfile:sanitize(coachProfile||''),
        coachMemory:sanitize(coachMemory.slice(0,8).map(m=>m.note).join(' | ')),
        chatHistorySummary:sanitize(aiMessages.slice(-6).map(m=>(m.role==='user'?'Du':'Coach')+': '+m.content.slice(0,100)).join(' | '))
      };
      const res=await fetch('/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:[{role:"user",content:prompt}],context:ctx})
      });
      const rawText=await res.text();
      if(!res.ok){setAiMessages([{role:"assistant",content:smartCoach("",type),auto:true}]);return;}
      const data=JSON.parse(rawText);
      if(data.message){
        setAiMessages([{role:"assistant",content:data.message,auto:true}]);
        const m=data.message;
        if(m.includes("Muster")||m.includes("Problem")||m.includes("Stärke")||m.includes("Schwäche")||m.length>200){
          saveCoachMemory("💡 Session "+new Date().toLocaleDateString("de-DE")+": "+m.slice(0,100).replace(/\n/g," ")+"...");
        }
      }
      else setAiMessages([{role:"assistant",content:smartCoach("",type),auto:true}]);
    }catch(err){
      setAiMessages([{role:"assistant",content:smartCoach("",type),auto:true}]);
    }finally{setAiLoading(false);}
  };

  const startVoice=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){
      // Fallback: show input field with prompt
      showToast("Tippe deine Frage ein 👆");
      return;
    }
    if(isRecording){setIsRecording(false);return;}
    const rec=new SR();
    rec.lang="de-DE";
    rec.continuous=false;
    rec.interimResults=true;
    rec.maxAlternatives=1;
    setIsRecording(true);
    try{rec.start();}catch(e){setIsRecording(false);showToast("Mikrofon Fehler: "+e.message);return;}
    rec.onresult=(e)=>{
      let interim="",final="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal)final+=e.results[i][0].transcript;
        else interim+=e.results[i][0].transcript;
      }
      const text=final||interim;
      if(text)setAiInput(text);
    };
    rec.onend=()=>{
      setIsRecording(false);
      // Auto-send after voice input
      setAiInput(prev=>{
        if(prev&&prev.trim()){
          setTimeout(()=>{
            const btn=document.getElementById("aiSendBtn");
            if(btn)btn.click();
          },300);
        }
        return prev;
      });
    };
    rec.onerror=(e)=>{
      setIsRecording(false);
      if(e.error==="not-allowed")showToast("Mikrofon-Zugriff verweigert – Einstellungen prüfen");
      else if(e.error==="no-speech")showToast("Nichts gehört – nochmal versuchen");
      else showToast("Sprachfehler: "+e.error);
    };
  };

  const handleImageSelect=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const base64=ev.target.result.split(",")[1];
      setAiImage({base64,mediaType:file.type||"image/jpeg"});
      setAiImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const importTTPTrades=(raw)=>{  const lines=raw.trim().split('\n').filter(l=>l.trim());const parsed=[];
  for(const line of lines){
    const parts=line.split('\t').map(s=>s.trim());
    if(parts.length<8)continue;
    const contract=parts[0].includes('MNQ')?'MNQ':'NQ';
    const entryDT=parts[1]; // "18.5.2026, 16:54:51"
    const pnlStr=parts[7].replace('$','').replace(',','.');
    const pnl=parseFloat(pnlStr);
    if(isNaN(pnl))continue;
    // Parse date: "18.5.2026, 16:54:51" -> "2026-05-18" + "16:54"
    const dtMatch=entryDT.match(/(\d+)\.(\d+)\.(\d+),\s*(\d+):(\d+)/);
    if(!dtMatch)continue;
    const [,day,month,year,hour,min]=dtMatch;
    const date=year+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0');
    const time=hour+':'+min;
    const qty=parseInt(parts[6])||1;
    const dir=qty>0?'LONG':'SHORT';
    parsed.push({id:uid(),acct:'09',contract,date,time,pnl,dur:0,dir,setup:'Import TTP',notes:'',rules:{r1:false,r2:false,r3:false,r4:false,r5:(parseInt(time.split(':')[0])===16&&parseInt(time.split(':')[1])>=15)||(parseInt(time.split(':')[0])===17&&parseInt(time.split(':')[1])<=30),r6:true}});
  }
  if(!parsed.length){alert('Keine Trades gefunden. Bitte TTP Export einfügen.');return;}
  if(!window.confirm('Import: '+parsed.length+' Trades einfügen? Das aktualisiert auch den Saldo.')){return;}
  setTrades(p=>{const u=[...p,...parsed];localStorage.setItem('ttp_trades',JSON.stringify(u));return u;});
  const totalPnl=parsed.reduce((s,t)=>s+t.pnl,0);
  const newSaldo=Math.round((saldo+totalPnl)*100)/100;
  setSaldo(newSaldo);localStorage.setItem('ttp_saldo',newSaldo);
  showToast(parsed.length+' Trades importiert! P&L: '+(totalPnl>=0?'+':'')+'$'+Math.round(totalPnl));
};

const analyzeProblems=async()=>{
  const selected=Object.keys(problems).filter(k=>problems[k]);
  if(!selected.length){showToast("Bitte mindestens ein Problem auswählen!");return;}
  setProbAnalysisLoading(true);
  setProbAnalysis('');
  try{
    const wr=t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0;
    const todayPnlStr=(todPnl>=0?"+":"")+todPnl;
    const prompt="Ich habe folgende Trading-Probleme: "+selected.join(", ")+
      ". Meine aktuellen Stats: WR "+wr+"%, Saldo $"+Math.round(saldo)+
      ", Heute: "+todT.length+" Trades ("+todayPnlStr+")"+
      ", Overtrading-Tage: "+(profitPlan?.overtradeDays||0)+
      ". Gib mir für JEDES Problem einen konkreten 1-2 Satz Plan was ich ab morgen genau machen soll.";
    const res=await fetch('/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        messages:[{role:"user",content:prompt}],
        context:{
          coachProfile:coachProfile||'',
          coachMemory:coachMemory.slice(0,5).map(m=>m.note).join(' | '),
          chatHistorySummary:''
        }
      })
    });
    if(!res.ok){setProbAnalysis("Fehler: "+res.status);return;}
    const d=await res.json();
    setProbAnalysis(d.message||'Keine Antwort erhalten.');
  }catch(e){
    setProbAnalysis("Verbindungsfehler: "+e.message);
  }finally{
    setProbAnalysisLoading(false);
  }
};

const sendAiMessage=async()=>{
    if((!aiInput.trim()&&!aiImage)||aiLoading)return;
    // "Merke dir..." Befehl → direkt ins Gedächtnis
    const inputLow=(aiInput||"").toLowerCase();
    // TTP Import from chat: paste TTP data directly
    if(aiInput.includes('NQ-202606') || aiInput.includes('MNQ-202606')){
      const lines=aiInput.trim().split('\n').filter(l=>l.includes('CME'));
      const imported=[];
      for(const line of lines){
        const parts=line.split('\t').map(s=>s.trim()).filter(Boolean);
        if(parts.length<8)continue;
        const contract=parts[0].includes('MNQ')?'MNQ':'NQ';
        const dtMatch=parts[1]?.match(/(\d+)\.(\d+)\.(\d+),\s*(\d+):(\d+)/);
        if(!dtMatch)continue;
        const [,day,month,year,hour,min]=dtMatch;
        const date=year+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0');
        const time=hour+':'+min;
        const pnlStr=(parts[7]||'0').replace(/[$,]/g,'').replace(',','.');
        const pnl=parseFloat(pnlStr);
        if(isNaN(pnl))continue;
        imported.push({id:uid(),acct:'09',contract,date,time,pnl,dur:0,dir:parseInt(parts[6]||'1')>0?'LONG':'SHORT',setup:'Chat Import',notes:'',rules:{r1:false,r2:false,r3:false,r4:false,r5:(parseInt(time.split(':')[0])===16&&parseInt(time.split(':')[1])>=15)||(parseInt(time.split(':')[0])===17&&parseInt(time.split(':')[1])<=30),r6:true}});
      }
      if(imported.length>0){
        setTrades(p=>{const u=[...p,...imported];localStorage.setItem('ttp_trades',JSON.stringify(u));return u;});
        const totalPnl=Math.round(imported.reduce((s,t)=>s+t.pnl,0));
        const newSaldo=Math.round((saldo+totalPnl)*100)/100;
        setSaldo(newSaldo);localStorage.setItem('ttp_saldo',newSaldo);
        setAiMessages(p=>[...p,{role:'user',content:'[TTP Import]'},{role:'assistant',content:'✅ '+imported.length+' Trades importiert! P&L: '+(totalPnl>=0?'+':'')+'$'+totalPnl+'. Saldo jetzt: $'+newSaldo.toLocaleString()+'.\n\n'+(imported.some(t=>t.contract==='NQ')?'⚠️ Achtung: NQ-Trades erkannt! Das sind 10x größere Kontrakte als MNQ. War das absichtlich?':'')}]);
        setAiInput('');
        return;
      }
    }
    if(inputLow.startsWith("merke dir")||inputLow.startsWith("vergiss nicht")){
      const note=aiInput.slice(inputLow.indexOf(" ")+1).trim();
      if(note){
        saveCoachMemory("📌 "+note);
        setAiMessages(p=>[...p,{role:"user",content:aiInput},{role:"assistant",content:"✅ Gemerkt! Ich werde mir das für alle zukünftigen Sessions merken:\n\n📌 "+note}]);
        setAiInput("");
        return;
      }
    }
    const userInput=aiInput;
    const newMsgs=[...aiMessages,{role:"user",content:userInput}];
    setAiMessages(newMsgs);
    setAiInput("");
    setAiLoading(true);
    try{
      // Alle Trades für KI-Analyse
      const allWins=t09.filter(t=>t.pnl>0);
      const allLoss=t09.filter(t=>t.pnl<0);
      const DAYS2=["So","Mo","Di","Mi","Do","Fr","Sa"];
      const dayStats={};
      t09.forEach(t=>{const d=DAYS2[new Date(t.date).getDay()];if(!dayStats[d])dayStats[d]={n:0,wins:0,pnl:0};dayStats[d].n++;dayStats[d].pnl+=t.pnl;if(t.pnl>0)dayStats[d].wins++;});
      const hourStats={};
      t09.forEach(t=>{const h=parseInt(t.time.split(":")[0]);if(!hourStats[h])hourStats[h]={n:0,wins:0,pnl:0};hourStats[h].n++;hourStats[h].pnl+=t.pnl;if(t.pnl>0)hourStats[h].wins++;});
      const setupStats={};
      t09.forEach(t=>{const s=t.setup||"Unbekannt";if(!setupStats[s])setupStats[s]={n:0,wins:0,pnl:0};setupStats[s].n++;setupStats[s].pnl+=t.pnl;if(t.pnl>0)setupStats[s].wins++;});
      const ctx={
        // Account Status
        saldo,kontoabstand,tradeCount,todPnl,disc,todayBlocked,inPause,tradesLeft,
        currentTime:nowHHMM(),
        currentDay:["So","Mo","Di","Mi","Do","Fr","Sa"][new Date().getDay()],
        // Goals
        monthPnl,targetBalance:goals.targetBalance,
        missingToTarget:Math.max(0,goals.targetBalance-saldo),
        // Gesamtstatistik
        totalTrades:t09.length,
        winRate:t09.length?Math.round(allWins.length/t09.length*100):0,
        avgWin:allWins.length?Math.round(allWins.reduce((s,t)=>s+t.pnl,0)/allWins.length):0,
        avgLoss:allLoss.length?Math.round(allLoss.reduce((s,t)=>s+t.pnl,0)/allLoss.length):0,
        totalPnl:Math.round(t09.reduce((s,t)=>s+t.pnl,0)),
        overtradingToday,atLimit,
        // Muster-Analyse
        dayStats,hourStats,setupStats,
        // Heutige Trades (voll)
        todayTrades:todT.map(t=>({pnl:t.pnl,dir:t.dir,contract:t.contract,time:t.time,setup:t.setup})),
        allTrades:t09.map(t=>({d:t.date,t:t.time,p:Math.round(t.pnl),dir:t.dir,c:t.contract,s:t.setup||""})),
        coachProfile:coachProfile||'',
        coachMemory:coachMemory.slice(0,8).map(m=>m.note).join(' | '),
        chatHistorySummary:aiMessages.slice(-6).map(m=>(m.role==='user'?'Du':'Coach')+': '+m.content.slice(0,100).replace(/[\u0080-\uFFFF]/g,'').replace(/\t/g,' ')).join(' | '),
        allTimeWR:allT09.length?Math.round(allT09.filter(t=>t.pnl>0).length/allT09.length*100):0,
        todayPnl:todPnl
      };
      // Build messages mit optionalem Bild
      const apiMessages=newMsgs.map((m,i)=>{
        if(i===newMsgs.length-1&&aiImage&&m.role==="user"){
          return{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:aiImage.mediaType,data:aiImage.base64}},
            {type:"text",text:sanitize(m.content)||"Analysiere diesen Chart für mich"}
          ]};
        }
        return{role:m.role,content:sanitize(m.content)};
      });
      setAiImage(null);
      setAiImagePreview(null);
      const res=await fetch('/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:apiMessages,context:ctx})
      });
      const rawText=await res.text();
      if(!res.ok){
        setAiMessages(p=>[...p,{role:"assistant",content:"🔴 HTTP "+res.status+": "+rawText.slice(0,200)}]);
        return;
      }
      let data;
      try{data=JSON.parse(rawText);}catch(e){
        setAiMessages(p=>[...p,{role:"assistant",content:"🔴 JSON Fehler: "+rawText.slice(0,200)}]);
        return;
      }
      if(!data.message){        setAiMessages(p=>[...p,{role:"assistant",content:"🔴 Kein message Feld: "+JSON.stringify(data).slice(0,200)}]);
        return;
      }
      const assistantMsg={role:"assistant",content:data.message,ts:new Date().toISOString()};
      setAiMessages(p=>{
        const updated=[...p,assistantMsg];
        const forStorage=updated.slice(-80).map(m=>({role:m.role,content:m.content.slice(0,600),ts:m.ts||''}));
        localStorage.setItem('ttp_chat_history',JSON.stringify(forStorage));
        return updated;
      });
      // Auto-save key insights (not every message, only meaningful ones)
      const msg=data.message;
      const isKeyInsight=msg.length>80&&(
        msg.includes("Problem")||msg.includes("Muster")||msg.includes("Stärke")||
        msg.includes("solltest")||msg.includes("wichtig")||msg.includes("achte")||
        msg.includes("morgen")||msg.includes("heute")
      );
      if(isKeyInsight){
        const short=msg.replace(/[🔴✅⚠️📌💡🎯]/g,'').slice(0,120).trim();
        saveCoachMemory("💬 "+short);
      }
    }catch(err){
      setAiMessages(p=>[...p,{role:"assistant",content:"🔴 Netzwerk Fehler: "+err.message}]);
    }finally{setAiLoading(false);}
  };

  const addTrade=()=>{
    if(!form.pnl){showToast("Bitte P&L eingeben");return;}
    const v=parseFloat(form.pnl);
    if(isNaN(v)){showToast("P&L muss eine Zahl sein");return;}
    const newT={id:uid(),acct:"09",contract:form.contract,date:form.date,time:form.time,pnl:v,dur:0,dir:form.dir,setup:form.setup,notes:form.notes,rules:{...form.rules}};
    setTrades(p=>{const u=[...p,newT];localStorage.setItem('ttp_trades',JSON.stringify(u));return u;});
    const newSaldo=Math.round((saldo+v)*100)/100;
    setSaldo(newSaldo);localStorage.setItem("ttp_saldo",newSaldo);
    setLastTradeAt(new Date());
    setForm(emptyForm());
    showToast("Gespeichert! 15-Min Pause startet...");
    setTab("dash");
    setTimeout(()=>triggerAiPopup("after_trade",newT),1000);
    setChecks({c1:false,c2:false,c3:false,c4:false});
    localStorage.removeItem("ttp_checks");
  };

  const renderCal=()=>{
    const y=now.getFullYear(),mo=now.getMonth();
    const fd2=new Date(y,mo,1).getDay(),dim=new Date(y,mo+1,0).getDate();
    const cells=[];
    for(let i=0;i<(fd2||7)-1;i++)cells.push(<div key={"e"+i}/>);
    for(let d=1;d<=dim;d++){
      const k=`${y}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const pv=calMap[k],isT=k===todayISO(),isFuture=k>todayISO();
      const isBlocked=blockedDays.has(k)&&isFuture;
      let bg="#131d30",border=isT?B:"#1e2d48";
      if(isBlocked){bg=R+"11";border=R+"44";}
      else if(pv!=null){bg=pv>0?G+"22":R+"22";border=pv>0?G+"55":R+"55";}
      cells.push(
        <div key={k} style={{background:bg,border:"2px solid "+border,borderRadius:isDesktop?10:7,padding:isDesktop?"10px 4px":"5px 2px",textAlign:"center",minHeight:isDesktop?64:42}}>
          <div style={{color:isT?B:"#8b96b0",fontSize:isDesktop?14:11,fontWeight:isT?700:400}}>{d}</div>
          {isBlocked&&<div style={{fontSize:8,color:R,fontWeight:700}}>SPERRE</div>}
          {pv!=null&&!isBlocked&&<div style={{color:pc(pv),fontSize:isDesktop?12:10,fontWeight:700}}>{pv>=0?"+":"-"}${Math.abs(pv).toFixed(0)}</div>}
        </div>
      );
    }
    return cells;
  };

  const allChecked=Object.values(checks).every(Boolean);
  const nowD=new Date();
  const lonTime=nowD.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"});
  const chiTime=nowD.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"America/Chicago"});
  const lonH=new Date(nowD.toLocaleString("en-US",{timeZone:"Europe/London"})).getHours();
  const chiH=new Date(nowD.toLocaleString("en-US",{timeZone:"America/Chicago"})).getHours();
  const lonOpen=lonH>=8&&lonH<16;
  const chiOpen=chiH>=8&&chiH<15;
  const NAVS=[
  {k:"dash",lb:"Dashboard",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="2,17 8,10 13,14 22,5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="10" r="1.5" fill="currentColor"/><circle cx="13" cy="14" r="1.5" fill="currentColor"/><line x1="2" y1="21" x2="22" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/></svg>},
  {k:"mind",lb:"Mind",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.96-3 2.5 2.5 0 0 1 0-5A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.96-3 2.5 2.5 0 0 0 0-5A2.5 2.5 0 0 0 14.5 2Z"/></svg>},
  {k:"log",lb:"Loggen",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>},
  {k:"analyse",lb:"Analyse",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 20 Q7 12 10 15 Q13 18 16 8 Q18 2 21 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="21" cy="4" r="2" fill="currentColor" opacity="0.8"/><circle cx="10" cy="15" r="1.5" fill="currentColor" opacity="0.6"/></svg>},
  {k:"hist",lb:"History",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="2" rx="1" fill="currentColor" opacity="0.9"/><rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor" opacity="0.7"/><rect x="3" y="14" width="16" height="2" rx="1" fill="currentColor" opacity="0.5"/><rect x="3" y="19" width="10" height="2" rx="1" fill="currentColor" opacity="0.35"/></svg>},
];

  return(
    <div style={{background:"#111725",minHeight:"100vh",color:"#f0f4ff",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",fontSize:isDesktop?15:14,paddingBottom:"calc(70px + env(safe-area-inset-bottom,0px))",width:"100%",overflowX:"hidden"}}>
      {authLoading&&<div style={{position:"fixed",inset:0,zIndex:9999,background:"#080c14",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:40,height:40,borderRadius:"50%",border:"3px solid #2d3548",borderTopColor:B,animation:"spin .8s linear infinite"}}/>
      </div>}

      {!authLoading&&!authUser&&<div style={{position:"fixed",inset:0,zIndex:9998,background:"#080c14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{fontSize:42,fontWeight:900,letterSpacing:"-2px",marginBottom:4}}><span style={{color:B}}>Mind</span><span style={{color:"#f0f4ff"}}>Risk</span></div>
        <div style={{fontSize:11,color:"#6b7a9a",letterSpacing:"3px",marginBottom:40}}>TRADING JOURNAL</div>
        <div style={{width:"100%",maxWidth:360}}>
          <div style={{display:"flex",marginBottom:24,background:"#141e35",borderRadius:10,padding:4}}>
            <button onClick={()=>{setAuthScreen("login");setAuthError("");}} style={{flex:1,padding:"8px",borderRadius:8,fontWeight:700,fontSize:14,background:authScreen==="login"?"#6366f1":"transparent",color:authScreen==="login"?"#fff":"#6b7a9a",border:"none"}}>Einloggen</button>
            <button onClick={()=>{setAuthScreen("register");setAuthError("");}} style={{flex:1,padding:"8px",borderRadius:8,fontWeight:700,fontSize:14,background:authScreen==="register"?"#6366f1":"transparent",color:authScreen==="register"?"#fff":"#6b7a9a",border:"none"}}>Registrieren</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>EMAIL</div>
              <input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="deine@email.com" style={{background:"transparent",border:"none",fontSize:15,color:"#f0f4ff",width:"100%",outline:"none"}}/>
            </div>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>PASSWORT</div>
              <input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="••••••••" style={{background:"transparent",border:"none",fontSize:15,color:"#f0f4ff",width:"100%",outline:"none"}} onKeyDown={e=>e.key==="Enter"&&(authScreen==="login"?signIn():signUp())}/>
            </div>
            {authError&&<div style={{color:authError.startsWith("✅")?G:R,fontSize:12,textAlign:"center",padding:"4px 0"}}>{authError}</div>}
            <button onClick={authScreen==="login"?signIn:signUp} disabled={authWorking}
              style={{padding:"16px",borderRadius:14,fontWeight:800,fontSize:16,background:authWorking?"#2d3548":"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",border:"none",marginTop:4}}>
              {authWorking?"...":(authScreen==="login"?"Einloggen →":"Account erstellen →")}
            </button>
          </div>
          <div style={{textAlign:"center",marginTop:20,fontSize:12,color:"#4b5568"}}>Deine Daten werden sicher gespeichert und sind nur für dich sichtbar.</div>
        </div>
      </div>}

      {showOnboarding&&authUser&&<div style={{position:"fixed",inset:0,zIndex:9998,background:"#080c14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",overflowY:"auto"}}>
        {/* STEP 0: WELCOME */}
        {onboardStep===0&&<div style={{width:"100%",maxWidth:400,textAlign:"center",animation:"fadeIn .5s ease"}}>
          <div style={{fontSize:48,fontWeight:900,letterSpacing:"-2px",marginBottom:8}}><span style={{color:B}}>Mind</span><span style={{color:"#f0f4ff"}}>Risk</span></div>
          <div style={{fontSize:12,color:"#6b7a9a",letterSpacing:"3px",marginBottom:40}}>TRADING JOURNAL</div>
          <div style={{width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#a855f7)",margin:"0 auto 32px",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 40px rgba(99,102,241,0.4)"}}>
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none"><circle cx="10" cy="12" r="2.5" fill="white"/><circle cx="18" cy="12" r="2.5" fill="white"/><path d="M9 17.5 Q14 21 19 17.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:"#f0f4ff",marginBottom:12,letterSpacing:"-0.5px"}}>Dein persönlicher Trading Coach</div>
          <div style={{fontSize:15,color:"#6b7a9a",lineHeight:1.6,marginBottom:40}}>MindRisk hilft dir disziplinierter zu traden, Overtrading zu stoppen und bei Prop Firm Challenges erfolgreich zu sein.</div>
          <button onClick={()=>setOnboardStep(1)} style={{width:"100%",padding:"16px",borderRadius:14,fontWeight:800,fontSize:16,background:"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",border:"none",marginBottom:12}}>Jetzt starten →</button>
          <div style={{fontSize:12,color:"#4b5568"}}>Kostenlos · Kein Account nötig</div>
        </div>}

        {/* STEP 1: PROFIL */}
        {onboardStep===1&&<div style={{width:"100%",maxWidth:400,animation:"fadeIn .5s ease"}}>
          <div style={{color:"#6366f1",fontSize:11,fontWeight:700,letterSpacing:"2px",marginBottom:8}}>SCHRITT 1 VON 3</div>
          <div style={{fontSize:24,fontWeight:800,color:"#f0f4ff",marginBottom:4,letterSpacing:"-0.5px"}}>Dein Profil</div>
          <div style={{fontSize:14,color:"#6b7a9a",marginBottom:28}}>Damit der Coach dich wirklich kennt.</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>DEIN NAME</div>
              <input value={onboardData.name} onChange={e=>setOnboardData(p=>({...p,name:e.target.value}))} placeholder="z.B. Max" style={{background:"transparent",border:"none",fontSize:16,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
            </div>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>HAUPT-INSTRUMENT</div>
              <select value={onboardData.instrument||'MNQ'} onChange={e=>setOnboardData(p=>({...p,instrument:e.target.value}))} style={{background:"transparent",border:"none",fontSize:15,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}>
                <option value="MNQ">MNQ — Micro Nasdaq (Tick: $0.50)</option>
                <option value="NQ">NQ — Nasdaq 100 (Tick: $5.00)</option>
                <option value="MES">MES — Micro S&P 500 (Tick: $1.25)</option>
                <option value="ES">ES — S&P 500 (Tick: $12.50)</option>
                <option value="MGC">MGC — Micro Gold (Tick: $1.00)</option>
                <option value="GC">GC — Gold (Tick: $10.00)</option>
                <option value="MCL">MCL — Micro Crude Oil (Tick: $1.00)</option>
                <option value="MYM">MYM — Micro Dow Jones (Tick: $0.50)</option>
                <option value="M2K">M2K — Micro Russell (Tick: $0.50)</option>
              </select>
            </div>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>PROP FIRM</div>
              <select value={onboardData.firm} onChange={e=>setOnboardData(p=>({...p,firm:e.target.value}))} style={{background:"transparent",border:"none",fontSize:15,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}>
                <option value="TTP">The Trading Pit (TTP)</option>
                <option value="FTMO">FTMO</option>
                <option value="MyFundedFX">MyFundedFX</option>
                <option value="Topstep">Topstep</option>
                <option value="E8 Funding">E8 Funding</option>
                <option value="Andere">Andere</option>
              </select>
            </div>
            {onboardData.firm==="Andere"&&<div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>FIRM NAME</div>
              <input value={onboardData.firmOther} onChange={e=>setOnboardData(p=>({...p,firmOther:e.target.value}))} placeholder="Firma eingeben" style={{background:"transparent",border:"none",fontSize:15,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
                <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>KONTO ($)</div>
                <select value={onboardData.size} onChange={e=>setOnboardData(p=>({...p,size:parseInt(e.target.value),target:parseInt(e.target.value)+parseInt(e.target.value)*0.08,maxDD:parseInt(e.target.value)*0.04,dailyDD:parseInt(e.target.value)*0.02}))} style={{background:"transparent",border:"none",fontSize:15,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}>
                  {[25000,50000,75000,100000,125000,150000,200000].map(s=><option key={s} value={s}>${(s/1000).toFixed(0)}k</option>)}
                </select>
              </div>
              <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
                <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>MAX DD ($)</div>
                <input type="number" value={onboardData.maxDD} onChange={e=>setOnboardData(p=>({...p,maxDD:parseInt(e.target.value)||2000}))} style={{background:"transparent",border:"none",fontSize:15,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
              </div>
            </div>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>KONTO-NUMMER (optional)</div>
              <input value={onboardData.number} onChange={e=>setOnboardData(p=>({...p,number:e.target.value}))} placeholder="z.B. P1-235109" style={{background:"transparent",border:"none",fontSize:14,color:"#f0f4ff",width:"100%",outline:"none"}}/>
            </div>
          </div>
          <button onClick={()=>onboardData.name.trim()?setOnboardStep(2):null} style={{width:"100%",padding:"16px",borderRadius:14,fontWeight:800,fontSize:16,background:onboardData.name.trim()?"linear-gradient(135deg,#6366f1,#a855f7)":"#2d3548",color:"#fff",border:"none",marginTop:20}}>Weiter →</button>
          <button onClick={()=>setOnboardStep(0)} style={{width:"100%",padding:"10px",background:"none",color:"#4b5568",fontSize:13,marginTop:8}}>← Zurück</button>
        </div>}

        {/* STEP 2: PSYCHOLOGIE */}
        {onboardStep===2&&<div style={{width:"100%",maxWidth:400,animation:"fadeIn .5s ease"}}>
          <div style={{color:"#6366f1",fontSize:11,fontWeight:700,letterSpacing:"2px",marginBottom:8}}>SCHRITT 2 VON 3</div>
          <div style={{fontSize:24,fontWeight:800,color:"#f0f4ff",marginBottom:4,letterSpacing:"-0.5px"}}>Ehrlicher Check</div>
          <div style={{fontSize:14,color:"#6b7a9a",marginBottom:28}}>Damit der Coach sofort helfen kann. Niemand sieht das außer dir.</div>
          {[
            {k:"problem",q:"Was ist dein größtes Trading-Problem?",opts:["Overtrading","Revenge Trading","FOMO","SL nicht einhalten","Zu früh aussteigen","Ungeduld"]},
            {k:"challenges",q:"Wie viele Challenges hast du schon verloren?",opts:["Noch keine","1-2","3-5","Mehr als 5"]},
            {k:"after_loss",q:"Was passiert nach einem Verlust?",opts:["Ich höre auf","Ich versuche es zurückzuholen","Ich mache Pause","Ich trade normal weiter"]},
            {k:"discipline",q:"Wie diszipliniert befolgst du deine Regeln?",opts:["Immer","Meistens","Manchmal","Selten"]},
          ].map(q=>(
            <div key={q.k} style={{marginBottom:20}}>
              <div style={{color:"#f0f4ff",fontSize:14,fontWeight:600,marginBottom:10}}>{q.q}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {q.opts.map(o=>(
                  <button key={o} onClick={()=>setOnboardData(p=>({...p,psychAnswers:{...p.psychAnswers,[q.k]:o}}))}
                    style={{padding:"8px 14px",borderRadius:20,fontSize:12,fontWeight:600,
                      background:onboardData.psychAnswers[q.k]===o?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.04)",
                      border:"1px solid "+(onboardData.psychAnswers[q.k]===o?"#6366f1":"rgba(255,255,255,0.1)"),
                      color:onboardData.psychAnswers[q.k]===o?"#a5b4fc":"#6b7a9a"}}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={()=>Object.keys(onboardData.psychAnswers).length>=4?setOnboardStep(3):null}
            style={{width:"100%",padding:"16px",borderRadius:14,fontWeight:800,fontSize:16,
              background:Object.keys(onboardData.psychAnswers).length>=4?"linear-gradient(135deg,#6366f1,#a855f7)":"#2d3548",
              color:"#fff",border:"none",marginTop:8}}>
            {Object.keys(onboardData.psychAnswers).length>=4?"Weiter →":"Alle Fragen beantworten ("+Object.keys(onboardData.psychAnswers).length+"/4)"}
          </button>
          <button onClick={()=>setOnboardStep(1)} style={{width:"100%",padding:"10px",background:"none",color:"#4b5568",fontSize:13,marginTop:8}}>← Zurück</button>
        </div>}

        {/* STEP 3: FERTIG */}
        {onboardStep===3&&<div style={{width:"100%",maxWidth:400,textAlign:"center",animation:"fadeIn .5s ease"}}>
          <div style={{color:"#6366f1",fontSize:11,fontWeight:700,letterSpacing:"2px",marginBottom:8}}>SCHRITT 3 VON 3</div>
          <div style={{fontSize:28,fontWeight:800,color:"#f0f4ff",marginBottom:8}}>Alles bereit!</div>
          <div style={{fontSize:14,color:"#6b7a9a",marginBottom:32,lineHeight:1.6}}>Dein Coach kennt jetzt dein Profil und deine Schwächen. Er wird dir von Anfang an gezielt helfen.</div>
          <div style={{background:"#141e35",borderRadius:14,padding:20,marginBottom:24,textAlign:"left",border:"1px solid rgba(99,102,241,0.2)"}}>
            <div style={{color:"#6366f1",fontSize:11,fontWeight:700,marginBottom:12}}>DEIN PROFIL</div>
            {[
              ["Name",onboardData.name],
              ["Firm",onboardData.firm==="Andere"?onboardData.firmOther:onboardData.firm],
              ["Konto","$"+(onboardData.size/1000).toFixed(0)+"k"],
              ["Hauptproblem",onboardData.psychAnswers.problem||"-"],
              ["Nach Verlust",onboardData.psychAnswers.after_loss||"-"],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #2d3548",fontSize:13}}>
                <span style={{color:"#6b7a9a"}}>{k}</span>
                <span style={{color:"#f0f4ff",fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={completeOnboarding} style={{width:"100%",padding:"16px",borderRadius:14,fontWeight:800,fontSize:16,background:"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",border:"none",marginBottom:12}}>MindRisk starten 🚀</button>
          <button onClick={()=>setOnboardStep(2)} style={{width:"100%",padding:"10px",background:"none",color:"#4b5568",fontSize:13}}>← Zurück</button>
        </div>}

        {/* Progress dots */}
        {onboardStep>0&&<div style={{position:"fixed",bottom:32,display:"flex",gap:8}}>
          {[1,2,3].map(s=>(
            <div key={s} style={{width:s===onboardStep?24:8,height:8,borderRadius:4,background:s<=onboardStep?"#6366f1":"#2d3548",transition:"all .3s"}}/>
          ))}
        </div>}
      </div>}

            {showSplash&&<div style={{position:"fixed",inset:0,zIndex:9999,background:"radial-gradient(circle at center,#1a1f2e 0%,#0f1117 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"fadeOut 0.4s ease 1.4s forwards"}}>
        <div style={{fontSize:42,fontWeight:900,letterSpacing:"-2px",marginBottom:8}}><span style={{color:B}}>Mind</span><span style={{color:"#f0f4ff"}}>Risk</span></div>
        <div style={{fontSize:11,color:"#8b96b0",letterSpacing:"3px",marginBottom:32}}>TRADING JOURNAL</div>
        <div style={{width:48,height:48,borderRadius:"50%",border:"3px solid #2d3548",borderTopColor:B,animation:"spin 0.8s linear infinite"}}/>
      </div>}

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{overflow-x:hidden;max-width:100%}
        input,select,textarea{max-width:100%;box-sizing:border-box;background:#0f1117;color:#e2e8f0;border:1px solid #2d3548;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:14px;outline:none;width:100%}
        input:focus,select:focus,textarea:focus{border-color:#6366f1}
        select option{background:#1a1f2e}
        button{cursor:pointer;font-family:inherit;border:none;border-radius:8px}
        .mr-content{padding:16px 16px 20px;max-width:520px;margin:0 auto}
        .mr-nav{max-width:520px;margin:0 auto}
        @media(min-width:800px){
          .mr-content{max-width:100%;padding:20px 32px 30px}
          .mr-nav{max-width:960px}
        }
        @keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}@keyframes livingOrb{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}@keyframes orbGlow{0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.55),0 0 40px rgba(168,85,247,0.35),0 0 70px rgba(99,102,241,0.15)}50%{box-shadow:0 0 30px rgba(99,102,241,0.85),0 0 65px rgba(168,85,247,0.55),0 0 100px rgba(99,102,241,0.3)}}@keyframes orbRing1{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.5);opacity:0}}@keyframes orbRing2{0%{transform:scale(1);opacity:0.6}100%{transform:scale(3);opacity:0}}@keyframes orbRing3{0%{transform:scale(1);opacity:0.4}100%{transform:scale(3.8);opacity:0}}@keyframes orbSpin{to{transform:rotate(360deg)}}@keyframes orbCore{0%,100%{opacity:0.55;transform:translate(-50%,-50%) scale(0.85)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}}@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}@keyframes orbGlow{0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.5),0 0 40px rgba(168,85,247,0.3),0 0 60px rgba(99,102,241,0.15)}50%{box-shadow:0 0 30px rgba(99,102,241,0.8),0 0 60px rgba(168,85,247,0.5),0 0 90px rgba(99,102,241,0.25)}}@keyframes orbSpin{to{transform:rotate(360deg)}}@keyframes orbCore{0%,100%{opacity:0.6;transform:translate(-50%,-50%) scale(0.8)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes fadeOut{to{opacity:0;visibility:hidden}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.5)}50%{box-shadow:0 0 0 12px rgba(99,102,241,0)}}
        @keyframes orb{0%,100%{transform:scale(1);box-shadow:0 0 20px rgba(99,102,241,0.6),0 0 40px rgba(168,85,247,0.3)}50%{transform:scale(1.05);box-shadow:0 0 30px rgba(99,102,241,0.9),0 0 60px rgba(168,85,247,0.5)}}
        @keyframes ring{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes watchDots{
          0%,100%{box-shadow:0 -5px 0 1.5px rgba(99,102,241,0.7),3.5px -3.5px 0 1.5px rgba(99,102,241,0.6),5px 0 0 1.5px rgba(99,102,241,0.5),3.5px 3.5px 0 1.5px rgba(99,102,241,0.6),0 5px 0 1.5px rgba(99,102,241,0.7),-3.5px 3.5px 0 1.5px rgba(99,102,241,0.6),-5px 0 0 1.5px rgba(99,102,241,0.5),-3.5px -3.5px 0 1.5px rgba(99,102,241,0.6)}
          50%{box-shadow:0 -8px 0 2px rgba(99,102,241,1),5.6px -5.6px 0 2px rgba(99,102,241,0.9),8px 0 0 2px rgba(99,102,241,0.8),5.6px 5.6px 0 2px rgba(99,102,241,0.9),0 8px 0 2px rgba(99,102,241,1),-5.6px 5.6px 0 2px rgba(99,102,241,0.9),-8px 0 0 2px rgba(99,102,241,0.8),-5.6px -5.6px 0 2px rgba(99,102,241,0.9)}
        }
        @keyframes watchDotsPurple{
          0%,100%{box-shadow:0 -5px 0 1.5px rgba(168,85,247,0.7),3.5px -3.5px 0 1.5px rgba(168,85,247,0.6),5px 0 0 1.5px rgba(168,85,247,0.5),3.5px 3.5px 0 1.5px rgba(168,85,247,0.6),0 5px 0 1.5px rgba(168,85,247,0.7),-3.5px 3.5px 0 1.5px rgba(168,85,247,0.6),-5px 0 0 1.5px rgba(168,85,247,0.5),-3.5px -3.5px 0 1.5px rgba(168,85,247,0.6)}
          50%{box-shadow:0 -8px 0 2px rgba(168,85,247,1),5.6px -5.6px 0 2px rgba(168,85,247,0.9),8px 0 0 2px rgba(168,85,247,0.8),5.6px 5.6px 0 2px rgba(168,85,247,0.9),0 8px 0 2px rgba(168,85,247,1),-5.6px 5.6px 0 2px rgba(168,85,247,0.9),-8px 0 0 2px rgba(168,85,247,0.8),-5.6px -5.6px 0 2px rgba(168,85,247,0.9)}
        }
        @media(min-width:768px){
          .mr-content{max-width:900px;padding:20px 24px 30px}
          .mr-nav{max-width:900px}
          .mr-header{max-width:900px;margin:0 auto}
          .mr-desktop-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
          .mr-desktop-full{grid-column:1/-1}
          .mr-desktop-sidebar{display:grid;grid-template-columns:340px 1fr;gap:16px;align-items:start}
        }
      `}</style>

      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,background:"#161b22",border:"1px solid "+G,color:G,padding:"10px 20px",borderRadius:10,fontWeight:600,fontSize:13,boxShadow:"0 8px 32px #0008",whiteSpace:"nowrap"}}>{toast}</div>}

      {delId&&<div style={{position:"fixed",inset:0,zIndex:998,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Card style={{width:280,textAlign:"center",border:"1px solid "+R}}>
          <div style={{color:R,fontWeight:700,marginBottom:16,fontSize:16}}>Trade loeschen?</div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button style={{background:R+"33",color:R,border:"1px solid "+R,padding:"8px 20px",fontWeight:600}} onClick={()=>{setTrades(p=>p.filter(t=>t.id!==delId));setDelId(null);showToast("Geloescht");}}>Ja</button>
            <button style={{background:"#21262d",color:"#8b949e",padding:"8px 16px"}} onClick={()=>setDelId(null)}>Nein</button>
          </div>
        </Card>
      </div>}

      {/* HEADER */}
      <div style={{background:"linear-gradient(180deg,#0f1830 0%,#0b1422 100%)",borderBottom:"1px solid #2d3548",padding:isDesktop?"16px 32px 14px":"14px 18px 12px",width:"100%",boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:30,letterSpacing:"-1.5px",lineHeight:1}}><span style={{color:B}}>Mind</span><span style={{color:"#f0f4ff"}}>Risk</span></div>
            <div style={{color:"#f0f4ff",fontSize:12,fontWeight:700,marginTop:3}}>{acct.name||"Trader"} <span style={{color:"#6b7a9a",fontSize:10,fontWeight:400}}>{acct.number?("· "+acct.number):""}</span></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:10}}>
              {(()=>{
                const tokyoH=new Date(nowD.toLocaleString("en-US",{timeZone:"Asia/Tokyo"})).getHours();
                const tokyoTime=nowD.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"});
                const tokyoOpen=tokyoH>=9&&tokyoH<15;
                const myH=new Date().getHours();const myM=new Date().getMinutes();
                const myWindow=(myH===16&&myM>=15)||(myH===17&&myM<=30);
                return(
                  <div style={{display:"flex",flexDirection:"column",gap:isDesktop?6:3,alignItems:"flex-end"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:"#6b7a9a",fontSize:isDesktop?11:8,fontWeight:isDesktop?600:400}}>{isDesktop?"London":"LON"}</span>
                      <span style={{color:lonOpen?G:"#6b7a9a",fontWeight:700,fontSize:isDesktop?13:10}}>{lonTime}</span>
                      <div style={{width:isDesktop?8:6,height:isDesktop?8:6,borderRadius:"50%",background:lonOpen?G:"#4a5568",boxShadow:lonOpen?"0 0 6px "+G:"none"}}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:"#6b7a9a",fontSize:isDesktop?11:8,fontWeight:isDesktop?600:400}}>{isDesktop?"Chicago":"CHI"}</span>
                      <span style={{color:myWindow?G:chiOpen?Y:"#6b7a9a",fontWeight:700,fontSize:isDesktop?13:10}}>{chiTime}</span>
                      <div style={{width:isDesktop?8:6,height:isDesktop?8:6,borderRadius:"50%",background:myWindow?G:chiOpen?Y:"#4a5568",boxShadow:myWindow?"0 0 6px "+G:chiOpen?"0 0 6px "+Y:"none"}}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:"#6b7a9a",fontSize:isDesktop?11:8,fontWeight:isDesktop?600:400}}>{isDesktop?"Tokyo":"TYO"}</span>
                      <span style={{color:tokyoOpen?G:"#6b7a9a",fontWeight:700,fontSize:isDesktop?13:10}}>{tokyoTime}</span>
                      <div style={{width:isDesktop?8:6,height:isDesktop?8:6,borderRadius:"50%",background:tokyoOpen?G:"#4a5568",boxShadow:tokyoOpen?"0 0 6px "+G:"none"}}/>
                    </div>
                  </div>
                );
              })()}
            </div>
            <button onClick={()=>setSettingsOpen(true)} style={{background:"linear-gradient(135deg,#6366f1,#a855f7)",borderRadius:12,width:40,height:40,padding:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,flexShrink:0}}>☰</button>
          </div>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"nowrap",overflowX:"auto",paddingBottom:2}}>
          <Pill bg={todPnl>=0?G+"22":R+"22"} color={pc(todPnl)}>P&L {fs(todPnl)}</Pill>
          {inPause?<Pill bg={Y+"33"} color={Y}>⏸ {pStr}</Pill>:<Pill bg={tradesLeft>0&&!todayBlocked&&!atLimit?G+"22":R+"22"} color={tradesLeft>0&&!todayBlocked&&!atLimit?G:R}>{todayBlocked?"🚫 GESPERRT":overtradingToday?"🚫 OVERTRADE":atLimit?"🛑 LIMIT":tradesLeft+"T übrig"}</Pill>}
          <Pill bg={sc(disc)+"22"} color={sc(disc)}>RQ {disc}%</Pill>
        </div>
      </div>

      {inPause&&<div style={{position:"sticky",top:0,zIndex:90,background:"linear-gradient(135deg,#f59e0b,#ef4444)",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:18}}>⏸</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:13,color:"#fff"}}>PFLICHTPAUSE – {pStr}</div>
          <div style={{fontSize:10,color:"#fef3c7"}}>Kein Impuls-Trade! Warte den Timer ab.</div>
        </div>
      </div>}

      <div style={{padding:isDesktop?"20px 28px 30px":"16px 16px 20px",width:"100%",boxSizing:"border-box",maxWidth:"100%"}}>

        {/* DASHBOARD */}
        {tab==="dash"&&<div style={{display:"flex",flexDirection:"column",gap:12,width:"100%"}}>
          {dailyDDHit&&<div style={{background:"rgba(239,68,68,0.15)",border:"2px solid rgba(239,68,68,0.6)",borderRadius:14,padding:"14px 16px",display:"flex",gap:12,alignItems:"center",gridColumn:isDesktop?"1/-1":"auto"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M4.93 4.93l14.14 14.14"/></svg>
            <div><div style={{color:"#fca5a5",fontWeight:800,fontSize:14}}>Daily DD erreicht! -${Math.round(dailyLoss)} / $1.000 Limit</div><div style={{color:"#fca5a5",fontSize:11}}>Für heute KEIN weiterer Trade. Rechner aus, Coach fragen.</div></div>
          </div>}
          {!dailyDDHit&&todayBlocked&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:14,padding:"14px 16px",display:"flex",gap:12,alignItems:"center",gridColumn:isDesktop?"1/-1":"auto"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            <div><div style={{color:R,fontWeight:700,fontSize:13}}>Heute gesperrt (Overtrading gestern)</div><div style={{color:"#fca5a5",fontSize:11}}>Morgen wieder. Heute: analysieren.</div></div>
          </div>}
          {overtradingToday&&!todayBlocked&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:14,padding:"14px 16px",display:"flex",gap:12,alignItems:"center"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            <div><div style={{color:R,fontWeight:700,fontSize:13}}>3 Trades – Morgen gesperrt!</div><div style={{color:"#fca5a5",fontSize:11}}>Rechner aus.</div></div>
          </div>}
          {atLimit&&!overtradingToday&&!todayBlocked&&<div style={{background:O+"22",border:"1px solid "+O,borderRadius:10,padding:"10px 14px",display:"flex",gap:10,alignItems:"center"}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M4.93 4.93l14.14 14.14"/></svg><div><div style={{color:O,fontWeight:800}}>2 Trades – Tageslimit!</div><div style={{color:"#fdba74",fontSize:11}}>Kein 3. Trade!</div></div>
          </div>}
          {inPause&&<div style={{background:"linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.08))",border:"2px solid rgba(245,158,11,0.6)",borderRadius:14,padding:"16px 18px",display:"flex",gap:14,alignItems:"center",animation:"glowPulse 2s ease infinite"}}>
            <span style={{fontSize:24}}>⏸</span>
            <div style={{flex:1}}>
              <div style={{color:Y,fontWeight:700,fontSize:13,marginBottom:4}}>Pflichtpause</div>
              <div style={{color:Y,fontWeight:800,fontSize:36,lineHeight:1}}>{pStr}</div>
              <div style={{color:"#fbbf24",fontSize:11,marginTop:5}}>Kein Impuls-Trade – warte den Timer ab</div>
            </div>
          </div>}

          <Card style={{borderColor:B+"44"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{color:"#8b96b0",fontSize:isDesktop?12:10,fontWeight:600,letterSpacing:1,marginBottom:3}}>KONTO 09</div>
                <div style={{color:pc(netPnl),fontWeight:800,fontSize:isDesktop?52:28}}>{netPnl>=0?"+":"-"}${Math.round(Math.abs(netPnl)).toLocaleString()}</div>
                <div style={{color:"#8b96b0",fontSize:isDesktop?13:10,marginTop:1}}>Saldo: ${Math.round(saldo).toLocaleString()}</div>
              </div>
              <div style={{background:"#0d1320",borderRadius:8,padding:"8px 12px",textAlign:"right"}}>
                <div style={{color:"#8b96b0",fontSize:9,marginBottom:1}}>HEUTE</div>
                <div style={{color:pc(todPnl),fontWeight:800,fontSize:isDesktop?22:16}}>{fs(todPnl)}</div>
                <div style={{color:tradeCount>=OVERTRADING_AT?R:tradeCount>=DAILY_LIMIT?O:"#8b96b0",fontSize:9,marginTop:1,fontWeight:tradeCount>=DAILY_LIMIT?700:400}}>{tradeCount}/{DAILY_LIMIT} Trades{tradeCount>=OVERTRADING_AT?" !":""}</div>
              </div>
            </div>
            {(()=>{
              // TTP EOD Trailing DD: DD folgt Saldo nach oben bis DD=$50k (bei Saldo=$52k) -> dann eingefroren
              const ddInitial=acct.size-acct.maxDD;        // $48.000 - Startlevel DD
              const ddLockAt=acct.size;                    // $50.000 - DD friert hier ein
              const profitStart=acct.size+acct.maxDD;      // $52.000 - ab hier reiner Profit
              const currentDD=Math.min(saldo-acct.maxDD,ddLockAt); // aktueller DD-Level (trailing bis Lock)
              const ddAbstand=Math.max(0,saldo-currentDD); // Abstand vom aktuellen DD
              const isLocked=saldo>=profitStart;           // DD eingefroren?
              const profit=Math.max(0,saldo-profitStart);  // Gewinn über $52k
              const totalRange=acct.target-ddInitial;      // $48k→$54k = $6k Gesamtrange
              const markerPct=Math.min(99,Math.max(1,(saldo-ddInitial)/totalRange*100));
              const lockLinePct=(ddLockAt-ddInitial)/totalRange*100;   // wo $50k liegt = 33%
              const profitLinePct=(profitStart-ddInitial)/totalRange*100; // wo $52k liegt = 66%
              const ddColor=ddAbstand<500?R:ddAbstand<1000?Y:G;
              return(
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#6b7a9a",fontSize:9,fontWeight:700,letterSpacing:"0.5px"}}>{acct.broker||"Prop Firm"} EOD TRAILING DD</span>
                    <span style={{color:isLocked?G:Y,fontSize:9,fontWeight:700}}>{isLocked?"⊠ DD eingefroren $"+ddLockAt.toLocaleString():"⚠️ DD läuft mit"}</span>
                  </div>
                  <div style={{position:"relative",height:12,borderRadius:6,overflow:"hidden",marginBottom:4,background:"rgba(255,255,255,0.05)"}}>
                    <div style={{position:"absolute",left:0,width:markerPct+"%",height:"100%",borderRadius:6,background:ddAbstand<500?"linear-gradient(90deg,#ef4444,#dc2626)":ddAbstand<1000?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#6366f1,#a855f7)",transition:"width .6s ease",boxShadow:ddAbstand<500?"0 0 12px rgba(239,68,68,0.5)":ddAbstand<1000?"0 0 12px rgba(245,158,11,0.4)":"0 0 12px rgba(99,102,241,0.3)"}}/>
                    <div style={{position:"absolute",left:lockLinePct+"%",top:0,bottom:0,width:1,background:"rgba(255,255,255,0.15)"}}/>
                    <div style={{position:"absolute",left:profitLinePct+"%",top:0,bottom:0,width:1,background:"rgba(255,255,255,0.15)"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#6b7a9a",marginBottom:6}}>
                    <span style={{color:R,fontSize:12,fontWeight:700}}>${ddInitial.toLocaleString()}<br/>Max DD</span>
                    <span style={{color:Y,textAlign:"center",fontSize:12,fontWeight:700}}>${ddLockAt.toLocaleString()}<br/>DD Lock</span>
                    <span style={{color:G,textAlign:"center",fontSize:12,fontWeight:700}}>${profitStart.toLocaleString()}<br/>Profit</span>
                    <span style={{textAlign:"right",fontSize:12,color:"#8b96b0",fontWeight:600}}>${acct.target.toLocaleString()}<br/>Ziel</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:ddColor,fontSize:9,fontWeight:700}}>Abstand: ${Math.round(ddAbstand).toLocaleString()}</span>
                    <span style={{color:profit>0?G:"#6b7a9a",fontSize:9,fontWeight:700}}>{profit>0?"Profit: +$"+Math.round(profit).toLocaleString():"Noch $"+(profitStart-saldo).toLocaleString()+" bis Profit"}</span>
                  </div>
                </div>
              );
            })()}
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{color:"#8b96b0",fontSize:10}}>Disziplin</span>
                <span style={{color:sc(disc),fontWeight:700}}>{disc}% / {goals.disc}% Ziel</span>
              </div>
              <Bar2 pct={Math.min(100,disc/goals.disc*100)} color={sc(disc)}/>
            </div>
            <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #2d3548",display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
              <div style={{background:"#0d1320",borderRadius:8,padding:"7px 8px",textAlign:"center",flex:1}}>
                <div style={{color:"#6b7a9a",fontSize:8,marginBottom:2}}>MONAT P&L</div>
                <div style={{color:pc(monthPnl),fontWeight:800,fontSize:14}}>{fs(monthPnl)}</div>
                <div style={{color:"#4a5568",fontSize:8}}>diesen Monat</div>
              </div>
              <div style={{background:"#0d1320",borderRadius:8,padding:"7px 8px",textAlign:"center",flex:1}}>
                <div style={{color:"#6b7a9a",fontSize:8,marginBottom:2}}>WIN RATE</div>
                <div style={{color:(t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0)>=50?G:R,fontWeight:800,fontSize:14}}>{t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0}%</div>
                <div style={{color:"#4a5568",fontSize:8}}>{t09.length} Trades</div>
              </div>
            </div>
            <div style={{paddingTop:8,borderTop:"1px solid #2d3548",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Field label="SALDO ($)">
                <input type="number" step="0.01" defaultValue={saldo} onBlur={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)){setSaldo(v);localStorage.setItem("ttp_saldo",v);}}} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:14,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
              </Field>
              <Field label="MAX DD ($)">
                <input type="number" step="0.01" defaultValue={maxDDLevel} onBlur={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)){setMaxDDLevel(v);localStorage.setItem("ttp_maxdd_level",v);}}} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:14,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
              </Field>
            </div>
          </Card>

          
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {[{l:"TRADES",v:tradeCount+"/"+DAILY_LIMIT,c:tradesLeft>0?G:R},{l:"MONAT P&L",v:fs(monthPnl),c:pc(monthPnl)},{l:"WIN RATE",v:(t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0)+"%",c:(t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0)>=50?G:R},{l:"DD ABSTAND",v:"$"+Math.round(kontoabstand),c:kontoabstand<1000?Y:G}].map(s=>(
              <div key={s.l} style={{background:"#131d30",border:"1px solid #2d3548",borderRadius:10,padding:10,textAlign:"center"}}>
                <div style={{color:"#8b96b0",fontSize:9,marginBottom:3}}>{s.l}</div>
                <div style={{color:s.c,fontWeight:800,fontSize:isDesktop?20:14}}>{s.v}</div>
              </div>
            ))}
          </div>


          <Card style={{breakInside:"avoid",height:isDesktop?"auto":"auto"}}>
            <div style={{fontWeight:isDesktop?800:700,marginBottom:isDesktop?14:10,fontSize:isDesktop?18:15}}>{now.toLocaleString("de-DE",{month:"long",year:"numeric"})}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:5}}>
              {["Mo","Di","Mi","Do","Fr","Sa","So"].map(d=><div key={d} style={{textAlign:"center",color:"#8b96b0",fontSize:isDesktop?13:10,fontWeight:700,marginBottom:isDesktop?4:0}}>{d}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:isDesktop?6:3}}>{renderCal()}</div>
          </Card>


          {/* WZP – WOCHENPLAN */}
          {wzpCalc&&(()=>{
            const wz=wzpCalc;
            // If Claude data available, merge it (Claude overrides local calc)
            const cd=wzpData;
            const ampelSrc=cd?cd.ampel:wz.ampel;
            const ampelColor=ampelSrc==='green'?G:ampelSrc==='yellow'?Y:R;
            const ampelBg=ampelSrc==='green'?'rgba(0,211,149,0.08)':ampelSrc==='yellow'?'rgba(245,158,11,0.08)':'rgba(239,68,68,0.08)';
            const ampelEmoji=ampelSrc==='green'?'🟢':ampelSrc==='yellow'?'🟡':'🔴';
            return(
              <Card style={{borderColor:ampelColor+'44',background:'linear-gradient(135deg,#0d1020,#0f1117)'}} onClick={()=>setWzpExp(p=>!p)}>
                {/* HEADER */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:12,height:12,borderRadius:'50%',background:ampelColor,flexShrink:0,animation:'pulse 2s infinite',boxShadow:'0 0 8px '+ampelColor}}/>
                    <div>
                      <div style={{fontWeight:800,fontSize:15,color:'#f0f4ff'}}>Wochenplan</div>
                      <div style={{color:B,fontSize:9,fontWeight:600,letterSpacing:'0.5px'}}>WZP · {(wz.accountType==='challenge'?'CHALLENGE':(wz.accountType==='pa'?'PERFORMANCE':'EIGENKAPITAL'))} · {wz.ddType==='eod'?'EOD DD':'TRAILING DD'}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{fontSize:18}}>{ampelEmoji}</div>
                    <button onClick={e=>{e.stopPropagation();wzpAnalyze();}}
                      style={{background:wzpLoading?'rgba(99,102,241,0.1)':'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))',border:'1px solid rgba(99,102,241,0.4)',borderRadius:8,padding:'5px 9px',color:wzpLoading?'#6b7a9a':'#a5b4fc',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>
                      {wzpLoading?<><span style={{animation:'spin 1s linear infinite',display:'inline-block'}}>⟳</span> Lädt...</>:<>🤖 KI</>}
                    </button>
                    {!isDesktop&&<span onClick={e=>{e.stopPropagation();setWzpExp(p=>!p);}} style={{color:B,fontSize:11,fontWeight:600}}>{wzpExp?'▲':'▼'}</span>}
                  </div>
                </div>
                {cd&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div style={{color:'#6b7a9a',fontSize:9}}>🤖 Claude Analyse · {cd.date}</div>
                  <button onClick={e=>{e.stopPropagation();setWzpData(null);localStorage.removeItem('ttp_wzp_data');}} style={{background:'none',color:'#4b5568',fontSize:9,padding:0}}>zurücksetzen</button>
                </div>}

                {/* AMPEL STATUS */}
                <div style={{background:ampelBg,borderRadius:10,padding:'10px 12px',marginBottom:10,border:'1px solid '+ampelColor+'33'}}>
                  <div style={{color:ampelColor,fontWeight:700,fontSize:12}}>{cd?cd.ampelReason:wz.ampelMsg}</div>
                  {cd&&cd.insight&&<div style={{color:'#8b96b0',fontSize:10,marginTop:4,fontStyle:'italic'}}>{cd.insight}</div>}
                </div>

                {/* STATS GRID – immer sichtbar */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,marginBottom:10}}>
                  {[
                    {l:'WOCHE P&L',v:(wz.weekPnl>=0?'+':'')+'$'+wz.weekPnl,c:wz.weekPnl>=0?G:R},
                    {l:'WOCHE WR',v:(cd?cd.winRate:wz.weekWR)+'%',c:(cd?cd.winRate:wz.weekWR)>=50?G:(cd?cd.winRate:wz.weekWR)>=35?Y:R},
                    {l:'ZIEL/TAG',v:'$'+(cd?cd.dailyTarget:wz.dailyNeeded),c:B},
                    {l:'EV/TRADE',v:cd?(cd.evPerTrade>=0?'+':'')+' $'+cd.evPerTrade:'–',c:cd&&cd.evPerTrade>=0?G:R},
                    {l:'AVG WIN',v:cd?'+$'+cd.avgWin:'–',c:G},
                    {l:'AVG LOSS',v:cd?'-$'+cd.avgLoss:'–',c:R},
                  ].map(s=>(
                    <div key={s.l} style={{background:'rgba(0,0,0,0.25)',borderRadius:8,padding:'7px 5px',textAlign:'center',border:'1px solid #1e2030'}}>
                      <div style={{color:'#6b7a9a',fontSize:8,marginBottom:2}}>{s.l}</div>
                      <div style={{color:s.c,fontWeight:800,fontSize:12}}>{s.v}</div>
                    </div>
                  ))}
                </div>

                {/* ADAPTIVES SL/TP & KONTRAKT */}
                {cd&&(
                  <div style={{background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(168,85,247,0.05))',borderRadius:10,padding:'10px 12px',marginBottom:10,border:'1px solid rgba(99,102,241,0.2)'}}>
                    <div style={{color:B,fontSize:10,fontWeight:700,marginBottom:6}}>📐 KI-Empfehlung (adaptiv aus deinen Trades)</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                      {[
                        {l:'KONTRAKTE',v:cd.recContracts+'x '+cd.recSymbol,c:'#f0f4ff'},
                        {l:'SL (adaptiv)',v:cd.adaptiveSL+'T → $'+(Math.round(cd.adaptiveSL*(INSTRUMENTS[cd.recSymbol]||INSTRUMENTS['MNQ']).tickValue*cd.recContracts)),c:R},
                        {l:'TP (adaptiv)',v:cd.adaptiveTP+'T → $'+(Math.round(cd.adaptiveTP*(INSTRUMENTS[cd.recSymbol]||INSTRUMENTS['MNQ']).tickValue*cd.recContracts)),c:G},
                      ].map(s=>(
                        <div key={s.l} style={{background:'rgba(0,0,0,0.2)',borderRadius:7,padding:'7px 5px',textAlign:'center'}}>
                          <div style={{color:'#6b7a9a',fontSize:8,marginBottom:2}}>{s.l}</div>
                          <div style={{color:s.c,fontWeight:800,fontSize:11}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* WOCHENFORTSCHRITT BAR */}
                <div style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{color:'#8b96b0',fontSize:10}}>Wochenfortschritt</span>
                    <span style={{color:ampelColor,fontWeight:700,fontSize:10}}>{wz.weeklyPct}%</span>
                  </div>
                  <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,0.05)',overflow:'hidden'}}>
                    <div style={{height:'100%',width:wz.weeklyPct+'%',background:'linear-gradient(90deg,'+ampelColor+','+ampelColor+'aa)',borderRadius:3,transition:'width .5s'}}/>
                  </div>
                </div>

                {/* CHALLENGE / PA PROGRESS */}
                {wz.accountType==='challenge'&&(
                  <div style={{background:'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(168,85,247,0.06))',borderRadius:10,padding:'10px 12px',marginBottom:10,border:'1px solid rgba(99,102,241,0.2)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <span style={{color:'#8b96b0',fontSize:10,fontWeight:700}}>CHALLENGE FORTSCHRITT</span>
                      <span style={{color:wz.profitNeeded<=0?G:Y,fontWeight:800,fontSize:12}}>{wz.profitNeeded<=0?'✅ ERREICHT!':'$'+wz.profitSoFar+' / $'+wz.profitTarget}</span>
                    </div>
                    <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,0.05)',overflow:'hidden',marginBottom:6}}>
                      <div style={{height:'100%',width:Math.min(100,Math.round(wz.profitSoFar/Math.max(1,wz.profitTarget)*100))+'%',background:'linear-gradient(90deg,'+G+',#00a871)',borderRadius:3,transition:'width .5s'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#6b7a9a'}}>
                      <span>Noch: <span style={{color:wz.profitNeeded<=0?G:R,fontWeight:700}}>${wz.profitNeeded}</span></span>
                      <span>Tägl. nötig: <span style={{color:wz.dailyNeeded<100?G:wz.dailyNeeded<200?Y:R,fontWeight:700}}>${wz.dailyNeeded}</span></span>
                      <span>Tage: <span style={{color:wz.challengeDaysLeft>5?G:Y,fontWeight:700}}>{wz.challengeDaysLeft}d</span></span>
                    </div>
                  </div>
                )}

                {/* TOP-3 EMPFEHLUNGEN – aufklappbar */}
                {(wzpExp||isDesktop)&&(
                  <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4}}>
                    <div style={{color:'#8b96b0',fontSize:10,fontWeight:700,marginBottom:2}}>{cd?'🤖 KI TOP-EMPFEHLUNGEN':'TOP EMPFEHLUNGEN (lokal)'}</div>
                    {(cd?cd.recs:wz.recs).map((rec,i)=>(
                      <div key={i} style={{background:'rgba(0,0,0,0.2)',borderRadius:10,padding:'10px 12px',border:'1px solid '+(cd?'rgba(99,102,241,0.2)':'#1e2030')}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                          <span style={{fontSize:14}}>{rec.icon}</span>
                          <span style={{color:'#f0f4ff',fontWeight:700,fontSize:11}}>{rec.title}</span>
                        </div>
                        <div style={{color:'#8b96b0',fontSize:10,lineHeight:1.5}}>{rec.text}</div>
                      </div>
                    ))}
                    {/* DD DETAIL */}
                    <div style={{background:'rgba(0,0,0,0.2)',borderRadius:10,padding:'10px 12px',border:'1px solid '+(wz.ddPct>50?R+'44':'#1e2030')}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                        <span style={{color:'#8b96b0',fontSize:10,fontWeight:700}}>MAX DD</span>
                        <span style={{color:wz.ddPct>50?R:wz.ddPct>25?Y:G,fontWeight:800,fontSize:11}}>{wz.ddPct}% verbraucht</span>
                      </div>
                      <div style={{height:5,borderRadius:3,background:'rgba(255,255,255,0.05)',overflow:'hidden',marginBottom:4}}>
                        <div style={{height:'100%',width:wz.ddPct+'%',background:wz.ddPct>50?R:wz.ddPct>25?Y:G,borderRadius:3}}/>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#6b7a9a'}}>
                        <span>Verbraucht: <span style={{color:'#f0f4ff',fontWeight:700}}>${wz.ddUsed}</span></span>
                        <span>Tages-DD: <span style={{color:wz.dailyDDPct>50?R:G,fontWeight:700}}>{wz.dailyDDPct}%</span></span>
                        <span style={{color:wz.ddType==='eod'?G:Y,fontWeight:700}}>{wz.ddType==='eod'?'EOD':'TRAILING'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })()}
      const tod3=t09.filter(t=>t.date===todayISO());
      const todTradesStr=tod3.map(t=>"• "+t.time+" "+t.contract+" "+(t.pnl>=0?"+":"")+"$"+t.pnl.toFixed(0)).join("\n");
      prompt="NOTFALL: "+(acct.name||"Trader")+" hat gerade seinen "+tod3.length+". Trade gemacht (Limit: "+DAILY_LIMIT+").\n\nHeutige Trades:\n"+todTradesStr+"\nHeutige P&L: "+(todPnl>=0?"+":"")+"$"+todPnl.toFixed(0)+"\n\nGib eine KLARE STOPP-Nachricht. Kurz, direkt, keine Ausreden akzeptieren. Max 3 Sätze.";
    }
    else if(type==="trading_window"){
      prompt=`Das Trading-Fenster (16:15-17:30) ist gerade geöffnet.

HEUTE (${tod}):
• Bisherige Trades: ${tradeCount}/${DAILY_LIMIT}
• P&L heute: ${todPnl>=0?"+":""}$${todPnl.toFixed(0)}
• ${tod}-WR historisch: ${dayWR}%
• Kontoabstand: $${kontoabstand.toFixed(0)}

Soll ich jetzt traden? Klare Ja/Nein Empfehlung mit kurzem Grund. Max 3 Sätze.`;
    }
    else{
      setAiMessages([{role:"assistant",content:smartCoach("",type),auto:true}]);
      setAiLoading(false);
      return;
    }

    try{
      const wins_t=t09.filter(t=>t.pnl>0),losses_t=t09.filter(t=>t.pnl<0);
      const ctx={
        saldo:Math.round(saldo),
        kontoabstand,tradeCount,todPnl,disc,todayBlocked,inPause,tradesLeft,
        overtradingToday,atLimit,
        currentDay:tod,dayWR,monthPnl,
        targetBalance:goals.targetBalance,
        missingToTarget:Math.max(0,goals.targetBalance-saldo),
        totalTrades:allT09.length,
        winRate:t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0,
        allTimeWR:allT09.length?Math.round(allT09.filter(t=>t.pnl>0).length/allT09.length*100):0,
        avgWin:wins_t.length?Math.round(wins_t.reduce((s,t)=>s+t.pnl,0)/wins_t.length):0,
        avgLoss:losses_t.length?Math.round(losses_t.reduce((s,t)=>s+t.pnl,0)/losses_t.length):0,
        allTrades:t09.map(t=>t.date+" "+t.time+" "+t.contract+" "+t.dir+" "+(t.pnl>=0?"+":"")+"$"+t.pnl.toFixed(0)).join("\n"),
        todayTrades:(todT.map(t=>t.time+' '+t.dir+' $'+Math.round(t.pnl)).join(', ')||'Keine Trades heute'),
        coachProfile:sanitize(coachProfile||''),
        coachMemory:sanitize(coachMemory.slice(0,8).map(m=>m.note).join(' | ')),
        chatHistorySummary:sanitize(aiMessages.slice(-6).map(m=>(m.role==='user'?'Du':'Coach')+': '+m.content.slice(0,100)).join(' | '))
      };
      const res=await fetch('/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:[{role:"user",content:prompt}],context:ctx})
      });
      const rawText=await res.text();
      if(!res.ok){setAiMessages([{role:"assistant",content:smartCoach("",type),auto:true}]);return;}
      const data=JSON.parse(rawText);
      if(data.message){
        setAiMessages([{role:"assistant",content:data.message,auto:true}]);
        const m=data.message;
        if(m.includes("Muster")||m.includes("Problem")||m.includes("Stärke")||m.includes("Schwäche")||m.length>200){
          saveCoachMemory("💡 Session "+new Date().toLocaleDateString("de-DE")+": "+m.slice(0,100).replace(/\n/g," ")+"...");
        }
      }
      else setAiMessages([{role:"assistant",content:smartCoach("",type),auto:true}]);
    }catch(err){
      setAiMessages([{role:"assistant",content:smartCoach("",type),auto:true}]);
    }finally{setAiLoading(false);}
  };

  const startVoice=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){
      // Fallback: show input field with prompt
      showToast("Tippe deine Frage ein 👆");
      return;
    }
    if(isRecording){setIsRecording(false);return;}
    const rec=new SR();
    rec.lang="de-DE";
    rec.continuous=false;
    rec.interimResults=true;
    rec.maxAlternatives=1;
    setIsRecording(true);
    try{rec.start();}catch(e){setIsRecording(false);showToast("Mikrofon Fehler: "+e.message);return;}
    rec.onresult=(e)=>{
      let interim="",final="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal)final+=e.results[i][0].transcript;
        else interim+=e.results[i][0].transcript;
      }
      const text=final||interim;
      if(text)setAiInput(text);
    };
    rec.onend=()=>{
      setIsRecording(false);
      // Auto-send after voice input
      setAiInput(prev=>{
        if(prev&&prev.trim()){
          setTimeout(()=>{
            const btn=document.getElementById("aiSendBtn");
            if(btn)btn.click();
          },300);
        }
        return prev;
      });
    };
    rec.onerror=(e)=>{
      setIsRecording(false);
      if(e.error==="not-allowed")showToast("Mikrofon-Zugriff verweigert – Einstellungen prüfen");
      else if(e.error==="no-speech")showToast("Nichts gehört – nochmal versuchen");
      else showToast("Sprachfehler: "+e.error);
    };
  };

  const handleImageSelect=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const base64=ev.target.result.split(",")[1];
      setAiImage({base64,mediaType:file.type||"image/jpeg"});
      setAiImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const importTTPTrades=(raw)=>{  const lines=raw.trim().split('\n').filter(l=>l.trim());const parsed=[];
  for(const line of lines){
    const parts=line.split('\t').map(s=>s.trim());
    if(parts.length<8)continue;
    const contract=parts[0].includes('MNQ')?'MNQ':'NQ';
    const entryDT=parts[1]; // "18.5.2026, 16:54:51"
    const pnlStr=parts[7].replace('$','').replace(',','.');
    const pnl=parseFloat(pnlStr);
    if(isNaN(pnl))continue;
    // Parse date: "18.5.2026, 16:54:51" -> "2026-05-18" + "16:54"
    const dtMatch=entryDT.match(/(\d+)\.(\d+)\.(\d+),\s*(\d+):(\d+)/);
    if(!dtMatch)continue;
    const [,day,month,year,hour,min]=dtMatch;
    const date=year+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0');
    const time=hour+':'+min;
    const qty=parseInt(parts[6])||1;
    const dir=qty>0?'LONG':'SHORT';
    parsed.push({id:uid(),acct:'09',contract,date,time,pnl,dur:0,dir,setup:'Import TTP',notes:'',rules:{r1:false,r2:false,r3:false,r4:false,r5:(parseInt(time.split(':')[0])===16&&parseInt(time.split(':')[1])>=15)||(parseInt(time.split(':')[0])===17&&parseInt(time.split(':')[1])<=30),r6:true}});
  }
  if(!parsed.length){alert('Keine Trades gefunden. Bitte TTP Export einfügen.');return;}
  if(!window.confirm('Import: '+parsed.length+' Trades einfügen? Das aktualisiert auch den Saldo.')){return;}
  setTrades(p=>{const u=[...p,...parsed];localStorage.setItem('ttp_trades',JSON.stringify(u));return u;});
  const totalPnl=parsed.reduce((s,t)=>s+t.pnl,0);
  const newSaldo=Math.round((saldo+totalPnl)*100)/100;
  setSaldo(newSaldo);localStorage.setItem('ttp_saldo',newSaldo);
  showToast(parsed.length+' Trades importiert! P&L: '+(totalPnl>=0?'+':'')+'$'+Math.round(totalPnl));
};

const analyzeProblems=async()=>{
  const selected=Object.keys(problems).filter(k=>problems[k]);
  if(!selected.length){showToast("Bitte mindestens ein Problem auswählen!");return;}
  setProbAnalysisLoading(true);
  setProbAnalysis('');
  try{
    const wr=t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0;
    const todayPnlStr=(todPnl>=0?"+":"")+todPnl;
    const prompt="Ich habe folgende Trading-Probleme: "+selected.join(", ")+
      ". Meine aktuellen Stats: WR "+wr+"%, Saldo $"+Math.round(saldo)+
      ", Heute: "+todT.length+" Trades ("+todayPnlStr+")"+
      ", Overtrading-Tage: "+(profitPlan?.overtradeDays||0)+
      ". Gib mir für JEDES Problem einen konkreten 1-2 Satz Plan was ich ab morgen genau machen soll.";
    const res=await fetch('/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        messages:[{role:"user",content:prompt}],
        context:{
          coachProfile:coachProfile||'',
          coachMemory:coachMemory.slice(0,5).map(m=>m.note).join(' | '),
          chatHistorySummary:''
        }
      })
    });
    if(!res.ok){setProbAnalysis("Fehler: "+res.status);return;}
    const d=await res.json();
    setProbAnalysis(d.message||'Keine Antwort erhalten.');
  }catch(e){
    setProbAnalysis("Verbindungsfehler: "+e.message);
  }finally{
    setProbAnalysisLoading(false);
  }
};

const sendAiMessage=async()=>{
    if((!aiInput.trim()&&!aiImage)||aiLoading)return;
    // "Merke dir..." Befehl → direkt ins Gedächtnis
    const inputLow=(aiInput||"").toLowerCase();
    // TTP Import from chat: paste TTP data directly
    if(aiInput.includes('NQ-202606') || aiInput.includes('MNQ-202606')){
      const lines=aiInput.trim().split('\n').filter(l=>l.includes('CME'));
      const imported=[];
      for(const line of lines){
        const parts=line.split('\t').map(s=>s.trim()).filter(Boolean);
        if(parts.length<8)continue;
        const contract=parts[0].includes('MNQ')?'MNQ':'NQ';
        const dtMatch=parts[1]?.match(/(\d+)\.(\d+)\.(\d+),\s*(\d+):(\d+)/);
        if(!dtMatch)continue;
        const [,day,month,year,hour,min]=dtMatch;
        const date=year+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0');
        const time=hour+':'+min;
        const pnlStr=(parts[7]||'0').replace(/[$,]/g,'').replace(',','.');
        const pnl=parseFloat(pnlStr);
        if(isNaN(pnl))continue;
        imported.push({id:uid(),acct:'09',contract,date,time,pnl,dur:0,dir:parseInt(parts[6]||'1')>0?'LONG':'SHORT',setup:'Chat Import',notes:'',rules:{r1:false,r2:false,r3:false,r4:false,r5:(parseInt(time.split(':')[0])===16&&parseInt(time.split(':')[1])>=15)||(parseInt(time.split(':')[0])===17&&parseInt(time.split(':')[1])<=30),r6:true}});
      }
      if(imported.length>0){
        setTrades(p=>{const u=[...p,...imported];localStorage.setItem('ttp_trades',JSON.stringify(u));return u;});
        const totalPnl=Math.round(imported.reduce((s,t)=>s+t.pnl,0));
        const newSaldo=Math.round((saldo+totalPnl)*100)/100;
        setSaldo(newSaldo);localStorage.setItem('ttp_saldo',newSaldo);
        setAiMessages(p=>[...p,{role:'user',content:'[TTP Import]'},{role:'assistant',content:'✅ '+imported.length+' Trades importiert! P&L: '+(totalPnl>=0?'+':'')+'$'+totalPnl+'. Saldo jetzt: $'+newSaldo.toLocaleString()+'.\n\n'+(imported.some(t=>t.contract==='NQ')?'⚠️ Achtung: NQ-Trades erkannt! Das sind 10x größere Kontrakte als MNQ. War das absichtlich?':'')}]);
        setAiInput('');
        return;
      }
    }
    if(inputLow.startsWith("merke dir")||inputLow.startsWith("vergiss nicht")){
      const note=aiInput.slice(inputLow.indexOf(" ")+1).trim();
      if(note){
        saveCoachMemory("📌 "+note);
        setAiMessages(p=>[...p,{role:"user",content:aiInput},{role:"assistant",content:"✅ Gemerkt! Ich werde mir das für alle zukünftigen Sessions merken:\n\n📌 "+note}]);
        setAiInput("");
        return;
      }
    }
    const userInput=aiInput;
    const newMsgs=[...aiMessages,{role:"user",content:userInput}];
    setAiMessages(newMsgs);
    setAiInput("");
    setAiLoading(true);
    try{
      // Alle Trades für KI-Analyse
      const allWins=t09.filter(t=>t.pnl>0);
      const allLoss=t09.filter(t=>t.pnl<0);
      const DAYS2=["So","Mo","Di","Mi","Do","Fr","Sa"];
      const dayStats={};
      t09.forEach(t=>{const d=DAYS2[new Date(t.date).getDay()];if(!dayStats[d])dayStats[d]={n:0,wins:0,pnl:0};dayStats[d].n++;dayStats[d].pnl+=t.pnl;if(t.pnl>0)dayStats[d].wins++;});
      const hourStats={};
      t09.forEach(t=>{const h=parseInt(t.time.split(":")[0]);if(!hourStats[h])hourStats[h]={n:0,wins:0,pnl:0};hourStats[h].n++;hourStats[h].pnl+=t.pnl;if(t.pnl>0)hourStats[h].wins++;});
      const setupStats={};
      t09.forEach(t=>{const s=t.setup||"Unbekannt";if(!setupStats[s])setupStats[s]={n:0,wins:0,pnl:0};setupStats[s].n++;setupStats[s].pnl+=t.pnl;if(t.pnl>0)setupStats[s].wins++;});
      const ctx={
        // Account Status
        saldo,kontoabstand,tradeCount,todPnl,disc,todayBlocked,inPause,tradesLeft,
        currentTime:nowHHMM(),
        currentDay:["So","Mo","Di","Mi","Do","Fr","Sa"][new Date().getDay()],
        // Goals
        monthPnl,targetBalance:goals.targetBalance,
        missingToTarget:Math.max(0,goals.targetBalance-saldo),
        // Gesamtstatistik
        totalTrades:t09.length,
        winRate:t09.length?Math.round(allWins.length/t09.length*100):0,
        avgWin:allWins.length?Math.round(allWins.reduce((s,t)=>s+t.pnl,0)/allWins.length):0,
        avgLoss:allLoss.length?Math.round(allLoss.reduce((s,t)=>s+t.pnl,0)/allLoss.length):0,
        totalPnl:Math.round(t09.reduce((s,t)=>s+t.pnl,0)),
        overtradingToday,atLimit,
        // Muster-Analyse
        dayStats,hourStats,setupStats,
        // Heutige Trades (voll)
        todayTrades:todT.map(t=>({pnl:t.pnl,dir:t.dir,contract:t.contract,time:t.time,setup:t.setup})),
        allTrades:t09.map(t=>({d:t.date,t:t.time,p:Math.round(t.pnl),dir:t.dir,c:t.contract,s:t.setup||""})),
        coachProfile:coachProfile||'',
        coachMemory:coachMemory.slice(0,8).map(m=>m.note).join(' | '),
        chatHistorySummary:aiMessages.slice(-6).map(m=>(m.role==='user'?'Du':'Coach')+': '+m.content.slice(0,100).replace(/[\u0080-\uFFFF]/g,'').replace(/\t/g,' ')).join(' | '),
        allTimeWR:allT09.length?Math.round(allT09.filter(t=>t.pnl>0).length/allT09.length*100):0,
        todayPnl:todPnl
      };
      // Build messages mit optionalem Bild
      const apiMessages=newMsgs.map((m,i)=>{
        if(i===newMsgs.length-1&&aiImage&&m.role==="user"){
          return{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:aiImage.mediaType,data:aiImage.base64}},
            {type:"text",text:sanitize(m.content)||"Analysiere diesen Chart für mich"}
          ]};
        }
        return{role:m.role,content:sanitize(m.content)};
      });
      setAiImage(null);
      setAiImagePreview(null);
      const res=await fetch('/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:apiMessages,context:ctx})
      });
      const rawText=await res.text();
      if(!res.ok){
        setAiMessages(p=>[...p,{role:"assistant",content:"🔴 HTTP "+res.status+": "+rawText.slice(0,200)}]);
        return;
      }
      let data;
      try{data=JSON.parse(rawText);}catch(e){
        setAiMessages(p=>[...p,{role:"assistant",content:"🔴 JSON Fehler: "+rawText.slice(0,200)}]);
        return;
      }
      if(!data.message){        setAiMessages(p=>[...p,{role:"assistant",content:"🔴 Kein message Feld: "+JSON.stringify(data).slice(0,200)}]);
        return;
      }
      const assistantMsg={role:"assistant",content:data.message,ts:new Date().toISOString()};
      setAiMessages(p=>{
        const updated=[...p,assistantMsg];
        const forStorage=updated.slice(-80).map(m=>({role:m.role,content:m.content.slice(0,600),ts:m.ts||''}));
        localStorage.setItem('ttp_chat_history',JSON.stringify(forStorage));
        return updated;
      });
      // Auto-save key insights (not every message, only meaningful ones)
      const msg=data.message;
      const isKeyInsight=msg.length>80&&(
        msg.includes("Problem")||msg.includes("Muster")||msg.includes("Stärke")||
        msg.includes("solltest")||msg.includes("wichtig")||msg.includes("achte")||
        msg.includes("morgen")||msg.includes("heute")
      );
      if(isKeyInsight){
        const short=msg.replace(/[🔴✅⚠️📌💡🎯]/g,'').slice(0,120).trim();
        saveCoachMemory("💬 "+short);
      }
    }catch(err){
      setAiMessages(p=>[...p,{role:"assistant",content:"🔴 Netzwerk Fehler: "+err.message}]);
    }finally{setAiLoading(false);}
  };

  const addTrade=()=>{
    if(!form.pnl){showToast("Bitte P&L eingeben");return;}
    const v=parseFloat(form.pnl);
    if(isNaN(v)){showToast("P&L muss eine Zahl sein");return;}
    const newT={id:uid(),acct:"09",contract:form.contract,date:form.date,time:form.time,pnl:v,dur:0,dir:form.dir,setup:form.setup,notes:form.notes,rules:{...form.rules}};
    setTrades(p=>{const u=[...p,newT];localStorage.setItem('ttp_trades',JSON.stringify(u));return u;});
    const newSaldo=Math.round((saldo+v)*100)/100;
    setSaldo(newSaldo);localStorage.setItem("ttp_saldo",newSaldo);
    setLastTradeAt(new Date());
    setForm(emptyForm());
    showToast("Gespeichert! 15-Min Pause startet...");
    setTab("dash");
    setTimeout(()=>triggerAiPopup("after_trade",newT),1000);
    setChecks({c1:false,c2:false,c3:false,c4:false});
    localStorage.removeItem("ttp_checks");
  };

  const renderCal=()=>{
    const y=now.getFullYear(),mo=now.getMonth();
    const fd2=new Date(y,mo,1).getDay(),dim=new Date(y,mo+1,0).getDate();
    const cells=[];
    for(let i=0;i<(fd2||7)-1;i++)cells.push(<div key={"e"+i}/>);
    for(let d=1;d<=dim;d++){
      const k=`${y}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const pv=calMap[k],isT=k===todayISO(),isFuture=k>todayISO();
      const isBlocked=blockedDays.has(k)&&isFuture;
      let bg="#131d30",border=isT?B:"#1e2d48";
      if(isBlocked){bg=R+"11";border=R+"44";}
      else if(pv!=null){bg=pv>0?G+"22":R+"22";border=pv>0?G+"55":R+"55";}
      cells.push(
        <div key={k} style={{background:bg,border:"2px solid "+border,borderRadius:isDesktop?10:7,padding:isDesktop?"10px 4px":"5px 2px",textAlign:"center",minHeight:isDesktop?64:42}}>
          <div style={{color:isT?B:"#8b96b0",fontSize:isDesktop?14:11,fontWeight:isT?700:400}}>{d}</div>
          {isBlocked&&<div style={{fontSize:8,color:R,fontWeight:700}}>SPERRE</div>}
          {pv!=null&&!isBlocked&&<div style={{color:pc(pv),fontSize:isDesktop?12:10,fontWeight:700}}>{pv>=0?"+":"-"}${Math.abs(pv).toFixed(0)}</div>}
        </div>
      );
    }
    return cells;
  };

  const allChecked=Object.values(checks).every(Boolean);
  const nowD=new Date();
  const lonTime=nowD.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"});
  const chiTime=nowD.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"America/Chicago"});
  const lonH=new Date(nowD.toLocaleString("en-US",{timeZone:"Europe/London"})).getHours();
  const chiH=new Date(nowD.toLocaleString("en-US",{timeZone:"America/Chicago"})).getHours();
  const lonOpen=lonH>=8&&lonH<16;
  const chiOpen=chiH>=8&&chiH<15;
  const NAVS=[
  {k:"dash",lb:"Dashboard",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="2,17 8,10 13,14 22,5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="10" r="1.5" fill="currentColor"/><circle cx="13" cy="14" r="1.5" fill="currentColor"/><line x1="2" y1="21" x2="22" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/></svg>},
  {k:"mind",lb:"Mind",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.96-3 2.5 2.5 0 0 1 0-5A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.96-3 2.5 2.5 0 0 0 0-5A2.5 2.5 0 0 0 14.5 2Z"/></svg>},
  {k:"log",lb:"Loggen",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>},
  {k:"analyse",lb:"Analyse",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 20 Q7 12 10 15 Q13 18 16 8 Q18 2 21 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="21" cy="4" r="2" fill="currentColor" opacity="0.8"/><circle cx="10" cy="15" r="1.5" fill="currentColor" opacity="0.6"/></svg>},
  {k:"hist",lb:"History",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="2" rx="1" fill="currentColor" opacity="0.9"/><rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor" opacity="0.7"/><rect x="3" y="14" width="16" height="2" rx="1" fill="currentColor" opacity="0.5"/><rect x="3" y="19" width="10" height="2" rx="1" fill="currentColor" opacity="0.35"/></svg>},
];

  return(
    <div style={{background:"#111725",minHeight:"100vh",color:"#f0f4ff",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",fontSize:isDesktop?15:14,paddingBottom:"calc(70px + env(safe-area-inset-bottom,0px))",width:"100%",overflowX:"hidden"}}>
      {authLoading&&<div style={{position:"fixed",inset:0,zIndex:9999,background:"#080c14",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:40,height:40,borderRadius:"50%",border:"3px solid #2d3548",borderTopColor:B,animation:"spin .8s linear infinite"}}/>
      </div>}

      {!authLoading&&!authUser&&<div style={{position:"fixed",inset:0,zIndex:9998,background:"#080c14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{fontSize:42,fontWeight:900,letterSpacing:"-2px",marginBottom:4}}><span style={{color:B}}>Mind</span><span style={{color:"#f0f4ff"}}>Risk</span></div>
        <div style={{fontSize:11,color:"#6b7a9a",letterSpacing:"3px",marginBottom:40}}>TRADING JOURNAL</div>
        <div style={{width:"100%",maxWidth:360}}>
          <div style={{display:"flex",marginBottom:24,background:"#141e35",borderRadius:10,padding:4}}>
            <button onClick={()=>{setAuthScreen("login");setAuthError("");}} style={{flex:1,padding:"8px",borderRadius:8,fontWeight:700,fontSize:14,background:authScreen==="login"?"#6366f1":"transparent",color:authScreen==="login"?"#fff":"#6b7a9a",border:"none"}}>Einloggen</button>
            <button onClick={()=>{setAuthScreen("register");setAuthError("");}} style={{flex:1,padding:"8px",borderRadius:8,fontWeight:700,fontSize:14,background:authScreen==="register"?"#6366f1":"transparent",color:authScreen==="register"?"#fff":"#6b7a9a",border:"none"}}>Registrieren</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>EMAIL</div>
              <input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="deine@email.com" style={{background:"transparent",border:"none",fontSize:15,color:"#f0f4ff",width:"100%",outline:"none"}}/>
            </div>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>PASSWORT</div>
              <input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="••••••••" style={{background:"transparent",border:"none",fontSize:15,color:"#f0f4ff",width:"100%",outline:"none"}} onKeyDown={e=>e.key==="Enter"&&(authScreen==="login"?signIn():signUp())}/>
            </div>
            {authError&&<div style={{color:authError.startsWith("✅")?G:R,fontSize:12,textAlign:"center",padding:"4px 0"}}>{authError}</div>}
            <button onClick={authScreen==="login"?signIn:signUp} disabled={authWorking}
              style={{padding:"16px",borderRadius:14,fontWeight:800,fontSize:16,background:authWorking?"#2d3548":"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",border:"none",marginTop:4}}>
              {authWorking?"...":(authScreen==="login"?"Einloggen →":"Account erstellen →")}
            </button>
          </div>
          <div style={{textAlign:"center",marginTop:20,fontSize:12,color:"#4b5568"}}>Deine Daten werden sicher gespeichert und sind nur für dich sichtbar.</div>
        </div>
      </div>}

      {showOnboarding&&authUser&&<div style={{position:"fixed",inset:0,zIndex:9998,background:"#080c14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",overflowY:"auto"}}>
        {/* STEP 0: WELCOME */}
        {onboardStep===0&&<div style={{width:"100%",maxWidth:400,textAlign:"center",animation:"fadeIn .5s ease"}}>
          <div style={{fontSize:48,fontWeight:900,letterSpacing:"-2px",marginBottom:8}}><span style={{color:B}}>Mind</span><span style={{color:"#f0f4ff"}}>Risk</span></div>
          <div style={{fontSize:12,color:"#6b7a9a",letterSpacing:"3px",marginBottom:40}}>TRADING JOURNAL</div>
          <div style={{width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#a855f7)",margin:"0 auto 32px",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 40px rgba(99,102,241,0.4)"}}>
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none"><circle cx="10" cy="12" r="2.5" fill="white"/><circle cx="18" cy="12" r="2.5" fill="white"/><path d="M9 17.5 Q14 21 19 17.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:"#f0f4ff",marginBottom:12,letterSpacing:"-0.5px"}}>Dein persönlicher Trading Coach</div>
          <div style={{fontSize:15,color:"#6b7a9a",lineHeight:1.6,marginBottom:40}}>MindRisk hilft dir disziplinierter zu traden, Overtrading zu stoppen und bei Prop Firm Challenges erfolgreich zu sein.</div>
          <button onClick={()=>setOnboardStep(1)} style={{width:"100%",padding:"16px",borderRadius:14,fontWeight:800,fontSize:16,background:"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",border:"none",marginBottom:12}}>Jetzt starten →</button>
          <div style={{fontSize:12,color:"#4b5568"}}>Kostenlos · Kein Account nötig</div>
        </div>}

        {/* STEP 1: PROFIL */}
        {onboardStep===1&&<div style={{width:"100%",maxWidth:400,animation:"fadeIn .5s ease"}}>
          <div style={{color:"#6366f1",fontSize:11,fontWeight:700,letterSpacing:"2px",marginBottom:8}}>SCHRITT 1 VON 3</div>
          <div style={{fontSize:24,fontWeight:800,color:"#f0f4ff",marginBottom:4,letterSpacing:"-0.5px"}}>Dein Profil</div>
          <div style={{fontSize:14,color:"#6b7a9a",marginBottom:28}}>Damit der Coach dich wirklich kennt.</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>DEIN NAME</div>
              <input value={onboardData.name} onChange={e=>setOnboardData(p=>({...p,name:e.target.value}))} placeholder="z.B. Max" style={{background:"transparent",border:"none",fontSize:16,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
            </div>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>HAUPT-INSTRUMENT</div>
              <select value={onboardData.instrument||'MNQ'} onChange={e=>setOnboardData(p=>({...p,instrument:e.target.value}))} style={{background:"transparent",border:"none",fontSize:15,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}>
                <option value="MNQ">MNQ — Micro Nasdaq (Tick: $0.50)</option>
                <option value="NQ">NQ — Nasdaq 100 (Tick: $5.00)</option>
                <option value="MES">MES — Micro S&P 500 (Tick: $1.25)</option>
                <option value="ES">ES — S&P 500 (Tick: $12.50)</option>
                <option value="MGC">MGC — Micro Gold (Tick: $1.00)</option>
                <option value="GC">GC — Gold (Tick: $10.00)</option>
                <option value="MCL">MCL — Micro Crude Oil (Tick: $1.00)</option>
                <option value="MYM">MYM — Micro Dow Jones (Tick: $0.50)</option>
                <option value="M2K">M2K — Micro Russell (Tick: $0.50)</option>
              </select>
            </div>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>PROP FIRM</div>
              <select value={onboardData.firm} onChange={e=>setOnboardData(p=>({...p,firm:e.target.value}))} style={{background:"transparent",border:"none",fontSize:15,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}>
                <option value="TTP">The Trading Pit (TTP)</option>
                <option value="FTMO">FTMO</option>
                <option value="MyFundedFX">MyFundedFX</option>
                <option value="Topstep">Topstep</option>
                <option value="E8 Funding">E8 Funding</option>
                <option value="Andere">Andere</option>
              </select>
            </div>
            {onboardData.firm==="Andere"&&<div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>FIRM NAME</div>
              <input value={onboardData.firmOther} onChange={e=>setOnboardData(p=>({...p,firmOther:e.target.value}))} placeholder="Firma eingeben" style={{background:"transparent",border:"none",fontSize:15,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
                <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>KONTO ($)</div>
                <select value={onboardData.size} onChange={e=>setOnboardData(p=>({...p,size:parseInt(e.target.value),target:parseInt(e.target.value)+parseInt(e.target.value)*0.08,maxDD:parseInt(e.target.value)*0.04,dailyDD:parseInt(e.target.value)*0.02}))} style={{background:"transparent",border:"none",fontSize:15,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}>
                  {[25000,50000,75000,100000,125000,150000,200000].map(s=><option key={s} value={s}>${(s/1000).toFixed(0)}k</option>)}
                </select>
              </div>
              <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
                <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>MAX DD ($)</div>
                <input type="number" value={onboardData.maxDD} onChange={e=>setOnboardData(p=>({...p,maxDD:parseInt(e.target.value)||2000}))} style={{background:"transparent",border:"none",fontSize:15,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
              </div>
            </div>
            <div style={{background:"#141e35",borderRadius:12,padding:"12px 16px",border:"1px solid #2d3548"}}>
              <div style={{color:"#6b7a9a",fontSize:10,fontWeight:700,letterSpacing:"1px",marginBottom:6}}>KONTO-NUMMER (optional)</div>
              <input value={onboardData.number} onChange={e=>setOnboardData(p=>({...p,number:e.target.value}))} placeholder="z.B. P1-235109" style={{background:"transparent",border:"none",fontSize:14,color:"#f0f4ff",width:"100%",outline:"none"}}/>
            </div>
          </div>
          <button onClick={()=>onboardData.name.trim()?setOnboardStep(2):null} style={{width:"100%",padding:"16px",borderRadius:14,fontWeight:800,fontSize:16,background:onboardData.name.trim()?"linear-gradient(135deg,#6366f1,#a855f7)":"#2d3548",color:"#fff",border:"none",marginTop:20}}>Weiter →</button>
          <button onClick={()=>setOnboardStep(0)} style={{width:"100%",padding:"10px",background:"none",color:"#4b5568",fontSize:13,marginTop:8}}>← Zurück</button>
        </div>}

        {/* STEP 2: PSYCHOLOGIE */}
        {onboardStep===2&&<div style={{width:"100%",maxWidth:400,animation:"fadeIn .5s ease"}}>
          <div style={{color:"#6366f1",fontSize:11,fontWeight:700,letterSpacing:"2px",marginBottom:8}}>SCHRITT 2 VON 3</div>
          <div style={{fontSize:24,fontWeight:800,color:"#f0f4ff",marginBottom:4,letterSpacing:"-0.5px"}}>Ehrlicher Check</div>
          <div style={{fontSize:14,color:"#6b7a9a",marginBottom:28}}>Damit der Coach sofort helfen kann. Niemand sieht das außer dir.</div>
          {[
            {k:"problem",q:"Was ist dein größtes Trading-Problem?",opts:["Overtrading","Revenge Trading","FOMO","SL nicht einhalten","Zu früh aussteigen","Ungeduld"]},
            {k:"challenges",q:"Wie viele Challenges hast du schon verloren?",opts:["Noch keine","1-2","3-5","Mehr als 5"]},
            {k:"after_loss",q:"Was passiert nach einem Verlust?",opts:["Ich höre auf","Ich versuche es zurückzuholen","Ich mache Pause","Ich trade normal weiter"]},
            {k:"discipline",q:"Wie diszipliniert befolgst du deine Regeln?",opts:["Immer","Meistens","Manchmal","Selten"]},
          ].map(q=>(
            <div key={q.k} style={{marginBottom:20}}>
              <div style={{color:"#f0f4ff",fontSize:14,fontWeight:600,marginBottom:10}}>{q.q}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {q.opts.map(o=>(
                  <button key={o} onClick={()=>setOnboardData(p=>({...p,psychAnswers:{...p.psychAnswers,[q.k]:o}}))}
                    style={{padding:"8px 14px",borderRadius:20,fontSize:12,fontWeight:600,
                      background:onboardData.psychAnswers[q.k]===o?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.04)",
                      border:"1px solid "+(onboardData.psychAnswers[q.k]===o?"#6366f1":"rgba(255,255,255,0.1)"),
                      color:onboardData.psychAnswers[q.k]===o?"#a5b4fc":"#6b7a9a"}}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={()=>Object.keys(onboardData.psychAnswers).length>=4?setOnboardStep(3):null}
            style={{width:"100%",padding:"16px",borderRadius:14,fontWeight:800,fontSize:16,
              background:Object.keys(onboardData.psychAnswers).length>=4?"linear-gradient(135deg,#6366f1,#a855f7)":"#2d3548",
              color:"#fff",border:"none",marginTop:8}}>
            {Object.keys(onboardData.psychAnswers).length>=4?"Weiter →":"Alle Fragen beantworten ("+Object.keys(onboardData.psychAnswers).length+"/4)"}
          </button>
          <button onClick={()=>setOnboardStep(1)} style={{width:"100%",padding:"10px",background:"none",color:"#4b5568",fontSize:13,marginTop:8}}>← Zurück</button>
        </div>}

        {/* STEP 3: FERTIG */}
        {onboardStep===3&&<div style={{width:"100%",maxWidth:400,textAlign:"center",animation:"fadeIn .5s ease"}}>
          <div style={{color:"#6366f1",fontSize:11,fontWeight:700,letterSpacing:"2px",marginBottom:8}}>SCHRITT 3 VON 3</div>
          <div style={{fontSize:28,fontWeight:800,color:"#f0f4ff",marginBottom:8}}>Alles bereit!</div>
          <div style={{fontSize:14,color:"#6b7a9a",marginBottom:32,lineHeight:1.6}}>Dein Coach kennt jetzt dein Profil und deine Schwächen. Er wird dir von Anfang an gezielt helfen.</div>
          <div style={{background:"#141e35",borderRadius:14,padding:20,marginBottom:24,textAlign:"left",border:"1px solid rgba(99,102,241,0.2)"}}>
            <div style={{color:"#6366f1",fontSize:11,fontWeight:700,marginBottom:12}}>DEIN PROFIL</div>
            {[
              ["Name",onboardData.name],
              ["Firm",onboardData.firm==="Andere"?onboardData.firmOther:onboardData.firm],
              ["Konto","$"+(onboardData.size/1000).toFixed(0)+"k"],
              ["Hauptproblem",onboardData.psychAnswers.problem||"-"],
              ["Nach Verlust",onboardData.psychAnswers.after_loss||"-"],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #2d3548",fontSize:13}}>
                <span style={{color:"#6b7a9a"}}>{k}</span>
                <span style={{color:"#f0f4ff",fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={completeOnboarding} style={{width:"100%",padding:"16px",borderRadius:14,fontWeight:800,fontSize:16,background:"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",border:"none",marginBottom:12}}>MindRisk starten 🚀</button>
          <button onClick={()=>setOnboardStep(2)} style={{width:"100%",padding:"10px",background:"none",color:"#4b5568",fontSize:13}}>← Zurück</button>
        </div>}

        {/* Progress dots */}
        {onboardStep>0&&<div style={{position:"fixed",bottom:32,display:"flex",gap:8}}>
          {[1,2,3].map(s=>(
            <div key={s} style={{width:s===onboardStep?24:8,height:8,borderRadius:4,background:s<=onboardStep?"#6366f1":"#2d3548",transition:"all .3s"}}/>
          ))}
        </div>}
      </div>}

            {showSplash&&<div style={{position:"fixed",inset:0,zIndex:9999,background:"radial-gradient(circle at center,#1a1f2e 0%,#0f1117 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"fadeOut 0.4s ease 1.4s forwards"}}>
        <div style={{fontSize:42,fontWeight:900,letterSpacing:"-2px",marginBottom:8}}><span style={{color:B}}>Mind</span><span style={{color:"#f0f4ff"}}>Risk</span></div>
        <div style={{fontSize:11,color:"#8b96b0",letterSpacing:"3px",marginBottom:32}}>TRADING JOURNAL</div>
        <div style={{width:48,height:48,borderRadius:"50%",border:"3px solid #2d3548",borderTopColor:B,animation:"spin 0.8s linear infinite"}}/>
      </div>}

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{overflow-x:hidden;max-width:100%}
        input,select,textarea{max-width:100%;box-sizing:border-box;background:#0f1117;color:#e2e8f0;border:1px solid #2d3548;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:14px;outline:none;width:100%}
        input:focus,select:focus,textarea:focus{border-color:#6366f1}
        select option{background:#1a1f2e}
        button{cursor:pointer;font-family:inherit;border:none;border-radius:8px}
        .mr-content{padding:16px 16px 20px;max-width:520px;margin:0 auto}
        .mr-nav{max-width:520px;margin:0 auto}
        @media(min-width:800px){
          .mr-content{max-width:100%;padding:20px 32px 30px}
          .mr-nav{max-width:960px}
        }
        @keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}@keyframes livingOrb{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}@keyframes orbGlow{0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.55),0 0 40px rgba(168,85,247,0.35),0 0 70px rgba(99,102,241,0.15)}50%{box-shadow:0 0 30px rgba(99,102,241,0.85),0 0 65px rgba(168,85,247,0.55),0 0 100px rgba(99,102,241,0.3)}}@keyframes orbRing1{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.5);opacity:0}}@keyframes orbRing2{0%{transform:scale(1);opacity:0.6}100%{transform:scale(3);opacity:0}}@keyframes orbRing3{0%{transform:scale(1);opacity:0.4}100%{transform:scale(3.8);opacity:0}}@keyframes orbSpin{to{transform:rotate(360deg)}}@keyframes orbCore{0%,100%{opacity:0.55;transform:translate(-50%,-50%) scale(0.85)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}}@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}@keyframes orbGlow{0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.5),0 0 40px rgba(168,85,247,0.3),0 0 60px rgba(99,102,241,0.15)}50%{box-shadow:0 0 30px rgba(99,102,241,0.8),0 0 60px rgba(168,85,247,0.5),0 0 90px rgba(99,102,241,0.25)}}@keyframes orbSpin{to{transform:rotate(360deg)}}@keyframes orbCore{0%,100%{opacity:0.6;transform:translate(-50%,-50%) scale(0.8)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes fadeOut{to{opacity:0;visibility:hidden}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.5)}50%{box-shadow:0 0 0 12px rgba(99,102,241,0)}}
        @keyframes orb{0%,100%{transform:scale(1);box-shadow:0 0 20px rgba(99,102,241,0.6),0 0 40px rgba(168,85,247,0.3)}50%{transform:scale(1.05);box-shadow:0 0 30px rgba(99,102,241,0.9),0 0 60px rgba(168,85,247,0.5)}}
        @keyframes ring{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes watchDots{
          0%,100%{box-shadow:0 -5px 0 1.5px rgba(99,102,241,0.7),3.5px -3.5px 0 1.5px rgba(99,102,241,0.6),5px 0 0 1.5px rgba(99,102,241,0.5),3.5px 3.5px 0 1.5px rgba(99,102,241,0.6),0 5px 0 1.5px rgba(99,102,241,0.7),-3.5px 3.5px 0 1.5px rgba(99,102,241,0.6),-5px 0 0 1.5px rgba(99,102,241,0.5),-3.5px -3.5px 0 1.5px rgba(99,102,241,0.6)}
          50%{box-shadow:0 -8px 0 2px rgba(99,102,241,1),5.6px -5.6px 0 2px rgba(99,102,241,0.9),8px 0 0 2px rgba(99,102,241,0.8),5.6px 5.6px 0 2px rgba(99,102,241,0.9),0 8px 0 2px rgba(99,102,241,1),-5.6px 5.6px 0 2px rgba(99,102,241,0.9),-8px 0 0 2px rgba(99,102,241,0.8),-5.6px -5.6px 0 2px rgba(99,102,241,0.9)}
        }
        @keyframes watchDotsPurple{
          0%,100%{box-shadow:0 -5px 0 1.5px rgba(168,85,247,0.7),3.5px -3.5px 0 1.5px rgba(168,85,247,0.6),5px 0 0 1.5px rgba(168,85,247,0.5),3.5px 3.5px 0 1.5px rgba(168,85,247,0.6),0 5px 0 1.5px rgba(168,85,247,0.7),-3.5px 3.5px 0 1.5px rgba(168,85,247,0.6),-5px 0 0 1.5px rgba(168,85,247,0.5),-3.5px -3.5px 0 1.5px rgba(168,85,247,0.6)}
          50%{box-shadow:0 -8px 0 2px rgba(168,85,247,1),5.6px -5.6px 0 2px rgba(168,85,247,0.9),8px 0 0 2px rgba(168,85,247,0.8),5.6px 5.6px 0 2px rgba(168,85,247,0.9),0 8px 0 2px rgba(168,85,247,1),-5.6px 5.6px 0 2px rgba(168,85,247,0.9),-8px 0 0 2px rgba(168,85,247,0.8),-5.6px -5.6px 0 2px rgba(168,85,247,0.9)}
        }
        @media(min-width:768px){
          .mr-content{max-width:900px;padding:20px 24px 30px}
          .mr-nav{max-width:900px}
          .mr-header{max-width:900px;margin:0 auto}
          .mr-desktop-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
          .mr-desktop-full{grid-column:1/-1}
          .mr-desktop-sidebar{display:grid;grid-template-columns:340px 1fr;gap:16px;align-items:start}
        }
      `}</style>

      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,background:"#161b22",border:"1px solid "+G,color:G,padding:"10px 20px",borderRadius:10,fontWeight:600,fontSize:13,boxShadow:"0 8px 32px #0008",whiteSpace:"nowrap"}}>{toast}</div>}

      {delId&&<div style={{position:"fixed",inset:0,zIndex:998,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Card style={{width:280,textAlign:"center",border:"1px solid "+R}}>
          <div style={{color:R,fontWeight:700,marginBottom:16,fontSize:16}}>Trade loeschen?</div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button style={{background:R+"33",color:R,border:"1px solid "+R,padding:"8px 20px",fontWeight:600}} onClick={()=>{setTrades(p=>p.filter(t=>t.id!==delId));setDelId(null);showToast("Geloescht");}}>Ja</button>
            <button style={{background:"#21262d",color:"#8b949e",padding:"8px 16px"}} onClick={()=>setDelId(null)}>Nein</button>
          </div>
        </Card>
      </div>}

      {/* HEADER */}
      <div style={{background:"linear-gradient(180deg,#0f1830 0%,#0b1422 100%)",borderBottom:"1px solid #2d3548",padding:isDesktop?"16px 32px 14px":"14px 18px 12px",width:"100%",boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:30,letterSpacing:"-1.5px",lineHeight:1}}><span style={{color:B}}>Mind</span><span style={{color:"#f0f4ff"}}>Risk</span></div>
            <div style={{color:"#f0f4ff",fontSize:12,fontWeight:700,marginTop:3}}>{acct.name||"Trader"} <span style={{color:"#6b7a9a",fontSize:10,fontWeight:400}}>{acct.number?("· "+acct.number):""}</span></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:10}}>
              {(()=>{
                const tokyoH=new Date(nowD.toLocaleString("en-US",{timeZone:"Asia/Tokyo"})).getHours();
                const tokyoTime=nowD.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"});
                const tokyoOpen=tokyoH>=9&&tokyoH<15;
                const myH=new Date().getHours();const myM=new Date().getMinutes();
                const myWindow=(myH===16&&myM>=15)||(myH===17&&myM<=30);
                return(
                  <div style={{display:"flex",flexDirection:"column",gap:isDesktop?6:3,alignItems:"flex-end"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:"#6b7a9a",fontSize:isDesktop?11:8,fontWeight:isDesktop?600:400}}>{isDesktop?"London":"LON"}</span>
                      <span style={{color:lonOpen?G:"#6b7a9a",fontWeight:700,fontSize:isDesktop?13:10}}>{lonTime}</span>
                      <div style={{width:isDesktop?8:6,height:isDesktop?8:6,borderRadius:"50%",background:lonOpen?G:"#4a5568",boxShadow:lonOpen?"0 0 6px "+G:"none"}}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:"#6b7a9a",fontSize:isDesktop?11:8,fontWeight:isDesktop?600:400}}>{isDesktop?"Chicago":"CHI"}</span>
                      <span style={{color:myWindow?G:chiOpen?Y:"#6b7a9a",fontWeight:700,fontSize:isDesktop?13:10}}>{chiTime}</span>
                      <div style={{width:isDesktop?8:6,height:isDesktop?8:6,borderRadius:"50%",background:myWindow?G:chiOpen?Y:"#4a5568",boxShadow:myWindow?"0 0 6px "+G:chiOpen?"0 0 6px "+Y:"none"}}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:"#6b7a9a",fontSize:isDesktop?11:8,fontWeight:isDesktop?600:400}}>{isDesktop?"Tokyo":"TYO"}</span>
                      <span style={{color:tokyoOpen?G:"#6b7a9a",fontWeight:700,fontSize:isDesktop?13:10}}>{tokyoTime}</span>
                      <div style={{width:isDesktop?8:6,height:isDesktop?8:6,borderRadius:"50%",background:tokyoOpen?G:"#4a5568",boxShadow:tokyoOpen?"0 0 6px "+G:"none"}}/>
                    </div>
                  </div>
                );
              })()}
            </div>
            <button onClick={()=>setSettingsOpen(true)} style={{background:"linear-gradient(135deg,#6366f1,#a855f7)",borderRadius:12,width:40,height:40,padding:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,flexShrink:0}}>☰</button>
          </div>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"nowrap",overflowX:"auto",paddingBottom:2}}>
          <Pill bg={todPnl>=0?G+"22":R+"22"} color={pc(todPnl)}>P&L {fs(todPnl)}</Pill>
          {inPause?<Pill bg={Y+"33"} color={Y}>⏸ {pStr}</Pill>:<Pill bg={tradesLeft>0&&!todayBlocked&&!atLimit?G+"22":R+"22"} color={tradesLeft>0&&!todayBlocked&&!atLimit?G:R}>{todayBlocked?"🚫 GESPERRT":overtradingToday?"🚫 OVERTRADE":atLimit?"🛑 LIMIT":tradesLeft+"T übrig"}</Pill>}
          <Pill bg={sc(disc)+"22"} color={sc(disc)}>RQ {disc}%</Pill>
        </div>
      </div>

      {inPause&&<div style={{position:"sticky",top:0,zIndex:90,background:"linear-gradient(135deg,#f59e0b,#ef4444)",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:18}}>⏸</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:13,color:"#fff"}}>PFLICHTPAUSE – {pStr}</div>
          <div style={{fontSize:10,color:"#fef3c7"}}>Kein Impuls-Trade! Warte den Timer ab.</div>
        </div>
      </div>}

      <div style={{padding:isDesktop?"20px 28px 30px":"16px 16px 20px",width:"100%",boxSizing:"border-box",maxWidth:"100%"}}>

        {/* DASHBOARD */}
        {tab==="dash"&&<div style={{display:"flex",flexDirection:"column",gap:12,width:"100%"}}>
          {dailyDDHit&&<div style={{background:"rgba(239,68,68,0.15)",border:"2px solid rgba(239,68,68,0.6)",borderRadius:14,padding:"14px 16px",display:"flex",gap:12,alignItems:"center",gridColumn:isDesktop?"1/-1":"auto"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M4.93 4.93l14.14 14.14"/></svg>
            <div><div style={{color:"#fca5a5",fontWeight:800,fontSize:14}}>Daily DD erreicht! -${Math.round(dailyLoss)} / $1.000 Limit</div><div style={{color:"#fca5a5",fontSize:11}}>Für heute KEIN weiterer Trade. Rechner aus, Coach fragen.</div></div>
          </div>}
          {!dailyDDHit&&todayBlocked&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:14,padding:"14px 16px",display:"flex",gap:12,alignItems:"center",gridColumn:isDesktop?"1/-1":"auto"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            <div><div style={{color:R,fontWeight:700,fontSize:13}}>Heute gesperrt (Overtrading gestern)</div><div style={{color:"#fca5a5",fontSize:11}}>Morgen wieder. Heute: analysieren.</div></div>
          </div>}
          {overtradingToday&&!todayBlocked&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:14,padding:"14px 16px",display:"flex",gap:12,alignItems:"center"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            <div><div style={{color:R,fontWeight:700,fontSize:13}}>3 Trades – Morgen gesperrt!</div><div style={{color:"#fca5a5",fontSize:11}}>Rechner aus.</div></div>
          </div>}
          {atLimit&&!overtradingToday&&!todayBlocked&&<div style={{background:O+"22",border:"1px solid "+O,borderRadius:10,padding:"10px 14px",display:"flex",gap:10,alignItems:"center"}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M4.93 4.93l14.14 14.14"/></svg><div><div style={{color:O,fontWeight:800}}>2 Trades – Tageslimit!</div><div style={{color:"#fdba74",fontSize:11}}>Kein 3. Trade!</div></div>
          </div>}
          {inPause&&<div style={{background:"linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.08))",border:"2px solid rgba(245,158,11,0.6)",borderRadius:14,padding:"16px 18px",display:"flex",gap:14,alignItems:"center",animation:"glowPulse 2s ease infinite"}}>
            <span style={{fontSize:24}}>⏸</span>
            <div style={{flex:1}}>
              <div style={{color:Y,fontWeight:700,fontSize:13,marginBottom:4}}>Pflichtpause</div>
              <div style={{color:Y,fontWeight:800,fontSize:36,lineHeight:1}}>{pStr}</div>
              <div style={{color:"#fbbf24",fontSize:11,marginTop:5}}>Kein Impuls-Trade – warte den Timer ab</div>
            </div>
          </div>}

          <Card style={{borderColor:B+"44"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{color:"#8b96b0",fontSize:isDesktop?12:10,fontWeight:600,letterSpacing:1,marginBottom:3}}>KONTO 09</div>
                <div style={{color:pc(netPnl),fontWeight:800,fontSize:isDesktop?52:28}}>{netPnl>=0?"+":"-"}${Math.round(Math.abs(netPnl)).toLocaleString()}</div>
                <div style={{color:"#8b96b0",fontSize:isDesktop?13:10,marginTop:1}}>Saldo: ${Math.round(saldo).toLocaleString()}</div>
              </div>
              <div style={{background:"#0d1320",borderRadius:8,padding:"8px 12px",textAlign:"right"}}>
                <div style={{color:"#8b96b0",fontSize:9,marginBottom:1}}>HEUTE</div>
                <div style={{color:pc(todPnl),fontWeight:800,fontSize:isDesktop?22:16}}>{fs(todPnl)}</div>
                <div style={{color:tradeCount>=OVERTRADING_AT?R:tradeCount>=DAILY_LIMIT?O:"#8b96b0",fontSize:9,marginTop:1,fontWeight:tradeCount>=DAILY_LIMIT?700:400}}>{tradeCount}/{DAILY_LIMIT} Trades{tradeCount>=OVERTRADING_AT?" !":""}</div>
              </div>
            </div>
            {(()=>{
              // TTP EOD Trailing DD: DD folgt Saldo nach oben bis DD=$50k (bei Saldo=$52k) -> dann eingefroren
              const ddInitial=acct.size-acct.maxDD;        // $48.000 - Startlevel DD
              const ddLockAt=acct.size;                    // $50.000 - DD friert hier ein
              const profitStart=acct.size+acct.maxDD;      // $52.000 - ab hier reiner Profit
              const currentDD=Math.min(saldo-acct.maxDD,ddLockAt); // aktueller DD-Level (trailing bis Lock)
              const ddAbstand=Math.max(0,saldo-currentDD); // Abstand vom aktuellen DD
              const isLocked=saldo>=profitStart;           // DD eingefroren?
              const profit=Math.max(0,saldo-profitStart);  // Gewinn über $52k
              const totalRange=acct.target-ddInitial;      // $48k→$54k = $6k Gesamtrange
              const markerPct=Math.min(99,Math.max(1,(saldo-ddInitial)/totalRange*100));
              const lockLinePct=(ddLockAt-ddInitial)/totalRange*100;   // wo $50k liegt = 33%
              const profitLinePct=(profitStart-ddInitial)/totalRange*100; // wo $52k liegt = 66%
              const ddColor=ddAbstand<500?R:ddAbstand<1000?Y:G;
              return(
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#6b7a9a",fontSize:9,fontWeight:700,letterSpacing:"0.5px"}}>{acct.broker||"Prop Firm"} EOD TRAILING DD</span>
                    <span style={{color:isLocked?G:Y,fontSize:9,fontWeight:700}}>{isLocked?"⊠ DD eingefroren $"+ddLockAt.toLocaleString():"⚠️ DD läuft mit"}</span>
                  </div>
                  <div style={{position:"relative",height:12,borderRadius:6,overflow:"hidden",marginBottom:4,background:"rgba(255,255,255,0.05)"}}>
                    <div style={{position:"absolute",left:0,width:markerPct+"%",height:"100%",borderRadius:6,background:ddAbstand<500?"linear-gradient(90deg,#ef4444,#dc2626)":ddAbstand<1000?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#6366f1,#a855f7)",transition:"width .6s ease",boxShadow:ddAbstand<500?"0 0 12px rgba(239,68,68,0.5)":ddAbstand<1000?"0 0 12px rgba(245,158,11,0.4)":"0 0 12px rgba(99,102,241,0.3)"}}/>
                    <div style={{position:"absolute",left:lockLinePct+"%",top:0,bottom:0,width:1,background:"rgba(255,255,255,0.15)"}}/>
                    <div style={{position:"absolute",left:profitLinePct+"%",top:0,bottom:0,width:1,background:"rgba(255,255,255,0.15)"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#6b7a9a",marginBottom:6}}>
                    <span style={{color:R,fontSize:12,fontWeight:700}}>${ddInitial.toLocaleString()}<br/>Max DD</span>
                    <span style={{color:Y,textAlign:"center",fontSize:12,fontWeight:700}}>${ddLockAt.toLocaleString()}<br/>DD Lock</span>
                    <span style={{color:G,textAlign:"center",fontSize:12,fontWeight:700}}>${profitStart.toLocaleString()}<br/>Profit</span>
                    <span style={{textAlign:"right",fontSize:12,color:"#8b96b0",fontWeight:600}}>${acct.target.toLocaleString()}<br/>Ziel</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:ddColor,fontSize:9,fontWeight:700}}>Abstand: ${Math.round(ddAbstand).toLocaleString()}</span>
                    <span style={{color:profit>0?G:"#6b7a9a",fontSize:9,fontWeight:700}}>{profit>0?"Profit: +$"+Math.round(profit).toLocaleString():"Noch $"+(profitStart-saldo).toLocaleString()+" bis Profit"}</span>
                  </div>
                </div>
              );
            })()}
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{color:"#8b96b0",fontSize:10}}>Disziplin</span>
                <span style={{color:sc(disc),fontWeight:700}}>{disc}% / {goals.disc}% Ziel</span>
              </div>
              <Bar2 pct={Math.min(100,disc/goals.disc*100)} color={sc(disc)}/>
            </div>
            <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #2d3548",display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
              <div style={{background:"#0d1320",borderRadius:8,padding:"7px 8px",textAlign:"center",flex:1}}>
                <div style={{color:"#6b7a9a",fontSize:8,marginBottom:2}}>MONAT P&L</div>
                <div style={{color:pc(monthPnl),fontWeight:800,fontSize:14}}>{fs(monthPnl)}</div>
                <div style={{color:"#4a5568",fontSize:8}}>diesen Monat</div>
              </div>
              <div style={{background:"#0d1320",borderRadius:8,padding:"7px 8px",textAlign:"center",flex:1}}>
                <div style={{color:"#6b7a9a",fontSize:8,marginBottom:2}}>WIN RATE</div>
                <div style={{color:(t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0)>=50?G:R,fontWeight:800,fontSize:14}}>{t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0}%</div>
                <div style={{color:"#4a5568",fontSize:8}}>{t09.length} Trades</div>
              </div>
            </div>
            <div style={{paddingTop:8,borderTop:"1px solid #2d3548",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Field label="SALDO ($)">
                <input type="number" step="0.01" defaultValue={saldo} onBlur={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)){setSaldo(v);localStorage.setItem("ttp_saldo",v);}}} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:14,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
              </Field>
              <Field label="MAX DD ($)">
                <input type="number" step="0.01" defaultValue={maxDDLevel} onBlur={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)){setMaxDDLevel(v);localStorage.setItem("ttp_maxdd_level",v);}}} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:14,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
              </Field>
            </div>
          </Card>

          
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {[{l:"TRADES",v:tradeCount+"/"+DAILY_LIMIT,c:tradesLeft>0?G:R},{l:"MONAT P&L",v:fs(monthPnl),c:pc(monthPnl)},{l:"WIN RATE",v:(t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0)+"%",c:(t09.length?Math.round(t09.filter(t=>t.pnl>0).length/t09.length*100):0)>=50?G:R},{l:"DD ABSTAND",v:"$"+Math.round(kontoabstand),c:kontoabstand<1000?Y:G}].map(s=>(
              <div key={s.l} style={{background:"#131d30",border:"1px solid #2d3548",borderRadius:10,padding:10,textAlign:"center"}}>
                <div style={{color:"#8b96b0",fontSize:9,marginBottom:3}}>{s.l}</div>
                <div style={{color:s.c,fontWeight:800,fontSize:isDesktop?20:14}}>{s.v}</div>
              </div>
            ))}
          </div>


          <Card style={{breakInside:"avoid",height:isDesktop?"auto":"auto"}}>
            <div style={{fontWeight:isDesktop?800:700,marginBottom:isDesktop?14:10,fontSize:isDesktop?18:15}}>{now.toLocaleString("de-DE",{month:"long",year:"numeric"})}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:5}}>
              {["Mo","Di","Mi","Do","Fr","Sa","So"].map(d=><div key={d} style={{textAlign:"center",color:"#8b96b0",fontSize:isDesktop?13:10,fontWeight:700,marginBottom:isDesktop?4:0}}>{d}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:isDesktop?6:3}}>{renderCal()}</div>
          </Card>


          {/* WZP – WOCHENPLAN */}
          {wzpCalc&&(()=>{
            const wz=wzpCalc;
            // If Claude data available, merge it (Claude overrides local calc)
            const cd=wzpData;
            const ampelSrc=cd?cd.ampel:wz.ampel;
            const ampelColor=ampelSrc==='green'?G:ampelSrc==='yellow'?Y:R;
            const ampelBg=ampelSrc==='green'?'rgba(0,211,149,0.08)':ampelSrc==='yellow'?'rgba(245,158,11,0.08)':'rgba(239,68,68,0.08)';
            const ampelEmoji=ampelSrc==='green'?'🟢':ampelSrc==='yellow'?'🟡':'🔴';
            return(
              <Card style={{borderColor:ampelColor+'44',background:'linear-gradient(135deg,#0d1020,#0f1117)'}} onClick={()=>setWzpExp(p=>!p)}>
                {/* HEADER */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:12,height:12,borderRadius:'50%',background:ampelColor,flexShrink:0,animation:'pulse 2s infinite',boxShadow:'0 0 8px '+ampelColor}}/>
                    <div>
                      <div style={{fontWeight:800,fontSize:15,color:'#f0f4ff'}}>Wochenplan</div>
                      <div style={{color:B,fontSize:9,fontWeight:600,letterSpacing:'0.5px'}}>WZP · {(wz.accountType==='challenge'?'CHALLENGE':(wz.accountType==='pa'?'PERFORMANCE':'EIGENKAPITAL'))} · {wz.ddType==='eod'?'EOD DD':'TRAILING DD'}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{fontSize:18}}>{ampelEmoji}</div>
                    <button onClick={e=>{e.stopPropagation();wzpAnalyze();}}
                      style={{background:wzpLoading?'rgba(99,102,241,0.1)':'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))',border:'1px solid rgba(99,102,241,0.4)',borderRadius:8,padding:'5px 9px',color:wzpLoading?'#6b7a9a':'#a5b4fc',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>
                      {wzpLoading?<><span style={{animation:'spin 1s linear infinite',display:'inline-block'}}>⟳</span> Lädt...</>:<>🤖 KI</>}
                    </button>
                    {!isDesktop&&<span onClick={e=>{e.stopPropagation();setWzpExp(p=>!p);}} style={{color:B,fontSize:11,fontWeight:600}}>{wzpExp?'▲':'▼'}</span>}
                  </div>
                </div>
                {cd&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div style={{color:'#6b7a9a',fontSize:9}}>🤖 Claude Analyse · {cd.date}</div>
                  <button onClick={e=>{e.stopPropagation();setWzpData(null);localStorage.removeItem('ttp_wzp_data');}} style={{background:'none',color:'#4b5568',fontSize:9,padding:0}}>zurücksetzen</button>
                </div>}

                {/* AMPEL STATUS */}
                <div style={{background:ampelBg,borderRadius:10,padding:'10px 12px',marginBottom:10,border:'1px solid '+ampelColor+'33'}}>
                  <div style={{color:ampelColor,fontWeight:700,fontSize:12}}>{cd?cd.ampelReason:wz.ampelMsg}</div>
                  {cd&&cd.insight&&<div style={{color:'#8b96b0',fontSize:10,marginTop:4,fontStyle:'italic'}}>{cd.insight}</div>}
                </div>

                {/* STATS GRID – immer sichtbar */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,marginBottom:10}}>
                  {[
                    {l:'WOCHE P&L',v:(wz.weekPnl>=0?'+':'')+'$'+wz.weekPnl,c:wz.weekPnl>=0?G:R},
                    {l:'WOCHE WR',v:(cd?cd.winRate:wz.weekWR)+'%',c:(cd?cd.winRate:wz.weekWR)>=50?G:(cd?cd.winRate:wz.weekWR)>=35?Y:R},
                    {l:'ZIEL/TAG',v:'$'+(cd?cd.dailyTarget:wz.dailyNeeded),c:B},
                    {l:'EV/TRADE',v:cd?(cd.evPerTrade>=0?'+':'')+' $'+cd.evPerTrade:'–',c:cd&&cd.evPerTrade>=0?G:R},
                    {l:'AVG WIN',v:cd?'+$'+cd.avgWin:'–',c:G},
                    {l:'AVG LOSS',v:cd?'-$'+cd.avgLoss:'–',c:R},
                  ].map(s=>(
                    <div key={s.l} style={{background:'rgba(0,0,0,0.25)',borderRadius:8,padding:'7px 5px',textAlign:'center',border:'1px solid #1e2030'}}>
                      <div style={{color:'#6b7a9a',fontSize:8,marginBottom:2}}>{s.l}</div>
                      <div style={{color:s.c,fontWeight:800,fontSize:12}}>{s.v}</div>
                    </div>
                  ))}
                </div>

                {/* ADAPTIVES SL/TP & KONTRAKT */}
                {cd&&(
                  <div style={{background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(168,85,247,0.05))',borderRadius:10,padding:'10px 12px',marginBottom:10,border:'1px solid rgba(99,102,241,0.2)'}}>
                    <div style={{color:B,fontSize:10,fontWeight:700,marginBottom:6}}>📐 KI-Empfehlung (adaptiv aus deinen Trades)</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                      {[
                        {l:'KONTRAKTE',v:cd.recContracts+'x '+cd.recSymbol,c:'#f0f4ff'},
                        {l:'SL (adaptiv)',v:cd.adaptiveSL+'T → $'+(Math.round(cd.adaptiveSL*(INSTRUMENTS[cd.recSymbol]||INSTRUMENTS['MNQ']).tickValue*cd.recContracts)),c:R},
                        {l:'TP (adaptiv)',v:cd.adaptiveTP+'T → $'+(Math.round(cd.adaptiveTP*(INSTRUMENTS[cd.recSymbol]||INSTRUMENTS['MNQ']).tickValue*cd.recContracts)),c:G},
                      ].map(s=>(
                        <div key={s.l} style={{background:'rgba(0,0,0,0.2)',borderRadius:7,padding:'7px 5px',textAlign:'center'}}>
                          <div style={{color:'#6b7a9a',fontSize:8,marginBottom:2}}>{s.l}</div>
                          <div style={{color:s.c,fontWeight:800,fontSize:11}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* WOCHENFORTSCHRITT BAR */}
                <div style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{color:'#8b96b0',fontSize:10}}>Wochenfortschritt</span>
                    <span style={{color:ampelColor,fontWeight:700,fontSize:10}}>{wz.weeklyPct}%</span>
                  </div>
                  <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,0.05)',overflow:'hidden'}}>
                    <div style={{height:'100%',width:wz.weeklyPct+'%',background:'linear-gradient(90deg,'+ampelColor+','+ampelColor+'aa)',borderRadius:3,transition:'width .5s'}}/>
                  </div>
                </div>

                {/* CHALLENGE / PA PROGRESS */}
                {wz.accountType==='challenge'&&(
                  <div style={{background:'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(168,85,247,0.06))',borderRadius:10,padding:'10px 12px',marginBottom:10,border:'1px solid rgba(99,102,241,0.2)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <span style={{color:'#8b96b0',fontSize:10,fontWeight:700}}>CHALLENGE FORTSCHRITT</span>
                      <span style={{color:wz.profitNeeded<=0?G:Y,fontWeight:800,fontSize:12}}>{wz.profitNeeded<=0?'✅ ERREICHT!':'$'+wz.profitSoFar+' / $'+wz.profitTarget}</span>
                    </div>
                    <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,0.05)',overflow:'hidden',marginBottom:6}}>
                      <div style={{height:'100%',width:Math.min(100,Math.round(wz.profitSoFar/Math.max(1,wz.profitTarget)*100))+'%',background:'linear-gradient(90deg,'+G+',#00a871)',borderRadius:3,transition:'width .5s'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#6b7a9a'}}>
                      <span>Noch: <span style={{color:wz.profitNeeded<=0?G:R,fontWeight:700}}>${wz.profitNeeded}</span></span>
                      <span>Tägl. nötig: <span style={{color:wz.dailyNeeded<100?G:wz.dailyNeeded<200?Y:R,fontWeight:700}}>${wz.dailyNeeded}</span></span>
                      <span>Tage: <span style={{color:wz.challengeDaysLeft>5?G:Y,fontWeight:700}}>{wz.challengeDaysLeft}d</span></span>
                    </div>
                  </div>
                )}

                {/* TOP-3 EMPFEHLUNGEN – aufklappbar */}
                {(wzpExp||isDesktop)&&(
                  <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4}}>
                    <div style={{color:'#8b96b0',fontSize:10,fontWeight:700,marginBottom:2}}>{cd?'🤖 KI TOP-EMPFEHLUNGEN':'TOP EMPFEHLUNGEN (lokal)'}</div>
                    {(cd?cd.recs:wz.recs).map((rec,i)=>(
                      <div key={i} style={{background:'rgba(0,0,0,0.2)',borderRadius:10,padding:'10px 12px',border:'1px solid '+(cd?'rgba(99,102,241,0.2)':'#1e2030')}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                          <span style={{fontSize:14}}>{rec.icon}</span>
                          <span style={{color:'#f0f4ff',fontWeight:700,fontSize:11}}>{rec.title}</span>
                        </div>
                        <div style={{color:'#8b96b0',fontSize:10,lineHeight:1.5}}>{rec.text}</div>
                      </div>
                    ))}
                    {/* DD DETAIL */}
                    <div style={{background:'rgba(0,0,0,0.2)',borderRadius:10,padding:'10px 12px',border:'1px solid '+(wz.ddPct>50?R+'44':'#1e2030')}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                        <span style={{color:'#8b96b0',fontSize:10,fontWeight:700}}>MAX DD</span>
                        <span style={{color:wz.ddPct>50?R:wz.ddPct>25?Y:G,fontWeight:800,fontSize:11}}>{wz.ddPct}% verbraucht</span>
                      </div>
                      <div style={{height:5,borderRadius:3,background:'rgba(255,255,255,0.05)',overflow:'hidden',marginBottom:4}}>
                        <div style={{height:'100%',width:wz.ddPct+'%',background:wz.ddPct>50?R:wz.ddPct>25?Y:G,borderRadius:3}}/>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#6b7a9a'}}>
                        <span>Verbraucht: <span style={{color:'#f0f4ff',fontWeight:700}}>${wz.ddUsed}</span></span>
                        <span>Tages-DD: <span style={{color:wz.dailyDDPct>50?R:G,fontWeight:700}}>{wz.dailyDDPct}%</span></span>
                        <span style={{color:wz.ddType==='eod'?G:Y,fontWeight:700}}>{wz.ddType==='eod'?'EOD':'TRAILING'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })()}
