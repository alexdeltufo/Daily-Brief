export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Missing GOOGLE_API_KEY' });

  const now = new Date();
  const weekOut = new Date(now);
  weekOut.setDate(now.getDate() + 7);

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?key=${apiKey}&timeMin=${now.toISOString()}&timeMax=${weekOut.toISOString()}&orderBy=startTime&singleEvents=true&maxResults=50`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.status(200).json(data.items || []);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
