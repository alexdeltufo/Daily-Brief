import { Redis } from '@upstash/redis';
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const data = await redis.get('shopping_lists');
    return res.json(data || { need: [], want: [] });
  }
  if (req.method === 'POST') {
    await redis.set('shopping_lists', req.body);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
