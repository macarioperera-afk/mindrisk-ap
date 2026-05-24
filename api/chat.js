// MindRisk Trading Coach - Claude API Bridge
// VERSION 6 - Weekly Economic Calendar + 15min Warning

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
    // Get next 5 trading days
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().split('T')[0];

    const url = `https://financialmodelingprep.com/stable/economic-calendar?from=${todayStr}&to=${endStr}&apikey=${FMP_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    // Only HIGH impact USD events
    const events = data
      .filter(e => e.impact === 'High' && (e.currency === 'USD' || e.country === 'US'))
      .map(e => ({
        date: e.date?.split('T')[0] || '',
        time: e.date?.split('T')[1]?.slice(0,5) || '',
        name: e.event,
        forecast: e.estimate || '',
        previous: e.previous || ''
      }))
      .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    newsCache = { data: events, date: todayStr };
    return events;
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

  // Special endpoint: just return news for frontend
  if (req.body?.newsOnly) {
    const news = await getWeeklyNews();
    return res.status(200).json({ news: news || [] });
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

  // Today's news
  const todayNews = news?.filter(n => n.date === todayStr) || [];
  const weekNews = news?.filter(n => n.date > todayStr) || [];

  const todayNewsText = todayNews.length > 0
    ? todayNews.map(n => `⚠️ ${n.time} ET: ${n.name}${n.forecast?' (Prognose: '+n.forecast+')':''}`).join('\n')
    : 'Keine HIGH Impact News heute.';

  const weekNewsText = weekNews.length > 0
    ? weekNews.map(n => `📅 ${n.date} ${n.time} ET: ${n.name}`).join('\n')
    : 'Keine weiteren HIGH Impact News diese Woche.';

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

HEUTE: ${dayName}, ${today.toLocaleDateString('de-DE')}
MARKT: ${marketStatus}

HIGH IMPACT NEWS HEUTE (3 Sterne, nur USD):
${todayNewsText}

HIGH IMPACT NEWS DIESE WOCHE:
${weekNewsText}

TRADER PROFIL: ${ctx.coachProfile||'Noch nicht eingerichtet'}
GEDÄCHTNIS: ${ctx.coachMemory||'Keine Erkenntnisse'}

KONTO: $${ctx.saldo||'?'} | Trades: ${ctx.tradeCount||0}/${ctx.maxTrades||2} | P&L: ${ctx.todayPnl>=0?'+':''}$${ctx.todayPnl||0}
WR: ${ctx.winRate||0}% | DD Abstand: $${ctx.kontoabstand||'?'}
PROP FIRM: ${ctx.broker||'-'} | ${ctx.accountNumber||''}

REGELN: Max ${ctx.maxTrades||2} Trades | ${ctx.windowStart||'16:15'}-${ctx.windowEnd||'17:30'} Uhr | SL ${ctx.slTicks||40} Ticks | TP ${ctx.tpTicks||80} Ticks

WENN WOCHENENDE: Klar sagen Märkte geschlossen, keine Trade-Empfehlung.
WENN NEWS IN <2H: Warnen, Uhrzeit nennen, empfehlen davor oder danach zu traden.
WENN NACH NEWS GEFRAGT: Exakte Zeiten und Namen aus dem Kalender nennen.

PSYCHOLOGIE: Verlust = Statistik. Overtrading sofort stoppen. 20% Strategie, 80% Psychologie.`;
}
