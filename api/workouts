// api/workouts.js — This Week's Workouts
//
// GET  /api/workouts             -> { week, program: [...], days: [{day,w,done} x7] }
// GET  /api/workouts?selftest=1  -> server-side write -> read round trip
// POST /api/workouts             <- { week, program, days }
//
// On a new week: day assignments are KEPT (they're your starting point),
// but the done flags reset.

const KEY = 'dailybrief_workouts';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_PROGRAM = ['Upper Lift', 'Lower Lift', 'Long Run', 'Yoga', 'Zone 2'];

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
  return {
    week,
    program: DEFAULT_PROGRAM.slice(),
    days: DAYS.map(day => ({ day, w: '', done: false }))
  };
}

function normalize(obj, week) {
  const rawProgram = Array.isArray(obj && obj.program) ? obj.program : [];
  const program = rawProgram
    .filter(n => typeof n === 'string' && n.trim())
    .map(n => n.trim().slice(0, 32))
    .slice(0, 12);
  const valid = new Set([...(program.length ? program : DEFAULT_PROGRAM), 'Rest']);
  const incoming = Array.isArray(obj && obj.days) ? obj.days : [];
  return {
    week,
    program: program.length ? program : DEFAULT_PROGRAM.slice(),
    days: DAYS.map((day, i) => {
      const row = incoming[i] || {};
      // Drop assignments pointing at a workout that no longer exists
      const w = typeof row.w === 'string' && valid.has(row.w) ? row.w : '';
      return { day, w, done: w && w !== 'Rest' ? !!row.done : false };
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

async function getBody(req) {
  if (req.body && typeof req.body === 'object') return { body: req.body, source: 'req.body' };
  if (typeof req.body === 'string' && req.body.length) {
    try { return { body: JSON.parse(req.body), source: 'req.body(string)' }; } catch (e) {}
  }
  const raw = await new Promise(resolve => {
    let s = '';
    const done = setTimeout(() => resolve(''), 1000);
    req.on('data', c => { s += c; });
    req.on('end', () => { clearTimeout(done); resolve(s); });
    req.on('error', () => { clearTimeout(done); resolve(''); });
  });
  if (raw) { try { return { body: JSON.parse(raw), source: 'raw-stream' }; } catch (e) {} }
  return { body: {}, source: 'EMPTY' };
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
    if (req.query && req.query.selftest) {
      const probe = normalize(
        { program: ['SELFTEST ' + Date.now()], days: [{ day: 'Mon', w: '', done: false }] },
        week
      );
      const wrote = await kvSet(url, token, probe);
      const readBack = await kvGet(url, token);
      const survived = readBack.value && readBack.value.program &&
        readBack.value.program[0] === probe.program[0];
      return res.status(200).json({
        verdict: survived
          ? 'SERVER OK — writes persist. Reload the page once to clear the test value.'
          : 'SERVER BROKEN — write did not survive. See writeResult below.',
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
        savedWeek: got.value ? got.value.week : null
      });
    }

    if (!got.value) return res.status(200).json(blank(week));

    const data = normalize(got.value, week);
    // New week -> keep the schedule, clear the checkmarks
    if (got.value.week !== week) data.days.forEach(d => { d.done = false; });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { body, source } = await getBody(req);
    const clean = normalize(body, week);
    const wrote = await kvSet(url, token, clean);
    if (!wrote.ok) {
      return res.status(500).json({ error: 'Upstash write failed', detail: wrote });
    }
    return res.status(200).json({ ok: true, bodySource: source, saved: clean });
  }

  res.status(405).end();
}
