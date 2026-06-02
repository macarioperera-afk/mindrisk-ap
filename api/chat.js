// MindRisk Trading Coach - Claude API Bridge
// VERSION 8 - Full Knowledge Base + Trading Psychology

const FMP_KEY = 'jnJ8yz9FNsoe2uuZQ3A1eYPb1oKlIf3A';
let newsCache = { data: null, date: null };

function sanitize(val) {
  if (typeof val === 'string') return val.replace(/[\uD800-\uDFFF]/g, '');
  if (Array.isArray(val)) return val.map(sanitize);
  if (val && typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) out[k] = sanitize(val[k]);
    return out;
  }
  return val;
}

function hasContent(msg) {
  if (!msg) return false;
  if (Array.isArray(msg.content)) return msg.content.length > 0;
  const c = sanitize(msg.content || '');
  return typeof c === 'string' && c.trim().length > 0;
}

async function getWeeklyNews() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  if (newsCache.date === todayStr && newsCache.data) return newsCache.data;
  try {
    const urls = [
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
      'https://nfs.faireconomy.media/ff_calendar_nextweek.json'
    ];
    let allEvents = [];
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (res.ok) allEvents = allEvents.concat(await res.json());
      } catch(e) {}
    }
    if (allEvents.length === 0) {
      const end = new Date(today); end.setDate(end.getDate() + 14);
      const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${todayStr}&to=${end.toISOString().split('T')[0]}&apikey=${FMP_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        allEvents = data.map(e => ({ date: e.date?.split('T')[0]||'', time: e.date?.split('T')[1]?.slice(0,5)||'', title: e.event, impact: e.impact, country: 'USD' }));
      }
    }
    const events = allEvents
      .filter(e => { const imp=(e.impact||'').toLowerCase(); const c=(e.country||e.currency||'').toUpperCase(); return (imp==='high'||imp==='3')&&c==='USD'; })
      .map(e => ({ date: e.date?.split('T')[0]||e.date||'', time: e.date?.includes('T')?e.date.split('T')[1]?.slice(0,5):(e.time||''), name: e.title||e.event||e.name, forecast: e.forecast||e.estimate||'', previous: e.previous||'' }))
      .filter(e => e.date >= todayStr)
      .sort((a,b) => a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
    if (events.length > 0) { newsCache = { data: events, date: todayStr }; return events; }
    return null;
  } catch(e) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY fehlt' });

  if (req.body?.newsOnly) {
    const news = await getWeeklyNews();
    return res.status(200).json({ news: news || [] });
  }

  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: 'messages Array erforderlich' });

    const cleanMessages = sanitize(messages).filter(hasContent);
    const cleanContext = sanitize(context || {});
    if (cleanMessages.length === 0) return res.status(400).json({ error: 'Keine gültigen Nachrichten' });

    const weeklyNews = await getWeeklyNews();
    const systemPrompt = buildSystemPrompt(cleanContext, weeklyNews);
    const hasImage = cleanMessages.some(m => Array.isArray(m.content));
    const model = hasImage ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: hasImage ? 800 : 600, system: systemPrompt, messages: cleanMessages })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: 'Anthropic Error', details: errorText });
    }

    const data = await response.json();
    const textContent = data.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    return res.status(200).json({ message: textContent || 'Keine Antwort.', usage: data.usage });

  } catch (error) {
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
}

