export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing CLICKUP_API_KEY' });

  try {
    // Get workspace
    const teamRes = await fetch('https://api.clickup.com/api/v2/team', {
      headers: { Authorization: apiKey }
    });
    const teamData = await teamRes.json();
    const teamId = teamData.teams?.[0]?.id;
    if (!teamId) return res.status(500).json({ error: 'No workspace found' });

    // Get tasks due within 7 days, not closed
    const now = Date.now();
    const weekOut = now + 7 * 24 * 60 * 60 * 1000;

    const taskRes = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/task?statuses[]=to%20do&statuses[]=in%20progress&statuses[]=open&statuses[]=active&order_by=due_date&reverse=false&due_date_lt=${weekOut}&include_closed=false`,
      { headers: { Authorization: apiKey } }
    );
    const taskData = await taskRes.json();

    // Also fetch tasks with no due date
    const noDueRes = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/task?statuses[]=to%20do&statuses[]=in%20progress&statuses[]=open&statuses[]=active&order_by=due_date&reverse=false&include_closed=false`,
      { headers: { Authorization: apiKey } }
    );
    const noDueData = await noDueRes.json();

    const allTasks = [...(taskData.tasks || []), ...(noDueData.tasks || [])];
    // dedupe by id
    const seen = new Set();
    const tasks = allTasks.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    res.status(200).json(tasks.slice(0, 10));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
