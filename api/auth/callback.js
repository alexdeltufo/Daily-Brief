export default async function handler(req, res) {
  const { code } = req.query;
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'https://alexsdailybrief.vercel.app/api/auth/callback',
      grant_type: 'authorization_code'
    })
  });

  const tokens = await response.json();
  
  if (tokens.refresh_token) {
    // Store refresh token as cookie
    res.setHeader('Set-Cookie', `gcal_refresh=${tokens.refresh_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);
  }
  
  res.setHeader('Set-Cookie', [
    `gcal_refresh=${tokens.refresh_token || ''}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
    `gcal_access=${tokens.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3500`
  ]);

  res.redirect('/');
}
