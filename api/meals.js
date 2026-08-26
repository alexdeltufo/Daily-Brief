// api/meals.js — This Week's Meals
//
// GET  /api/meals             -> { week, meals: [{day,meal,cook} x7] }
// GET  /api/meals?debug=1     -> what's actually stored in Upstash right now
// GET  /api/meals?selftest=1  -> server-side write -> read round trip (no client involved)
// POST /api/meals             <- { week, meals: [{day,meal,cook} x7] }

const KEY = 'dailybrief_meals';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COOKS = ['', 'alex', 'gabe', 'both', 'out'];

// Monday of the current week in America/New_York, as YYYY-MM-DD
function currentWeek() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday'));
  const d = new Date(`${get('year')}-${get('month')}-${get('day')}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((wd + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function blank(week) {
  return { week, meals: DAYS.map(day => ({ day, meal: '', cook: '' })) };
}

function normalize(obj, week) {
  const incoming = Array.isArray(obj && obj.meals) ? obj.meals : [];
  return {
    week,
    meals: DAYS.map((day, i) => {
      const row = incoming[i] || {};
      return {
        day,
        meal: typeof row.meal === 'string' ? row.meal.trim().slice(0, 120) : '',
        cook: COOKS.includes(row.cook) ? row.cook : ''
      };
    })
  };
}

function unwrap(result) {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result);
    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
  } catch (e) {
    return null;
  }
}

// Vercel usually parses JSON into req.body. If it didn't (wrong content-type,
// sendBeacon, edge cases), fall back to reading the raw stream ourselves.
async function getBody(req) {
  if (req.body && typeof req.body === 'object') return { body: req.body, source: 'req.body' };
  if (typeof req.body === 'string' && req.body.length) {
    try { return { body: JSON.parse(req.body), source: 'req.body(string)' }; } catch (e) {}
  }
  const raw = await new Promise(resolve => {
    let s = '';
    const done = setTimeout(() => resolve(''), 1000); // stream already consumed
    req.on('data', c => { s += c; });
    req.on('end', () => { clearTimeout(done); resolve(s); });
    req.on('error', () => { clearTimeout(done); resolve(''); });
  });
  if (raw) {
    try { return { body: JSON.parse(raw), source: 'raw-stream' }; } catch (e) {}
  }
  return { body: {}, source: 'EMPTY' };
}

async function kvGet(url, token) {
  const r = await fetch(`${url}/get/${KEY}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json();
  return { status: r.status, raw: data.result ?? null, value: unwrap(data.result) };
}

async function kvSet(url, token, value) {
  const r = await fetch(`${url}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value))
  });
  let json = null;
  try { json = await r.json(); } catch (e) {}
  return { ok: r.ok && !(json && json.error), status: r.status, response: json };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const week = currentWeek();

  if (!url || !token) {
    return res.status(500).json({ error: 'Missing UPSTASH_REDIS_REST_URL or _TOKEN' });
  }

  if (req.method === 'GET') {
    // --- Full round trip, server only. If this fails, the client is innocent. ---
    if (req.query && req.query.selftest) {
      const probe = normalize(
        { meals: [{ day: 'Mon', meal: 'SELFTEST ' + Date.now(), cook: 'gabe' }] },
        week
      );
      const wrote = await kvSet(url, token, probe);
      const readBack = await kvGet(url, token);
      const survived =
        readBack.value &&
        readBack.value.meals &&
        readBack.value.meals[0].meal === probe.meals[0].meal &&
        readBack.value.meals[0].cook === 'gabe';
      return res.status(200).json({
        verdict: survived
          ? 'SERVER OK — writes persist. Problem is client-side (check Network tab for the POST).'
          : 'SERVER BROKEN — write did not survive. See writeResult/readBack below.',
        serverWeek: week,
        writeResult: wrote,
        readBack: { status: readBack.status, value: readBack.value }
      });
    }

    const got = await kvGet(url, token);

    if (req.query && req.query.debug) {
      return res.status(200).json({
        serverWeek: week,
        upstashStatus: got.status,
        rawResult: got.raw,
        parsed: got.value,
        savedWeek: got.value ? got.value.week : null,
        weekMatches: !!got.value && got.value.week === week
      });
    }

    // Meals carry over between weeks — clear manually with the Clear button.
    // normalize() restamps the week so the next save is keyed to the current one.
    if (!got.value) return res.status(200).json(blank(week));
    return res.status(200).json(normalize(got.value, week));
  }

  if (req.method === 'POST') {
    const { body, source } = await getBody(req);
    const clean = normalize(body, week);
    const wrote = await kvSet(url, token, clean);

    if (!wrote.ok) {
      return res.status(500).json({ error: 'Upstash write failed', detail: wrote });
    }
    // bodySource tells you instantly whether the payload actually arrived
    return res.status(200).json({ ok: true, bodySource: source, saved: clean });
  }

  res.status(405).end();
}
