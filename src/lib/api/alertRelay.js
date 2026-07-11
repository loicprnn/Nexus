// Client side of the Make.com alert relay. POSTs a constrained payload to the
// secure server proxy (/api/alert), which holds the Make.com webhook URL in its
// environment — the URL never appears in this bundle. Returns { delivered }.
export async function sendAlertWebhook({ title, message, alert }) {
  try {
    const res = await fetch('/api/alert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, message, alert }),
    })
    const json = await res.json().catch(() => ({}))
    return { delivered: Boolean(json?.delivered), reason: json?.reason ?? json?.error }
  } catch (err) {
    return { delivered: false, reason: String(err) }
  }
}
