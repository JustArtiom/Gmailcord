# Gmailcord

Gmailcord watches your Gmail inbox and sends a short AI summary to a Discord DM when a new email arrives.

**What it does**
- Subscribes to Gmail push notifications via Pub/Sub.
- Fetches new inbound emails and parses them.
- Summarizes the email with OpenAI.
- Sends the summary to a Discord user.

**Quick start**
1. Install deps: `npm install`
2. Create your `.env` (example below)
3. Get a Gmail refresh token: `node scripts/auth.js`
4. Configure Gmail push notifications (Pub/Sub + webhook)
5. Run: `node index.js`

**Environment variables**
- `OPENAI_API_KEY` — OpenAI API key
- `DISCORD_BOT_TOKEN` — Discord bot token
- `CLIENT_ID` — Google OAuth client ID
- `CLIENT_SECRET` — Google OAuth client secret
- `REFRESH_TOKEN` — Gmail refresh token (from `node scripts/auth.js`)
- `PORT` — Optional. HTTP server port (default `3000`)
- `AUTH_PORT` — Optional. Port used by `scripts/auth.js` (default `3000`)
- `REDIRECT_URI` — Optional. Override OAuth redirect URI (defaults to `http://localhost:${AUTH_PORT}/oauth2callback`)

**Example `.env`**
```dotenv
OPENAI_API_KEY=...
DISCORD_BOT_TOKEN=...
CLIENT_ID=...
CLIENT_SECRET=...
REFRESH_TOKEN=...
PORT=3000
```

**Step 1: Google OAuth setup**
1. Create a Google Cloud project and enable the Gmail API.
2. Create an OAuth client (Web application).
3. Add an authorized redirect URI that matches your local auth server, for example `http://localhost:3000/oauth2callback`.
4. Put `CLIENT_ID` and `CLIENT_SECRET` in `.env`.

**Step 2: Get a refresh token**
1. Run `node scripts/auth.js`.
2. Open the printed URL in your browser and grant access.
3. Copy the printed `REFRESH_TOKEN=...` into `.env`.

If you do not see a refresh token, revoke the app’s access in your Google Account and run the auth flow again.

**Step 3: Gmail push notifications (Pub/Sub + webhook)**
Gmail push notifications require a Pub/Sub topic and a push subscription to your webhook.

1. Enable the Pub/Sub API in your Google Cloud project.
2. Create a Pub/Sub topic and note its full name (example: `projects/YOUR_PROJECT/topics/YOUR_TOPIC`).
3. Grant the Gmail push service account the `Pub/Sub Publisher` role on the topic: `gmail-api-push@system.gserviceaccount.com`.
4. Create a push subscription that targets your webhook URL: `https://YOUR_PUBLIC_URL/gmail/webhook`.
   You need a public URL. For local dev, use a tunnel like ngrok.
5. Update the `topicName` in `index.js` to your topic name.

**Step 4: Discord setup**
1. Create a Discord bot and add it to a server.
2. Set `DISCORD_BOT_TOKEN` in `.env`.
3. Update the user ID in `index.js` to the Discord user you want to DM.

**Run**
```bash
node index.js
```

The server will start, register a Gmail watch, and begin sending summaries when new inbox emails arrive.
