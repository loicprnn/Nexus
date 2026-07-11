import { getQuery, sendJson } from './_utils.js'

// SEC EDGAR proxy. EDGAR is free and key-less, but the SEC requires a
// identifying User-Agent (with a contact) and does not send permissive CORS
// headers — so calls must go through the server. Whitelisted endpoints only:
//   /api/edgar?endpoint=tickers                 → ticker → CIK directory
//   /api/edgar?endpoint=companyfacts&cik=320193 → all XBRL facts for a company
const UA = process.env.SEC_USER_AGENT || 'Nexus Finance App (contact@nexus.local)'

export default async function handler(req, res) {
  const query = getQuery(req)
  const endpoint = query.get('endpoint')

  let url
  if (endpoint === 'tickers') {
    url = 'https://www.sec.gov/files/company_tickers.json'
  } else if (endpoint === 'companyfacts') {
    const cik = (query.get('cik') || '').replace(/\D/g, '')
    if (!cik) return sendJson(res, 400, { error: 'cik requis' })
    url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.padStart(10, '0')}.json`
  } else {
    return sendJson(res, 400, { error: 'endpoint invalide' })
  }

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    if (!upstream.ok) {
      // 404 = company has no EDGAR filings (non-US / ETF) — relay it.
      return sendJson(res, upstream.status, { error: `SEC HTTP ${upstream.status}` })
    }
    const json = await upstream.json()
    return sendJson(res, 200, json)
  } catch (err) {
    return sendJson(res, 502, { error: 'SEC injoignable', detail: String(err) })
  }
}
