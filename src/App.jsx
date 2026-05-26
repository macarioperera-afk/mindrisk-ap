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

const SETUPS=["Heatmap Correlation SP","Break & Retest","VWAP Bounce","Opening Range Break","Momentum Scalp","Support/Resistance"];
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
  <div onClick={onClick} style={{background:"linear-gradient(145deg,#1a2540 0%,#141e32 100%)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:14,padding:16,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.05)",...style}}>{children}</div>
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
  <div style={{background:"#111725",borderRadius:10,padding:"10px 12px",border:"1px solid #2d3548"}}>
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
  const[onboardData,setOnboardData]=useState({name:'',firm:'TTP',firmOther:'',size:50000,maxDD:2000,dailyDD:1000,target:54000,number:'',psychAnswers:{}});
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
      lotSize:1
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
      type:'challenge',broker:'',number:'',name:'',
      size:50000,maxDD:2000,dailyDD:1000,target:54000,targetDays:30,lotSize:1
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
    const dataSet=t09.length>=2?t09:allT09; // Use challenge trades, fall back to all
    if(dataSet.length<2)return null;
    const wins=t09.filter(t=>t.pnl>0),losses=t09.filter(t=>t.pnl<=0);
    const wr=wins.length/t09.length;
    const ls=acct.lotSize||1;const avgW=wins.length?wins.reduce((s,t)=>s+t.pnl,0)/wins.length:0;
    const avgL=losses.length?Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length):1;
    const rr=avgW/avgL;
    const m={};t09.forEach(t=>{m[t.date]=(m[t.date]||0)+1;});
    const dailyEV=Math.round(2*(wr*avgW-(1-wr)*avgL));const slAmt=ls*20;const tpAmt=ls*40;
    const monthlyEV=Math.round(dailyEV*22);
    return{wr:Math.round(wr*100),rr:rr.toFixed(1),neededWR:Math.round(100/(1+rr)),
      dailyEV,monthlyEV,avgW:Math.round(avgW),avgL:Math.round(avgL),
      overtradeDays:Object.values(m).filter(n=>n>3).length,totalDays:Object.keys(m).length};
  },[t09,allT09]);

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
    if(msg.includes("hallo")||msg.includes("hi"))return "Hi "+(acct.name||"Trader")+"! \uD83D\uDC4B "+t09.length+" Trades, "+wr+"% WR. Heute: "+todayT.length+"/2 ("+(todPnlV>=0?"+":"")+"$"+todPnlV.toFixed(0)+").";
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

  const importTTPTrades=(raw)=>{  const lines=raw.trim().split('\n').filter(l=>l.trim());
  const parsed=[];
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
    <div style={{background:"#111725",minHeight:"100vh",color:"#f0f4ff",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",fontSize:isDesktop?15:14,paddingBottom:isDesktop?"20px":"calc(70px + env(safe-area-inset-bottom,0px))",width:"100%",overflowX:"hidden",paddingRight:isDesktop?"380px":"0"}}>
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
      <div style={{background:"linear-gradient(180deg,#0f1830 0%,#0b1422 100%)",borderBottom:"1px solid #2d3548",padding:isDesktop?"16px 32px 14px":"14px 18px 12px",width:"100%",boxSizing:"border-box",paddingRight:isDesktop?"400px":"18px"}}>
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
        {tab==="dash"&&<div style={{display:isDesktop?"grid":"flex",gridTemplateColumns:isDesktop?"1fr 380px":"none",flexDirection:"column",gap:16,width:"100%",alignItems:"start"}}>
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
                <div style={{color:"#8b96b0",fontSize:10,fontWeight:600,letterSpacing:1,marginBottom:3}}>KONTO 09</div>
                <div style={{color:pc(netPnl),fontWeight:800,fontSize:isDesktop?52:28}}>{netPnl>=0?"+":"-"}${Math.round(Math.abs(netPnl)).toLocaleString()}</div>
                <div style={{color:"#8b96b0",fontSize:isDesktop?13:10,marginTop:1}}>Saldo: ${Math.round(saldo).toLocaleString()}</div>
              </div>
              <div style={{background:"#111725",borderRadius:8,padding:"8px 12px",textAlign:"right"}}>
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
                    <span style={{color:"#6b7a9a",fontSize:9,fontWeight:700,letterSpacing:"0.5px"}}>TTP EOD TRAILING DD</span>
                    <span style={{color:isLocked?G:Y,fontSize:9,fontWeight:700}}>{isLocked?"⊠ DD eingefroren $"+ddLockAt.toLocaleString():"⚠️ DD läuft mit"}</span>
                  </div>
                  <div style={{position:"relative",height:12,borderRadius:6,overflow:"hidden",marginBottom:4,background:"rgba(255,255,255,0.05)"}}>
                    <div style={{position:"absolute",left:0,width:markerPct+"%",height:"100%",borderRadius:6,background:ddAbstand<500?"linear-gradient(90deg,#ef4444,#dc2626)":ddAbstand<1000?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#6366f1,#a855f7)",transition:"width .6s ease",boxShadow:ddAbstand<500?"0 0 12px rgba(239,68,68,0.5)":ddAbstand<1000?"0 0 12px rgba(245,158,11,0.4)":"0 0 12px rgba(99,102,241,0.3)"}}/>
                    <div style={{position:"absolute",left:lockLinePct+"%",top:0,bottom:0,width:1,background:"rgba(255,255,255,0.15)"}}/>
                    <div style={{position:"absolute",left:profitLinePct+"%",top:0,bottom:0,width:1,background:"rgba(255,255,255,0.15)"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#4b5568",marginBottom:6}}>
                    <span style={{color:R,fontSize:12,fontWeight:700}}>${ddInitial.toLocaleString()}<br/>Max DD</span>
                    <span style={{color:Y,textAlign:"center",fontSize:12,fontWeight:700}}>${ddLockAt.toLocaleString()}<br/>DD Lock</span>
                    <span style={{color:G,textAlign:"center",fontSize:12,fontWeight:700}}>${profitStart.toLocaleString()}<br/>Profit</span>
                    <span style={{textAlign:"right",fontSize:12,fontWeight:600,color:"#8b96b0"}}>${acct.target.toLocaleString()}<br/>Ziel</span>
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
              <div style={{background:"#111725",borderRadius:8,padding:"7px 8px",textAlign:"center",flex:1}}>
                <div style={{color:"#6b7a9a",fontSize:8,marginBottom:2}}>MONAT P&L</div>
                <div style={{color:pc(monthPnl),fontWeight:800,fontSize:14}}>{fs(monthPnl)}</div>
                <div style={{color:"#4a5568",fontSize:8}}>diesen Monat</div>
              </div>
              <div style={{background:"#111725",borderRadius:8,padding:"7px 8px",textAlign:"center",flex:1}}>
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


          <div style={{gridColumn:isDesktop?"2":"auto",gridRow:isDesktop?"1 / 4":"auto",display:"flex",flexDirection:"column",gap:16}}>
          <Card style={{breakInside:"avoid"}}>
            <div style={{fontWeight:isDesktop?800:700,marginBottom:isDesktop?14:10,fontSize:isDesktop?18:15}}>{now.toLocaleString("de-DE",{month:"long",year:"numeric"})}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:5}}>
              {["Mo","Di","Mi","Do","Fr","Sa","So"].map(d=><div key={d} style={{textAlign:"center",color:"#8b96b0",fontSize:isDesktop?13:10,fontWeight:700,marginBottom:isDesktop?4:0}}>{d}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:isDesktop?6:3}}>{renderCal()}</div>
          </Card>

          {/* NEWS WIDGET */}
          <Card style={{borderColor:"rgba(245,158,11,0.2)",background:"linear-gradient(145deg,#1a1f10,#141e32)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:Y,animation:"livingOrb 2s infinite"}}/>
              <div style={{fontWeight:800,fontSize:14,color:"#f0f4ff"}}>Economic Calendar</div>
            </div>
            {weeklyNews.length>0?(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {weeklyNews.slice(0,4).map((ev,i)=>(
                  <div key={i} style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 10px",borderLeft:"3px solid "+Y}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{color:"#f0f4ff",fontSize:12,fontWeight:700}}>{ev.name}</div>
                      <div style={{color:Y,fontSize:11,fontWeight:700,flexShrink:0,marginLeft:8}}>{ev.time} ET</div>
                    </div>
                    <div style={{color:"#6b7a9a",fontSize:10,marginTop:2}}>{ev.date}</div>
                  </div>
                ))}
              </div>
            ):(
              <div style={{color:"#4a5568",fontSize:12,textAlign:"center",padding:"12px 0"}}>Keine HIGH Impact News diese Woche</div>
            )}
          </Card>
          </div>

          {/* WEG ZUR PROFITABILITÄT */}}
          {profitPlan&&<Card style={{borderColor:"#6366f133",background:"linear-gradient(135deg,#111a2e,#141e32)",gridColumn:isDesktop?"1 / -1":"auto"}} onClick={()=>setProfExpanded(p=>!p)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:"#6366f1",flexShrink:0,marginTop:5,marginLeft:5,animation:"watchDots 2.5s ease-in-out infinite",boxShadow:"0 0 4px rgba(99,102,241,0.8)"}}/>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:"#f0f4ff"}}>Weg zur Profitabilität</div>
                  <div style={{color:"#6366f1",fontSize:9,fontWeight:600,letterSpacing:"0.5px"}}>POWERED BY MINDRISK AI</div>
                </div>
              </div>
              {!isDesktop&&<span style={{color:"#6366f1",fontSize:11,fontWeight:600}}>{profExpanded?"▲ schließen":"▼ öffnen"}</span>}
            </div>
            {!profExpanded&&!isDesktop&&profitPlan&&<div style={{display:"flex",gap:8,marginBottom:2}}>
              <div style={{background:"#0d1420",borderRadius:7,padding:"5px 10px",flex:1,textAlign:"center"}}>
                <div style={{color:"#6b7a9a",fontSize:8}}>EV / TAG</div>
                <div style={{color:profitPlan.dailyEV>=0?G:R,fontWeight:800,fontSize:13}}>{profitPlan.dailyEV>=0?"+":""}${profitPlan.dailyEV}</div>
              </div>
              <div style={{background:"#0d1420",borderRadius:7,padding:"5px 10px",flex:1,textAlign:"center"}}>
                <div style={{color:"#6b7a9a",fontSize:8}}>PROGNOSE MONAT</div>
                <div style={{color:profitPlan.monthlyEV>=0?G:R,fontWeight:800,fontSize:13}}>{profitPlan.monthlyEV>=0?"+":""}${profitPlan.monthlyEV}</div>
              </div>
              <div style={{background:"#0d1420",borderRadius:7,padding:"5px 10px",flex:1,textAlign:"center"}}>
                <div style={{color:"#6b7a9a",fontSize:8}}>OVERTRADING</div>
                <div style={{color:profitPlan.overtradeDays>3?R:G,fontWeight:800,fontSize:13}}>{profitPlan.overtradeDays} Tage</div>
              </div>
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
              {[{l:"TREFFERQUOTE",v:profitPlan.wr+"%",c:profitPlan.wr>=50?G:R},
                {l:"DEIN R:R",v:profitPlan.rr+":1",c:parseFloat(profitPlan.rr)>=1?G:Y},
                {l:"BREAK-EVEN WR",v:profitPlan.neededWR+"%",c:profitPlan.wr>=profitPlan.neededWR?G:Y}
              ].map(s=>(
                <div key={s.l} style={{background:"#0d1420",borderRadius:8,padding:"8px 6px",textAlign:"center",border:"1px solid #1e2030"}}>
                  <div style={{color:"#6b7a9a",fontSize:9,marginBottom:2}}>{s.l}</div>
                  <div style={{color:s.c,fontWeight:800,fontSize:16}}>{s.v}</div>
                </div>
              ))}
            </div>
            {(profExpanded||isDesktop)&&(()=>{
              const wr=profitPlan.wr/100;
              const slT=40,tpT=80,slD=20,tpD=40,crv=2;
              const evT=Math.round(wr*tpD-(1-wr)*slD);
              const evD=evT*DAILY_LIMIT;
              const today=new Date();const endM=new Date(today.getFullYear(),today.getMonth()+1,0);
              let dLeft=0;for(let d=new Date(today);d<=endM;d.setDate(d.getDate()+1)){const dw=d.getDay();if(dw!==0&&dw!==6)dLeft++;}
              const projM=Math.round(dLeft*evD);
              const missingNow=Math.max(0,goals.targetBalance-saldo);
              const monateBis=evD>0?Math.ceil(missingNow/(evD*22)):null;
              return(
                <div style={{marginTop:12}}>
                  {profitPlan.overtradeDays>0&&<div style={{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"8px 12px",display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
                    <span style={{fontSize:14}}>⚠️</span>
                    <div style={{color:"#fca5a5",fontSize:11,fontWeight:600}}>{profitPlan.overtradeDays}/{profitPlan.totalDays} Tage Overtrading – Dein #1 Problem</div>
                  </div>}
                  <div style={{background:"#0d1420",borderRadius:10,padding:12,marginBottom:10,border:"1px solid #1e2030"}}>
                    <div style={{color:"#6366f1",fontWeight:700,fontSize:11,marginBottom:8,letterSpacing:"0.5px"}}>SETUP 1 MNQ</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
                      {[{l:"STOP LOSS",v:"40 Ticks",s:"$20",c:R},{l:"TAKE PROFIT",v:"80 Ticks",s:"$40",c:G},{l:"CRV",v:"2:1",s:"Risk/Reward",c:Y}].map(s=>(
                        <div key={s.l} style={{background:"#131d30",borderRadius:7,padding:"8px 6px",textAlign:"center"}}>
                          <div style={{color:"#6b7a9a",fontSize:8,marginBottom:2}}>{s.l}</div>
                          <div style={{color:s.c,fontWeight:800,fontSize:isDesktop?20:14}}>{s.v}</div>
                          <div style={{color:s.c,fontSize:9,opacity:0.7}}>{s.s}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {[
                        {l:"EV / TRADE",v:(evT>=0?"+":"")+"$"+evT,c:evT>=0?G:R,s:"Ø Gewinn pro Trade"},
                        {l:"EV / TAG",v:(evD>=0?"+":"")+"$"+evD,c:evD>=0?G:R,s:"2 Trades · Expected Value"},
                        {l:"PROGNOSE MONAT",v:(projM>=0?"+":"")+"$"+projM,c:projM>=0?G:R,s:dLeft+" Handelstage"},
                        {l:"MONATE BIS ZIEL",v:monateBis?monateBis+"Mo":"∞",c:monateBis&&monateBis<=6?G:Y,s:"bei akt. Performance"},
                        {l:"HANDELSTAGE NOCH",v:dLeft+" Tage",c:dLeft>5?G:dLeft>2?Y:R,s:"bis Monatsende"},
                      ].map(s=>(
                        <div key={s.l} style={{background:"#131d30",borderRadius:7,padding:"8px 10px",border:"1px solid #1e2030"}}>
                          <div style={{color:"#6b7a9a",fontSize:9}}>{s.l}</div>
                          <div style={{color:s.c,fontWeight:800,fontSize:15}}>{s.v}</div>
                          <div style={{color:"#8b96b0",fontSize:9}}>{s.s}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{background:"linear-gradient(135deg,rgba(99,102,241,0.08),rgba(168,85,247,0.05))",borderRadius:10,padding:12,border:"1px solid rgba(99,102,241,0.15)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:B,animation:"pulse 2s infinite"}}/>
                      <div style={{color:B,fontSize:11,fontWeight:700,letterSpacing:"0.5px"}}>MINDRISK AI ANALYSE</div>
                    </div>
                    {[
                      profitPlan.wr<profitPlan.neededWR&&"📊 WR "+profitPlan.wr+"% liegt unter Break-Even "+profitPlan.neededWR+"%. Fokus auf Setup-Qualität statt Quantität.",
                      profitPlan.overtradeDays>5&&"⚠️ "+profitPlan.overtradeDays+" Overtrading-Tage destroyen deinen EV. Strikt max "+DAILY_LIMIT+" Trades/Tag.",
                      evT>0&&"✅ Positive Edge vorhanden. Mit Disziplin wirst du langfristig profitabel.",
                      evT<=0&&"🔴 Negativer EV – Verluste übersteigen Gewinne statistisch. Setup oder Disziplin optimieren.",
                    ].filter(Boolean).map((t,i)=>(
                      <div key={i} style={{color:"#cbd5e1",fontSize:11,marginBottom:4,lineHeight:1.5}}>{t}</div>
                    ))}
                    <div style={{color:"#6366f1",fontSize:11,fontWeight:600,marginTop:6}}>Ziel: {profitPlan.neededWR}%+ WR = automatisch profitabel bei 2:1 CRV.</div>
                  </div>
                </div>
              );
            })()}
          </Card>}


          {/* MEIN MONATSZIEL */}
          <Card style={{borderColor:P+"33",background:"linear-gradient(145deg,#1a1432,#141e32)",gridColumn:isDesktop?"1 / -1":"auto"}} onClick={()=>setMonatExp(p=>!p)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:"#a855f7",flexShrink:0,marginTop:5,marginLeft:5,animation:"watchDotsPurple 2.5s ease-in-out infinite 0.3s",boxShadow:"0 0 4px rgba(168,85,247,0.8)"}}/>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:"#f0f4ff"}}>Mein Monatsziel</div>
                  <div style={{color:P,fontSize:9,fontWeight:600,letterSpacing:"0.5px"}}>PERSÖNLICHE KALKULATION</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <button onClick={e=>{e.stopPropagation();const v=prompt("Ziel-Saldo ($):",goals.targetBalance);if(v&&!isNaN(v)){const newG={...goals,targetBalance:parseFloat(v)};setGoals(newG);localStorage.setItem('ttp_goals',JSON.stringify(newG));}}} style={{background:P+"22",color:P,fontSize:10,padding:"3px 8px",borderRadius:6,fontWeight:600}}>✏️</button>
                <span style={{color:P,fontSize:11,fontWeight:600}}>{monatExp?"▲":"▼"}</span>
              </div>
            </div>
            {(()=>{
              const startSaldo=Math.round((saldo-monthPnl)*100)/100;
              const monthNeeded=Math.round(Math.max(1,goals.targetBalance-startSaldo));
              const monthPct=Math.round(Math.min(100,Math.max(0,monthPnl/monthNeeded*100)));
              const missing=Math.round(Math.max(0,goals.targetBalance-saldo));
              const today2=new Date();const endM2=new Date(today2.getFullYear(),today2.getMonth()+1,0);
              let dLeft2=0;for(let d=new Date(today2);d<=endM2;d.setDate(d.getDate()+1)){const dw=d.getDay();if(dw!==0&&dw!==6)dLeft2++;}
              const dailyNeed=dLeft2>0?Math.ceil(missing/dLeft2):0;
              const tradeNeed=Math.ceil(dailyNeed/DAILY_LIMIT);
              const slD=20,tpD=40;
              return(
                <div>                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
                    {[{l:"AKTUELL",v:"$"+saldo.toLocaleString("de-DE",{maximumFractionDigits:0}),c:"#f0f4ff"},
                      {l:"ZIEL",v:"$"+goals.targetBalance.toLocaleString("de-DE"),c:P},
                      {l:"NOCH FEHLT",v:missing<=0?"✓":"+$"+Math.round(missing).toLocaleString("de-DE"),c:missing<=0?G:R}
                    ].map(s=>(
                      <div key={s.l} style={{background:"#0f1428",borderRadius:8,padding:"7px 6px",textAlign:"center",border:"1px solid #1e1428"}}>
                        <div style={{color:"#6b7a9a",fontSize:9,marginBottom:2}}>{s.l}</div>
                        <div style={{color:s.c,fontWeight:800,fontSize:13}}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginBottom:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{color:"#8b96b0",fontSize:10}}>Monatsfortschritt</span>
                      <span style={{color:monthPct>=100?G:P,fontWeight:700,fontSize:10}}>{monthPct}% ({monthPnl>=0?"+":""}${Math.round(monthPnl)} von ${monthNeeded} nötig)</span>                    </div>
                    <div style={{height:6,borderRadius:3,background:"#1e2540",overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:3,width:monthPct+"%",background:"linear-gradient(90deg,"+B+","+P+")",transition:"width .4s"}}/>
                    </div>
                  </div>
                  {(monatExp||isDesktop)&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1e1428"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                      {[
                        {l:"HANDELSTAGE NOCH",v:dLeft2+" Tage",c:dLeft2>5?G:dLeft2>2?Y:R,s:"diesen Monat"},
                        {l:"GEWINN/TAG NÖTIG",v:missing<=0?"✅ Erreicht":"$"+dailyNeed,c:missing<=0?G:dailyNeed<100?G:Y,s:"um Ziel zu erreichen"},
                        {l:"GEWINN/TRADE NÖTIG",v:missing<=0?"✓":"$"+tradeNeed,c:missing<=0?G:tradeNeed<50?G:Y,s:"bei 2 Trades/Tag"},
                        {l:"MAX. TRADES NOCH",v:dLeft2*DAILY_LIMIT,c:"#f0f4ff",s:dLeft2+" Tage × "+DAILY_LIMIT},
                        {l:"DIESEN MONAT P&L",v:(monthPnl>=0?"+":"")+"$"+monthPnl,c:pc(monthPnl),s:"seit Monatsstart"},
                        {l:"REGELQUOTE",v:disc+"%",c:sc(disc),s:"Ziel: "+goals.disc+"%"},
                      ].map(s=>(
                        <div key={s.l} style={{background:"#0f1428",borderRadius:7,padding:"7px 8px",border:"1px solid #1e1428"}}>
                          <div style={{color:"#6b7a9a",fontSize:9}}>{s.l}</div>
                          <div style={{color:s.c,fontWeight:700,fontSize:14}}>{s.v}</div>
                          <div style={{color:"#8b96b0",fontSize:9}}>{s.s}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{background:"linear-gradient(135deg,rgba(168,85,247,0.08),rgba(99,102,241,0.05))",borderRadius:8,padding:"10px 12px",border:"1px solid rgba(168,85,247,0.15)"}}>
                      <div style={{color:P,fontSize:11,fontWeight:700,marginBottom:4}}>🤖 KI Einschätzung:</div>
                      <div style={{color:"#cbd5e1",fontSize:11,lineHeight:1.5}}>
                        {missing<=0?"✅ Ziel bereits erreicht! Fokus auf Regelquote und Kapital schützen.":
                        dailyNeed>80?"Mit $"+dailyNeed+"/Tag bei "+dLeft2+" Tagen ist das Ziel diesen Monat schwer erreichbar. Realistisches Ziel setzen.":
                        "Mit $"+dailyNeed+"/Tag bei "+dLeft2+" Handelstagen erreichbar. "+DAILY_LIMIT+" Trades/Tag, SL $"+slD+", TP $"+tpD+" – Prozess über Profit."}
                      </div>
                    </div>
                  </div>}
                </div>
              );
            })()}
          </Card>
        </div>}



        {tab==="mind"&&<div style={{display:"flex",flexDirection:"column",gap:12,width:"100%"}}>
          <Card style={{borderColor:"rgba(99,102,241,0.4)",background:"linear-gradient(145deg,#0f1428,#0d1020)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:12,height:12,borderRadius:"50%",background:mindLight==='green'?G:mindLight==='yellow'?Y:mindLight==='red'?R:"#6366f1",animation:"livingOrb 2s infinite",boxShadow:"0 0 8px "+(mindLight==='green'?G:mindLight==='yellow'?Y:mindLight==='red'?R:"#6366f1")}}/>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:"#f0f4ff"}}>Coach Check-in</div>
                <div style={{color:"#6366f1",fontSize:9,fontWeight:600}}>WIE BIST DU HEUTE DRAUF?</div>
              </div>
            </div>
            {!checkedIn?(
              <div>
                {[{id:"mood",l:"🎯 Fokus & Klarheit"},{id:"energy",l:"⚡ Energie"},{id:"stress",l:"😤 Stress (1=kein, 5=viel)"}].map(item=>(
                  <div key={item.id} style={{marginBottom:12}}>
                    <div style={{color:"#94a3b8",fontSize:11,marginBottom:6}}>{item.l}</div>
                    <div style={{display:"flex",gap:6}}>
                      {[1,2,3,4,5].map(v=>(
                        <button key={v} onClick={()=>setMindCheckIn(p=>({...p,[item.id]:v}))}
                          style={{flex:1,padding:"8px 4px",borderRadius:8,fontSize:13,fontWeight:700,
                            background:mindCheckIn[item.id]===v?"rgba(99,102,241,0.35)":"rgba(255,255,255,0.04)",
                            border:"1px solid "+(mindCheckIn[item.id]===v?"#6366f1":"rgba(255,255,255,0.08)"),
                            color:mindCheckIn[item.id]===v?"#a5b4fc":"#4b5568",transition:"all .15s"}}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={doMindCheckIn} disabled={mindLoading||!mindCheckIn.mood||!mindCheckIn.energy||!mindCheckIn.stress}
                  style={{width:"100%",padding:"12px",borderRadius:10,fontWeight:800,fontSize:14,
                    background:mindCheckIn.mood&&mindCheckIn.energy&&mindCheckIn.stress?"linear-gradient(135deg,#6366f1,#a855f7)":"rgba(255,255,255,0.05)",
                    color:mindCheckIn.mood&&mindCheckIn.energy&&mindCheckIn.stress?"#fff":"#4b5568",
                    border:"none",transition:"all .2s"}}>
                  {mindLoading?"🤖 Analysiere...":"Check-in →"}
                </button>
              </div>
            ):(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 12px",background:mindLight==='green'?"rgba(34,197,94,0.1)":mindLight==='yellow'?"rgba(245,158,11,0.1)":"rgba(239,68,68,0.1)",borderRadius:10,border:"1px solid "+(mindLight==='green'?"rgba(34,197,94,0.3)":mindLight==='yellow'?"rgba(245,158,11,0.3)":"rgba(239,68,68,0.3)")}}>
                  <div style={{fontSize:28}}>{mindLight==='green'?"🟢":mindLight==='yellow'?"🟡":"🔴"}</div>
                  <div style={{fontWeight:800,fontSize:14,color:mindLight==='green'?G:mindLight==='yellow'?Y:R}}>
                    {mindLight==='green'?"GRÜNES LICHT":mindLight==='yellow'?"VORSICHT":mindLight==='red'?"HEUTE NICHT TRADEN":""}
                  </div>
                </div>
                <div style={{color:"#a8b8d0",fontSize:12,lineHeight:1.6,marginBottom:10}}>{mindMsg}</div>
                <button onClick={()=>{setCheckedIn(false);setMindCheckIn({mood:0,energy:0,stress:0});setMindLight(null);setMindMsg('');}}
                  style={{fontSize:11,color:"#4b5568",background:"none",padding:"4px 0"}}>↺ Neu check-in</button>
              </div>
            )}
          </Card>

          {/* PRE-TRADE CHECKLIST - only show if checked in */}
          {checkedIn&&mindLight!=='red'&&<Card style={{borderColor:"rgba(99,102,241,0.3)"}}>
            <div style={{fontWeight:800,fontSize:15,color:"#f0f4ff",marginBottom:4}}>✅ Pre-Trade Checklist</div>
            <div style={{color:"#6366f1",fontSize:9,fontWeight:600,letterSpacing:"0.5px",marginBottom:10}}>VOR JEDEM TRADE</div>
            {[{id:"r1",q:"Bin ich emotional ruhig und klar?",warn:"Wenn nicht → KEIN Trade"},{id:"r2",q:"Habe ich ein klares Setup?",warn:"Kein Impuls-Trade"},{id:"r3",q:"SL und TP definiert?",warn:"Immer vor Entry"},{id:"r4",q:"Ist es nach 16:15 Uhr?",warn:"Nur im Zeitfenster"},{id:"r5",q:"Max 2 Trades heute noch möglich?",warn:"Limit einhalten"}].map(r=>(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <input type="checkbox" checked={!!form.rules?.[r.id]} onChange={e=>setForm(p=>({...p,rules:{...p.rules,[r.id]:e.target.checked}}))} style={{width:18,height:18,accentColor:"#6366f1",flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{color:"#f0f4ff",fontSize:12}}>{r.q}</div>
                  <div style={{color:"#4b5568",fontSize:10}}>{r.warn}</div>
                </div>
              </div>
            ))}
            {Object.values(form.rules||{}).every(Boolean)&&<div style={{marginTop:10,background:"rgba(99,102,241,0.12)",borderRadius:8,padding:"8px 12px",color:"#a5b4fc",fontSize:12,fontWeight:700,textAlign:"center"}}>✅ Alle Punkte gecheckt – Bereit!</div>}
          </Card>}



          {/* MEINE REGELN - Dynamic */}
          <Card style={{borderColor:"rgba(245,158,11,0.3)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:"#f0f4ff"}}>📋 Meine Regeln</div>
                <div style={{color:"#f59e0b",fontSize:9,fontWeight:600}}>MEIN SYSTEM – {selectedRules.length} AKTIV</div>
              </div>
              <button onClick={()=>setSettingsOpen(true)} style={{fontSize:10,color:"#6366f1",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:6,padding:"3px 8px"}}>✏️ Bearbeiten</button>
            </div>
            {selectedRules.length===0?(
              <div style={{color:"#4b5568",fontSize:12,textAlign:"center",padding:"12px 0"}}>Keine Regeln ausgewählt. ☰ → Regeln → auswählen</div>
            ):(
              ALL_RULES.filter(r=>selectedRules.includes(r.k)).map((r,i)=>(
                <div key={r.k} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",color:"#cbd5e1",fontSize:12,display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:16,flexShrink:0}}>{r.icon}</span>
                  <span style={{flex:1}}>{r.l}</span>
                  <span style={{color:"#f59e0b",fontWeight:800,fontSize:11}}>{i+1}</span>
                </div>
              ))
            )}
          </Card>


          {/* TAGES-REFLEXION */}
          <Card style={{borderColor:"rgba(99,102,241,0.2)"}}>
            <div style={{fontWeight:800,fontSize:15,color:"#f0f4ff",marginBottom:4}}>📝 Tages-Reflexion</div>
            <div style={{color:"#6366f1",fontSize:9,fontWeight:600,letterSpacing:"0.5px",marginBottom:10}}>NACH DEM TRADING</div>
            {[{id:"good",label:"Was lief gut heute?",p:"Setup, Disziplin, Geduld..."},{id:"bad",label:"Was verbessern?",p:"Impuls, zu früh raus..."},{id:"emotion",label:"Wie war dein Zustand?",p:"Ruhig, fokussiert, gestresst..."}].map(q=>(
              <div key={q.id} style={{marginBottom:8}}>
                <label style={{color:"#8b96b0",fontSize:10,display:"block",marginBottom:3}}>{q.label}</label>
                <textarea rows={2} value={todayJ[q.id]||""} onChange={e=>setTodayJ(p=>({...p,[q.id]:e.target.value}))} placeholder={q.p} style={{resize:"vertical",width:"100%"}}/>
              </div>
            ))}
            <button onClick={()=>{const u={...journal,[todayISO()]:{...todayJ}};setJournal(u);localStorage.setItem("ttp_journal",JSON.stringify(u));showToast("✅ Reflexion gespeichert!");}} style={{background:B,color:"#fff",padding:10,width:"100%",fontWeight:700,borderRadius:10,fontSize:13}}>Speichern</button>
          </Card>

          <Card style={{borderColor:"rgba(245,158,11,0.2)",background:"linear-gradient(145deg,#1a1508 0%,#0f1010 100%)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,cursor:"pointer"}} onClick={()=>setProbExp(p=>!p)}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:14,height:14,borderRadius:"50%",background:"radial-gradient(circle,#fcd34d,#f59e0b 60%,#92400e)",animation:"livingOrb 2s ease-in-out infinite",boxShadow:"0 0 10px rgba(245,158,11,0.6)",flexShrink:0}}/>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:"#f0f4ff"}}>Meine Trading-Probleme</div>
                  <div style={{color:"#f59e0b",fontSize:9,fontWeight:600}}>PERSÖNLICHE KI-DIAGNOSE</div>
                </div>
              </div>
              <span style={{color:"#f59e0b",fontSize:11,fontWeight:600}}>{probExp?"▲":"▼"}</span>
            </div>
            {probExp&&(()=>{
              const PROBS=[
                {k:"overtrading",l:"Overtrading"},{k:"fomo",l:"FOMO"},{k:"revenge",l:"Revenge Trading"},
                {k:"early_exit",l:"Zu früh aussteigen"},{k:"no_sl",l:"SL nicht einhalten"},
                {k:"outside_window",l:"Falsche Zeiten"},{k:"impulse",l:"Impuls-Trading"},{k:"fear",l:"Angst vor Verlusten"},
              ];
              const selected=Object.keys(problems).filter(k=>problems[k]);
              return(
                <div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                    {PROBS.map(p=>(
                      <button key={p.k} onClick={()=>saveProblems({...problems,[p.k]:!problems[p.k]})}
                        style={{padding:"5px 10px",borderRadius:20,fontSize:11,fontWeight:600,
                          background:problems[p.k]?"rgba(245,158,11,0.25)":"rgba(255,255,255,0.04)",
                          border:"1px solid "+(problems[p.k]?"rgba(245,158,11,0.6)":"rgba(255,255,255,0.1)"),
                          color:problems[p.k]?"#fcd34d":"#6b7a9a"}}>
                        {problems[p.k]?"✓ ":""}{p.l}
                      </button>
                    ))}
                  </div>
                  {selected.length>0&&<button onClick={analyzeProblems} disabled={probLoading}
                    style={{width:"100%",padding:"10px",borderRadius:10,fontWeight:700,fontSize:13,
                      background:"linear-gradient(135deg,rgba(245,158,11,0.2),rgba(239,68,68,0.1))",
                      border:"1px solid rgba(245,158,11,0.3)",color:probLoading?"#6b7280":"#fcd34d",marginBottom:8}}>
                    {probLoading?"KI Analysiert...":"KI-Diagnose starten ("+selected.length+" Probleme)"}
                  </button>}
                  {probAnalysis&&<div style={{background:"rgba(245,158,11,0.06)",borderRadius:10,padding:12,border:"1px solid rgba(245,158,11,0.15)"}}>
                    <div style={{color:"#f59e0b",fontSize:11,fontWeight:700,marginBottom:6}}>Dein persönlicher Plan:</div>
                    <div style={{color:"#a8b8d0",fontSize:11,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{probAnalysis}</div>
                  </div>}
                  {!probAnalysis&&selected.length===0&&<div style={{color:"#4a5568",fontSize:11,textAlign:"center",padding:"4px 0"}}>Wähle deine Probleme – KI gibt dir einen konkreten Plan</div>}
                </div>
              );
            })()}
          </Card>
        </div>}


        {/* LOGGEN TAB */}
        {tab==="log"&&<div style={{maxWidth:isDesktop?"700px":"100%",margin:isDesktop?"0 auto":"0"}}>
          {!allChecked&&!inPause&&!todayBlocked&&!atLimit&&<div style={{background:"linear-gradient(135deg,rgba(239,68,68,0.12),rgba(245,158,11,0.08))",border:"2px solid rgba(239,68,68,0.5)",borderRadius:14,padding:"18px",marginBottom:14,textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:8}}>🔒</div>
            <div style={{color:R,fontWeight:800,fontSize:16,marginBottom:6}}>Routine zuerst!</div>
            <div style={{color:"#fca5a5",fontSize:12,marginBottom:14,lineHeight:1.5}}>Gehe zuerst deine Pre-Trade Regeln durch.</div>
            <button onClick={()=>setTab("mind")} style={{background:"linear-gradient(135deg,"+B+","+P+")",color:"#fff",padding:"12px 24px",fontWeight:700,fontSize:13,borderRadius:10}}>✅ Zu den Regeln</button>
          </div>}
          {inPause&&<div style={{background:"#1a0a00",border:"2px solid "+Y,borderRadius:12,padding:14,marginBottom:12,textAlign:"center"}}>
            <div style={{color:Y,fontWeight:800,fontSize:15,marginBottom:2}}>⏸ Pflichtpause</div>
            <div style={{color:Y,fontWeight:800,fontSize:42,letterSpacing:2}}>{pStr}</div>
          </div>}
          {!inPause&&todayBlocked&&<div style={{background:R+"22",border:"1px solid "+R,borderRadius:12,padding:14,marginBottom:12,textAlign:"center"}}><div style={{color:R,fontWeight:800}}>🚫 Heute gesperrt</div></div>}
          {!inPause&&atLimit&&!todayBlocked&&<div style={{background:O+"22",border:"1px solid "+O,borderRadius:12,padding:14,marginBottom:12,textAlign:"center"}}><div style={{color:O,fontWeight:800}}>🛑 Tageslimit erreicht</div></div>}
          {allChecked&&!inPause&&!todayBlocked&&!atLimit&&<div style={{background:"linear-gradient(135deg,rgba(0,211,149,0.12),rgba(99,102,241,0.08))",border:"1px solid rgba(0,211,149,0.5)",borderRadius:14,padding:"12px 16px",marginBottom:14,display:"flex",gap:12,alignItems:"center"}}>
            <span style={{fontSize:22}}>✅</span>
            <div><div style={{color:G,fontWeight:800,fontSize:13}}>READY – Routine erfüllt</div><div style={{color:"#86efac",fontSize:11,marginTop:2}}>Alle 4 Regeln abgehakt.</div></div>
          </div>}
          <Card>
            <div style={{fontWeight:700,fontSize:16,marginBottom:14}}>Trade loggen</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Field label="DATUM">
                  <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:13,color:"#f0f4ff",width:"100%",outline:"none"}}/>
                </Field>
                <Field label="UHRZEIT">
                  <input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:13,color:"#f0f4ff",width:"100%",outline:"none"}}/>
                </Field>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Field label="KONTRAKT">
                  <select value={form.contract} onChange={e=>setForm(f=>({...f,contract:e.target.value}))}>
                    <option value="MNQ">MNQ ✓</option><option value="NQ">NQ</option><option value="ES">ES</option>
                  </select>
                </Field>
                <Field label="RICHTUNG">
                  <select value={form.dir} onChange={e=>setForm(f=>({...f,dir:e.target.value}))}>
                    <option value="LONG">LONG ↑</option><option value="SHORT">SHORT ↓</option>
                  </select>
                </Field>
              </div>
              <Field label="SETUP">
                <select value={form.setup} onChange={e=>setForm(f=>({...f,setup:e.target.value}))}>
                  {SETUPS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="NETTO P&L ($) *">
                <input type="number" step="0.01" value={form.pnl} onChange={e=>setForm(f=>({...f,pnl:e.target.value}))} placeholder="z.B. 40 oder -20" style={{borderColor:form.pnl?(parseFloat(form.pnl)>=0?G+"88":R+"88"):"#1e2d48"}}/>
              </Field>
              <div style={{background:"#0a160f",borderRadius:10,padding:"10px 12px",border:"1px solid "+G+"33"}}>
                <div style={{color:G,fontSize:11,fontWeight:600}}>1 MNQ: SL 40 Ticks ($20) | TP 80 Ticks ($40)</div>
              </div>
              <div style={{background:"#111725",borderRadius:10,padding:12,border:"1px solid #2d3548"}}>
                <div style={{color:"#8b96b0",fontSize:11,marginBottom:6,fontWeight:600}}>REGELN EINGEHALTEN?</div>
                {RULES.map(r=>(<Chk key={r.id} checked={form.rules[r.id]} onClick={()=>setForm(f=>({...f,rules:{...f.rules,[r.id]:!f.rules[r.id]}}))} label={r.label}/>))}
              </div>
              <Field label="NOTIZEN">
                <textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Emotion? Was lief gut/schlecht?" style={{resize:"vertical"}}/>
              </Field>
              <button onClick={addTrade} style={{background:canTrade?B:"#4a5568",color:"#fff",padding:13,fontSize:14,fontWeight:700,width:"100%",borderRadius:10,opacity:canTrade?1:0.6}} disabled={!canTrade}>
                {inPause?"⏸ Warten... "+pStr:todayBlocked?"Heute gesperrt":overtradingToday?"3 Trades – Gesperrt":atLimit?"Limit erreicht":!allChecked?"🔒 Erst Regeln abhaken":"Trade speichern – Timer startet!"}
              </button>
            </div>
          </Card>
        </div>}

        {/* ANALYSE TAB */}
        {tab==="analyse"&&<div style={{display:"flex",flexDirection:"column",gap:12,width:"100%"}}>

          {/* SCHNELL-STATS */}
          {(()=>{
            const wins=t09.filter(t=>t.pnl>0);
            const losses=t09.filter(t=>t.pnl<0);
            const avgW=wins.length?Math.round(wins.reduce((s,t)=>s+t.pnl,0)/wins.length):0;
            const avgL=losses.length?Math.round(Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length)):0;
            const pf=avgL>0?(avgW*wins.length)/(avgL*losses.length):0;
            return(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                {[{l:"TRADES",v:t09.length,c:B},{l:"Ø WIN",v:"+$"+avgW,c:G},{l:"Ø LOSS",v:"-$"+avgL,c:R},{l:"PROFIT F.",v:pf.toFixed(1)+"x",c:pf>=1?G:R}].map(s=>(
                  <div key={s.l} style={{background:"#131d30",border:"1px solid #2d3548",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{color:"#6b7a9a",fontSize:8,marginBottom:3}}>{s.l}</div>
                    <div style={{color:s.c,fontWeight:800,fontSize:13}}>{s.v}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* EQUITY KURVE */}
          <Card>
            <div style={{fontWeight:700,marginBottom:10,fontSize:14,color:"#f0f4ff"}}>Equity Kurve</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={equity}>
                <XAxis dataKey="i" tick={{fill:"#6b7a9a",fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#6b7a9a",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>"$"+v} width={55}/>
                <Tooltip formatter={v=>[fd(v),"Kumuliert"]} contentStyle={{background:"#131d30",border:"1px solid #2d3548",borderRadius:8,fontSize:11}}/>
                <ReferenceLine y={0} stroke="#1e2d48" strokeDasharray="4 4"/>
                <Line type="monotone" dataKey="v" stroke={B} strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* STUNDEN-PERFORMANCE */}
          {(()=>{
            const hours={};
            t09.forEach(t=>{const h=parseInt(t.time.split(":")[0]);if(!hours[h])hours[h]={n:0,wins:0,pnl:0};hours[h].n++;hours[h].pnl+=t.pnl;if(t.pnl>0)hours[h].wins++;});
            const sorted=Object.entries(hours).sort(([a],[b])=>parseInt(a)-parseInt(b));
            return sorted.length>0&&(
              <Card>
                <div style={{fontWeight:700,marginBottom:10,fontSize:14,color:"#f0f4ff"}}>Stunden-Performance</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {sorted.map(([h,d])=>{
                    const wr=Math.round(d.wins/d.n*100);
                    const c=wr>=60?G:wr>=40?Y:R;
                    const isWindow=parseInt(h)>=16&&parseInt(h)<=17;
                    return(
                      <div key={h} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{color:isWindow?G:"#8b96b0",fontSize:11,fontWeight:isWindow?700:400,width:36,flexShrink:0}}>{h}:00{isWindow&&" ⚡"}</div>
                        <div style={{flex:1,height:20,background:"#111725",borderRadius:4,overflow:"hidden",position:"relative"}}>
                          <div style={{height:"100%",width:wr+"%",background:c+"44",borderRadius:4}}/>
                          <div style={{position:"absolute",top:0,left:4,right:0,height:"100%",display:"flex",alignItems:"center"}}>
                            <span style={{color:c,fontSize:10,fontWeight:700}}>{wr}% WR</span>
                            <span style={{color:"#6b7a9a",fontSize:10,marginLeft:6}}>{d.n} Trades · {d.pnl>=0?"+":""}${Math.round(d.pnl)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })()}

          {/* SETUP-PERFORMANCE */}
          {(()=>{
            const setups={};
            t09.forEach(t=>{const s=t.setup||"Unbekannt";if(!setups[s])setups[s]={n:0,wins:0,pnl:0};setups[s].n++;setups[s].pnl+=t.pnl;if(t.pnl>0)setups[s].wins++;});
            const sorted=Object.entries(setups).sort(([,a],[,b])=>b.pnl-a.pnl);
            return sorted.length>0&&(
              <Card>
                <div style={{fontWeight:700,marginBottom:10,fontSize:14,color:"#f0f4ff"}}>Setup-Performance</div>
                {sorted.map(([name,d])=>{
                  const wr=Math.round(d.wins/d.n*100);
                  const c=wr>=60?G:wr>=40?Y:R;
                  return(
                    <div key={name} style={{marginBottom:8,padding:"8px 10px",background:"#111725",borderRadius:8,borderLeft:"3px solid "+c}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#f0f4ff"}}>{name}</div>
                        <div style={{color:pc(d.pnl),fontWeight:800,fontSize:12}}>{d.pnl>=0?"+":""}${Math.round(d.pnl)}</div>
                      </div>
                      <div style={{display:"flex",gap:12}}>
                        <span style={{color:c,fontSize:10,fontWeight:700}}>{wr}% WR</span>
                        <span style={{color:"#6b7a9a",fontSize:10}}>{d.n} Trades</span>
                        <span style={{color:"#6b7a9a",fontSize:10}}>Ø {d.wins} TP / {d.n-d.wins} SL</span>
                      </div>
                    </div>
                  );
                })}
              </Card>
            );
          })()}

          {/* STREAK + PSYCHOLOGIE */}
          {(()=>{
            let curStreak=0,maxWin=0,maxLoss=0,cur=0;
            t09.forEach(t=>{if(t.pnl>0){cur=cur>0?cur+1:1;maxWin=Math.max(maxWin,cur);}else{cur=cur<0?cur-1:-1;maxLoss=Math.min(maxLoss,cur);}});
            curStreak=cur;
            const discHistory=t09.slice(-20).map((t,i)=>{const rv=t.rules||{};const kk=Object.keys(rv);return kk.length?Math.round(kk.filter(k=>rv[k]).length/kk.length*100):50;});
            const avgDisc=discHistory.length?Math.round(discHistory.reduce((s,v)=>s+v,0)/discHistory.length):0;
            return(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Card>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#f0f4ff"}}>Streak-Analyse</div>
                  {[{l:"Aktuell",v:curStreak>0?"+"+curStreak+" Siege":curStreak<0?Math.abs(curStreak)+" Verluste":"Neutral",c:curStreak>0?G:curStreak<0?R:Y},
                    {l:"Best. Siegesserie",v:maxWin+" Trades",c:G},
                    {l:"Schlechteste Serie",v:Math.abs(maxLoss)+" Verluste",c:R},
                  ].map(s=>(
                    <div key={s.l} style={{marginBottom:6}}>
                      <div style={{color:"#6b7a9a",fontSize:9}}>{s.l}</div>
                      <div style={{color:s.c,fontWeight:800,fontSize:isDesktop?20:14}}>{s.v}</div>
                    </div>
                  ))}
                </Card>
                <Card>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#f0f4ff"}}>Mentaler Score</div>
                  {[{l:"Regelquote Ø",v:avgDisc+"%",c:sc(avgDisc)},
                    {l:"Disziplin-Trend",v:disc>avgDisc?"↗ Im Aufbau":disc<avgDisc?"↘ Ausbaufähig":"→ Konstant",c:disc>=avgDisc?G:Y},
                    {l:"Overtrading-Tage",v:profitPlan?profitPlan.overtradeDays+"T":"–",c:profitPlan&&profitPlan.overtradeDays>3?R:G},
                  ].map(s=>(
                    <div key={s.l} style={{marginBottom:6}}>
                      <div style={{color:"#6b7a9a",fontSize:9}}>{s.l}</div>
                      <div style={{color:s.c,fontWeight:800,fontSize:isDesktop?20:14}}>{s.v}</div>
                    </div>
                  ))}
                </Card>
              </div>
            );
          })()}

          {/* BESTE HANDELSTAGE */}
          <Card>
            <div style={{fontWeight:700,marginBottom:8,fontSize:14,color:"#f0f4ff"}}>Handelstage nach Wochentag</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5}}>
              {weekdayStats.map(d=>{
                const c=d.pct>=60?G:d.pct>=40?Y:R;
                return(
                  <div key={d.label} style={{background:"#111725",borderRadius:8,padding:"8px 4px",textAlign:"center",border:"1px solid "+(d.days>0?c+"33":"#1e2d48")}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:2,color:d.days>0?c:"#4a5568"}}>{d.label}</div>
                    {d.days>0?(<>
                      <div style={{color:c,fontWeight:800,fontSize:16}}>{d.pct}%</div>
                      <div style={{color:pc(d.pnl),fontSize:10,fontWeight:600}}>{d.pnl>=0?"+":"-"}${Math.abs(d.pnl).toFixed(0)}</div>
                      <div style={{color:"#4a5568",fontSize:8}}>{d.days}T</div>
                    </>):<div style={{color:"#4a5568",fontSize:10,marginTop:6}}>–</div>}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* HALTEDAUER */}
          <Card>
            <div style={{fontWeight:700,marginBottom:8,fontSize:14,color:"#f0f4ff"}}>Haltedauer</div>
            {durBuckets.map(b=>(
              <div key={b.label} style={{marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:52,color:"#8b96b0",fontSize:11,flexShrink:0}}>{b.label}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{color:"#6b7a9a",fontSize:9}}>{b.n} Trades</span>
                    <span style={{color:sc(b.wr),fontSize:9,fontWeight:700}}>{b.wr}% · {b.pnl>=0?"+":""}${Math.round(b.pnl)}</span>
                  </div>
                  <Bar2 pct={b.wr} color={sc(b.wr)}/>
                </div>
              </div>
            ))}
          </Card>

          {/* PSYCHOLOGIE JOURNAL */}
          
        </div>}

        {tab==="hist"&&<div style={{display:"flex",flexDirection:"column",gap:10,width:"100%"}}>
          <Card style={{borderColor:"rgba(99,102,241,0.3)"}}>
            <div style={{fontWeight:700,fontSize:14,color:"#f0f4ff",marginBottom:8}}>📥 TTP Trade Import</div>
            <div style={{color:"#8b96b0",fontSize:11,marginBottom:8}}>TTP Report → Trades markieren → Kopieren → hier einfügen:</div>
            <textarea id="ttp_import_box" rows={4} placeholder="NQ-202606-CME&#9;18.5.2026, 16:54:51&#9;..." style={{width:"100%",fontSize:10,marginBottom:8,fontFamily:"monospace",resize:"vertical"}}/>
            <button onClick={()=>{const v=document.getElementById('ttp_import_box').value;importTTPTrades(v);document.getElementById('ttp_import_box').value='';}}
              style={{background:"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",padding:"10px",width:"100%",fontWeight:700,borderRadius:10,fontSize:13}}>
              📥 Trades importieren
            </button>
          </Card>
          <Card>
            <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>🔍 Filter</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <Field label="VON"><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:13,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
              <Field label="BIS"><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:13,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
            </div>
            {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");}} style={{background:"none",color:"#8b96b0",fontSize:11,padding:"4px 0",width:"100%"}}>Filter zurücksetzen ×</button>}
          </Card>
          {(dateFrom||dateTo)&&(()=>{
            const filtered=t09.filter(t=>(!dateFrom||t.date>=dateFrom)&&(!dateTo||t.date<=dateTo));
            const sum=filtered.reduce((s,t)=>s+t.pnl,0);
            const wr=filtered.length?Math.round(filtered.filter(t=>t.pnl>0).length/filtered.length*100):0;
            return(<>
              <Card style={{borderColor:B+"44"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div><div style={{color:"#8b96b0",fontSize:10}}>{filtered.length} Trades</div><div style={{color:pc(sum),fontWeight:800,fontSize:24}}>{sum>=0?"+":"-"}${Math.abs(sum).toFixed(2)}</div></div>
                  <div style={{textAlign:"right"}}><div style={{color:"#8b96b0",fontSize:10}}>WR</div><div style={{color:wr>=50?G:R,fontWeight:800,fontSize:20}}>{wr}%</div></div>
                </div>
              </Card>
              {[...filtered].reverse().map(t=>(
                <div key={t.id} style={{background:"#131d30",borderRadius:10,padding:"10px 12px",borderLeft:"3px solid "+pc(t.pnl),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{display:"flex",gap:6,marginBottom:2}}><span style={{fontWeight:800,color:pc(t.pnl)}}>{fd(t.pnl)}</span><span style={{fontSize:10,color:"#8b96b0"}}>{t.contract} · {t.dir}</span></div><div style={{color:"#8b96b0",fontSize:10}}>{t.date} {t.time}</div></div>
                  <button onClick={()=>setDelId(t.id)} style={{background:"none",color:R,fontSize:16,padding:"2px 4px",opacity:0.5}}>×</button>
                </div>
              ))}
            </>);
          })()}
          {!dateFrom&&!dateTo&&<Card>
            <div style={{fontWeight:700,fontSize:15,marginBottom:10}}>📅 Jahresübersicht</div>
            {monthlyStats.map(ms=>{
              const isExp=expandedMonth===ms.mo;
              return(
                <div key={ms.mo} style={{marginBottom:8,background:"#111725",borderRadius:10,padding:"10px 12px",border:isExp?"1px solid "+B+"55":"1px solid transparent"}}>
                  <div onClick={()=>setExpandedMonth(isExp?null:ms.mo)} style={{cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{color:"#8b96b0",fontSize:11,display:"inline-block",transform:isExp?"rotate(90deg)":"none"}}>▶</span>
                        <div style={{fontWeight:700,fontSize:13}}>{ms.mo}</div>
                      </div>
                      <div style={{color:pc(ms.pnl),fontWeight:800,fontSize:15}}>{ms.pnl>=0?"+":"-"}${Math.abs(ms.pnl).toFixed(0)}</div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,fontSize:10}}>
                      <div style={{textAlign:"center"}}><div style={{color:"#8b96b0"}}>Trades</div><div style={{fontWeight:700}}>{ms.trades}</div></div>
                      <div style={{textAlign:"center"}}><div style={{color:"#8b96b0"}}>WR</div><div style={{color:ms.wr>=50?G:R,fontWeight:700}}>{ms.wr}%</div></div>
                      <div style={{textAlign:"center"}}><div style={{color:"#8b96b0"}}>TP</div><div style={{color:G,fontWeight:700}}>{ms.wins}</div></div>
                      <div style={{textAlign:"center"}}><div style={{color:"#8b96b0"}}>SL</div><div style={{color:R,fontWeight:700}}>{ms.losses}</div></div>
                    </div>
                  </div>
                  {isExp&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #2d3548",display:"flex",flexDirection:"column",gap:5}}>
                    {[...t09.filter(t=>t.date.startsWith(ms.mo))].reverse().map(t=>(
                      <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 8px",background:"#131d30",borderRadius:6,borderLeft:"2px solid "+pc(t.pnl)}}>
                        <div><div style={{fontSize:11,fontWeight:700,color:pc(t.pnl)}}>{fd(t.pnl)} <span style={{color:"#8b96b0",fontWeight:400}}>· {t.contract} · {t.dir}</span></div><div style={{color:"#8b96b0",fontSize:10}}>{t.date} {t.time}</div></div>
                        <button onClick={e=>{e.stopPropagation();setDelId(t.id);}} style={{background:"none",color:R,fontSize:14,padding:"2px 4px",opacity:0.4}}>×</button>
                      </div>
                    ))}
                  </div>}
                </div>
              );
            })}
          </Card>}
        </div>}

      </div>

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:0,right:isDesktop?"370px":"0",zIndex:100,background:"rgba(15,10,30,0.97)",borderTop:"1px solid rgba(99,102,241,0.4)",boxShadow:"0 -4px 24px rgba(99,102,241,0.15)",display:"flex",paddingBottom:"env(safe-area-inset-bottom,8px)",WebkitTransform:"translate3d(0,0,0)",transform:"translate3d(0,0,0)"}}>        {NAVS.map(nav=>(
          <button key={nav.k} onClick={()=>setTab(nav.k)} style={{background:"none",color:tab===nav.k?B:P+"aa",padding:isDesktop?"14px 8px 14px":"10px 2px 11px",fontSize:isDesktop?10:8,flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:isDesktop?6:4,borderBottom:tab===nav.k?"2px solid "+B:"2px solid transparent",borderRadius:0,position:"relative",fontWeight:700,letterSpacing:"0.5px",transition:"color 0.2s"}}>
            <div style={{width:isDesktop?28:22,height:isDesktop?28:22,display:"flex",alignItems:"center",justifyContent:"center",opacity:tab===nav.k?1:0.55,transform:tab===nav.k?"scale(1.1)":"scale(1)",transition:"all 0.2s"}}>
              {nav.k==="log"&&!allChecked&&!todayBlocked&&!atLimit&&!inPause
                ?<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#ef4444" strokeWidth="1.8"/><line x1="12" y1="8" x2="12" y2="16" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/></svg>
                :nav.svg}
            </div>
            <span style={{whiteSpace:"nowrap",color:tab===nav.k?B:P+"aa"}}>{nav.lb.toUpperCase()}</span>
            {nav.k==="log"&&inPause&&<div style={{position:"absolute",top:8,right:"14%",width:6,height:6,borderRadius:"50%",background:Y,boxShadow:"0 0 6px "+Y}}/>}
            {nav.k==="check"&&allChecked&&!todayBlocked&&<div style={{position:"absolute",top:8,right:"14%",width:6,height:6,borderRadius:"50%",background:G,boxShadow:"0 0 8px rgba(0,211,149,0.8)"}}/>}
          </button>
        ))}
      </div>

      {/* SETTINGS DRAWER */}
      {settingsOpen&&<div onClick={()=>setSettingsOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,backdropFilter:"blur(4px)"}}>
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:0,right:0,bottom:0,width:"min(300px,82vw)",background:"linear-gradient(180deg,#1a1f2e,#0f1117)",borderLeft:"1px solid #2d3548",overflowY:"auto",padding:"20px 18px",paddingBottom:"calc(20px + env(safe-area-inset-bottom,0px))"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <div style={{fontWeight:800,fontSize:20,color:"#f0f4ff"}}>Einstellungen</div>
              <div style={{color:"#6366f1",fontSize:10,fontWeight:600,letterSpacing:"0.5px"}}>MINDRISK KONFIGURATION</div>
            </div>
            <button onClick={()=>setSettingsOpen(false)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid #2d3548",borderRadius:10,width:34,height:34,padding:0,color:"#8b96b0",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* ZIELE – ACCORDION */}
          {[
            {id:"goals",label:"Meine Ziele",sub:"Monatsziel, 3M, 6M"},
            {id:"rules",label:"Trading Regeln",sub:"Limits, Zeiten, Pause"},
            {id:"coach",label:"Coach Profil",sub:"Wer du bist & KI-Gedächtnis"},
            {id:"data",label:"Daten",sub:"Reset & Verwaltung"},
          ].map(sec=>(
            <div key={sec.id} style={{marginBottom:6,borderRadius:12,border:"1px solid #2d3548",overflow:"hidden"}}>
              <div onClick={()=>setSettingsSection(p=>p===sec.id?null:sec.id)}
                style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",background:settingsSection===sec.id?"rgba(99,102,241,0.08)":"transparent"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:"#f0f4ff"}}>{sec.label}</div>
                  <div style={{color:"#6b7a9a",fontSize:10}}>{sec.sub}</div>
                </div>
                <div style={{color:settingsSection===sec.id?B:"#6b7a9a",fontSize:12,fontWeight:700,transform:settingsSection===sec.id?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</div>
              </div>

              {settingsSection==="goals"&&sec.id==="goals"&&<div style={{padding:"12px 14px",borderTop:"1px solid #2d3548",background:"#111725"}}>
                <div style={{marginBottom:12}}>
                  <div style={{color:"#8b96b0",fontSize:10,fontWeight:600,marginBottom:6}}>ZIEL-ZEITRAUM</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                    {[{k:"month",l:"Monat"},{k:"3m",l:"3 Monate"},{k:"6m",l:"6 Monate"}].map(p=>(
                      <button key={p.k} onClick={()=>setGoalPeriod(p.k)} style={{background:goalPeriod===p.k?B+"33":"#131d30",border:"1px solid "+(goalPeriod===p.k?B:"#1e2d48"),color:goalPeriod===p.k?B:"#8b96b0",padding:"7px 4px",borderRadius:8,fontSize:11,fontWeight:600}}>{p.l}</button>
                    ))}
                  </div>
                </div>
                <Field label="ZIEL-SALDO ($)">
                  <input type="number" defaultValue={goals.targetBalance} onBlur={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)){const newG={...goals,targetBalance:v};setGoals(newG);localStorage.setItem('ttp_goals',JSON.stringify(newG));} }} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:14,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
                </Field>
                <div style={{marginTop:8,background:"rgba(99,102,241,0.08)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(99,102,241,0.15)"}}>
                  <div style={{color:"#8b96b0",fontSize:10}}>Aktuell: <span style={{color:"#f0f4ff",fontWeight:700}}>${saldo.toFixed(0)}</span> · Noch fehlen: <span style={{color:R,fontWeight:700}}>${Math.max(0,goals.targetBalance-saldo).toFixed(0)}</span></div>
                </div>
                <div style={{marginTop:8}}>
                  <Field label="REGELQUOTE-ZIEL (%)">
                    <input type="number" defaultValue={goals.disc} onBlur={e=>{const v=parseInt(e.target.value);if(!isNaN(v)){const newG={...goals,disc:v};setGoals(newG);localStorage.setItem('ttp_goals',JSON.stringify(newG));}}} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:14,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/>
                  </Field>
                </div>
              </div>}

              {settingsSection==="rules"&&sec.id==="rules"&&<div style={{padding:"12px 14px",borderTop:"1px solid #2d3548",background:"#111725",display:"flex",flexDirection:"column",gap:10}}>
                <div style={{color:"#8b96b0",fontSize:10,marginBottom:6}}>Wähle max. 5 Regeln für MIND Tab:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                  {ALL_RULES.map(r=>{const on=selectedRules.includes(r.k);const disabled=!on&&selectedRules.length>=5;return(<button key={r.k} onClick={()=>!disabled&&toggleRule(r.k)} style={{padding:"5px 8px",borderRadius:16,fontSize:10,fontWeight:600,display:"flex",alignItems:"center",gap:3,background:on?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:"1px solid "+(on?"#6366f1":"rgba(255,255,255,0.1)"),color:on?"#a5b4fc":disabled?"#2d3548":"#6b7a9a",opacity:disabled?0.4:1}}>{r.icon} {r.l}</button>);})}
                </div>
                <div style={{color:"#4b5568",fontSize:9,marginBottom:8}}>{selectedRules.length}/5 gewählt – erscheinen im MIND Tab</div>
                <Field label="MAX TRADES / TAG"><input type="number" value={settings.maxTrades} onChange={e=>saveSettings({...settings,maxTrades:parseInt(e.target.value)||2})} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:14,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                <Field label="PFLICHTPAUSE (MIN)"><input type="number" value={settings.pauseMins} onChange={e=>saveSettings({...settings,pauseMins:parseInt(e.target.value)||15})} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:14,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <Field label="FENSTER VON"><input type="time" value={settings.windowStart} onChange={e=>saveSettings({...settings,windowStart:e.target.value})} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:13,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                  <Field label="FENSTER BIS"><input type="time" value={settings.windowEnd} onChange={e=>saveSettings({...settings,windowEnd:e.target.value})} style={{background:"transparent",border:"none",padding:"2px 0",fontSize:13,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                </div>
              </div>}

              {settingsSection==="coach"&&sec.id==="coach"&&<div style={{padding:"12px 14px",borderTop:"1px solid #2d3548",background:"#111725"}}>
                <div style={{color:"#8b96b0",fontSize:10,marginBottom:6}}>KI liest das bei JEDER Antwort:</div>
                <textarea rows={5} value={coachProfile} onChange={e=>{setCoachProfile(e.target.value);localStorage.setItem('ttp_coach_profile',e.target.value);}}
                  placeholder="Ich trade bei einer Prop Firm. Beschreibe hier dein Profil, Probleme und Ziele..."
                  style={{resize:"vertical",fontSize:11,lineHeight:1.5,width:"100%",marginBottom:8}}/>
                <div style={{color:G,fontSize:9,marginBottom:10}}>Schreib auch Psychologie, Schwächen, Ziele</div>
                {coachMemory.length>0&&<div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{color:"#8b96b0",fontSize:10,fontWeight:600}}>GEDÄCHTNIS ({coachMemory.length} Einträge)</div>
                    <button onClick={()=>{if(confirm("Löschen?")){setCoachMemory([]);localStorage.removeItem('ttp_coach_memory');}}} style={{background:"none",color:R,fontSize:10,padding:0}}>löschen</button>
                  </div>
                  {coachMemory.slice(0,4).map((m,i)=>(
                    <div key={i} style={{fontSize:10,color:"#a8b8d0",padding:"3px 0",borderBottom:"1px solid #2d3548"}}>
                      <span style={{color:"#6b7a9a",fontSize:9}}>{m.date}: </span>{m.note.slice(0,70)}
                    </div>
                  ))}
                </div>}
              </div>}

              {settingsSection==="data"&&sec.id==="data"&&<div style={{padding:"12px 14px",borderTop:"1px solid #2d3548",background:"#111725"}}>
                <div style={{color:"#a5b4fc",fontSize:11,fontWeight:700,marginBottom:8}}>KONTO TYP</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
                  {[{k:"challenge",l:"🎯 Challenge"},{k:"pa",l:"💰 PA Account"}].map(t=>(
                    <button key={t.k} onClick={()=>saveAcct({...acct,type:t.k})}
                      style={{padding:"8px",borderRadius:8,fontSize:11,fontWeight:700,background:acct.type===t.k?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:"1px solid "+(acct.type===t.k?"#6366f1":"#2d3548"),color:acct.type===t.k?"#a5b4fc":"#6b7a9a"}}>{t.l}</button>
                  ))}
                </div>
                <Field label="DEIN NAME"><input defaultValue={acct.name||""} onBlur={e=>saveAcct({...acct,name:e.target.value})} style={{background:"transparent",border:"none",fontSize:13,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                <Field label="BROKER"><input defaultValue={acct.broker} onBlur={e=>saveAcct({...acct,broker:e.target.value})} style={{background:"transparent",border:"none",fontSize:13,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                <Field label="KONTO NUMMER"><input defaultValue={acct.number} onBlur={e=>saveAcct({...acct,number:e.target.value})} style={{background:"transparent",border:"none",fontSize:13,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                <div style={{color:"#a5b4fc",fontSize:11,fontWeight:700,marginTop:10,marginBottom:8}}>KONTO GRÖßE</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginBottom:10}}>
                  {[50000,75000,100000,125000,150000,200000].map(s=>(
                    <button key={s} onClick={()=>saveAcct({...acct,size:s})} style={{padding:"6px 4px",borderRadius:7,fontSize:10,fontWeight:700,background:acct.size===s?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:"1px solid "+(acct.size===s?"#6366f1":"#2d3548"),color:acct.size===s?"#a5b4fc":"#6b7a9a"}}>${s/1000}k</button>
                  ))}
                </div>
                <div style={{color:"#a5b4fc",fontSize:11,fontWeight:700,marginBottom:8}}>RISIKO EINSTELLUNGEN</div>
                <Field label={"MAX DD ($) – Level: $"+(acct.size-acct.maxDD).toLocaleString()}><input type="number" defaultValue={acct.maxDD} onBlur={e=>{const v=parseInt(e.target.value);if(!isNaN(v))saveAcct({...acct,maxDD:v});}} style={{background:"transparent",border:"none",fontSize:13,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                <Field label="DAILY DD LIMIT ($)"><input type="number" defaultValue={acct.dailyDD} onBlur={e=>{const v=parseInt(e.target.value);if(!isNaN(v))saveAcct({...acct,dailyDD:v});}} style={{background:"transparent",border:"none",fontSize:13,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                <div style={{color:"#a5b4fc",fontSize:11,fontWeight:700,marginTop:10,marginBottom:6}}>LOT SIZE (für Kalkulationen)</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:8}}>
                  {[1,2,3,5].map(l=>(
                    <button key={l} onClick={()=>saveAcct({...acct,lotSize:l})} style={{padding:"6px 4px",borderRadius:7,fontSize:11,fontWeight:700,background:acct.lotSize===l?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:"1px solid "+(acct.lotSize===l?"#6366f1":"#2d3548"),color:acct.lotSize===l?"#a5b4fc":"#6b7a9a"}}>{l} MNQ</button>
                  ))}
                </div>
                <div style={{background:"rgba(99,102,241,0.08)",borderRadius:8,padding:"8px 10px",marginBottom:8}}>
                  <div style={{color:"#8b96b0",fontSize:10}}>
                    {acct.lotSize||1} MNQ → SL: <span style={{color:R,fontWeight:700}}>-${((acct.lotSize||1)*20).toFixed(0)}</span> | TP: <span style={{color:G,fontWeight:700}}>+${((acct.lotSize||1)*40).toFixed(0)}</span> | EV/Trade: <span style={{color:B,fontWeight:700}}>{(()=>{const w=t09.length?t09.filter(t=>t.pnl>0).length/t09.length:0.5;return((w*(acct.lotSize||1)*40-(1-w)*(acct.lotSize||1)*20)).toFixed(0);})()} $</span>
                  </div>
                </div>
                {acct.type==='challenge'&&<div>
                  <div style={{color:"#a5b4fc",fontSize:11,fontWeight:700,marginTop:10,marginBottom:8}}>CHALLENGE ZIEL</div>
                  <Field label="ZIEL SALDO ($)"><input type="number" defaultValue={acct.target} onBlur={e=>{const v=parseInt(e.target.value);if(!isNaN(v))saveAcct({...acct,target:v});}} style={{background:"transparent",border:"none",fontSize:13,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                  <div style={{color:"#6b7a9a",fontSize:9,marginBottom:6}}>z.B. $50k + 8% Ziel = 54000 eingeben</div>
                  <Field label="ZEITRAUM (TAGE)"><input type="number" defaultValue={acct.targetDays} onBlur={e=>{const v=parseInt(e.target.value);if(!isNaN(v))saveAcct({...acct,targetDays:v});}} style={{background:"transparent",border:"none",fontSize:13,fontWeight:700,color:"#f0f4ff",width:"100%",outline:"none"}}/></Field>
                </div>}
                <div style={{background:"rgba(99,102,241,0.08)",borderRadius:8,padding:"8px 10px",margin:"10px 0"}}>
                  <div style={{color:"#8b96b0",fontSize:10}}>Challenge läuft seit: <span style={{color:"#a5b4fc",fontWeight:700}}>{challengeStart==='2000-01-01'?'Nicht gestartet':challengeStart}</span></div>
                </div>
                <button onClick={()=>{if(window.confirm("Challenge starten:\nKonto: $"+acct.size.toLocaleString()+"\nMax DD: $"+acct.maxDD+"\nZiel: $"+acct.target+"\n\nAlles startet bei 0!")){startChallenge();}}} style={{marginBottom:8,background:"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",padding:"12px",width:"100%",fontWeight:800,fontSize:13,borderRadius:10}}>🚀 Challenge starten / neu starten</button>
                <button onClick={()=>{if(window.confirm("Alle Daten löschen?")){{localStorage.clear();window.location.reload();}}}} style={{background:"rgba(239,68,68,0.06)",color:R,border:"1px solid rgba(239,68,68,0.2)",padding:"10px",width:"100%",fontWeight:600,fontSize:11,borderRadius:10}}>Alle Daten löschen</button>
              </div>}
            </div>
          ))}
          <div style={{paddingTop:12,color:"#4a5568",fontSize:10,textAlign:"center"}}>MindRisk v2.0 · Claude AI ✅</div>
        </div>
      </div>}

      {/* AI COACH – FUTURISTISCH */}
      <div style={{position:"fixed",bottom:isDesktop?0:88,right:0,zIndex:200,top:isDesktop?0:"auto",width:isDesktop?"370px":"auto"}}>
        {!aiOpen&&!isDesktop&&(
          <button onClick={()=>{setAiOpen(true);if(aiMessages.length===0){setAiMessages([{role:"assistant",content:smartCoach("","daily_motivation")}]);}}}
            style={{width:54,height:54,borderRadius:"50%",border:"none",padding:0,position:"relative",overflow:"visible",cursor:"pointer",background:"transparent",WebkitTapHighlightColor:"transparent"}}>
            {/* Pulsing rings – echter Herzschlag */}
            <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"rgba(99,102,241,0.5)",animation:"orbRing1 1.4s ease-out infinite",pointerEvents:"none"}}/>
            <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"rgba(168,85,247,0.4)",animation:"orbRing2 1.4s ease-out infinite 0.45s",pointerEvents:"none"}}/>
            <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"rgba(99,102,241,0.25)",animation:"orbRing3 1.4s ease-out infinite 0.9s",pointerEvents:"none"}}/>
            {/* Main sphere – atmet */}
            <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"radial-gradient(circle at 35% 28%,#e0d4ff 0%,#c4b5fd 15%,#a78bfa 35%,#7c3aed 60%,#4c1d95 85%,#1e1b4b 100%)",animation:"livingOrb 2.2s ease-in-out infinite",boxShadow:"0 0 25px rgba(99,102,241,0.7),0 0 50px rgba(168,85,247,0.4),inset 0 0 15px rgba(255,255,255,0.15)"}}/>
            {/* Rotierender Ring */}
            <div style={{position:"absolute",inset:3,borderRadius:"50%",border:"1.5px solid transparent",borderTopColor:"rgba(255,255,255,0.6)",borderRightColor:"rgba(196,181,253,0.4)",animation:"orbSpin 4s linear infinite",pointerEvents:"none"}}/>
            {/* Kern-Licht */}
            <div style={{position:"absolute",top:"20%",left:"22%",width:20,height:20,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,255,255,0.95) 0%,rgba(221,214,254,0.6) 50%,transparent 75%)",filter:"blur(3px)",animation:"orbCore 2s ease-in-out infinite",pointerEvents:"none"}}/>
          </button>
        )}
        {(aiOpen||isDesktop)&&(
          <div style={{width:isDesktop?"400px":320,maxWidth:isDesktop?"400px":"calc(100vw - 32px)",background:isDesktop?"#131d30":"#131d30",border:isDesktop?"none":"1px solid #6366f1",borderLeft:isDesktop?"1px solid rgba(99,102,241,0.3)":"none",borderRadius:isDesktop?0:16,boxShadow:isDesktop?"none":"0 8px 32px rgba(99,102,241,0.3)",display:"flex",flexDirection:"column",height:isDesktop?"100vh":"auto",maxHeight:isDesktop?"100vh":"80vh",minHeight:isDesktop?"100vh":360}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #2d3548",display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,rgba(99,102,241,0.15),rgba(168,85,247,0.1))",borderRadius:"16px 16px 0 0"}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",animation:"orb 3s ease infinite",flexShrink:0}}>
                  <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                    <circle cx="10" cy="12" r="2.5" fill="white" opacity="0.9"/>
                    <circle cx="18" cy="12" r="2.5" fill="white" opacity="0.9"/>
                    <path d="M9 17.5 Q14 21 19 17.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  </svg>
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:"#f0f4ff"}}>MindRisk Coach</div>
                  <div style={{color:B,fontSize:10,fontWeight:600}}>Claude AI ✦</div>
                </div>
              </div>
              {!isDesktop&&<button onClick={()=>setAiOpen(false)} style={{background:"rgba(255,255,255,0.08)",color:"#8b96b0",fontSize:16,padding:"4px 8px",borderRadius:6}}>×</button>}
            </div>
            <div ref={chatContainerRef} onScroll={e=>{const el=e.target;const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<60;userScrolledUp.current=!atBottom;}} style={{flex:1,overflowY:"scroll",WebkitOverflowScrolling:"touch",padding:12,display:"flex",flexDirection:"column",gap:8,minHeight:0}}>
              {checkedIn&&mindLight&&mindLight!=='green'&&(
                <div style={{background:mindLight==='red'?"rgba(239,68,68,0.12)":"rgba(245,158,11,0.12)",border:"1px solid "+(mindLight==='red'?"rgba(239,68,68,0.4)":"rgba(245,158,11,0.4)"),borderRadius:10,padding:"8px 12px",marginBottom:4,display:"flex",gap:8,alignItems:"flex-start",flexShrink:0}}>
                  <span style={{fontSize:16,flexShrink:0}}>{mindLight==='red'?"🚫":"⚠️"}</span>
                  <div>
                    <div style={{color:mindLight==='red'?R:Y,fontWeight:700,fontSize:11,marginBottom:2}}>{mindLight==='red'?"Heute NICHT traden!":"Heute vorsichtig sein"}</div>
                    {mindMsg&&<div style={{color:"#a8b8d0",fontSize:10,lineHeight:1.4}}>{mindMsg}</div>}
                  </div>
                </div>
              )}
              {aiMessages.length===0&&!aiLoading&&(
                <div style={{color:"#8b96b0",fontSize:12,textAlign:"center",padding:16}}>Tippe eine Frage – echte Claude KI antwortet!</div>
              )}
              {aiMessages.map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                  <div style={{maxWidth:"85%",padding:"8px 12px",borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",background:m.role==="user"?"linear-gradient(135deg,"+B+","+P+")":"#0d1825",border:"1px solid "+(m.role==="user"?"transparent":"#1e2d48"),fontSize:12,color:"#f0f4ff",lineHeight:1.5,whiteSpace:"pre-wrap"}}>
                    {m.content}
                  </div>
                </div>
              ))}
              {aiLoading&&(
                <div style={{display:"flex",gap:4,padding:"4px 8px"}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:B,animation:"pulse 1s infinite"}}/>
                  <div style={{width:7,height:7,borderRadius:"50%",background:P,animation:"pulse 1s infinite 0.2s"}}/>
                  <div style={{width:7,height:7,borderRadius:"50%",background:B,animation:"pulse 1s infinite 0.4s"}}/>
                </div>
              )}
              <div ref={aiMessagesEndRef}/>
            </div>
            <div style={{padding:"6px 12px",borderTop:"1px solid #2d3548"}}>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>triggerAiPopup("daily_motivation")} style={{background:"rgba(0,211,149,0.15)",color:G,fontSize:10,padding:"5px 10px",borderRadius:20,border:"1px solid "+G+"44",fontWeight:700,flex:1}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg> Tages-Briefing</button>
                <button onClick={()=>setAiInput("Soll ich traden?")} style={{background:"rgba(99,102,241,0.15)",color:B,fontSize:10,padding:"5px 10px",borderRadius:20,border:"1px solid "+B+"44",fontWeight:600,flex:1}}>Soll ich traden?</button>
                <button onClick={()=>setShowMoreButtons(p=>!p)} style={{background:"rgba(255,255,255,0.05)",color:"#6b7a9a",fontSize:16,padding:"4px 10px",borderRadius:20,border:"1px solid #2d3548",flexShrink:0,lineHeight:1}}>{showMoreButtons?"▲":"···"}</button>
              </div>
              {showMoreButtons&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}>
                {["Analysiere meine Schwächen","Beste Handelszeit?","Diese Woche?"].map(q=>(
                  <button key={q} onClick={()=>{setAiInput(q);setShowMoreButtons(false);}} style={{background:"rgba(99,102,241,0.15)",color:B,fontSize:10,padding:"4px 10px",borderRadius:20,border:"1px solid "+B+"44",fontWeight:600}}>{q}</button>
                ))}
                {t09.length>0&&<button onClick={()=>{const last=t09[t09.length-1];setAiInput("Analysiere: "+last.contract+" "+last.dir+" "+(last.pnl>=0?"+":"")+last.pnl.toFixed(2)+"$ um "+last.time+" am "+last.date);setShowMoreButtons(false);}} style={{background:"rgba(0,211,149,0.15)",color:G,fontSize:10,padding:"4px 10px",borderRadius:20,border:"1px solid "+G+"44",fontWeight:600}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="12" width="4" height="10" rx="1"/><rect x="9" y="7" width="4" height="15" rx="1"/><rect x="16" y="3" width="4" height="19" rx="1"/></svg> Letzter Trade</button>}
              </div>}
            </div>

            {aiImagePreview&&<div style={{padding:"6px 12px",borderTop:"1px solid #2d3548",display:"flex",alignItems:"center",gap:8}}>
              <img src={aiImagePreview} alt="chart" style={{width:52,height:52,borderRadius:8,objectFit:"cover",border:"1px solid "+B+"44"}}/>
              <div style={{fontSize:11,color:"#a8b8d0",flex:1}}>📊 Chart wird mitgeschickt...</div>
              <button onClick={()=>{setAiImage(null);setAiImagePreview(null);}} style={{background:"none",color:"#ef4444",fontSize:18,padding:"2px 6px"}}>×</button>
            </div>}
            <div style={{padding:"8px 12px",borderTop:"1px solid #2d3548"}}>
              <input type="file" id="chartUpload" accept="image/*" onChange={handleImageSelect} style={{display:"none"}}/>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <button onClick={()=>document.getElementById("chartUpload").click()}
                  style={{background:"#131d30",border:"1px solid #2d3548",color:"#a8b8d0",padding:"9px 0",borderRadius:10,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontSize:11,fontWeight:600}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Chart
                </button>
                <button onClick={startVoice}
                  style={{background:isRecording?"rgba(239,68,68,0.3)":"#131d30",border:"1px solid "+(isRecording?"#ef4444":"#1e2d48"),color:isRecording?"#ef4444":"#a8b8d0",padding:"9px 0",borderRadius:10,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontSize:11,fontWeight:600}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  {isRecording?"Aufnahme":"Sprechen"}
                </button>
                <button onClick={()=>{setAiMessages([]);localStorage.removeItem('ttp_chat_history');}}
                  style={{background:"#131d30",border:"1px solid #2d3548",color:"#4b5568",padding:"9px 12px",borderRadius:10,fontSize:13,flexShrink:0}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <textarea value={aiInput} onChange={e=>setAiInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendAiMessage())}
                  placeholder={isRecording?"🎤 Höre zu...":"Frag deinen Coach..."}
                  rows={4}
                  style={{flex:1,fontSize:13,padding:"12px 14px",borderRadius:14,background:"#111725",border:"1px solid #2d3548",resize:"none",lineHeight:1.5,maxHeight:140,overflowY:"auto",color:"#f0f4ff",fontFamily:"inherit"}}/>
                <button id="aiSendBtn" onClick={sendAiMessage} disabled={aiLoading||(!aiInput.trim()&&!aiImage)}
                  style={{background:"linear-gradient(135deg,"+B+","+P+")",color:"#fff",padding:"13px 15px",borderRadius:14,fontSize:16,fontWeight:700,opacity:aiLoading||(!aiInput.trim()&&!aiImage)?0.4:1,flexShrink:0}}>→</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
