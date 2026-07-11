// Symbol catalogs used across the app. Labels are what we show in the UI.

// Top scrolling band. Twelve Data's free plan does NOT serve raw indices/futures
// (paid-only) but DOES serve US-listed stocks and ETFs as ordinary equities, so
// every ticker here is TD-served and live with no Yahoo dependency. ETFs stand
// in for the big indices (SPY=S&P 500, QQQ=Nasdaq 100, DIA=Dow, IWM=Russell
// 2000), plus the marquee US names and a few commodity/sector ETFs. The band
// fetches these in throttled chunks (useChunkedQuotes) to stay inside the free
// tier's 8 credits/minute budget, then caches each for 15 min.
// Kept intentionally SHORT (8 symbols): the whole strip is fetched in ONE Twelve
// Data batch (≤8 credits), so it fits the free plan's 8-credits/minute budget in
// a single call and never starves the dashboard widgets (which would 429 the
// strip and leave it blank). Indices via ETF proxies + the marquee megacaps +
// gold, the most "ticker-worthy" reads.
export const TICKER_SYMBOLS = [
  { symbol: 'SPY', label: 'S&P 500' },
  { symbol: 'QQQ', label: 'Nasdaq 100' },
  { symbol: 'DIA', label: 'Dow Jones' },
  { symbol: 'AAPL', label: 'Apple' },
  { symbol: 'MSFT', label: 'Microsoft' },
  { symbol: 'NVDA', label: 'NVIDIA' },
  { symbol: 'AMZN', label: 'Amazon' },
  { symbol: 'GLD', label: 'Or' },
]

export const FAVORIS_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'VWRL.AS', name: 'Vanguard All-World' },
]

// Liquid basket used to compute the day's top movers (no key-less Yahoo
// screener exists, so we rank % change within a tracked universe). Kept to 8
// names so the single batch costs ≤8 Twelve Data credits and stays inside the
// free plan's per-minute budget (a 20-symbol batch 429s outright).
export const MOVERS_UNIVERSE = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'TSLA', 'AMD', 'AVGO',
]

// World markets shown on the 3D globe (étape 5). The Twelve Data FREE plan does
// not serve raw indices (^GSPC, SPX… are paid-plan only), but it DOES serve
// US-listed country ETFs as ordinary US equities. So each financial centre is
// proxied by its iShares MSCI country ETF (or SPY/QQQ for the US): the live
// figure is that ETF's USD performance, a clean stand-in for the local market
// that the data layer fetches straight from Twelve Data (no Yahoo needed).
//
// 22 markets across 6 continents. A Twelve Data /quote batch costs 1 credit per
// symbol and the free plan allows only 8 credits/minute, so we never request
// them all at once: the Markets page loads them in throttled chunks of ≤6,
// staggered ~1 min apart (see useChunkedQuotes), then caches each for 15 min.
// Markers therefore fill in waves on first visit and are instant afterwards.
// `admin` matches the Natural Earth country GeoJSON property (ADMIN, English) so
// the globe's regional heatmap can colour each country by its market's
// performance. (ISO_A2 is unreliable for a few countries — e.g. France = -99 —
// so we match on ADMIN instead.)
export const WORLD_MARKETS = [
  // Amériques
  { symbol: 'SPY', etf: 'SPY', index: 'S&P 500', city: 'New York', country: 'États-Unis', admin: 'United States of America', lat: 40.71, lng: -74.01 },
  { symbol: 'QQQ', etf: 'QQQ', index: 'Nasdaq 100', city: 'New York', country: 'États-Unis', admin: 'United States of America', lat: 41.4, lng: -73.2 },
  { symbol: 'EWC', etf: 'EWC', index: 'S&P/TSX', city: 'Toronto', country: 'Canada', admin: 'Canada', lat: 43.65, lng: -79.38 },
  { symbol: 'EWW', etf: 'EWW', index: 'IPC', city: 'Mexico', country: 'Mexique', admin: 'Mexico', lat: 19.43, lng: -99.13 },
  { symbol: 'EWZ', etf: 'EWZ', index: 'Bovespa', city: 'São Paulo', country: 'Brésil', admin: 'Brazil', lat: -23.55, lng: -46.63 },
  // Europe
  { symbol: 'EWU', etf: 'EWU', index: 'FTSE 100', city: 'Londres', country: 'Royaume-Uni', admin: 'United Kingdom', lat: 51.51, lng: -0.13 },
  { symbol: 'EWQ', etf: 'EWQ', index: 'CAC 40', city: 'Paris', country: 'France', admin: 'France', lat: 48.86, lng: 2.35 },
  { symbol: 'EWG', etf: 'EWG', index: 'DAX', city: 'Francfort', country: 'Allemagne', admin: 'Germany', lat: 50.11, lng: 8.68 },
  { symbol: 'EWN', etf: 'EWN', index: 'AEX', city: 'Amsterdam', country: 'Pays-Bas', admin: 'Netherlands', lat: 52.37, lng: 4.90 },
  { symbol: 'EWL', etf: 'EWL', index: 'SMI', city: 'Zurich', country: 'Suisse', admin: 'Switzerland', lat: 47.37, lng: 8.54 },
  { symbol: 'EWI', etf: 'EWI', index: 'FTSE MIB', city: 'Milan', country: 'Italie', admin: 'Italy', lat: 45.46, lng: 9.19 },
  { symbol: 'EWP', etf: 'EWP', index: 'IBEX 35', city: 'Madrid', country: 'Espagne', admin: 'Spain', lat: 40.42, lng: -3.70 },
  { symbol: 'EWD', etf: 'EWD', index: 'OMX 30', city: 'Stockholm', country: 'Suède', admin: 'Sweden', lat: 59.33, lng: 18.07 },
  // Asie-Pacifique
  { symbol: 'EWJ', etf: 'EWJ', index: 'Nikkei 225', city: 'Tokyo', country: 'Japon', admin: 'Japan', lat: 35.68, lng: 139.69 },
  { symbol: 'EWH', etf: 'EWH', index: 'Hang Seng', city: 'Hong Kong', country: 'Hong Kong', admin: 'Hong Kong S.A.R.', lat: 22.32, lng: 114.17 },
  { symbol: 'FXI', etf: 'FXI', index: 'CSI 300', city: 'Shanghai', country: 'Chine', admin: 'China', lat: 31.23, lng: 121.47 },
  { symbol: 'EWY', etf: 'EWY', index: 'KOSPI', city: 'Séoul', country: 'Corée du Sud', admin: 'South Korea', lat: 37.57, lng: 126.98 },
  { symbol: 'EWT', etf: 'EWT', index: 'TAIEX', city: 'Taipei', country: 'Taïwan', admin: 'Taiwan', lat: 25.03, lng: 121.57 },
  { symbol: 'EWS', etf: 'EWS', index: 'STI', city: 'Singapour', country: 'Singapour', admin: 'Singapore', lat: 1.35, lng: 103.82 },
  { symbol: 'INDA', etf: 'INDA', index: 'Nifty 50', city: 'Mumbai', country: 'Inde', admin: 'India', lat: 19.08, lng: 72.88 },
  { symbol: 'EWA', etf: 'EWA', index: 'ASX 200', city: 'Sydney', country: 'Australie', admin: 'Australia', lat: -33.87, lng: 151.21 },
  // Afrique
  { symbol: 'EZA', etf: 'EZA', index: 'JSE Top 40', city: 'Johannesburg', country: 'Afrique du Sud', admin: 'South Africa', lat: -26.20, lng: 28.04 },
]

