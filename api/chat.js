// MindRisk Trading Coach - Claude API Bridge
// VERSION 5 - Economic Calendar + Smart Caching

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

async function getEconomicNews() {
  const today = new Date().toISOString().split('T')[0];
  if (newsCache.date === today && newsCache.data) return newsCache.data;
  
  try {
    const url = `https://financialmodelingprep.com/stable/economic-calendar?from=${today}&to=${today}&apikey=${FMP_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    
    // Filter HIGH impact USD events only
    const highImpact = data
      .filter(e => e.impact === 'High' && e.currency === 'USD')
      .map(e => ({
        time: e.date ? e.date.split('T')[1]?.slice(0,5) : '',
        name: e.event,
        impact: e.impact,
        forecast: e.estimate,
        previous: e.previous
      }))
      .slice(0, 5);
    
    newsCache = { data: highImpact, date: today };
    return highImpact;
  } catch(e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY fehlt' });
  }

  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages Array erforderlich' });
    }

    const cleanMessages = sanitize(messages).filter(hasContent);
    const cleanContext = sanitize(context || {});
    if (cleanMessages.length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Nachrichten' });
    }

    // Get economic news (cached per day)
    const economicNews = await getEconomicNews();
    
    const systemPrompt = buildSystemPrompt(cleanContext, economicNews);
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
      return res.status(response.status).json({ error: 'Anthropic API Error', details: errorText });
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
  
  const newsText = news && news.length > 0
    ? news.map(n => `⚠️ ${n.time} Uhr: ${n.name} (HIGH IMPACT)`).join('\n')
    : 'Keine High-Impact News heute.';

  const marketStatus = isWeekend 
    ? `🔴 MÄRKTE GESCHLOSSEN (${dayName})`
    : `🟢 Märkte offen (${dayName})`;

  return `Du bist ${ctx.traderName||'Trader'}s persönlicher Trading Coach in der MindRisk App.

ANTWORTSTIL:
- IMMER auf Deutsch
- Maximal 3 Sätze
- Direkt wie ein Mentor
- Max 1 Emoji
- KEINE Krisenhotlines

TRADER PROFIL: ${ctx.coachProfile||'Noch nicht eingerichtet'}
COACH GEDÄCHTNIS: ${ctx.coachMemory||'Keine Erkenntnisse'}

HEUTE: ${dayName}, ${today.toLocaleDateString('de-DE')}
MARKT: ${marketStatus}
WIRTSCHAFTSNEWS HEUTE:
${newsText}

KONTO: Saldo $${ctx.saldo||'?'} | Trades heute: ${ctx.tradeCount||0} | P&L heute: ${ctx.todayPnl>=0?'+':''}$${ctx.todayPnl||0}
WIN RATE: ${ctx.winRate||0}% | DD Abstand: $${ctx.kontoabstand||'?'}
PROP FIRM: ${ctx.broker||'Unbekannt'} | Konto: ${ctx.accountNumber||''}

HEUTIGE TRADES: ${ctx.todayTrades||'Keine'}
CHAT VERLAUF: ${ctx.chatHistorySummary||'Erste Session'}

JERONIMOS HAUPTPROBLEM: OVERTRADING

REGELN (konfigurierbar):
- Max ${ctx.maxTrades||2} Trades/Tag
- Handelsfenster: ${ctx.windowStart||'16:15'}-${ctx.windowEnd||'17:30'} Uhr
- SL: ${ctx.slTicks||40} Ticks | TP: ${ctx.tpTicks||80} Ticks

WENN WOCHENENDE: Klar sagen dass Märkte geschlossen sind, keine Trading-Empfehlung.
WENN NEWS HEUTE: Vor High-Impact News warnen, Zeiten nennen.

PSYCHOLOGIE (Mark Douglas):
- Verlust = Statistik, kein Fehler
- Overtrading: sofort klare Stopp-Botschaft
- 5 Wahrheiten: Jeder Trade einzigartig, Edge über viele Trades

KERNBOTSCHAFT: 20% Strategie, 80% Psychologie.`;
}
