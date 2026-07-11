import {
  NexusScoreWidget,
  FearGreedWidget,
  VixWidget,
  FavorisWidget,
  TopMoversWidget,
  CryptoWidget,
  CommoditiesWidget,
  MarketHoursWidget,
  DailyBriefWidget,
  PaperPerfWidget,
} from './widgets'

// Catalogue of available widget types. `size` is the default grid footprint.
// The board is laid out in TWO columns (each 6 of the 12 units wide), so every
// widget defaults to w:6 and new widgets drop in at a column width.
export const WIDGET_REGISTRY = {
  nexusScore: {
    title: 'Nexus Score',
    category: 'Marché global',
    component: NexusScoreWidget,
    // Compact: just the gauge + label.
    size: { w: 6, h: 4, minW: 3, minH: 4 },
  },
  fearGreed: {
    title: 'Fear & Greed',
    category: 'Marché global',
    component: FearGreedWidget,
    size: { w: 6, h: 5, minW: 3, minH: 4 },
  },
  vix: {
    title: 'VIX',
    category: 'Marché global',
    component: VixWidget,
    size: { w: 6, h: 5, minW: 3, minH: 4 },
  },
  dailyBrief: {
    title: 'Brief quotidien',
    category: 'Analyse IA',
    component: DailyBriefWidget,
    // Enlarged so the full Claude brief shows without truncation.
    size: { w: 6, h: 8, minW: 4, minH: 6 },
  },
  favoris: {
    title: 'Mes favoris',
    category: 'Actifs',
    component: FavorisWidget,
    size: { w: 6, h: 7, minW: 3, minH: 4 },
  },
  topMovers: {
    title: 'Top movers',
    category: 'Actifs',
    component: TopMoversWidget,
    size: { w: 6, h: 7, minW: 3, minH: 4 },
  },
  crypto: {
    title: 'Crypto',
    category: 'Actifs',
    component: CryptoWidget,
    size: { w: 6, h: 7, minW: 3, minH: 4 },
  },
  commodities: {
    title: 'Matières premières',
    category: 'Actifs',
    component: CommoditiesWidget,
    size: { w: 6, h: 6, minW: 3, minH: 4 },
  },
  marketHours: {
    title: "Horaires des bourses",
    category: 'Horaires',
    component: MarketHoursWidget,
    size: { w: 6, h: 6, minW: 3, minH: 4 },
  },
  paperPerf: {
    title: 'Performance portefeuille',
    category: 'Paper Trading',
    component: PaperPerfWidget,
    size: { w: 6, h: 5, minW: 4, minH: 4 },
  },
}

export const WIDGET_TYPES = Object.keys(WIDGET_REGISTRY)

// Layout shown to a user who has never customised their dashboard.
export const DEFAULT_WIDGETS = [
  { i: 'nexusScore-0', type: 'nexusScore' },
  { i: 'fearGreed-0', type: 'fearGreed' },
  { i: 'vix-0', type: 'vix' },
  { i: 'dailyBrief-0', type: 'dailyBrief' },
  { i: 'favoris-0', type: 'favoris' },
  { i: 'topMovers-0', type: 'topMovers' },
  { i: 'marketHours-0', type: 'marketHours' },
  { i: 'paperPerf-0', type: 'paperPerf' },
]

// Two aligned columns that hold their shape at every breakpoint: each column is
// half the grid wide, widgets stack vertically inside their column — no zig-zag.
// `colW` is the per-breakpoint half-width (lg 12→6, md 10→5, sm 6→3).
const LEFT_COLUMN = [
  { i: 'dailyBrief-0', h: 8 },
  { i: 'favoris-0', h: 7 },
  { i: 'marketHours-0', h: 6 },
]
const RIGHT_COLUMN = [
  { i: 'nexusScore-0', h: 4 },
  { i: 'fearGreed-0', h: 5 },
  { i: 'vix-0', h: 5 },
  { i: 'topMovers-0', h: 7 },
  { i: 'paperPerf-0', h: 5 },
]

function place(items, x, colW, startY = 0) {
  let y = startY
  return items.map(({ i, h }) => {
    const item = { i, x, y, w: colW, h }
    y += h
    return item
  })
}

// Two side-by-side columns (left at x:0, right at x:colW).
function buildColumns(colW) {
  return [...place(LEFT_COLUMN, 0, colW), ...place(RIGHT_COLUMN, colW, colW)]
}

// Single stacked column for the narrowest screens (left then right).
function buildStack(colW) {
  const left = place(LEFT_COLUMN, 0, colW)
  const lastY = left.length ? left[left.length - 1].y + left[left.length - 1].h : 0
  return [...left, ...place(RIGHT_COLUMN, 0, colW, lastY)]
}

// One entry per breakpoint so the two-column shape never falls back to RGL's
// auto-generated (zig-zag) layout. Half-width = half the column count.
export const DEFAULT_LAYOUTS = {
  lg: buildColumns(6), // 12 cols
  md: buildColumns(5), // 10 cols
  sm: buildColumns(3), // 6 cols
  xs: buildColumns(2), // 4 cols
  xxs: buildStack(2), // 2 cols → single column
}
