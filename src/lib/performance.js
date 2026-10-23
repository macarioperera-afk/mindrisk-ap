export function performance(trades){
 const rows=trades.filter(t=>t.pnl!==null&&t.pnl!==undefined&&t.pnl!==''&&Number.isFinite(Number(t.pnl))).slice().sort((a,b)=>(String(a.date)+' '+(a.time||'')).localeCompare(String(b.date)+' '+(b.time||'')));
 let pnl=0,peak=0,maxDrawdown=0,gains=0,losses=0,wins=0,lossCount=0;const daily={},curve=[{index:0,pnl:0,date:'Start'}];
 for(const t of rows){const n=Number(t.pnl);pnl+=n;peak=Math.max(peak,pnl);maxDrawdown=Math.max(maxDrawdown,peak-pnl);if(n>0){gains+=n;wins++}if(n<0){losses-=n;lossCount++}const date=String(t.date).slice(0,10);daily[date]??={pnl:0,count:0};daily[date].pnl+=n;daily[date].count++;curve.push({index:curve.length,pnl,date});}
 return {rows,pnl,gains,losses,wins,lossCount,maxDrawdown,daily,curve,winRate:rows.length?wins/rows.length*100:null,profitFactor:losses?gains/losses:gains?Infinity:null,expectancy:rows.length?pnl/rows.length:null,avgWin:wins?gains/wins:null,avgLoss:lossCount?losses/lossCount:null};
}
export function localDay(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
