export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const KEY = 'dailybrief_quicktasks';

  if (req.method === 'GET') {
    const r = await fetch(`${url}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await r.json();
    let tasks = [];
    if (data.result) {
      try {
        const parsed = JSON.parse(data.result);
        tasks = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
      } catch(e) {}
    }
    return res.status(200).json(tasks);
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await fetch(`${url}/set/${KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(body))
    });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
