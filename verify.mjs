import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 練り消し、地球になる の検証。node verify.mjs
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 6471
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|googletagmanager/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__nkReady, null, { timeout: 15000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *, .ovl:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.id === 'card') continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button,main:not([hidden]) a,.ovl:not([hidden]) button')) { if (!el.offsetParent) continue; const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  const ovl = document.querySelector('.ovl:not([hidden]) .in'); if (ovl && ovl.scrollHeight > ovl.clientHeight + 1) over.push('howScroll:' + ovl.scrollHeight + '/' + ovl.clientHeight)
  return { H, over: over.slice(0, 6) }
})
const variance = (p, sel) => p.evaluate(sel => {
  const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
}, sel)
// 始めて「着席」まで飛ばし、時間を止める（台本どおりに進めるため）
const begin = (p, seed = 5) => p.evaluate(sd => { nk.dbg.seed(sd); nk.start(); nk.dbg.pause(); nk.dbg.skipKiritsu() }, seed)
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'large']]

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない・読み込み画面が消える', async () => { await p.waitForTimeout(500); const l = await p.evaluate(() => getComputedStyle(document.getElementById('loading')).display); expect(p.errs.length === 0 && l === 'none', p.errs.join('|') + ' loading=' + l) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect, cvta: getComputedStyle(document.getElementById('cv')).touchAction }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none' && r.cvta === 'none', JSON.stringify(r)); return r
})
await t('OGP 一式と canonical・転送 script がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]'), !!document.querySelector('link[rel=canonical]'), !!document.getElementById('ghMove')))
  expect(r.every(Boolean), JSON.stringify(r))
})
await t('タイトルの絵が描けている（輝度の散らばり）', async () => { const v = await variance(p, '#tBall'); expect(v > 200, v); return v })

// ---- 本物の指で遊ぶ: 始める→起立礼着席→左右交互に押す ----
await t('本物のクリックで始めて、左右交互に押すと練り消しが育つ', async () => {
  await p.click('#bStart')
  await p.waitForFunction(() => nk.G.phase === 'play', null, { timeout: 5000 })
  await p.evaluate(() => { nk.G.noWatch = true })
  const L = await p.evaluate(() => nk.sideXY(0)), R = await p.evaluate(() => nk.sideXY(1))
  for (let i = 0; i < 16; i++) { const s = i % 2 ? R : L; await p.mouse.click(s.x, s.y); await p.waitForTimeout(120) }
  const st = await p.evaluate(() => nk.state())
  expect(st.strokes >= 15 && st.P > 3, JSON.stringify(st)); return { strokes: st.strokes, P: st.P }
})
await t('音を鳴らす操作の後でも実際には無音（Chromium）', async () => { const r = await p.evaluate(() => ({ ok: window.__muteOk(), calls: window.__soundCalls })); expect(r.ok && r.calls > 0, JSON.stringify(r)); return r })
await t('左右の入力の外（右上のボタン）を押しても こすらない', async () => {
  const before = await p.evaluate(() => nk.G.strokes); await p.click('#bMute2'); await p.click('#bMute2'); const after = await p.evaluate(() => nk.G.strokes)
  expect(before === after, before + '->' + after)
})
await t('キーボードの左右でもこすれる', async () => {
  const before = await p.evaluate(() => nk.G.strokes)
  const last = await p.evaluate(() => nk.G.lastSide)
  await p.keyboard.press(last === 0 ? 'ArrowRight' : 'ArrowLeft'); await p.keyboard.press(last === 0 ? 'ArrowLeft' : 'ArrowRight')
  const after = await p.evaluate(() => nk.G.strokes); expect(after === before + 2, before + '->' + after)
})

