// Claude (Anthropic) client — talks ONLY to the secure server proxy (/api/claude).
// No API key is ever present here or in the bundle: the proxy injects it from
// process.env.ANTHROPIC_KEY (see api/claude.js). This module just shapes the
// request and unwraps the text response.

// Low-level call: send a system prompt + messages, get back the model's text.
export async function askClaude({ system, messages, maxTokens = 1024 }) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system, messages, max_tokens: maxTokens }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json?.error || `Claude HTTP ${res.status}`)
  }
  return json.text ?? ''
}

// System prompt for the daily market brief. Constrains tone, language and length
// so the output fits the dashboard widget and matches Nexus' editorial voice.
const BRIEF_SYSTEM = [
  "Tu es l'analyste marché de Nexus, une application d'analyse financière.",
  'Rédige un brief de marché quotidien en français, concis et professionnel.',
  'Style sobre, factuel, sans superlatifs ni conseils d\'investissement personnalisés.',
  'Longueur : 2 à 3 phrases (60 mots maximum). Pas de titre, pas de liste, pas d\'emoji.',
  "Appuie-toi uniquement sur les données chiffrées fournies ; n'invente aucun chiffre.",
].join(' ')

// Build the user message describing today's market context from live indicators.
function buildBriefContext({ fearGreed, vix, curve }) {
  const lines = []
  if (fearGreed?.score != null) {
    lines.push(`Indice Fear & Greed : ${fearGreed.score}/100 (${fearGreed.label ?? ''}).`)
  }
  if (vix?.price != null) {
    const dir = vix.changePct >= 0 ? 'en hausse' : 'en baisse'
    lines.push(`VIX : ${vix.price.toFixed(2)} (${dir} de ${Math.abs(vix.changePct).toFixed(2)}%).`)
  }
  if (curve?.value != null) {
    const state = curve.value < 0 ? 'inversée (signal de récession)' : 'positive'
    lines.push(`Courbe des taux 10Y-2Y : ${curve.value >= 0 ? '+' : ''}${curve.value.toFixed(2)} pp, ${state}.`)
  }
  return lines.length
    ? `Données de marché du jour :\n${lines.join('\n')}\n\nRédige le brief.`
    : null
}

// Generate the daily brief. Returns the text, or throws if no context/data.
export async function getDailyBrief(context) {
  const userContent = buildBriefContext(context)
  if (!userContent) throw new Error('Données de marché insuffisantes pour le brief')
  return askClaude({
    system: BRIEF_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
    maxTokens: 300,
  })
}

// --- Nexus Coach -------------------------------------------------------

// System prompt for the conversational coach. Frames scope and guardrails: it
// explains and contextualises markets but never gives personalised investment
// advice (regulatory + Nexus editorial stance).
const COACH_SYSTEM = [
  "Tu es Nexus Coach, l'assistant d'analyse financière de l'application Nexus.",
  'Réponds toujours en français, de façon claire, pédagogique et structurée.',
  'Tu peux expliquer des concepts financiers, commenter le contexte de marché fourni,',
  'décrire des indicateurs et des stratégies de façon générale et éducative.',
  "Tu ne donnes JAMAIS de conseil d'investissement personnalisé ni de recommandation",
  "d'achat/vente sur un actif précis ; si on te le demande, rappelle poliment que tu",
  "fournis de l'information éducative, pas du conseil personnalisé, et invite à consulter",
  'un conseiller agréé. Reste concis (réponses de 3 à 6 phrases sauf demande explicite),',
  "factuel, sans superlatifs ni emoji. N'invente aucun chiffre : appuie-toi uniquement",
  'sur les données de marché fournies dans le contexte ou sur des notions générales.',
  "N'utilise AUCUN formatage Markdown : pas de **gras**, pas de titres #, pas de listes",
  'à puces, pas de séparateurs ---. Rédige en texte brut, en paragraphes courts séparés',
  'par des sauts de ligne.',
].join(' ')

// Inline today's live market readings into a context block prepended as a system
// note, so the coach can ground its answers in real numbers.
function marketContextNote({ fearGreed, vix, curve } = {}) {
  const lines = []
  if (fearGreed?.score != null) {
    lines.push(`- Fear & Greed : ${fearGreed.score}/100 (${fearGreed.label ?? ''})`)
  }
  if (vix?.price != null) {
    lines.push(`- VIX : ${vix.price.toFixed(2)} (${vix.changePct >= 0 ? '+' : ''}${vix.changePct.toFixed(2)}%)`)
  }
  if (curve?.value != null) {
    lines.push(`- Courbe 10Y-2Y : ${curve.value >= 0 ? '+' : ''}${curve.value.toFixed(2)} pp`)
  }
  if (!lines.length) return null
  return `Contexte de marché en temps réel (à utiliser si pertinent) :\n${lines.join('\n')}`
}

