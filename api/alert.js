import { readJsonBody, sendJson } from './_utils.js'

// Secure Make.com alert relay. The Make webhook URL lives ONLY in the server
// environment (process.env.MAKE_WEBHOOK_URL) — it never reaches the client
// bundle, so it can't be scraped or spammed. The browser POSTs a constrained
// alert payload here; we forward it to the configured Make.com scenario, which
// fans it out to email / push / etc.
//
// If no webhook is configured the endpoint succeeds with delivered:false, so
// in-app notifications keep working without an external dependency.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Méthode non autorisée' })
  }

  const webhook = process.env.MAKE_WEBHOOK_URL
  const body = await readJsonBody(req)
  const { title, message, alert } = body

  if (typeof title !== 'string' || !title.trim()) {
    return sendJson(res, 400, { error: 'title requis' })
  }

  // No webhook configured → soft success so the client still shows the in-app
  // notification. This keeps the feature usable out-of-the-box.
  if (!webhook) {
    return sendJson(res, 200, { delivered: false, reason: 'MAKE_WEBHOOK_URL non configurée' })
  }

  // Server-controlled payload: only a constrained, known shape is forwarded.
  const payload = {
    source: 'nexus',
    firedAt: new Date().toISOString(),
    title: String(title).slice(0, 200),
    message: typeof message === 'string' ? message.slice(0, 500) : '',
    alert: alert && typeof alert === 'object' ? alert : null,
  }

  try {
    const upstream = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!upstream.ok) {
      return sendJson(res, 502, {
        delivered: false,
        error: `Make.com HTTP ${upstream.status}`,
      })
    }
    return sendJson(res, 200, { delivered: true })
  } catch (err) {
    return sendJson(res, 502, { delivered: false, error: 'Make.com injoignable', detail: String(err) })
  }
}