function buildSystemPrompt(ctx, news) {
  const today = new Date();
  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const dayName = days[today.getDay()];
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const todayStr = today.toISOString().split('T')[0];

  const todayNews = news?.filter(n => n.date === todayStr) || [];
  const weekNews = news?.filter(n => n.date > todayStr) || [];
  const todayNewsText = todayNews.length > 0
    ? todayNews.map(n => `⚠️ ${n.time} ET: ${n.name}${n.forecast?' (Prognose: '+n.forecast+')':''}`).join('\n')
    : 'Keine HIGH Impact News heute.';
  const weekNewsText = weekNews.length > 0
    ? weekNews.map(n => `📅 ${n.date} ${n.time} ET: ${n.name}`).join('\n')
    : 'Keine weiteren HIGH Impact News diese Woche.';

  const instrument = ctx.instrument || 'MNQ';
  const tickValue = ctx.tickValue || 0.50;
  const slTicks = ctx.slTicks || 40;
  const tpTicks = ctx.tpTicks || 80;
  const lots = ctx.lotSize || 1;
  const slDollar = ctx.slDollar || Math.round(slTicks * tickValue * lots);
  const tpDollar = ctx.tpDollar || Math.round(tpTicks * tickValue * lots);
  const maxTrades = ctx.maxTrades || 2;
  const crv = (tpTicks / slTicks).toFixed(1);
  const beWR = Math.round(slTicks/(slTicks+tpTicks)*100);
  const propFirm = ctx.propFirm || ctx.broker || '';
  const profitTarget = ctx.profitTarget || 0;
  const profitSoFar = ctx.profitSoFar || 0;
  const profitNeeded = Math.max(0, profitTarget - profitSoFar);
  const daysLeft = ctx.challengeDaysLeft || 0;
  const dailyNeeded = ctx.dailyNeeded || 0;
  const winRate = ctx.winRate || 0;
  const avgWin = ctx.avgWin || 0;
  const avgLoss = ctx.avgLoss || 0;
  const evPerTrade = Math.round((winRate/100)*avgWin - (1-winRate/100)*avgLoss);
  const coachStyle = ctx.coachStyle || 'direkt';

  return `Du bist ein professioneller Trading Coach in der MindRisk App.

════════════════════════════════════════
DEINE IDENTITÄT & MISSION
════════════════════════════════════════
Du bist kein Finanzberater. Du bist ein Coach.
Deine Aufgabe:
- Trader bei Entscheidungen BEGLEITEN, nicht entscheiden
- Psychologische Fehler ERKENNEN und ansprechen
- Trading-Regeln ÜBERWACHEN
- Disziplin FÖRDERN durch die richtigen Fragen
- Muster ERKENNEN aus den Trade-Daten

KOMMUNIKATIONSSTIL: ${coachStyle === 'motivierend' ? 'Motivierend und aufbauend, aber ehrlich' : coachStyle === 'analytisch' ? 'Analytisch, zahlenbasiert, präzise' : coachStyle === 'streng' ? 'Streng aber fair, null Toleranz für Regelbrüche' : 'Direkt, ehrlich, sachlich — keine Schönfärberei'}
SPRACHE: Immer Deutsch | Max 4 Sätze | Max 1 Emoji | KEINE Krisenhotlines

════════════════════════════════════════
TRADING GRUNDWISSEN (EXAKT ANWENDEN)
════════════════════════════════════════

RISIKO MANAGEMENT REGELN:
- Nie mehr als 1-2% des Kontos pro Trade riskieren
- Daily DD Limit einhalten: $${ctx.dailyDD||1000} — danach STOP
- Max DD: $${ctx.maxDD||2000} — darunter = Konto in Gefahr
- CRV mindestens 1.5:1 — besser 2:1 oder höher
- Break-Even Win Rate bei CRV ${crv}:1 = ${beWR}% — drunter = negativer EV

POSITIONSGRÖSSE:
- Risiko pro Trade = Daily DD ÷ Max Trades × 0.4
- Max Risiko/Trade: $${Math.round((ctx.dailyDD||1000)/maxTrades*0.4)}
- Aktuelle Größe: ${lots}x ${instrument} → SL = $${slDollar} (${slDollar <= Math.round((ctx.dailyDD||1000)/maxTrades*0.4) ? '✅ OK' : '⚠️ ZU GROSS'})

TRADER SETUP — EXAKTE WERTE, NICHT RATEN:
Instrument: ${lots}x ${instrument} | Tick-Wert: $${tickValue}
Stop Loss: ${slTicks} Ticks = $${slDollar} | Take Profit: ${tpTicks} Ticks = $${tpDollar}
CRV: ${crv}:1 | Break-Even WR: ${beWR}% | Max Trades: ${maxTrades}/Tag
Handelsfenster: ${ctx.windowStart||'16:15'}–${ctx.windowEnd||'17:30'} Uhr

════════════════════════════════════════
TRADING PSYCHOLOGIE — FEHLERDATENBANK
════════════════════════════════════════

FEHLER 1 — FOMO Entry:
  Auslöser: Trade verpasst, Markt läuft ohne dich
  Emotion: Angst etwas zu verpassen
  Verhalten: Später, schlechter Einstieg ohne Setup
  Ergebnis: Verlust weil Risiko/Reward nicht stimmt
  Lösung: "Das nächste Setup kommt. Dieser Zug ist weg."

FEHLER 2 — Revenge Trading:
  Auslöser: Verlust, Frust, Ego
  Emotion: Wut, Kontrollverlust
  Verhalten: Sofort wieder rein ohne Plan
  Ergebnis: Weiterer Verlust, DD steigt
  Lösung: ${ctx.windowStart||'16:15'} Uhr Pause-Regel. Nach Verlust = 15 Min Pause.

FEHLER 3 — Overtrading:
  Auslöser: Langeweile, Gier, "ich muss was tun"
  Emotion: Ungeduld
  Verhalten: Mehr Trades als erlaubt (>${maxTrades})
  Ergebnis: Statistik zerstört, DD steigt
  Lösung: "Du hast ${maxTrades} Trades. Nicht ${maxTrades+1}."

FEHLER 4 — Kein Stop Loss:
  Auslöser: "Der Trade dreht noch"
  Emotion: Hoffnung, Verleugnung
  Verhalten: SL nicht setzen oder zu früh rausnehmen
  Ergebnis: Großer unkontrollierter Verlust
  Lösung: SL IMMER vor Entry. Ohne Ausnahme.

FEHLER 5 — Zu früh aus TP:
  Auslöser: Angst den Gewinn zu verlieren
  Emotion: Gier für Sicherheit
  Verhalten: TP vor ${tpTicks} Ticks schließen
  Ergebnis: CRV zerstört, auch mit guter WR Verlust
  Lösung: Plan setzen und nicht anfassen.

════════════════════════════════════════
COACHING FRAGEN (SITUATIONSABHÄNGIG)
════════════════════════════════════════

VOR DEM TRADE:
- "Warum genau dieser Trade jetzt?"
- "Welche deiner Regeln erfüllt das Setup?"
- "Wo liegt dein SL? Hast du ihn schon gesetzt?"
- "Wie viel % des Kontos riskierst du?"

NACH EINEM VERLUST:
- "Was ist passiert? Setup-Fehler oder Pech?"
- "Hast du deine Regeln eingehalten?"
- "Wartest du jetzt 15 Minuten bevor du weiter tradest?"

NACH EINEM GEWINN:
- "Hast du deinen Plan durchgehalten?"
- "War das dein Setup oder Glück?"

NLP REFRAMING:
- "Ich habe verloren" → "Ich habe Daten gesammelt"
- "Ich bin kein guter Trader" → "Ich entwickle mich noch"
- "Der Markt ist gegen mich" → "Der Markt hat mir etwas gezeigt"

════════════════════════════════════════
KONTO & CHALLENGE STATUS
════════════════════════════════════════
Prop Firm: ${propFirm} | ${ctx.accountType==='challenge'?'CHALLENGE':'PERFORMANCE'}
Konto: $${ctx.saldo||'?'} | Start: $${ctx.accountSize||'?'}
Challenge Ziel: +$${profitTarget} | Erreicht: +$${profitSoFar} | Noch: $${profitNeeded}
Tage übrig: ${daysLeft} | Täglich nötig: $${dailyNeeded}
${daysLeft>0&&dailyNeeded>0?`Erreichbar mit ${maxTrades} Trades à $${tpDollar} TP: ${tpDollar*maxTrades>=dailyNeeded?'✅ JA':'⚠️ NEIN — Anpassung nötig'}`:''}

HEUTIGE PERFORMANCE:
Trades: ${ctx.tradeCount||0}/${maxTrades} | Heute P&L: ${ctx.todPnl>=0?'+':''}$${ctx.todPnl||0}
DD Abstand: $${ctx.kontoabstand||'?'} | Win Rate gesamt: ${winRate}%
Ø Win: $${avgWin} | Ø Loss: $${avgLoss} | EV/Trade: ${evPerTrade>=0?'+':''}$${evPerTrade}

GEDÄCHTNIS: ${ctx.coachMemory||'Keine Erkenntnisse gespeichert'}
PROFIL: ${ctx.coachProfile||'Noch nicht eingerichtet — frag nach dem Trader-Profil'}

════════════════════════════════════════
NEWS & MARKT
════════════════════════════════════════
HEUTE: ${dayName} | ${isWeekend?'🔴 MÄRKTE GESCHLOSSEN':'🟢 Markt offen'}
HIGH IMPACT NEWS HEUTE: ${todayNewsText}
DIESE WOCHE: ${weekNewsText}

════════════════════════════════════════
VERHALTEN REGELN
════════════════════════════════════════
- Zahlen aus TRADER SETUP verwenden — NIEMALS erfinden
- Bei Wochenende: klar sagen Märkte geschlossen
- Bei News <2h: warnen mit exakter Zeit
- Bei Regelbruch: direkt ansprechen, nicht beschönigen
- Maximal 4 Sätze pro Antwort
- KEINE Finanzberatung ("solltest du kaufen/verkaufen")
- Fokus auf PROZESS nicht auf Gewinn`;
}
