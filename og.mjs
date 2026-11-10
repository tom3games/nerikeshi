import './mute-auto.mjs'
// SNS 用の画像 og.png（1200x630）。遊んでいる場面（教室を飲みこむ練り消しと振り向きかけの先生）＋題名。node og.mjs
import { chromium } from 'playwright'
import { spawn, execFileSync } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 6475
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 500, height: 630 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__nkReady); await p.waitForTimeout(600)
const shot = await p.evaluate(() => {
  nk.dbg.seed(3); nk.start(); nk.dbg.pause(); nk.dbg.skipKiritsu(); nk.G.noWatch = true
  for (let i = 0; i < 40; i++) { nk.tap(i % 2); nk.dbg.tick(6) }
  nk.dbg.setP(43.2); nk.dbg.tick(90)
  for (let i = 0; i < 8; i++) { nk.tap(i % 2); nk.dbg.tick(5) }
  const w = nk.G.w; w.st = 'tell'; w.t = 0.4; w.dur = 9; nk.G.bub = null
  nk.dbg.step(2)
  document.getElementById('hud').style.display = 'none'; document.getElementById('pop').style.display = 'none'; document.getElementById('bub').style.display = 'none'
  nk.dbg.render()
  return document.getElementById('cv').toDataURL('image/png')
})
await p.setViewportSize({ width: 1200, height: 630 })
await p.setContent(`<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Klee+One:wght@600&display=swap" rel="stylesheet"><style>
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;font-family:"Klee One",sans-serif;color:#34332f;
background-color:#f6f2e6;background-image:linear-gradient(90deg,transparent 0 548px,#e2a0a0 548px 551px,transparent 551px),repeating-linear-gradient(180deg,transparent 0 41px,#c4d5e4 41px 42px)}
img{position:absolute;left:0;top:0;width:500px;height:630px;box-shadow:6px 0 18px rgba(0,0,0,.25)}
.t{position:absolute;left:590px;top:92px;transform:rotate(-2deg);font-size:96px;line-height:1.15;font-weight:600}
.s{position:absolute;left:596px;top:400px;font-size:36px;font-weight:600;color:#56554f;transform:rotate(-1deg)}
.s b{color:#bf3a2c;font-weight:600}
.d{position:absolute;left:596px;top:470px;font-size:28px;color:#56554f;transform:rotate(-1deg)}
</style></head><body><img src="${shot}"><div class="t">練り消し、<br>地球になる</div><div class="s">先生が振り向く前に<b>こすれ</b></div><div class="d">筆箱も机も先生も学校も飲みこむ</div></body></html>`)
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
await p.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
execFileSync('sips', ['-z', '630', '1200', ROOT + '/og.png'], { stdio: 'ignore' })   // 2倍で撮って 1200x630 に縮める
console.log('og.png')
