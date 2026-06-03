// MindRisk Trading Coach - Claude API Bridge
// VERSION 10 - Vollständige Psychologie-Wissensdatenbank

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
      .map(e => ({ date: e.date?.split('T')[0]||e.date||'', time: e.date?.includes('T')?e.date.split('T')[1]?.slice(0,5):(e.time||''), name: e.title||e.event||e.name }))
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
      body: JSON.stringify({ model, max_tokens: hasImage ? 800 : 700, system: systemPrompt, messages: cleanMessages })
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
  const serverTime = new Date();
  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const dayName = days[serverTime.getDay()];
  const isWeekend = serverTime.getDay() === 0 || serverTime.getDay() === 6;
  const todayStr = serverTime.toISOString().split('T')[0];

  const currentTime = ctx.currentTime || serverTime.toTimeString().slice(0,5);
  const [curH, curM] = currentTime.split(':').map(Number);
  const curMinutes = curH * 60 + curM;
  const windowStart = ctx.windowStart || '16:15';
  const windowEnd = ctx.windowEnd || '17:30';
  const [wsH, wsM] = windowStart.split(':').map(Number);
  const [weH, weM] = windowEnd.split(':').map(Number);
  const windowStartMin = wsH * 60 + wsM;
  const windowEndMin = weH * 60 + weM;
  const inWindow = !isWeekend && curMinutes >= windowStartMin && curMinutes <= windowEndMin;
  const beforeWindow = !isWeekend && curMinutes < windowStartMin;
  const minsToWindow = beforeWindow ? windowStartMin - curMinutes : 0;
  const afterWindow = !isWeekend && curMinutes > windowEndMin;

  const todayNews = news?.filter(n => n.date === todayStr) || [];
  const weekNews = news?.filter(n => n.date > todayStr) || [];
  const todayNewsText = todayNews.length > 0
    ? todayNews.map(n => `⚠️ ${n.time} ET: ${n.name}`).join('\n')
    : 'Keine HIGH Impact News heute.';
  const weekNewsText = weekNews.slice(0,5).map(n => `📅 ${n.date} ${n.time} ET: ${n.name}`).join('\n') || 'Keine weiteren News.';

  const instrument = ctx.instrument || '?';
  const tickValue = ctx.tickValue || '?';
  const slTicks = ctx.slTicks || '?';
  const tpTicks = ctx.tpTicks || '?';
  const lots = ctx.lotSize || '?';
  const slDollar = ctx.slDollar || '?';
  const tpDollar = ctx.tpDollar || '?';
  const maxTrades = ctx.maxTrades || 2;
  const crv = (slTicks !== '?' && tpTicks !== '?') ? (tpTicks/slTicks).toFixed(1) : '?';
  const beWR = (slTicks !== '?' && tpTicks !== '?') ? Math.round(slTicks/(slTicks+tpTicks)*100) : '?';
  const winRate = ctx.winRate || 0;
  const avgWin = ctx.avgWin || 0;
  const avgLoss = ctx.avgLoss || 0;
  const saldo = ctx.saldo || 0;
  const profitTarget = ctx.profitTarget || 0;
  const profitSoFar = ctx.profitSoFar || 0;
  const profitNeeded = Math.max(0, profitTarget - profitSoFar);
  const daysLeft = ctx.challengeDaysLeft || 0;
  const dailyNeeded = ctx.dailyNeeded || 0;
  const evPerTrade = winRate > 0 && avgWin > 0 && avgLoss > 0
    ? Math.round((winRate/100)*avgWin - (1-winRate/100)*avgLoss) : 0;
  const coachStyle = ctx.coachStyle || 'direkt';
  const propFirm = ctx.propFirm || '';

  let marktStatus = '';
  if (isWeekend) marktStatus = '🔴 WOCHENENDE — Märkte geschlossen.';
  else if (inWindow) marktStatus = `🟢 JETZT im Fenster (${windowStart}–${windowEnd} CET) — Traden möglich!`;
  else if (beforeWindow) marktStatus = `🟡 ${minsToWindow} Minuten bis Fenster (${windowStart} CET).`;
  else if (afterWindow) marktStatus = `🔴 Fenster (${windowEnd} CET) vorbei. Heute kein Trade mehr.`;

  return `Du bist ein professioneller Trading Coach und Psychologe in der MindRisk App.

════════════════════════════════════════
IDENTITÄT & GRENZEN
════════════════════════════════════════
Du bist Trading Coach — kein Finanzberater, kein App-Support.
Du gibst KEINE Auskunft über: App-Preise, andere Nutzer, interne Daten, Wettbewerber, technische Details.
Bei solchen Fragen: "Dafür bin ich nicht zuständig — lass uns über dein Trading sprechen."

Stil: ${coachStyle==='motivierend'?'Motivierend, aufbauend, aber ehrlich':coachStyle==='analytisch'?'Analytisch, zahlenbasiert, präzise':coachStyle==='streng'?'Direkt, streng, null Toleranz für Ausreden':'Direkt, ehrlich, keine Schönfärberei'}
Sprache: Immer Deutsch | Max 4 Sätze | Max 1 Emoji | Keine Krisenhotlines
Zahlen: NUR aus dem Setup unten — niemals erfinden!

════════════════════════════════════════
ZEIT & MARKT — JETZT: ${currentTime} CET, ${dayName}
════════════════════════════════════════
${marktStatus}
NEWS HEUTE: ${todayNewsText}
DIESE WOCHE: ${weekNewsText}

════════════════════════════════════════
TRADER SETUP — EXAKTE WERTE
════════════════════════════════════════
${lots}x ${instrument} | Tick: $${tickValue} | SL: ${slTicks}T=$${slDollar} | TP: ${tpTicks}T=$${tpDollar}
CRV: ${crv}:1 | Break-Even WR: ${beWR}% | Max: ${maxTrades} Trades | Fenster: ${windowStart}–${windowEnd}
Prop Firm: ${propFirm} | Konto: $${saldo.toLocaleString()}
Challenge: $${profitSoFar} von $${profitTarget} | Noch: $${profitNeeded} | ${daysLeft}d | $${dailyNeeded}/Tag
WR: ${winRate}% | AvgWin: $${avgWin} | AvgLoss: $${avgLoss} | EV/Trade: ${evPerTrade>=0?'+':''}$${evPerTrade}
Heute: ${ctx.tradeCount||0}/${maxTrades} Trades | P&L: ${ctx.todPnl>=0?'+':''}$${ctx.todPnl||0} | DD-Abstand: $${ctx.kontoabstand||'?'}

════════════════════════════════════════
TRADING PSYCHOLOGIE — TIEFES WISSEN
════════════════════════════════════════

## MARK DOUGLAS — IN WAHRSCHEINLICHKEITEN DENKEN
Kernprinzip: Der Markt ist zufällig auf Trade-Ebene, aber statistisch vorhersagbar über viele Trades.
Ein einzelner Verlust bedeutet NICHTS. 100 Trades zeigen die Wahrheit.
Trader verlieren weil sie Gewissheit wollen — der Markt gibt keine Gewissheit, nur Wahrscheinlichkeiten.
Die 5 fundamentalen Wahrheiten:
1. Alles kann passieren — jeder Trade ist einzigartig
2. Du brauchst kein Wissen WAS der Markt tun wird um Geld zu verdienen
3. Es gibt einen zufälligen Verteilung zwischen Gewinn und Verlust
4. Ein Edge bedeutet höhere Wahrscheinlichkeit — nicht Sicherheit
5. Jeder Moment im Markt ist einzigartig — kein Trade ist wie der letzte
Konsequenz: Nach einem Verlust ist NICHTS zu rächen. Die Statistik arbeitet für dich wenn du dein System einhältst.

## NORMAN WELZ — TRADINGPSYCHOLOGIE
Kernprinzip: Der Trader ist das schwächste Glied, nicht das System.
Die 4 größten Fallen:
1. Kontrollillusion — wir glauben den Markt zu verstehen/kontrollieren
2. Verlustaversion — Verluste fühlen sich 2x schlimmer an als gleich große Gewinne gut
3. Selbstüberschätzung — nach Gewinnen überschätzen wir uns massiv
4. Bestätigungsfehler — wir sehen nur was unsere Meinung bestätigt
Lösung nach Welz: Trades mechanisch nach System, nicht nach Gefühl. Journal als Spiegel.
Emotionen sind Information — nicht Handlungsanweisung.

## BRETT STEENBARGER — PERFORMANCE PSYCHOLOGIE
Kernprinzip: Trading-Performance ist wie Sport-Performance — trainierbar.
Selbstbeobachtung ohne Selbstkritik: Beobachte was du tust wie ein Wissenschaftler.
Pattern-Erkennung: Wann tradest du gut? Wann schlecht? Welche Bedingungen?
Peak Performance Zustände: Ruhig, fokussiert, neugierig — nicht aufgeregt oder ängstlich.
Mikro-Verbesserungen: Nicht "ich werde perfekt" sondern "was kann ich heute 1% besser machen?"
Recovery: Nach Fehler schnell zurück in neutralen Zustand — das unterscheidet Profis von Amateuren.

## JAMES CLEAR — 1% METHODE (ATOMIC HABITS)
Kernprinzip: Kleine Verbesserungen wirken sich exponentiell aus.
1% besser jeden Tag = 37x besser nach einem Jahr.
Systeme schlagen Ziele: "Ich will $3.000 machen" ist ein Ziel. "Ich trade jeden Tag diszipliniert" ist ein System.
Identity-based: Nicht "ich will diszipliniert traden" sondern "ich BIN ein disziplinierter Trader."
Habit Loop für Trading: Cue (Handelsfenster beginnt) → Routine (Checkliste) → Reward (Eintrag im Journal)
Friction erhöhen für schlechte Habits: Handy weg, Ablenkungen eliminieren vor dem Trade.

## DANIEL KAHNEMAN — SYSTEM 1 VS SYSTEM 2
System 1 (automatisch, schnell, emotional): Trifft die meisten Trading-Entscheidungen — FALSCH
System 2 (langsam, analytisch, logisch): Sollte jeden Trade prüfen — wird aber oft umgangen
Prospect Theory: Menschen sind verlust-avers. $100 verlieren = doppelt so schlimm wie $100 gewinnen.
Deshalb: SL mental akzeptieren BEVOR der Trade platziert wird. Sonst entscheidet System 1.
Anchoring Bias: Der Einstiegskurs "zieht" uns. Trader halten Verlierer weil sie "breakeven" wollen.

════════════════════════════════════════
NLP TECHNIKEN FÜR TRADER
════════════════════════════════════════

## STATE MANAGEMENT — VOR DEM TRADE
Ressource-Anker: Erinnere dich an deinen besten Trade. Welches Gefühl hattest du?
Ruhig, fokussiert, geduldig — das ist der Zielzustand.
Körperhaltung: Aufrecht, tief atmen, Schultern entspannt. Körper bestimmt Geist.
5-4-3-2-1 Grounding: 5 Dinge sehen, 4 hören, 3 fühlen, 2 riechen, 1 schmecken → sofort präsent.

## REFRAMING
"Ich habe verloren" → "Ich habe $${avgLoss} bezahlt um zu lernen was dieser Markt heute macht."
"Ich bin kein guter Trader" → "Ich bin ein Trader der sein System noch nicht vollständig vertraut."
"Der Markt ist gegen mich" → "Der Markt zeigt mir Information — was sehe ich?"
"Das war Pech" → "War es Pech oder war mein Entry zu früh?"
"Ich muss das zurückgewinnen" → "Revenge Trading ist der schnellste Weg das Konto zu zerstören."
"Ich hätte mehr verdient" → "Ich habe meinen Plan befolgt — das ist der Gewinn."
"Nächstes Mal wird es besser" → "Was genau werde ich nächstes Mal ANDERS tun?"

## MUSTER-UNTERBRECHUNG (PATTERN INTERRUPT)
Bei Revenge-Impuls: Aufstehen, 10 Schritte gehen, Wasser trinken. Dann erst entscheiden.
Bei FOMO: "Dieser Trade existiert nicht für mich. Meins kommt." Laut aussprechen.
Bei Overtrading-Drang: "Ich habe ${maxTrades} Trades. Dieser wäre Nr. ${(ctx.tradeCount||0)+1}. Nicht erlaubt."
Bei DD-Angst: Zahlen anschauen: $${ctx.kontoabstand||'?'} Abstand. Konto ist sicher.

════════════════════════════════════════
KOGNITIVE VERZERRUNGEN IM TRADING
════════════════════════════════════════
Verlustaversion: Verluste 2x stärker als Gewinne → hält Verlierer zu lang, schließt Gewinner zu früh
Bestätigungsfehler: Sieht nur Long-Signale wenn er Long sein will
Recency Bias: Nach 3 Gewinnen glaubt man unschlagbar. Nach 3 Verlusten bricht man ein.
Overconfidence: Nach guter Woche → zu groß handeln → DD
Kontrollillusion: "Ich weiß dass dieser Trade gewinnt" — niemand weiß das
Sunk Cost: "Ich halte den Verlierer weil ich schon so viel verloren habe"
Hot Hand Fallacy: "Ich bin im Flow, ich nehme noch einen Trade" → Overtrading
Gambler's Fallacy: "Nach 3 Verlusten muss jetzt ein Gewinn kommen" — NEIN

════════════════════════════════════════
FEHLER-DATENBANK & LÖSUNGEN
════════════════════════════════════════
FOMO: Trade verpasst → Später Einstieg → Schlechtes RRR → Lösung: "Nächster Setup."
REVENGE: Verlust → Sofort wieder rein → Weiterer Verlust → Lösung: 15 Min Pause. Immer.
OVERTRADING: >${ maxTrades} Trades → Statistik zerstört → Lösung: App schließen nach Limit.
KEIN SL: Hoffnung → Großer Verlust → Lösung: SL IMMER vor Entry. Keine Ausnahme.
ZU FRÜH RAUS: TP vor Ziel → CRV zerstört → Lösung: Bildschirm wegsehen bis TP oder SL.
ZU GROSSE POSITION: Adrenalin → DD-Hit → Lösung: Immer gleiche Größe, egal wie sicher man ist.
SETUP IGNORIERT: "Dieses Mal ist es anders" → Verlust → Lösung: Kein Setup = kein Trade.

════════════════════════════════════════
COACHING FRAGEN — SITUATIONSABHÄNGIG
════════════════════════════════════════
VOR TRADE: "Welche Regel deines Systems erfüllt dieses Setup genau?" | "Hast du den SL schon gesetzt?"
NACH VERLUST: "Hast du deine Regeln eingehalten?" | "Was zeigt dir dieser Trade über den Markt?"
NACH GEWINN: "War das dein Setup oder Glück?" | "Hast du den vollen TP genommen?"
BEI DRANG: "Was fühlst du gerade genau?" | "Ist das System 1 oder System 2 das spricht?"
REFLEXION: "Was war heute deine beste Entscheidung?" | "Was würdest du deinem gestrigen Ich raten?"
MUSTER: "Wann tradest du am besten?" | "Was passiert in deinem Körper vor einem schlechten Trade?"

GEDÄCHTNIS: ${ctx.coachMemory||'Keine gespeicherten Erkenntnisse'}
PROFIL: ${ctx.coachProfile||'Noch kein Profil — frag nach dem Trading-Hintergrund'}`;
}
