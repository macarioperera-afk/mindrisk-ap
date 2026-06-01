// MindRisk Trading Coach - Claude API Bridge
// VERSION 7 - Full Account Context (Instrument, Tick-Wert, SL/TP in $, Challenge)

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
      const end = new Date(today);
      end.setDate(end.getDate() + 14);
      const endStr = end.toISOString().split('T')[0];
      const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${todayStr}&to=${endStr}&apikey=${FMP_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        allEvents = data.map(e => ({
          date: e.date?.split('T')[0] || '',
          time: e.date?.split('T')[1]?.slice(0,5) || '',
          title: e.event, impact: e.impact, country: 'USD'
        }));
      }
    }
    const events = allEvents
      .filter(e => {
        const imp = (e.impact || '').toLowerCase();
        const country = (e.country || e.currency || '').toUpperCase();
        return (imp === 'high' || imp === '3') && country === 'USD';
      })
      .map(e => ({
        date: e.date?.split('T')[0] || e.date || '',
        time: e.date?.includes('T') ? e.date.split('T')[1]?.slice(0,5) : (e.time || ''),
        name: e.title || e.event || e.name,
        forecast: e.forecast || e.estimate || '',
        previous: e.previous || ''
      }))
      .filter(e => e.date >= todayStr)
      .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    if (events.length > 0) {
      newsCache = { data: events, date: todayStr };
      return events;
    }
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
    if (cleanMessages.length === 0)
      return res.status(400).json({ error: 'Keine gültigen Nachrichten' });

    const weeklyNews = await getWeeklyNews();
    const systemPrompt = buildSystemPrompt(cleanContext, weeklyNews);
    const hasImage = cleanMessages.some(m => Array.isArray(m.content));
    const model = hasImage ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: hasImage ? 800 : 500,
        system: systemPrompt,
        messages: cleanMessages
      })
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

  // ── Instrument & Setup ───────────────────────────────────
  const instrument = ctx.instrument || 'MNQ';
  const tickValue = ctx.tickValue || 0.50;
  const slTicks = ctx.slTicks || 40;
  const tpTicks = ctx.tpTicks || 80;
  const lots = ctx.lotSize || 1;
  const slDollar = ctx.slDollar || Math.round(slTicks * tickValue * lots);
  const tpDollar = ctx.tpDollar || Math.round(tpTicks * tickValue * lots);
  const maxTrades = ctx.maxTrades || 2;
  const crv = (tpTicks / slTicks).toFixed(1);
  const maxRiskDay = slDollar * maxTrades;
  const maxGainDay = tpDollar * maxTrades;

  // ── Challenge / Account ──────────────────────────────────
  const isChallenge = ctx.accountType === 'challenge';
  const propFirm = ctx.propFirm || ctx.broker || '';
  const profitTarget = ctx.profitTarget || 0;
  const profitSoFar = ctx.profitSoFar || 0;
  const profitNeeded = Math.max(0, profitTarget - profitSoFar);
  const daysLeft = ctx.challengeDaysLeft || 0;
  const dailyNeeded = ctx.dailyNeeded || (daysLeft > 0 ? Math.ceil(profitNeeded / daysLeft) : 0);
  const onTrack = dailyNeeded <= tpDollar * maxTrades;

  const challengeSection = isChallenge ? `
CHALLENGE (${propFirm || 'Prop Firm'}):
- Gewinnziel: $${profitTarget} | Erreicht: $${profitSoFar} | Noch: $${profitNeeded}
- Tage übrig: ${daysLeft} | Tägl. nötig: $${dailyNeeded}
- Status: ${onTrack ? '✅ Auf Kurs' : '⚡ Pace erhöhen nötig'}
- DD-Typ: ${ctx.ddType === 'eod' ? 'EOD (End of Day)' : 'Trailing'}
- Max DD: $${ctx.maxDD || 2000} | Daily DD: $${ctx.dailyDD || 1000}` : `
PERFORMANCE KONTO (${propFirm}):
- Monatsziel: $${profitTarget} | Erreicht: $${profitSoFar}
- Max DD: $${ctx.maxDD || 2000} | Daily DD: $${ctx.dailyDD || 1000}`;

  return `Du bist der persönliche Trading Coach in der MindRisk App.

ANTWORTSTIL:
- IMMER auf Deutsch, direkt wie ein Mentor
- Maximal 3-4 Sätze, kein Smalltalk
- Max 1 Emoji
- KEINE Krisenhotlines, KEINE Ausweichformulierungen

HEUTE: ${dayName}, ${today.toLocaleDateString('de-DE')}
MARKT: ${isWeekend ? '🔴 MÄRKTE GESCHLOSSEN — Kein Trading heute!' : '🟢 Märkte offen'}

HIGH IMPACT NEWS HEUTE (USD, 3 Sterne):
${todayNewsText}

HIGH IMPACT NEWS DIESE WOCHE:
${weekNewsText}

══════════════════════════════════════
TRADER SETUP — DIESE ZAHLEN SIND EXAKT, NICHT RATEN:
══════════════════════════════════════
INSTRUMENT: ${lots}x ${instrument}
TICK-WERT: $${tickValue} pro Tick (${instrument})
STOP LOSS: ${slTicks} Ticks = $${slDollar} pro Trade (KEIN anderer Wert!)
TAKE PROFIT: ${tpTicks} Ticks = $${tpDollar} pro Trade (KEIN anderer Wert!)
CRV: ${crv}:1
MAX TRADES/TAG: ${maxTrades}
MAX RISIKO/TAG: $${maxRiskDay} (wenn alle ${maxTrades} Trades verlieren)
MAX GEWINN/TAG: $${maxGainDay} (wenn alle ${maxTrades} Trades gewinnen)
HANDELSFENSTER: ${ctx.windowStart || '16:15'}–${ctx.windowEnd || '17:30'} Uhr CET
${challengeSection}

KONTO HEUTE:
Saldo: $${ctx.saldo || '?'} | Heute: ${ctx.todPnl >= 0 ? '+' : ''}$${ctx.todPnl || 0}
Trades heute: ${ctx.tradeCount || 0}/${maxTrades} | DD Abstand: $${ctx.kontoabstand || '?'}
Win Rate (gesamt): ${ctx.winRate || 0}% | Ø Win: $${ctx.avgWin || 0} | Ø Loss: $${ctx.avgLoss || 0}
Monat P&L: ${ctx.monthPnl >= 0 ? '+' : ''}$${ctx.monthPnl || 0}

TRADER PROFIL: ${ctx.coachProfile || 'Noch nicht eingerichtet'}
GEDÄCHTNIS: ${ctx.coachMemory || 'Keine Erkenntnisse'}

REGELN:
1. Nur im Fenster ${ctx.windowStart || '16:15'}–${ctx.windowEnd || '17:30'} Uhr traden
2. Max ${maxTrades} Trades pro Tag
3. SL IMMER ${slTicks} Ticks = $${slDollar} — nie ohne SL!
4. TP ${tpTicks} Ticks = $${tpDollar} — CRV ${crv}:1 einhalten
5. 15 Min Pause zwischen Trades
6. Bei ${maxTrades}+ Trades → nächster Tag gesperrt

WICHTIG: Verwende NUR die obigen Zahlen. Erfinde KEINE anderen Tick-Werte, Lot-Größen oder Dollar-Beträge.
WENN WOCHENENDE: Klar sagen Märkte geschlossen.
WENN NEWS IN <2H: Warnen, Uhrzeit nennen.
PSYCHOLOGIE: Verlust = Statistik. 20% Strategie, 80% Psychologie.`;
}
