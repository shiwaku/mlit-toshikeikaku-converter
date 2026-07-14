import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'

import { getBasemapStyle } from './basemap'
import { THEMES, type ThemeDef, dotColor, hoverHtml, legendFor, paintFor, popupHtml } from './layers'
import { applyThemeAttr, initialTheme, type Theme } from './theme'
import './style.css'

const PMTILES_BASE = import.meta.env.VITE_PMTILES_BASE ?? '/pmtiles'
const DATA_ATTRIBUTION =
  '都市計画決定GISデータ（<a href="https://www.mlit.go.jp/toshi/tosiko/toshi_tosiko_tk_000182.html" target="_blank" rel="noopener">国土交通省 都市局</a>）'

let theme: Theme = initialTheme()
applyThemeAttr(theme)

const protocol = new Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)

const map = new maplibregl.Map({
  container: 'map',
  style: getBasemapStyle(theme),
  center: [139.74, 35.68],
  zoom: 10,
  attributionControl: false,
})
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
map.addControl(new maplibregl.ScaleControl(), 'bottom-left')
map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: DATA_ATTRIBUTION }))

const layerId = (key: string): string => `${key}-lyr`
const keyFromLayer = (id: string): string => id.replace(/-lyr$/, '')
const defOf = (key: string): ThemeDef | undefined => THEMES.find((t) => t.key === key)
const activeLayerIds = (): string[] =>
  THEMES.filter((t) => t.on).map((t) => layerId(t.key)).filter((id) => map.getLayer(id))

function addDataLayers(): void {
  for (const def of THEMES) {
    if (map.getLayer(layerId(def.key))) map.removeLayer(layerId(def.key))
    if (map.getSource(def.key)) map.removeSource(def.key)
  }
  for (const def of THEMES) {
    map.addSource(def.key, {
      type: 'vector',
      url: `pmtiles://${PMTILES_BASE}/${def.key}.pmtiles`,
    })
    const p = paintFor(def)
    map.addLayer({
      id: layerId(def.key),
      type: p.type,
      source: def.key,
      'source-layer': def.key,
      layout: { visibility: def.on ? 'visible' : 'none' },
      paint: p.paint,
    } as maplibregl.LayerSpecification)
  }
}

function onceStyleReady(cb: () => void): void {
  if (map.isStyleLoaded()) {
    cb()
    return
  }
  const h = (): void => {
    if (map.isStyleLoaded()) {
      map.off('styledata', h)
      cb()
    }
  }
  map.on('styledata', h)
}

// ---- テーマ切替 ----
const themeBtn = document.getElementById('theme-btn') as HTMLButtonElement
const renderThemeBtn = (): void => {
  themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙'
}
function setTheme(next: Theme): void {
  theme = next
  applyThemeAttr(theme)
  renderThemeBtn()
  map.setStyle(getBasemapStyle(theme))
  onceStyleReady(addDataLayers)
}
themeBtn.addEventListener('click', () => setTheme(theme === 'dark' ? 'light' : 'dark'))

// ---- パネル開閉 ----
const panel = document.getElementById('panel') as HTMLElement
const collapseBtn = document.getElementById('collapse-btn') as HTMLButtonElement
const renderCollapseBtn = (): void => {
  collapseBtn.textContent = panel.classList.contains('collapsed') ? '▾' : '▴'
}
collapseBtn.addEventListener('click', () => {
  panel.classList.toggle('collapsed')
  renderCollapseBtn()
})

// ---- レイヤートグル ----
const layersDiv = document.getElementById('layers') as HTMLElement
function setLayerVisible(def: ThemeDef, on: boolean): void {
  def.on = on
  const id = layerId(def.key)
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  renderLegend()
}
function buildToggles(): void {
  for (const def of THEMES) {
    const label = document.createElement('label')
    label.className = 'toggle'
    label.dataset.key = def.key

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = def.on
    input.addEventListener('change', () => setLayerVisible(def, input.checked))

    const sw = document.createElement('span')
    sw.className = 'switch'
    const text = document.createElement('span')
    text.className = 't-label'
    text.textContent = def.name
    const dot = document.createElement('span')
    dot.className = 't-dot'
    dot.style.background = dotColor(def)

    label.append(input, sw, text, dot)
    layersDiv.append(label)
  }
}
const allOffBtn = document.getElementById('all-off') as HTMLButtonElement
allOffBtn.addEventListener('click', () => {
  for (const def of THEMES) {
    if (!def.on) continue
    const input = layersDiv.querySelector<HTMLInputElement>(`.toggle[data-key="${def.key}"] input`)
    if (input) input.checked = false
    setLayerVisible(def, false)
  }
})

// ---- 凡例（表示中テーマのみ） ----
const legendDiv = document.getElementById('legend') as HTMLElement
function renderLegend(): void {
  const active = THEMES.filter((t) => t.on)
  if (!active.length) {
    legendDiv.innerHTML = '<div class="legend-empty">レイヤーを選択してください</div>'
    return
  }
  legendDiv.innerHTML = active
    .map((def) => {
      const items = legendFor(def)
      const swatches = items
        .map(
          (it) =>
            `<div class="legend-row"><span class="legend-sw" style="background:${it.color}"></span>${it.label}</div>`,
        )
        .join('')
      return `<div class="legend-block"><div class="legend-title">${def.name}</div>${swatches}</div>`
    })
    .join('')
}

// ---- ホバーツールチップ ----
const tooltip = document.getElementById('tooltip') as HTMLElement
map.on('mousemove', (e) => {
  const ids = activeLayerIds()
  const feats = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : []
  if (feats.length) {
    const f = feats[0]
    const key = keyFromLayer(f.layer.id)
    tooltip.innerHTML = hoverHtml(key, defOf(key)?.name ?? key, f.properties as Record<string, unknown>)
    tooltip.style.left = `${e.point.x}px`
    tooltip.style.top = `${e.point.y}px`
    tooltip.hidden = false
    map.getCanvas().style.cursor = 'pointer'
  } else {
    tooltip.hidden = true
    map.getCanvas().style.cursor = ''
  }
})
map.on('mouseout', () => {
  tooltip.hidden = true
})

// ---- クリックポップアップ ----
map.on('click', (e) => {
  const ids = activeLayerIds()
  const feats = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : []
  if (!feats.length) return
  const f = feats[0]
  const key = keyFromLayer(f.layer.id)
  new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
    .setLngLat(e.lngLat)
    .setHTML(popupHtml(key, defOf(key)?.name ?? key, f.properties as Record<string, unknown>))
    .addTo(map)
})

// ---- 初期化 ----
renderThemeBtn()
renderCollapseBtn()
buildToggles()
renderLegend()
map.on('load', addDataLayers)
