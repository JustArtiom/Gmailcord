import { htmlToText } from "html-to-text"

const extractEmail = value => {
  if (!value) return null
  const match = value.match(/<([^>]+)>/)
  return match ? match[1] : value.trim()
}

export const parseEmail = async(message,{ withAttachments = false,gmail,userId = `me` }) => {
  const headers = Object.fromEntries(
    (message.payload.headers || []).map(({ name,value }) => [name.toLowerCase(),value]),
  )

  const parts = []

  const addParts = msg_parts => {
    for (const part of msg_parts || [])
      if(part.mimeType === `multipart/alternative` && part.parts.find(p => p.mimeType === `text/html`))
        parts.push(part.parts.find(p => p.mimeType === `text/html`))

      else
        if (part.parts) return addParts(part.parts)
        else
          if(part.mimeType === `text/plain` || part.mimeType === `text/html`)
            parts.push(part)

  }

  addParts([message.payload])

  const content = parts.map(part => {
    return Buffer.from(part.body.data,`base64`).toString(`utf8`)
  }).join(`\n`)

  let content_type = `text/plain`
  for(const part of parts)
    if(part.mimeType === `text/html`) {
      content_type = `text/html`
      break
    }

  const attachments = []

  const collectAttachments = async(parts = []) => {
    for (const part of parts) {
      if (part.filename && part.filename.length > 0 && part.body.attachmentId) {
        if(!gmail) throw new Error(`Gmail client is required to fetch attachments`)
        const attachment = await gmail.users.messages.attachments.get({
          userId,
          messageId: message.id,
          id: part.body.attachmentId,
        })
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size,
          data: Buffer.from(attachment.data.data,`base64`),
        })
      }
      if (part.parts)
        await collectAttachments(part.parts)

    }
  }

  if (withAttachments)
    await collectAttachments(message.payload.parts || [])

  return {
    id: message.id,
    threadId: message.threadId,
    labels: message.labelIds || [],
    from: extractEmail(headers[`from`]),
    to: extractEmail(headers[`to`]),
    cc: extractEmail(headers[`cc`]),
    bcc: extractEmail(headers[`bcc`]),
    subject: headers[`subject`] || null,
    date: headers[`date`] || null,
    snippet: message.snippet || null,
    content_type,
    content,
    parts: message.payload.parts,
    attachments,
  }
}


export function truncateUrls(text, maxUrlLength = 1000) {
  if (!text) return text;

  return text.replace(
    /\[(https?:\/\/[^\s\]]+)\]/gi,
    (_, url) => {
      if (url.length <= maxUrlLength) return `[${url}]`;
      return `[${url.slice(0, maxUrlLength)}…(sliced)]`;
    }
  );
}


export function normalizeEmailHtml(html) {
  const text = htmlToText(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: false } },
    ],
    limits: {
      maxInputLength: 50_000, // safety
    },
  });

  return truncateUrls(text);
}

console.log(normalizeEmailHtml(`<p>Hello <b>world</b>! Visit <a href="https://example.com">our site</a>.</p><img src="image.jpg" />`))