// ---- 台本で: 空振り・破れる・見つかる・フェイント・ギリギリ ----
await t('同じ側を3回続けて押すと空振り→ビリッ（注意+1・先生が振り向く）', async () => {
  await begin(p, 11)
  const r = await p.evaluate(() => {
    nk.tap(0); nk.dbg.tick(10); const P1 = nk.G.P
    const a = nk.tap(0); nk.dbg.tick(10); const P2 = nk.G.P
    const b = nk.tap(0); nk.dbg.tick(2)
    return { a, b, P1, P2, tears: nk.G.tears, strikes: nk.G.strikes, w: nk.G.w.st }
  })
  expect(r.a === 'miss' && r.b === 'tear' && r.P1 === r.P2 && r.tears === 1 && r.strikes === 1 && r.w === 'tell', JSON.stringify(r)); return r
})
await t('振り向く直前（首が動いた間）にこすると2倍（ギリギリ）', async () => {
  await begin(p, 12)
  const r = await p.evaluate(() => {
    const G = nk.G; G.noWatch = true
    nk.tap(0); nk.dbg.tick(12); nk.tap(1); nk.dbg.tick(12)
    const a0 = G.P; nk.tap(0); const a = G.P - a0; nk.dbg.tick(12)
    G.w.st = 'tell'; G.w.t = 0; G.w.dur = 5; G.w.fake = false
    const b0 = G.P; nk.tap(1); const b = G.P - b0
    return { a: +a.toFixed(4), b: +b.toFixed(4), ratio: +(b / a).toFixed(2), thrills: G.thrills }
  })
  expect(r.ratio > 1.9 && r.ratio < 2.1 && r.thrills === 1, JSON.stringify(r)); return r
})
await t('先生がこっちを向いている間にこすると見つかる（注意+1・重さが減る・1.4秒こすれない）', async () => {
  await begin(p, 13)
  const r = await p.evaluate(() => {
    const G = nk.G; G.noWatch = true
    for (let i = 0; i < 30; i++) { nk.tap(i % 2); nk.dbg.tick(10) }
    const P0 = G.P; G.w.st = 'look'; G.w.t = 0.3; G.w.dur = 5
    const res = nk.tap(G.lastSide ? 0 : 1); const P1 = G.P
    nk.dbg.tick(30); const locked = nk.tap(G.lastSide ? 0 : 1)
    return { res, strikes: G.strikes, drop: +(P0 - P1).toFixed(2), floor: G.stage * 10, P1: +P1.toFixed(2), locked, ev: G.ev.filter(e => e[1] === 'caught').length }
  })
  expect(r.res === 'caught' && r.strikes === 1 && r.drop > 0 && r.P1 >= r.floor && r.locked === false && r.ev === 1, JSON.stringify(r)); return r
})
await t('フェイント（チョーク折れた）の間は押しても見つからない', async () => {
  await begin(p, 14)
  const r = await p.evaluate(() => {
    const G = nk.G; G.noWatch = true; G.turns = 3
    G.w.st = 'tell'; G.w.t = 0; G.w.dur = 0.3; G.w.fake = true
    nk.dbg.tick(30)
    const st = G.w.st, res = nk.tap(0)
    return { st, res, strikes: G.strikes, bub: G.bub && G.bub.text }
  })
  expect(r.st === 'fake' && r.res === 'ok' && r.strikes === 0 && r.bub, JSON.stringify(r)); return r
})
// ---- 前の席の山田さん（告げ口）
const cBegin = (p, seed) => p.evaluate(sd => { nk.dbg.seed(sd); nk.start(); nk.dbg.pause(); nk.dbg.skipKiritsu(); const G = nk.G; G.noTeacher = true; for (let i = 0; i < 20; i++) { nk.tap(i % 2); nk.dbg.tick(10) } }, seed)
await t('山田さん: 振り向く前に必ず前ぶれ（0.5秒以上）・最初の1回は聞くだけ・序盤20秒は振り向かない', async () => {
  await cBegin(p, 31)
  const r = await p.evaluate(() => {
    const G = nk.G, seq = []; let prev = 'idle', tellDur = 0, firstT = -1
    for (let f = 0; f < 60 * 240; f++) {
      nk.dbg.tick(1); const c = G.c
      if (c.st !== prev) { if (c.st === 'tell') { tellDur = c.dur; if (firstT < 0) firstT = G.t } if (c.st === 'look' || c.st === 'ask') seq.push([prev, c.st, +tellDur.toFixed(2)]); prev = c.st }
    }
    return { n: seq.length, bad: seq.filter(s => s[0] !== 'tell' || s[2] < 0.48).length, first: seq[0] && seq[0][1], minTell: Math.min(...seq.map(s => s[2])), asks: seq.filter(s => s[1] === 'ask').length, firstT: +firstT.toFixed(1) }
  })
  expect(r.n >= 10 && r.bad === 0 && r.first === 'ask' && r.asks >= 2 && r.asks < r.n && r.firstT >= 20, JSON.stringify(r)); return r
})
await t('山田さん: 振り向いている間にこすると告げ口＝注意1回（先生も振り向く）', async () => {
  await cBegin(p, 32)
  const r = await p.evaluate(() => {
    const G = nk.G; G.noClass = false; G.c.st = 'look'; G.c.t = 0.3; G.c.dur = 5; G.c.tier = 't0'
    const res = nk.tap(G.lastSide ? 0 : 1)
    const o = { res, strikes: G.strikes, tattles: G.tattles, w: G.w.st, c: G.c.st, bub: G.bub && G.bub.who, lock: G.lock > 1 }
    nk.dbg.tick(90); o.later = G.bub && G.bub.who; o.phase = G.phase; return o
  })
  expect(r.res === 'tattle' && r.strikes === 1 && r.tattles === 1 && r.w === 'caught' && r.c === 'tattle' && r.bub === 'yamada' && r.lock && r.later === 'teacher' && r.phase === 'play', JSON.stringify(r)); return r
})
await t('山田さん: 前ぶれの間と「聞くだけ」の間はこすっても告げ口されない', async () => {
  await cBegin(p, 33)
  const r = await p.evaluate(() => {
    const G = nk.G
    G.c.st = 'tell'; G.c.t = 0; G.c.dur = 0.6; const a = nk.tap(G.lastSide ? 0 : 1)
    G.c.st = 'look'; G.c.t = 0.05; G.c.dur = 5; const b = nk.tap(G.lastSide ? 0 : 1)   // 振り向いた最初の0.15秒は猶予
    G.c.st = 'ask'; G.c.t = 0.5; G.c.dur = 1.6; nk.dbg.tick(1); const c = nk.tap(G.lastSide ? 0 : 1)
    return { a, b, c, strikes: G.strikes, tattles: G.tattles }
  })
  expect(r.a === 'ok' && r.b === 'ok' && r.c === 'ok' && r.strikes === 0 && r.tattles === 0, JSON.stringify(r)); return r
})
await t('山田さん: 練り消しに飲みこまれても中から告げ口する（町でも）', async () => {
  await cBegin(p, 34)
  const r = await p.evaluate(() => {
    const G = nk.G; nk.dbg.setP(62); nk.dbg.tick(200)
    const gone = G.items.yamada === 2; G.lock = 0; G.trans = null; G.c.st = 'idle'; G.c.next = 0; G.c.turns = 3; G.strokes = Math.max(G.strokes, 20)
    let f = 0; while (G.c.st !== 'tell' && f++ < 60 * 30) nk.dbg.tick(1)
    const kind = G.c.kind; G.c.ask = false; let g = 0; while (G.c.st !== 'look' && g++ < 120) nk.dbg.tick(1)
    nk.dbg.tick(12); const res = nk.tap(G.lastSide ? 0 : 1)
    return { gone, scene: G.sceneNow, kind, res, line: G.c.line, tattles: G.tattles }
  })
  expect(r.gone && r.scene === 'town' && r.kind === 'bulge' && r.res === 'tattle' && r.tattles === 1 && r.line, JSON.stringify(r)); return r
})
await t('山田さん: 告げ口2回で没収、鑑定書に告げ口の回数と山田さんの一言', async () => {
  await cBegin(p, 35)
  await p.evaluate(() => { const G = nk.G; for (let k = 0; k < 2; k++) { G.lock = 0; G.c.st = 'look'; G.c.t = 0.3; G.c.dur = 5; G.c.tier = 't0'; nk.tap(G.lastSide ? 0 : 1); nk.dbg.tick(120) } nk.dbg.tick(400) })
  await p.waitForFunction(() => nk.G.phase === 'done', null, { timeout: 5000 }); await p.waitForTimeout(900)
  const r = await p.evaluate(() => ({ reason: nk.result().reason, tattles: nk.result().tattles, dl: document.getElementById('cDl').textContent, ym: document.getElementById('cYm').textContent }))
  await p.screenshot({ path: ROOT + '/shots/v-end-tattle.png' })
  expect(r.reason === 'out' && r.tattles === 2 && /告げ口2回/.test(r.dl) && /山田さんの一言「2回言いました/.test(r.ym), JSON.stringify(r)); return r
})
await t('時間では終わらない: 何もしないで3分たっても授業は続く（注意0・重さほぼ0）', async () => {
  await begin(p, 16)
  const r = await p.evaluate(() => { nk.dbg.tick(60 * 180); return { phase: nk.G.phase, P: nk.G.P, strikes: nk.G.strikes, turns: nk.G.turns } })
  expect(r.phase === 'play' && r.P < 3 && r.strikes === 0 && r.turns > 10, JSON.stringify(r)); return r
})
await t('何もしないまま見つかって終わると一番下の判定（ただの消しカス）', async () => {
  await p.evaluate(() => nk.dbg.finish())
  await p.waitForFunction(() => nk.G.phase === 'done', null, { timeout: 5000 })
  const r = await p.evaluate(() => ({ rank: nk.result().rank, title: nk.result().title }))
  expect(r.rank === 0, JSON.stringify(r)); return r
})
await t('見つかる＋破る の合計2回で没収→鑑定書（重さ・取りこんだ物・鑑定額・自己ベスト）', async () => {
  await begin(p, 17)
  await p.evaluate(() => { const G = nk.G; G.noWatch = true; for (let i = 0; i < 120; i++) { nk.tap(i % 2); nk.dbg.tick(10) } nk.tap(G.lastSide); nk.dbg.tick(2); nk.tap(G.lastSide); nk.dbg.tick(60) })
  const mid = await p.evaluate(() => ({ strikes: nk.G.strikes, phase: nk.G.phase }))
  await p.evaluate(() => { const G = nk.G; G.lock = 0; G.w.st = 'look'; G.w.t = 0.3; G.w.dur = 5; nk.tap(G.lastSide ? 0 : 1); nk.dbg.tick(400) })
  await p.waitForFunction(() => nk.G.phase === 'done', null, { timeout: 5000 })
  await p.waitForTimeout(1300)
  const r = await p.evaluate(() => ({ rank: document.getElementById('cRank').textContent, dl: document.getElementById('cDl').textContent, ate: document.getElementById('cAte').textContent, price: document.getElementById('cPrice').textContent, r: nk.result(), best: localStorage.getItem('nk_best') }))
  await p.screenshot({ path: ROOT + '/shots/v-end.png' })
  expect(mid.strikes === 1 && mid.phase === 'play' && r.r.strikes === 2 && r.r.reason === 'out' && /g|トン|kg/.test(r.dl) && /新記録/.test(r.dl) && r.ate.length > 6 && r.price && r.best, JSON.stringify({ mid, r }).slice(0, 400)); return { rank: r.rank, P: r.r.P }
})
await t('鑑定書の練り消しが描けている', async () => { const v = await variance(p, '#certBall'); expect(v > 100, v); return v })
await t('画像で保存: 1080x1440 の画像が描けてダウンロードされる', async () => {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('#bSave')])
  const v = await variance(p, '#card'); expect(dl.suggestedFilename() === 'nerikeshi.png' && v > 300, dl.suggestedFilename() + ' ' + v); return v
})
await t('Xでポスト: 結果と公開URLが入る', async () => {
  const u = await p.evaluate(() => { let got = ''; const o = window.open; window.open = x => { got = x; return null }; document.getElementById('bPost').click(); window.open = o; return got })
  expect(/x\.com\/intent\/post/.test(u) && decodeURIComponent(u).includes('https://tom3games.com/play/nerikeshi/') && decodeURIComponent(u).includes(await p.evaluate(() => nk.result().title)), u)
})
await t('支援と横丁へ戻るが結果画面にある', async () => { const r = await p.evaluate(() => [!!document.getElementById('tmSupport'), !!document.getElementById('tmHome')]); expect(r.every(Boolean), r) })
await t('もう一回で最初から（重さ0・注意0）', async () => {
  await p.click('#bAgain'); await p.waitForTimeout(100)
  const r = await p.evaluate(() => ({ P: nk.G.P, strikes: nk.G.strikes, ate: nk.G.ate.length, phase: nk.G.phase, play: !document.getElementById('vPlay').hidden }))
  expect(r.P === 0 && r.strikes === 0 && r.ate === 0 && r.play, JSON.stringify(r)); return r
})
await t('全段階を通る: 机→教室→学校→町→日本→地球→宇宙、物を順に取りこむ・描けている', async () => {
  await begin(p, 18)
  const seen = []
  for (const P of [5, 15, 25, 36, 45, 55, 65, 75, 85, 95, 105]) {
    const r = await p.evaluate(P => { nk.G.noWatch = true; nk.dbg.setP(P); nk.dbg.step(120); return { sc: nk.G.sceneNow, ate: nk.G.ate.length, fly: nk.G.fly.length } }, P)
    const v = await variance(p, '#cv'); seen.push(r.sc + ':' + r.ate + ':' + v)
    if (v < 200) throw new Error('flat ' + P + ' ' + v)
  }
  const order = await p.evaluate(() => nk.G.ate.join(','))
  const expectOrder = (await p.evaluate(() => nk.D.ITEMS.filter(i => i.p <= nk.G.P).map(i => i.id).join(',')))
  expect(order === expectOrder && p.errs.length === 0, order + ' / ' + expectOrder + ' ' + p.errs.join('|')); return seen
})
await t('際限なく育つ: ビッグバンで机に戻り2時間目・3時間目（重さは宇宙N個と…）・見張りが速くなる', async () => {
  const r = await p.evaluate(() => {
    const G = nk.G, out = []
    for (let k = 0; k < 2; k++) { G.lock = 0; nk.dbg.setP(116); nk.dbg.step(200); out.push({ loop: G.loop, phase: G.phase, scene: G.sceneNow, P: +G.P.toFixed(1), items: Object.values(G.items).filter(v => v).length, hud: document.getElementById('hW').textContent }) }
    G.noWatch = true; for (let i = 0; i < 40; i++) { nk.tap(i % 2); nk.dbg.tick(8) }
    out.push({ P: +G.P.toFixed(2), hud: document.getElementById('hW').textContent })
    return out
  })
  expect(r[0].loop === 1 && r[1].loop === 2 && r[1].phase === 'play' && r[1].scene === 'room' && r[1].items === 0 && /宇宙2個/.test(r[2].hud) && r[2].P > 1, JSON.stringify(r)); return r
})
await t('自己ベストがタイトルに出る', async () => {
  const q = await (await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } })).newPage()
  await muteContext(q.context()); await q.goto(URL0); await q.waitForFunction(() => window.__nkReady)
  await q.evaluate(() => localStorage.setItem('nk_best', JSON.stringify({ s: 95, m: '60垓トン', r: 8, l: 0 }))); await q.reload(); await q.waitForFunction(() => window.__nkReady)
  const t = await q.evaluate(() => document.getElementById('tBest').textContent); await q.context().close()
  expect(/最高記録.*60垓トン/.test(t), t); return t
})
await t('遊び中の画面は重さと注意の印（2つ）と音のボタンだけ', async () => {
  await begin(p, 22)
  const r = await p.evaluate(() => ({ marks: document.querySelectorAll('#hX i').length, hudText: document.getElementById('hud').innerText.trim().split('\n').filter(Boolean), clock: !!document.getElementById('hClock') }))
  expect(r.marks === 2 && r.hudText.length === 1 && !r.clock, JSON.stringify(r)); return r
})
await t('本物のマウスでなぞる: 右半分から左へなぞると消しゴムは左へ、向きを変えるたびに1回こする', async () => {
  await begin(p, 23); await p.evaluate(() => { nk.G.noWatch = true; nk.dbg.pause(false) })
  const box = await p.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return { l: r.left, w: r.width, y: r.top + r.height * 0.75 } })
  const s0 = await p.evaluate(() => nk.G.strokes)
  await p.mouse.move(box.l + box.w * 0.75, box.y); await p.mouse.down(); await p.mouse.move(box.l + box.w * 0.15, box.y, { steps: 10 }); await p.waitForTimeout(250)
  const a = await p.evaluate(() => nk.state())
  await p.mouse.move(box.l + box.w * 0.85, box.y, { steps: 10 }); await p.waitForTimeout(250)
  const b = await p.evaluate(() => nk.state())
  await p.mouse.move(box.l + box.w * 0.2, box.y, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(100)
  const c = await p.evaluate(() => nk.state())
  expect(a.roll < -0.5 && a.eraserX < box.w / 2 && b.roll > 0.5 && b.eraserX > box.w / 2 && c.strokes - s0 === 3, JSON.stringify({ a: [a.roll, a.eraserX], b: [b.roll, b.eraserX], n: c.strokes - s0 })); return { left: a.eraserX, right: b.eraserX, strokes: c.strokes - s0 }
})
await t('タップ: 左半分を押すと消しゴムは左、右半分なら右', async () => {
  const r = []
  for (const s of [0, 1]) { const xy = await p.evaluate(s => nk.sideXY(s), s); await p.mouse.click(xy.x, xy.y); await p.waitForTimeout(250); r.push(await p.evaluate(() => nk.state().roll)) }
  expect(r[0] < -0.6 && r[1] > 0.6, JSON.stringify(r)); return r
})
await t('重さの表示が増え続ける（単位の切り替え）', async () => {
  const r = await p.evaluate(() => { const out = []; let prev = 0, mono = true; for (let P = 0; P <= 115; P += 0.5) { const g = nk.massG(P); if (g < prev) mono = false; prev = g } for (const P of [0, 10, 30, 45, 60, 75, 90, 100, 115]) out.push(nk.fmtMass(nk.massG(P))); return { mono, out } })
  expect(r.mono && /垓/.test(r.out[6]) && /g$/.test(r.out[0]), JSON.stringify(r)); return r.out.join(' ')
})
await t('遊び中に同時に出る文字は2つまで（吹き出し＋判定）', async () => {
  await begin(p, 19)
  let mx = 0
  for (let i = 0; i < 40; i++) {
    const n = await p.evaluate(i => { const G = nk.G; if (i === 10) { G.w.st = 'look'; G.w.t = 0.3; G.w.dur = 3 } nk.tap(i % 2); nk.dbg.step(20); return ['bub', 'pop'].filter(id => { const e = document.getElementById(id); return e.classList.contains('on') && e.textContent.trim() && getComputedStyle(e).opacity !== '0' }).length }, i)
    mx = Math.max(mx, n)
  }
  expect(mx <= 2, mx); return mx
})
await t('吹き出しが画面の中に収まる', async () => {
  const r = await p.evaluate(() => { const out = []; for (const who of ['teacher', 'tanaka', 'back', 'yamada', 'principal', 'heli', 'sat', 'ufo', 'cosmic', 'me']) { nk.G.bub = null; const e = document.getElementById('bub'); e.textContent = 'えー、黒板が無いので口で'; e.classList.add('on'); nk.G.bub = { who, text: 'x', until: nk.G.clk + 5 }; nk.dbg.step(1); const r = e.getBoundingClientRect(); if (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) out.push(who + ':' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.right)) } return out })
  expect(!r.length, r.join(' '))
})
await t('英語に切り替わる（タイトル・遊び方・結果）', async () => {
  const q = await open(browser)
  await q.click('#bLang')
  const a = await q.evaluate(() => ({ h: document.getElementById('tH').textContent, start: document.getElementById('bStartT').textContent, how: document.getElementById('howBody').textContent.slice(0, 40) }))
  await begin(q, 20)
  await q.evaluate(() => { nk.G.noWatch = true; for (let i = 0; i < 60; i++) { nk.tap(i % 2); nk.dbg.tick(10) } nk.dbg.finish() })
  await q.waitForFunction(() => nk.G.phase === 'done')
  const b = await q.evaluate(() => ({ rank: document.getElementById('cRank').textContent, h: document.getElementById('cH').textContent, mass: nk.result().mass, again: document.getElementById('bAgain').textContent, home: document.getElementById('tmHome').textContent }))
  await q.screenshot({ path: ROOT + '/shots/v-end-en.png' })
  const ja = /[ぁ-んァ-ヶ一-龠]/
  expect(/Earth/.test(a.h) && a.start === 'Start class' && !ja.test(a.how) && !ja.test(b.rank + b.h + b.mass + b.again + b.home), JSON.stringify({ a, b }))
  await q.context().close(); return b
})
await p.close()

