import { readJsonBody, sendJson } from './_utils.js'

// Secure Claude (Anthropic) proxy. The API key lives ONLY in the server
// environment (process.env.ANTHROPIC_KEY) and is attached here — it never
// reaches the client. The browser POSTs a constrained payload; we forward it to
// the Anthropic Messages API and relay the response.
//
// Anthropic also rejects direct browser calls unless the unsafe
// `anthropic-dangerous-direct-browser-access` header is set, so routing through
// this proxy is both the secure AND the supported path.

const UPSTREAM = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS_CAP = 2048

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Méthode non autorisée' })
  }
  const key = process.env.ANTHROPIC_KEY
  if (!key) {
    return sendJson(res, 500, { error: 'ANTHROPIC_KEY non configurée côté serveur' })
  }

  const body = await readJsonBody(req)
  const { system, messages, max_tokens } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return sendJson(res, 400, { error: 'messages[] requis' })
  }

  // Build a server-controlled payload. The client never picks the model or an
  // unbounded token budget — this caps cost/abuse on the public deployment.
  const payload = {
    model: DEFAULT_MODEL,
    max_tokens: Math.min(Number(max_tokens) || 1024, MAX_TOKENS_CAP),
    messages,
  }
  if (typeof system === 'string' && system.trim()) {
    payload.system = system
  }

  try {
    const upstreamRes = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
    })
    const json = await upstreamRes.json()
    if (!upstreamRes.ok) {
      return sendJson(res, upstreamRes.status, {
        error: `Anthropic HTTP ${upstreamRes.status}`,
        detail: json?.error?.message,
      })
    }
    // Relay only the text content; the client has no need for the raw envelope.
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    return sendJson(res, 200, { text })
  } catch (err) {
    return sendJson(res, 502, { error: 'Anthropic injoignable', detail: String(err) })
  }
}
