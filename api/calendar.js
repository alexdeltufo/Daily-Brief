export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  let accessToken = req.cookies?.gcal_access;
  const refreshToken = req.cookies?.gcal_refresh;
  
  // If no access token, try to refresh
  if (!accessToken && refreshToken) {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    const refreshData = await refreshRes.json();
    accessToken = refreshData.access_token;

    if (accessToken) {
      res.setHeader('Set-Cookie', `gcal_access=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3500`);
    }
  }

  if (!accessToken) {
    return res.status(401).json({ error: 'NOT_AUTHED' });
  }

  const now = new Date(new Date().setHours(0,0,0,0));
  const weekOut = new Date(new Date().setHours(0,0,0,0) + 7*24*60*60*1000);

  try {
    // Fetch all calendars first
    const calListRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const calList = await calListRes.json();
    const calendarIds = (calList.items || []).map(c => c.id);

    // Fetch events from all calendars
    const allEvents = await Promise.all(
      calendarIds.map(id =>
        fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?timeMin=${now.toISOString()}&timeMax=${weekOut.toISOString()}&orderBy=startTime&singleEvents=true&maxResults=20`, {
          headers: { Authorization: `Bearer ${accessToken}` }
     }).then(r => r.json()).then(d => (d.items || []).map(ev => ({ ...ev, _calColor: calendarMap[id] }))).catch(() => [])
      )
    );

    // Flatten, dedupe, sort
    const seen = new Set();
    const events = allEvents.flat().filter(ev => {
      if (seen.has(ev.id)) return false;
      seen.add(ev.id);
      return true;
    }).sort((a, b) => {
      const aTime = a.start?.dateTime || a.start?.date || '';
      const bTime = b.start?.dateTime || b.start?.date || '';
      return aTime.localeCompare(bTime);
    });

    res.status(200).json(events);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
