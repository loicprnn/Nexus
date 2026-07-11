// Shared helpers for the serverless proxy functions. The `_` prefix keeps Vercel
// from exposing this file as an HTTP endpoint. These run identically under the
// Vercel Node runtime (prod) and the Vite dev middleware (see vite.config.js):
// in both, `req`/`res` are Node's IncomingMessage/ServerResponse.

// Parse the query string from req.url, portable across both runtimes.
export function getQuery(req) {
  const url = new URL(req.url, 'http://localhost')
  return url.searchParams
}

// Read and JSON-parse the request body. Vercel may pre-parse it into req.body;
// the dev middleware does not, so fall back to draining the raw stream.
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

// Send a JSON response with a status code.
export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(body)
}