// Send the conversation to Claude and return the assistant's reply text.
// `history` is the full [{role:'user'|'assistant', content}] turn list.
export async function getCoachReply({ history, marketContext }) {
  const note = marketContextNote(marketContext)
  const system = note ? `${COACH_SYSTEM}\n\n${note}` : COACH_SYSTEM
  return askClaude({ system, messages: history, maxTokens: 1024 })
}

// --- Analyse d'actif (étape 6) ----------------------------------------------

// System prompt for the full single-asset analysis. Frames the four-axis
// structure, anchors the quantitative axes to the supplied figures, allows a
// qualitative (non-numeric) fundamental read, and forbids personalised advice.
const ASSET_ANALYSIS_SYSTEM = [
  "Tu es l'analyste de Nexus, une application d'analyse financière.",
  "Produis une analyse complète d'un actif, en français, structurée en quatre axes",
  'dans cet ordre : Technique, Fondamental, Sentiment de marché, Macro.',
  'Pour les axes Technique, Sentiment et Macro, appuie-toi UNIQUEMENT sur les chiffres',
  "fournis ; n'invente aucune donnée chiffrée. Pour l'axe Fondamental, donne une lecture",
  "QUALITATIVE et générale de l'entreprise (modèle économique, secteur, positionnement",
  'connus du grand public) SANS citer de chiffres précis que tu ne possèdes pas',
  '(ne fabrique aucun PER, chiffre d\'affaires, marge, etc.).',
  'Termine par une phrase expliquant ce que reflète le score global fourni.',
  "Reste éducatif et factuel : tu ne donnes JAMAIS de conseil d'achat/vente ni de",
  'recommandation personnalisée. Une à deux phrases par axe.',
  "N'utilise AUCUN formatage Markdown (pas de **gras**, pas de titres #, pas de listes).",
  'Présente chaque axe sur sa propre ligne, préfixée par son nom suivi de deux points,',
  'par exemple « Technique : … ». Pas d\'emoji.',
].join(' ')

// Build the user message from live figures. `data` carries the asset identity,
// the quote, the computed technical metrics, the market sentiment / macro
// readings, and the composite score.
function buildAssetContext(d) {
  const lines = [`Actif : ${d.name} (${d.symbol}).`]
  if (d.price != null) {
    const chg = d.changePct != null ? ` (${d.changePct >= 0 ? '+' : ''}${d.changePct.toFixed(2)}% sur la séance)` : ''
    lines.push(`Cours : ${d.price} ${d.currency ?? 'USD'}${chg}.`)
  }
  const tech = []
  if (d.perf != null) tech.push(`performance de séance ${d.perf >= 0 ? '+' : ''}${d.perf.toFixed(2)}%`)
  if (d.trend != null) tech.push(`tendance intraséance ${d.trend >= 0 ? '+' : ''}${d.trend.toFixed(2)}%`)
  if (d.volatility != null) tech.push(`volatilité intraséance ${d.volatility.toFixed(2)}%`)
  if (d.rangePos != null) tech.push(`position dans le range du jour ${Math.round(d.rangePos * 100)}%`)
  if (tech.length) lines.push(`Technique : ${tech.join(', ')}.`)
  const senti = []
  if (d.fearGreed != null) senti.push(`Fear & Greed ${d.fearGreed}/100`)
  if (d.vix != null) senti.push(`VIX ${d.vix.toFixed(2)}`)
  if (senti.length) lines.push(`Sentiment de marché : ${senti.join(', ')}.`)
  const macro = []
  if (d.yieldCurve != null) macro.push(`courbe 10a-2a ${d.yieldCurve >= 0 ? '+' : ''}${d.yieldCurve.toFixed(2)} pp`)
  if (d.cpi != null) macro.push(`inflation CPI ${d.cpi.toFixed(1)}% en glissement annuel`)
  if (macro.length) lines.push(`Macro : ${macro.join(', ')}.`)
  if (d.score != null) lines.push(`Score global Nexus : ${d.score}/10.`)
  return `Données disponibles :\n${lines.join('\n')}\n\nRédige l'analyse en quatre axes.`
}

// Generate the four-axis asset analysis. Returns the text, or throws on no data.
export async function getAssetAnalysis(data) {
  if (!data?.symbol) throw new Error('Aucun actif sélectionné')
  return askClaude({
    system: ASSET_ANALYSIS_SYSTEM,
    messages: [{ role: 'user', content: buildAssetContext(data) }],
    maxTokens: 700,
  })
}

