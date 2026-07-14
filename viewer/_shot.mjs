import { chromium } from 'playwright'

const OUT = '/tmp/claude-1000/-mnt-c-Users-yshiw-Documents-GIS-ksj-toshi-tosiko-tk/20a2c2d7-996d-421e-badb-3a22f0991430/scratchpad'
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1040, height: 820 } })
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()) })
await page.goto('http://localhost:8000/', { waitUntil: 'networkidle' })
await page.waitForTimeout(6000) // タイル描画待ち
await page.screenshot({ path: `${OUT}/shot-map.png` })

// 背景を写真に切替
await page.click('.basemap-switch button[data-base="photo"]')
await page.waitForTimeout(6000)
await page.screenshot({ path: `${OUT}/shot-photo.png` })

// パネルのみ（凡例確認）
const panel = await page.$('#panel')
await panel.screenshot({ path: `${OUT}/shot-panel.png` })

await browser.close()
console.log('done')
