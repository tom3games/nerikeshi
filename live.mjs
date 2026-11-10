import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
// nerikeshi __NS__ を置き換え、「遊びの通し」をゲームに合わせて書く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る（2026-11-02 live.mjs に名前が文字で入ったまま5本公開していた）
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = 'https://tom3games.github.io/nerikeshi/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  // 横丁へ移す転送 script は、横丁に載る前だと 404 へ飛ぶので確認の時だけ外す（配信中の中身そのものを確かめる）
  await ctx.route(u => u.href.startsWith(URL0) && !/\.(js|mp3|png|html)(\?|$)/.test(u.pathname), async route => { const r = await route.fetch(); route.fulfill({ response: r, body: (await r.text()).replace(/<script id="ghMove">[^<]*<\/script>/, '') }) })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__nkReady, null, { timeout: 15000 })
  await p.waitForTimeout(600)
  if (bt === webkit) await p.tap('#bStart'); else await p.click('#bStart')
  await p.waitForFunction(() => nk.G.phase === 'play', null, { timeout: 8000 })
  for (let i = 0; i < 14; i++) { const s = await p.evaluate(i => nk.sideXY(i % 2), i); if (bt === webkit) await p.touchscreen.tap(s.x, s.y); else await p.mouse.click(s.x, s.y); await p.waitForTimeout(150) }
  const st = await p.evaluate(() => nk.state()); if (st.strokes < 6) errs.push('strokes ' + st.strokes)
  await p.evaluate(() => { nk.dbg.pause(); nk.dbg.tick(60 * 80) }); await p.waitForFunction(() => nk.G.phase === 'done', null, { timeout: 8000 })
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await (async () => { const r = await fetch(URL0 + 'og.png'); return r.status + ' ' + r.headers.get('content-type') })()   // og:image は横丁の URL。横丁に載る前は github.io の物で確かめる
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/nerikeshi', 'https://github.com/tom3games/nerikeshi/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
