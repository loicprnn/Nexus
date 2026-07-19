import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import Globe from 'react-globe.gl'
import countries from '../../assets/globe/countries.json'
import { formatPrice, formatPct } from '../../lib/format'

const UP = '#22C55E'
const DOWN = '#EF4444'
const NEUTRAL = '#9A9A92'

// Marker colour by performance sign; grey when no quote is available.
function markerColor(pct) {
  if (pct == null || Number.isNaN(pct)) return NEUTRAL
  return pct >= 0 ? UP : DOWN
}

// --- Regional heatmap -------------------------------------------------------
// Country fill = its market's performance: a dark base blended toward green
// (up) or red (down), the blend intensity scaled by |% change| (saturating at
// ±2.5%). Countries without a tracked market stay dark grey.
const HEAT_NODATA = '#D0D0CC' // continents sans données (gris clair)
const HEAT_BASE = [208, 208, 204] // #D0D0CC → base du dégradé vers vert/rouge
const HEAT_UP = [34, 197, 94]
const HEAT_DOWN = [239, 68, 68]

function heatColor(pct) {
  if (pct == null || Number.isNaN(pct)) return HEAT_NODATA
  const mag = Math.min(Math.abs(pct), 2.5) / 2.5
  const t = 0.3 + 0.7 * mag
  const target = pct >= 0 ? HEAT_UP : HEAT_DOWN
  const [r, g, b] = HEAT_BASE.map((c, i) => Math.round(c + (target[i] - c) * t))
  return `rgb(${r}, ${g}, ${b})`
}

// Styled HTML tooltip (globe.gl injects raw HTML, so Tailwind classes won't
// apply — inline styles mirror the design tokens).
function tooltipHtml(d) {
  const color = markerColor(d.changePct)
  const price = d.price != null ? formatPrice(d.price) : '—'
  const pct = d.changePct != null ? formatPct(d.changePct) : 'Données indisponibles'
  return `
    <div style="
      font-family: Inter, system-ui, sans-serif;
      background: #FFFFFF;
      border: 0.5px solid #E8E8E0;
      border-radius: 12px;
      padding: 10px 12px;
      min-width: 150px;
      pointer-events: none;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    ">
      <div style="font-size:10px;letter-spacing:0.04em;text-transform:uppercase;color:#AAAAAA;">
        ${d.city} · ${d.country}
      </div>
      <div style="display:flex;align-items:baseline;gap:6px;margin-top:2px;">
        <span style="font-size:14px;font-weight:600;color:#0A0A0A;">${d.index}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#888880;">${d.etf}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:14px;margin-top:6px;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#0A0A0A;">${price}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:${color};">${pct}</span>
      </div>
    </div>`
}

// Interactive 3D globe of world markets. Markers sit on financial centres,
// coloured by performance and raised in proportion to |% change|. Auto-rotates
// until the user interacts. Sized to its parent via ResizeObserver.
export default function MarketGlobe({ markets, onHover }) {
  const globeRef = useRef(null)
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Track container size for a responsive canvas.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ width: Math.round(r.width), height: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Initial camera + auto-rotation, set once the Globe instance is ready (the
  // <Globe> mounts only after the container is measured, so globeRef isn't
  // available at component-mount time — onGlobeReady fires at the right moment).
  const handleReady = () => {
    const g = globeRef.current
    if (!g) return
    // Centre on the Atlantic so North America (left) and Europe (right) are both
    // in view on first paint — the markets people look for first.
    g.pointOfView({ lat: 32, lng: -34, altitude: 2.3 }, 0)
    // Oceans = the globe sphere itself, painted near-black. Landmasses are drawn
    // grey on top via the country-polygon layer (see <Globe> props below).
    const controls = g.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.35
    controls.enableZoom = true
    controls.minDistance = 180
    controls.maxDistance = 600
    controls.addEventListener('start', () => {
      controls.autoRotate = false
    })
  }

  const points = useMemo(
    () =>
      markets.map((m) => ({
        ...m,
        // Raise markers by magnitude of move (capped so outliers stay readable).
        alt: 0.01 + Math.min(Math.abs(m.changePct ?? 0), 5) * 0.06,
      })),
    [markets],
  )

  // Pulsing rings only on markets that actually have live data.
  const rings = useMemo(() => points.filter((p) => p.changePct != null), [points])

  // Performance by country (ADMIN name) for the heatmap. For countries with
  // several tracked markets (e.g. US: SPY + QQQ) the first available reading
  // wins.
  const perfByAdmin = useMemo(() => {
    const map = {}
    for (const m of markets) {
      if (m.admin && m.changePct != null && map[m.admin] == null) {
        map[m.admin] = m.changePct
      }
    }
    return map
  }, [markets])

  // Signature of the heat data — used to give `borders` a fresh array identity
  // when performances change, so globe.gl recomputes the cap colours (it caches
  // them per data reference) WITHOUT remounting the globe (camera preserved).
  const heatKey = useMemo(
    () => Object.entries(perfByAdmin).map(([k, v]) => `${k}:${v.toFixed(2)}`).join('|'),
    [perfByAdmin],
  )

  // Country borders (Natural Earth, bundled locally — no CDN). Drawn as filled
  // landmasses that double as a performance heatmap (see polygonCapColor). A new
  // array is produced whenever the heat data changes to bust globe.gl's cache.
  const borders = useMemo(
    () => countries.features.filter((f) => f.properties?.ISO_A2 !== 'AQ').map((f) => f),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heatKey],
  )

  // Ocean sphere = soft slate blue so the globe reads clearly on the white card
  // without being loud. Emissive keeps it visible regardless of scene lighting,
  // with a slightly darker tone for subtle spherical shading. Built once.
  const globeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: '#B8C8D4',
        emissive: '#9FB2C0',
        shininess: 0,
      }),
    [],
  )

  return (
    <div ref={wrapRef} className="h-full w-full">
      {size.width > 0 && (
        <Globe
          ref={globeRef}
          onGlobeReady={handleReady}
          width={size.width}
          height={size.height}
          globeMaterial={globeMaterial}
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere={false}
          polygonsData={borders}
          polygonCapColor={(f) => heatColor(perfByAdmin[f.properties?.ADMIN])}
          polygonsTransitionDuration={600}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => 'rgba(150,150,145,0.35)'}
          polygonAltitude={(f) => (perfByAdmin[f.properties?.ADMIN] != null ? 0.012 : 0.006)}
          polygonLabel={() => ''}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d) => markerColor(d.changePct)}
          pointAltitude="alt"
          pointRadius={0.45}
          pointsMerge={false}
          pointLabel={tooltipHtml}
          onPointHover={(d) => onHover?.(d || null)}
          labelsData={points}
          labelLat="lat"
          labelLng="lng"
          labelText={(d) => d.index}
          labelColor={() => 'rgba(20,20,20,0.72)'}
          labelSize={0.85}
          labelDotRadius={0}
          labelResolution={2}
          labelAltitude={(d) => d.alt + 0.01}
          labelLabel={tooltipHtml}
          onLabelHover={(d) => onHover?.(d || null)}
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor={(d) => () => markerColor(d.changePct)}
          ringMaxRadius={2.2}
          ringPropagationSpeed={1.2}
          ringRepeatPeriod={1400}
          ringAltitude={0.012}
        />
      )}
    </div>
  )
}
