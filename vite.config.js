import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fredHandler from './api/fred.js'
import claudeHandler from './api/claude.js'
import twelveDataHandler from './api/twelvedata.js'
import alertHandler from './api/alert.js'
import edgarHandler from './api/edgar.js'

// Browser-like headers — some upstreams (Yahoo, CNN) reject non-browser clients.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function withBrowserHeaders(proxy, referer) {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.setHeader('user-agent', BROWSER_UA)
    proxyReq.setHeader('accept', 'application/json, text/plain, */*')
    if (referer) proxyReq.setHeader('referer', referer)
  })
}

// Dev-only plugin that runs the SAME serverless handlers used in production
// (api/fred.js, api/claude.js) as Vite middleware. This keeps the secret keys
// server-side in dev too: they are read from process.env (populated via loadEnv
// below) and never exposed to the client — exactly like Vercel in prod.
function secureApiPlugin() {
  return {
    name: 'nexus-secure-api',
    configureServer(server) {
      server.middlewares.use('/api/fred', (req, res) => fredHandler(req, res))
      server.middlewares.use('/api/claude', (req, res) => claudeHandler(req, res))
      server.middlewares.use('/api/twelvedata', (req, res) => twelveDataHandler(req, res))
      server.middlewares.use('/api/alert', (req, res) => alertHandler(req, res))
      server.middlewares.use('/api/edgar', (req, res) => edgarHandler(req, res))
    },
  }
}

// Dev proxies route market-data calls through the Vite server to dodge browser
// CORS / bot-detection. Keyed APIs (FRED, Claude) go through secureApiPlugin so
// their keys stay server-side. Production uses vercel.json rewrites for the
// keyless upstreams and the api/* serverless functions for the keyed ones.
export default defineConfig(({ mode }) => {
  // Load ALL env vars (no prefix filter) into process.env so the server-side
  // handlers can read FRED_API_KEY / ANTHROPIC_KEY. Vite only inlines VITE_*
  // into the client, so these secrets never leak into the bundle.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v
  }

  return {
    plugins: [react(), secureApiPlugin()],
    server: {
      // Honor a host-assigned port (PORT env) when present; fall back to Vite's
      // conventional 5173 for plain local runs.
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
      proxy: {
        '/api/yahoo': {
          target: 'https://query1.finance.yahoo.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/yahoo/, ''),
          configure: (proxy) => withBrowserHeaders(proxy, 'https://finance.yahoo.com/'),
        },
        '/api/coingecko': {
          target: 'https://api.coingecko.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/coingecko/, ''),
        },
        '/api/fng': {
          target: 'https://production.dataviz.cnn.io',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/fng/, ''),
          configure: (proxy) => withBrowserHeaders(proxy, 'https://edition.cnn.com/'),
        },
      },
    },
  }
})