// Instruments tradables dans le Paper Trading (étape 7). Toutes des valeurs/ETF
// cotés aux US → servis par Twelve Data en plan gratuit (1 crédit/symbole), donc
// prix réels sans Yahoo. `kind` sert juste au libellé/regroupement dans l'UI.
export const TRADABLE_UNIVERSE = [
  { symbol: 'AAPL', name: 'Apple', kind: 'Action' },
  { symbol: 'MSFT', name: 'Microsoft', kind: 'Action' },
  { symbol: 'NVDA', name: 'NVIDIA', kind: 'Action' },
  { symbol: 'AMZN', name: 'Amazon', kind: 'Action' },
  { symbol: 'GOOGL', name: 'Alphabet', kind: 'Action' },
  { symbol: 'META', name: 'Meta Platforms', kind: 'Action' },
  { symbol: 'TSLA', name: 'Tesla', kind: 'Action' },
  { symbol: 'AMD', name: 'AMD', kind: 'Action' },
  { symbol: 'NFLX', name: 'Netflix', kind: 'Action' },
  { symbol: 'AVGO', name: 'Broadcom', kind: 'Action' },
  { symbol: 'JPM', name: 'JPMorgan Chase', kind: 'Action' },
  { symbol: 'V', name: 'Visa', kind: 'Action' },
  { symbol: 'XOM', name: 'ExxonMobil', kind: 'Action' },
  { symbol: 'DIS', name: 'Walt Disney', kind: 'Action' },
  { symbol: 'COIN', name: 'Coinbase', kind: 'Action' },
  { symbol: 'UBER', name: 'Uber', kind: 'Action' },
  { symbol: 'CRM', name: 'Salesforce', kind: 'Action' },
  { symbol: 'PLTR', name: 'Palantir', kind: 'Action' },
  { symbol: 'BA', name: 'Boeing', kind: 'Action' },
  { symbol: 'INTC', name: 'Intel', kind: 'Action' },
  { symbol: 'SPY', name: 'S&P 500 (ETF)', kind: 'ETF' },
  { symbol: 'QQQ', name: 'Nasdaq 100 (ETF)', kind: 'ETF' },
]

// symbol -> display name lookup (used to label positions/trades).
export const SYMBOL_NAMES = Object.fromEntries(
  TRADABLE_UNIVERSE.map((t) => [t.symbol, t.name]),
)

export const COMMODITIES_SYMBOLS = [
  { symbol: 'GC=F', name: 'Or (oz)' },
  { symbol: 'CL=F', name: 'Pétrole WTI' },
  { symbol: 'SI=F', name: 'Argent (oz)' },
  { symbol: 'NG=F', name: 'Gaz naturel' },
  { symbol: 'ZW=F', name: 'Blé' },
]

// CoinGecko ids -> display symbol/name.
export const CRYPTO_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'Ripple' },
]
