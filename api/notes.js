export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const KEY = 'dailybrief_notes';

  if (req.method === 'GET') {
    const r = await fetch(`${url}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await r.json();
    let text = '';
    if (data.result) {
      try {
        const parsed = JSON.parse(data.result);
        text = typeof parsed === 'string' ? parsed : JSON.parse(parsed);
      } catch(e) { text = data.result; }
    }
    return res.status(200).json({ text });
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await fetch(`${url}/set/${KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body.text)
    });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
