import './mute-auto.mjs'
// 画面の確認用スクショ。node shot.mjs [幅] [高さ] [webkit]
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 6472
mkdirSync(ROOT + '/shots', { recursive: true })
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const [w, h] = [+(process.argv[2] || 390), +(process.argv[3] || 844)], bt = process.argv[4] === 'webkit' ? webkit : chromium
const b = await bt.launch(), ctx = await b.newContext({ locale: process.env.LANG_EN ? 'en-US' : 'ja-JP', viewport: { width: w, height: h }, deviceScaleFactor: 2, ...(bt === webkit ? { isMobile: true, hasTouch: true } : {}) })
const p = await ctx.newPage(), errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__nkReady, null, { timeout: 15000 }); await p.waitForTimeout(500)
const tag = `${w}x${h}`
await p.screenshot({ path: `shots/s-${tag}-title.png` })
await p.evaluate(() => { nk.dbg.seed(7); nk.start(); nk.dbg.pause(); nk.dbg.skipKiritsu(); nk.G.noWatch = true })
const tapN = async n => { for (let i = 0; i < n; i++) { await p.evaluate(i => { nk.tap(i % 2); nk.dbg.step(10) }, i) } }
await tapN(20); await p.evaluate(() => nk.dbg.step(40)); await p.screenshot({ path: `shots/s-${tag}-p0.png` })
await p.evaluate(() => { const w = nk.G.w; w.st = 'tell'; w.t = 0; w.dur = 9; nk.dbg.step(2) }); await p.screenshot({ path: `shots/s-${tag}-tell.png` })
await p.evaluate(() => { const w = nk.G.w; w.st = 'look'; w.t = 0.2; w.dur = 9; nk.G.lastSide = 1; nk.tap(0); nk.dbg.step(8) }); await p.screenshot({ path: `shots/s-${tag}-caught.png` })
await p.evaluate(() => { nk.dbg.step(120); nk.G.strikes = 0 })
for (const P of (process.env.PS || '14,24,33,44,49.5,56,66,76,85,89.6,96,104').split(',').map(Number)) {
  await p.evaluate(P => { nk.dbg.setP(P); nk.dbg.step(80) }, P)
  await tapN(6); await p.evaluate(() => nk.dbg.step(60))
  await p.screenshot({ path: `shots/s-${tag}-p${P}.png` })
}
await p.evaluate(() => { nk.G.t = 74.9; nk.G.lock = 0; nk.G.w.st = 'idle'; nk.dbg.step(200) }); await p.waitForTimeout(900); await p.screenshot({ path: `shots/s-${tag}-end.png` })
console.log(JSON.stringify(await p.evaluate(() => nk.result())), errs)
await b.close(); server.kill()
