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
  // Get existing state first
  const existing = await fetch(`${url}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());
  const current = existing.result ? JSON.parse(existing.result) : { date: '', checked: {} };
  // If same day, merge checked states. If new day, use incoming.
  const merged = (current.date === body.date)
    ? { date: body.date, checked: { ...current.checked, ...body.checked } }
    : body;
  await fetch(`${url}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(merged))
  });
  return res.status(200).json({ ok: true });
}
