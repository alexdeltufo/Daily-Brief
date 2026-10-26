// Income tracker storage. Locked behind INCOME_KEY because this repo and its API are public.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const secret = process.env.INCOME_KEY;
  const KEY = 'dailybrief_income';

  if (!secret) return res.status(500).json({ error: 'INCOME_KEY is not set in Vercel' });
  if (req.headers['x-income-key'] !== secret) return res.status(401).json({ error: 'locked' });

  if (req.method === 'GET') {
    const r = await fetch(`${url}/get/${KEY}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    let income = null;
    if (data.result) {
      try {
        const parsed = JSON.parse(data.result);
        income = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
      } catch (e) { income = null; }
    }
    return res.status(200).json({ income });
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await fetch(`${url}/set/${KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(body.income))
    });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
