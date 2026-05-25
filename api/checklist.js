export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    const KEY = 'dailybrief_checklist';
  
    if (req.method === 'GET') {
      const r = await fetch(`${url}/get/${KEY}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      const value = data.result ? JSON.parse(data.result) : { date: '', checked: {} };
      return res.status(200).json(value);
    }
  
    if (req.method === 'POST') {
      const body = req.body;
      await fetch(`${url}/set/${KEY}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(body))
      });
      return res.status(200).json({ ok: true });
    }
  
    res.status(405).end();
  }