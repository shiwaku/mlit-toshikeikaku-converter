import { chromium } from 'playwright'
const OUT = '/tmp/claude-1000/-mnt-c-Users-yshiw-Documents-GIS-ksj-toshi-tosiko-tk/20a2c2d7-996d-421e-badb-3a22f0991430/scratchpad'
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1040, height: 820 } })
await page.goto('http://localhost:8000/', { waitUntil: 'networkidle' })
await page.waitForTimeout(6000)
await page.click('.basemap-switch button[data-base="photo"]')
await page.waitForTimeout(12000)
const state = await page.evaluate(() => {
  const m = window.__map
  return m ? { hasSrc: !!m.getSource('youto'), hasLyr: !!m.getLayer('youto-lyr'), vis: m.getLayer('youto-lyr') && m.getLayoutProperty('youto-lyr','visibility'), styleLoaded: m.isStyleLoaded() } : 'no __map'
})
console.log('STATE:', JSON.stringify(state))
await page.screenshot({ path: `${OUT}/shot-photo2.png` })
await browser.close()
console.log('done')
