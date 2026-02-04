import dotenv from 'dotenv';
import express from 'express';
import { google } from 'googleapis';

dotenv.config();

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const PORT = Number(process.env.AUTH_PORT || 3000);
const CLIENT_ID = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.REDIRECT_URI ||
  process.env.GOOGLE_REDIRECT_URI ||
  `http://localhost:${PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing CLIENT_ID/CLIENT_SECRET in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [SCOPE],
});

const app = express();

app.get('/', (_req, res) => {
  res.set('Content-Type', 'text/html');
  res.end(`
    <html>
      <body style="font-family: sans-serif; padding: 24px;">
        <h2>Gmail OAuth</h2>
        <p>Click the link below to authorize.</p>
        <p><a href="${authUrl}">Authorize Gmail Readonly</a></p>
      </body>
    </html>
  `);
});

app.get('/oauth2callback', async (req, res) => {
  const { error } = req.query;
  const rawCode = req.query.code;
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  if (error) {
    res.status(400).send('Authorization failed. Check console for details.');
    console.error('Authorization error:', error);
    return;
  }

  if (!code) {
    res.status(400).send('Missing authorization code.');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(String(code));

    if (!tokens.refresh_token) {
      console.warn(
        'No refresh token returned. Remove existing app access and try again, or ensure prompt: consent.',
      );
    } else {
      console.log('REFRESH_TOKEN=' + tokens.refresh_token);
    }

    res.send('Done. You can close this tab and return to the console.');
  } catch (err) {
    console.error('Token exchange failed:', err);
    res.status(500).send('Token exchange failed. Check console.');
  } finally {
    server.close(() => process.exit(0));
  }
});

const server = app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
  console.log('Open this URL in your browser to authorize:');
  console.log(authUrl);
});

const TIMEOUT_MS = 5 * 60 * 1000;
setTimeout(() => {
  console.error('Timed out waiting for authorization.');
  server.close(() => process.exit(1));
}, TIMEOUT_MS);