// --- Sentiment sectoriel (page Sentiment) -----------------------------------

const SECTOR_SENTIMENT_SYSTEM = [
  "Tu es l'analyste de Nexus. À partir de la performance du jour des ETF sectoriels",
  "fournis et du climat de marché global (Fear & Greed), attribue à chaque secteur un",
  'score de sentiment de 0 à 100 (0 = très défensif/aversion, 50 = neutre, 100 = très',
  'offensif/appétit) et une interprétation courte (8 mots max), factuelle et éducative.',
  "Appuie-toi UNIQUEMENT sur les chiffres fournis ; n'invente aucune donnée.",
  'Réponds STRICTEMENT en JSON valide, sans texte autour, sans Markdown : un tableau',
  'd\'objets {"secteur": string, "score": number, "note": string}. Pas d\'emoji.',
].join(' ')

// Generate per-sector sentiment scores. `sectors` = [{label, changePct}]; `mood`
// is the market-wide Fear & Greed score. Returns a parsed array
// [{secteur, score, note}] (throws if Claude returns unparseable JSON).
export async function getSectorSentiment({ sectors, mood }) {
  const lines = sectors
    .filter((s) => s.changePct != null)
    .map((s) => `- ${s.label} : ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}% aujourd'hui`)
  if (!lines.length) throw new Error('Données sectorielles insuffisantes')
  const moodLine = mood != null ? `Climat de marché (Fear & Greed) : ${mood}/100.\n` : ''
  const content = `${moodLine}Performance du jour des ETF sectoriels :\n${lines.join('\n')}\n\nRends le scoring JSON.`
  const text = await askClaude({
    system: SECTOR_SENTIMENT_SYSTEM,
    messages: [{ role: 'user', content }],
    maxTokens: 600,
  })
  // Be tolerant: extract the JSON array even if the model adds stray characters.
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Réponse Claude non exploitable')
  const parsed = JSON.parse(match[0])
  if (!Array.isArray(parsed)) throw new Error('Format de réponse inattendu')
  return parsed
}

// --- Synthèse macro (page Macro) --------------------------------------------

const MACRO_SYSTEM = [
  "Tu es l'économiste de Nexus, une application d'analyse financière.",
  'À partir des indicateurs macro fournis (taux Fed, taux 10 ans, courbe des taux,',
  'inflation CPI, chômage, masse monétaire M2), rédige une synthèse en français de',
  '3 à 4 phrases : croise les signaux et conclus sur le régime de marché actuel',
  '(ex. resserrement/assouplissement monétaire, risque de récession, reflation…).',
  "Appuie-toi UNIQUEMENT sur les chiffres fournis ; n'invente aucune donnée.",
  'Reste factuel et éducatif, sans conseil personnalisé. Pas de Markdown, pas de',
  'liste, pas d\'emoji — du texte brut.',
].join(' ')

function buildMacroContext(d) {
  const lines = []
  if (d.fedRate != null) lines.push(`Taux directeur Fed : ${d.fedRate.toFixed(2)} %.`)
  if (d.tenYear != null) lines.push(`Taux US 10 ans : ${d.tenYear.toFixed(2)} %.`)
  if (d.yieldCurve != null)
    lines.push(
      `Courbe 10a-2a : ${d.yieldCurve >= 0 ? '+' : ''}${d.yieldCurve.toFixed(2)} pp (${d.yieldCurve < 0 ? 'inversée' : 'positive'}).`,
    )
  if (d.cpi != null) lines.push(`Inflation CPI (a/a) : ${d.cpi.toFixed(2)} %.`)
  if (d.unemployment != null) lines.push(`Chômage : ${d.unemployment.toFixed(1)} %.`)
  if (d.m2 != null)
    lines.push(`Masse monétaire M2 : ${Math.round(d.m2)} Md $ (variation récente ${d.m2Change >= 0 ? '+' : ''}${d.m2Change?.toFixed?.(1) ?? '—'}).`)
  if (!lines.length) return null
  return `Indicateurs macro du moment :\n${lines.join('\n')}\n\nRédige la synthèse et conclus sur le régime de marché.`
}

// Generate the macro synthesis. Returns the text, or throws if no data.
export async function getMacroAnalysis(data) {
  const content = buildMacroContext(data)
  if (!content) throw new Error('Données macro insuffisantes')
  return askClaude({
    system: MACRO_SYSTEM,
    messages: [{ role: 'user', content }],
    maxTokens: 400,
  })
}
