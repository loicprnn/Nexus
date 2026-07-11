# Nexus — Financial Intelligence Platform

Nexus est une application web d'analyse financière qui se positionne entre un
Bloomberg Terminal et TradingView : données de marché en direct, indicateurs
macro et de sentiment, analyse d'actifs assistée par l'IA (Claude), le tout dans
une interface sombre à identité visuelle verte, pensée comme un terminal moderne.

> Projet portfolio — toute l'interface et les réponses de l'IA sont en français.

## ✨ Fonctionnalités

- **Dashboard** modulaire à identité verte : Nexus Score, Fear & Greed, VIX,
  courbe des taux, favoris et top movers, avec sparklines néon et recherche rapide.
- **Analyse d'actif** en 4 axes (technique, fondamental, sentiment, macro) avec
  score global /10 et synthèse générée par Claude. Données fondamentales via
  **SEC EDGAR** (10-K/10-Q).
- **Markets** : globe 3D interactif avec heatmap régionale des performances.
- **Macro** : taux Fed, CPI, chômage, M2, courbe des taux + synthèse « Nexus Analysis ».
- **Indicateurs avancés** : VIX, spreads de crédit, breakeven d'inflation, dollar index.
- **Sentiment** : Fear & Greed (historique 30 j), Put/Call ratio, scoring sectoriel IA.
- **Comparer** : comparaison multi-actifs avec analyse comparative Claude.
- **Paper Trading** : portefeuille fictif aux prix réels.
- **Nexus Coach** : assistant conversationnel (Claude) sur le contexte de marché.
- **Alertes**, **Calendrier économique**, sidebar repliable, responsive mobile.

## 🛠️ Stack technique

- **Front** : React 18 + Vite, Tailwind CSS, Framer Motion, React Router
- **Visualisation** : SVG maison (sparklines/jauges), react-globe.gl + three.js, TSParticles
- **Auth & données** : Supabase (Auth + Postgres, RLS)
- **IA** : API Claude (Anthropic) via proxy serveur
- **Données de marché** : Twelve Data (cours), FRED (macro), CNN (Fear & Greed),
  CoinGecko (crypto), SEC EDGAR (fondamentaux) — toutes les clés restent côté serveur
- **Déploiement** : Vercel (fonctions serverless pour les proxys d'API)

## 🔐 Sécurité des clés

Aucune clé secrète n'est exposée au client. Les APIs à clé passent par des proxys
serveur (`api/*.js` en prod Vercel, middleware Vite en dev) qui injectent les clés
depuis les variables d'environnement. Seules `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY` (protégées par RLS) sont publiques.

## 🚀 Démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env
#   puis renseigner les clés dans .env (voir ci-dessous)

# 3. Lancer en développement
npm run dev

# 4. Build de production
npm run build
```

### Variables d'environnement (`.env`)

Côté serveur uniquement (jamais dans le bundle) :

```
FRED_API_KEY=          # macro (fred.stlouisfed.org)
TWELVE_DATA_KEY=       # cours (twelvedata.com)
ANTHROPIC_KEY=         # Claude (console.anthropic.com)
SEC_USER_AGENT=        # User-Agent identifiant pour l'API SEC EDGAR
MAKE_WEBHOOK_URL=      # (optionnel) relais d'alertes Make.com
```

Publiques (RLS) :

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## 📁 Structure

```
api/            Fonctions serverless (proxys sécurisés : fred, claude, twelvedata, edgar, alert)
src/
  components/   UI, layout, dashboard, markets, paper trading
  pages/        Dashboard, Analyse, Markets, Macro, Sentiment, Comparer, …
  hooks/        useMarketData (polling + cache)
  lib/          Clients API, scoring, formatage
```

---

🤖 Développé avec [Claude Code](https://claude.com/claude-code)
