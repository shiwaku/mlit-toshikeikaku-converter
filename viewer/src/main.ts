import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'

import { getBasemapStyle, type Basemap } from './basemap'
import { THEMES, type ThemeDef, hoverHtml, legendFor, paintFor, popupHtml } from './layers'
import { applyThemeAttr, initialTheme, type Theme } from './theme'
import './style.css'

const PMTILES_BASE = import.meta.env.VITE_PMTILES_BASE ?? '/pmtiles'
const DATA_ATTRIBUTION =
  '都市計画決定GISデータ（<a href="https://www.mlit.go.jp/toshi/tosiko/toshi_tosiko_tk_000182.html" target="_blank" rel="noopener">国土交通省 都市局</a>）'

let theme: Theme = initialTheme()
let base: Basemap = 'pale'
applyThemeAttr(theme)

const protocol = new Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)

const map = new maplibregl.Map({
  container: 'map',
  style: getBasemapStyle(base, theme),
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

// ---- テーマ切替 ----
const themeBtn = document.getElementById('theme-btn') as HTMLButtonElement
const renderThemeBtn = (): void => {
  themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙'
}
// 背景スタイル差し替え後、新スタイルの読み込み完了（styledata）を待ってデータ層を再追加する。
// setStyle 直後は旧スタイルが loaded 扱いのままのことがあり、即時追加すると差し替えで消えるため。
function reloadStyle(): void {
  map.setStyle(getBasemapStyle(base, theme))
  map.once('styledata', () => addDataLayers())
}
themeBtn.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark'
  applyThemeAttr(theme)
  renderThemeBtn()
  reloadStyle()
})

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

// ---- レイヤートグル（凡例を各レイヤー直下にインライン表示） ----
const layersDiv = document.getElementById('layers') as HTMLElement

function legendMarkup(def: ThemeDef): string {
  const items = legendFor(def)
  if (items.length <= 1) {
    const c = items[0]?.color ?? 'rgba(150,150,150,1)'
    return `<span class="lg-bar" style="background:${c}"></span>`
  }
  return items
    .map(
      (it) =>
        `<span class="lg-row"><span class="lg-sw" style="background:${it.color}"></span>${it.label}</span>`,
    )
    .join('')
}

function buildToggles(): void {
  for (const def of THEMES) {
    const item = document.createElement('div')
    item.className = 'layer-item'
    item.dataset.key = def.key

    const label = document.createElement('label')
    label.className = 'toggle'

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = def.on
    input.addEventListener('change', () => setLayerVisible(def, input.checked))

    const sw = document.createElement('span')
    sw.className = 'switch'
    const text = document.createElement('span')
    text.className = 't-label'
    text.textContent = def.name

    label.append(input, sw, text)

    const legend = document.createElement('div')
    legend.className = 'layer-legend'
    legend.innerHTML = legendMarkup(def)
    legend.hidden = !def.on

    item.append(label, legend)
    layersDiv.append(item)
  }
}

function setLayerVisible(def: ThemeDef, on: boolean): void {
  def.on = on
  const id = layerId(def.key)
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  const legend = layersDiv.querySelector<HTMLElement>(`.layer-item[data-key="${def.key}"] .layer-legend`)
  if (legend) legend.hidden = !on
}

const allOffBtn = document.getElementById('all-off') as HTMLButtonElement
allOffBtn.addEventListener('click', () => {
  for (const def of THEMES) {
    if (!def.on) continue
    const input = layersDiv.querySelector<HTMLInputElement>(`.layer-item[data-key="${def.key}"] input`)
    if (input) input.checked = false
    setLayerVisible(def, false)
  }
})

// ---- 背景地図スイッチャー（右下） ----
class BasemapControl implements maplibregl.IControl {
  private el!: HTMLElement
  onAdd(): HTMLElement {
    this.el = document.createElement('div')
    this.el.className = 'maplibregl-ctrl basemap-switch'
    const defs: [Basemap, string][] = [
      ['pale', '地図'],
      ['photo', '写真'],
    ]
    for (const [b, label] of defs) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = label
      btn.dataset.base = b
      btn.setAttribute('aria-selected', String(b === base))
      btn.addEventListener('click', () => setBase(b))
      this.el.append(btn)
    }
    return this.el
  }
  onRemove(): void {
    this.el.remove()
  }
  sync(): void {
    for (const btn of this.el.querySelectorAll<HTMLButtonElement>('button')) {
      btn.setAttribute('aria-selected', String(btn.dataset.base === base))
    }
  }
}
const basemapCtrl = new BasemapControl()
map.addControl(basemapCtrl, 'bottom-right')

function setBase(next: Basemap): void {
  if (next === base) return
  base = next
  basemapCtrl.sync()
  reloadStyle()
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
map.on('load', addDataLayers)

// デバッグ/外部連携用にマップを公開
;(window as unknown as { __map: maplibregl.Map }).__map = map