// ---- スマホ縦3サイズ × 全画面で一画面に収まる・はみ出さない
for (const [w, h, name] of SIZES) {
  const q = await open(browser, { viewport: { width: w, height: h } })
  const views = {}
  await q.waitForTimeout(600); views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#bHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); const oh = await overflow(q); await q.click('#howClose')
  await begin(q, 21); await q.evaluate(() => { nk.G.noWatch = true; for (let i = 0; i < 20; i++) { nk.tap(i % 2); nk.dbg.step(8) } })
  views.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await q.evaluate(() => { nk.dbg.setP(93); nk.dbg.step(120) }); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-space.png` })
  await q.evaluate(() => nk.dbg.finish()); await q.waitForFunction(() => nk.G.phase === 'done'); await q.waitForTimeout(1300)
  views.end = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-end.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !oh.bad.length && !q.errs.length, JSON.stringify(o) + JSON.stringify(oh.bad) + q.errs.join('|')) })
  await t(`${name}: 結果の文字が鑑定書からはみ出さない`, async () => {
    const r = await q.evaluate(() => { const c = document.getElementById('cert').getBoundingClientRect(), bad = []; for (const el of document.querySelectorAll('#cert *')) { const r = el.getBoundingClientRect(); if (r.width && (r.bottom > c.bottom + 1 || r.right > c.right + 1 || r.left < c.left - 1)) bad.push(el.id || el.className || el.tagName) } return bad })
    expect(!r.length, r.join(','))
  })
  await q.context().close()
}
await browser.close()

// ---- WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始めて、指で左右交互にこすれる', async () => {
  await wp.tap('#bStart'); await wp.waitForFunction(() => nk.G.phase === 'play', null, { timeout: 5000 })
  await wp.evaluate(() => { nk.G.noWatch = true })
  const L = await wp.evaluate(() => nk.sideXY(0)), R = await wp.evaluate(() => nk.sideXY(1))
  for (let i = 0; i < 12; i++) { const s = i % 2 ? R : L; await wp.touchscreen.tap(s.x, s.y); await wp.waitForTimeout(110) }
  const st = await wp.evaluate(() => nk.state()); expect(st.strokes >= 11, JSON.stringify(st)); return st.strokes
})
await t('WebKit: 指でなぞる（左へなぞると消しゴムは左・往復でこする）', async () => {
  const r = await wp.evaluate(async () => {
    const cv = document.getElementById('cv'), R = cv.getBoundingClientRect(), y = R.top + R.height * 0.75, s0 = nk.G.strokes
    const ev = (t, x) => cv.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 3, pointerType: 'touch' }))
    ev('pointerdown', R.left + R.width * 0.7); for (let i = 1; i <= 10; i++) ev('pointermove', R.left + R.width * (0.7 - 0.06 * i))
    await new Promise(r => setTimeout(r, 300)); const left = nk.state()
    for (let i = 1; i <= 10; i++) ev('pointermove', R.left + R.width * (0.1 + 0.07 * i)); await new Promise(r => setTimeout(r, 300)); const right = nk.state(); ev('pointerup', R.left + R.width * 0.8)
    return { l: left.roll, r: right.roll, n: right.strokes - s0 }
  })
  expect(r.l < -0.5 && r.r > 0.5 && r.n === 2, JSON.stringify(r)); return r
})
await t('WebKit: 実際には無音（タップで音を鳴らしたあと）', async () => { const r = await wp.evaluate(() => ({ ok: window.__muteOk(), calls: window.__soundCalls })); expect(r.ok && r.calls > 0, JSON.stringify(r)); return r })
await t('WebKit: 裏に回ると BGM と環境音が止まり suspend。戻っても触るまで鳴らない（bfcache の pageshow でも）', async () => {
  const r = await wp.evaluate(async () => {
    const c = Snd.ctx; let sus = 0; const os = c.suspend.bind(c); c.suspend = () => { sus++; return os() }
    await new Promise(r => setTimeout(r, 900)); const before = Snd.playing().length
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'))
    const hid = { away: Snd.away, playing: Snd.playing().length, sus, gain: Snd.master.gain.value }
    const p0 = Snd.played.rub || 0; nk.tap(nk.G.lastSide ? 0 : 1); Snd.loop('test', 'snd/amb_clock.mp3', 0.2)   // 裏にいる間の音は鳴らさない
    await new Promise(r => setTimeout(r, 400)); const quiet = Snd.playing().length
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    await new Promise(r => setTimeout(r, 400)); const back = { away: Snd.away, playing: Snd.playing().length, gain: Snd.master.gain.value }
    Snd.loop('test', null)
    return { before, hid, quiet, back, p0 }
  })
  const L = await wp.evaluate(() => nk.sideXY(0)); await wp.touchscreen.tap(L.x, L.y); await wp.waitForTimeout(700)
  const after = await wp.evaluate(() => ({ away: Snd.away, playing: Snd.playing().length, wake: Snd.life.wake, mute: window.__muteOk() }))
  expect(r.before >= 2 && r.hid.away && r.hid.playing === 0 && r.hid.sus === 1 && r.hid.gain === 0 && r.quiet === 0 && r.back.away && r.back.playing === 0 && r.back.gain === 0 && !after.away && after.playing >= 2 && after.wake === 1 && after.mute, JSON.stringify({ r, after })); return { before: r.before, after: after.playing }
})
await t('WebKit: 横丁へ移る（pagehide）と止まり、戻るで戻っても鳴っていない', async () => {
  await wp.evaluate(() => addEventListener('pagehide', () => { try { sessionStorage.setItem('nkHide', JSON.stringify({ away: Snd.away, playing: Snd.playing().length, hide: Snd.life.hide })) } catch (e) {} }))
  await wp.goto(URL0 + 'privacy.html'); await wp.waitForTimeout(300)
  const hid = await wp.evaluate(() => sessionStorage.getItem('nkHide'))
  await wp.goBack(); await wp.waitForFunction(() => window.__nkReady, null, { timeout: 15000 }); await wp.waitForTimeout(800)
  const back = await wp.evaluate(() => ({ playing: Snd.playing().length, scene: nk.G.scene, ctx: !!Snd.ctx, away: Snd.away }))
  const h = JSON.parse(hid || '{}')
  expect(h.away && h.playing === 0 && back.playing === 0, JSON.stringify({ h, back })); return { h, back }
})
await t('WebKit: 結果まで通してエラーなし', async () => {
  await wp.evaluate(() => { nk.start(); nk.dbg.pause(); nk.dbg.skipKiritsu(); nk.dbg.finish() }); await wp.waitForFunction(() => nk.G.phase === 'done'); await wp.waitForTimeout(600)
  await wp.screenshot({ path: ROOT + '/shots/v-webkit-end.png' })
  expect(wp.errs.length === 0, wp.errs.join('|'))
})
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
