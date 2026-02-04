import express from "express";
import "dotenv/config";
import { google } from "googleapis";
import OpenAI from "openai";
import { parseEmail,normalizeEmailHtml } from "./parsers.js";
import { Client, GatewayIntentBits, Partials } from "discord.js"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages], partials: [Partials.Channel] });
await bot.login(process.env.DISCORD_BOT_TOKEN);
const user = await bot.users.fetch("526191240962768910");

const app = express();
const PORT = process.env.PORT || 3000;

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  `http://localhost:${PORT}/oauth2callback`
);

oauth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
let lastHistoryId = null;

async function handleHistoryUpdate(newHistoryId) {
  if (!lastHistoryId) {
    lastHistoryId = newHistoryId;
    return;
  }

  const res = await gmail.users.history.list({
    userId: "me",
    startHistoryId: lastHistoryId,
    historyTypes: ["messageAdded"],
  });

  const histories = res.data.history || [];
  const messageIds = [];

  for (const h of histories) {
    if (h.messagesAdded) {
      for (const m of h.messagesAdded) {
        messageIds.push(m.message.id);
      }
    }
  }

  for (const messageId of messageIds) {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const labels = msg.data.labelIds || [];

    if (
      labels.includes("DRAFT") ||
      labels.includes("SENT") ||
      !labels.includes("INBOX")
    ) {
      continue;
    }

    const parsed = await parseEmail(msg.data, {
      withAttachments: true,
      gmail,
      userId: "me",
    });

    console.log("New inbound email parsed:", parsed);

    const emailSummary = await openai.responses.create({
      model: "gpt-5.2",
      instructions: `
You will receive:
- An email subject
- An email body (cleaned text)

Your task:
Write a short summary of the email in SIMPLE everyday English.

Output rules:
- Output ONLY the summary (no title, no greeting, no explanations)
- Do NOT mention that this is a summary
- Do NOT use complex words, formal tone, or technical language
- Do NOT invent or guess anything
- Keep important details (dates, requests, decisions)
- Remove filler, signatures, and repeated text

IMPORTANT CLASSIFICATION RULES:
- Only use "Action:" if something is REQUIRED or mandatory.
- Requests for feedback, surveys, ratings, reviews, or opinions are OPTIONAL unless the email clearly says they are required.
- Invitations, suggestions, and “we’d like to invite you” are OPTIONAL.
- If nothing is required, say: "No action required."

Format rules:
1) Start with ONE short paragraph (2–4 sentences) explaining what the email is about.
2) After the paragraph, add bullet points ONLY if they add clarity.
3) Bullet labels:
   - "Action:" → required
   - "Optional:" → optional
   - "Info:" → helpful information
   - "Warning:" → visibility or consequences

Keep everything easy to read and human.

Input:
Subject:
{{EMAIL_SUBJECT}}

Content:
{{EMAIL_TEXT}}

Respond only with the summary.`,
      input: `
Subject:
${parsed.subject || "(no subject)"}

Content:
${normalizeEmailHtml(parsed.content)}`
    })

    await user.send({
      content: `${parsed.labels.includes("IMPORTANT") ? `${user}` : ``}
# 📧 New Email Received. 
**From:** ${parsed.from}  
## ${parsed.subject || "(no subject)"}  

**Summary:**  
${emailSummary.output_text}  

[See full email](https://mail.google.com/mail/u/0/#inbox/${parsed.id})
`,
      flags: 1 << 2,
    })
  }

  lastHistoryId = newHistoryId;
}

async function startWatching() {
  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: "projects/phonic-arcana-329708/topics/email-listen",
      labelIds: ["INBOX"],
      labelFilterAction: "include",
    },
  });

  console.log("Watch expires at:", new Date(Number(res.data.expiration)));
  console.log("Start historyId:", res.data.historyId);
  lastHistoryId = res.data.historyId;

  setTimeout(startWatching, new Date(Number(res.data.expiration)).getTime() - Date.now() - 60000);
}

await startWatching();

app.use(express.json());

app.post("/gmail/webhook", async (req, res) => {
  try {
    const msg = req.body?.message?.data;
    if (!msg) {
      res.sendStatus(204);
      return;
    }

    const decoded = JSON.parse(
      Buffer.from(msg, "base64").toString("utf8")
    );

    const historyId = decoded.historyId;
    if (!historyId) {
      res.sendStatus(204);
      return;
    }

    await handleHistoryUpdate(historyId);
    res.sendStatus(204);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});