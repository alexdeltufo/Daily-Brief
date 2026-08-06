// api/meals.js — This Week's Meals
//
// GET  /api/meals  ->  { week: "2026-08-03", meals: [{day,meal,cook} x7] }
// POST /api/meals  <-  { week: "2026-08-03", meals: [{day,meal,cook} x7] }

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

// Rebuild from scratch so the shape is always 7 rows, Mon–Sun, valid cook ids
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const week = currentWeek();

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${url}/get/${KEY}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      let saved = null;
      if (data.result) {
        try {
          const parsed = JSON.parse(data.result);
          saved = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
        } catch (e) {}
      }
      // New week? Hand back an empty slate instead of last week's dinners.
      if (!saved || saved.week !== week) return res.status(200).json(blank(week));
      return res.status(200).json(normalize(saved, week));
    } catch (e) {
      return res.status(200).json(blank(week));
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const clean = normalize(body, week);
      await fetch(`${url}/set/${KEY}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(clean))
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false });
    }
  }

  res.status(405).end();
}
