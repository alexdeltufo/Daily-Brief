export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing CLICKUP_API_KEY' });

  try {
    const teamRes = await fetch('https://api.clickup.com/api/v2/team', {
      headers: { Authorization: apiKey }
    });
    const teamData = await teamRes.json();
    const teamId = teamData.teams?.[0]?.id;
    if (!teamId) return res.status(500).json({ error: 'No workspace found' });

    const priRes = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/user/180041229/priorities`,
      { headers: { Authorization: apiKey } }
    );
    const priData = await priRes.json();
    res.status(200).json(priData.tasks || priData || []);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
