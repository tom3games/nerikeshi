import '../mute-auto.mjs'   // ブラウザでは音を出さない。音は記録して ffmpeg で後から重ねる
// X 投稿用の縦長プレイ動画（1080x1920・30fps・H.264＋AAC）。node promo/film.mjs   （PROBE=1 で下見: 出来事の時刻だけ出す）
// 上手い人の bot（1秒に約7回・気づくまで0.5秒）で通し、3回目の振り向きだけわざと見つかる。見せ場の区間だけ撮り、間は早送り
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { serve, open, Recorder, mix, encode, inspect, stills } from '../../_shared/promo-film.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const SLUG = 'nerikeshi', SEED = +(process.env.SEED || 21), PROBE = !!process.env.PROBE
const TMP = process.env.FRAMES || join(tmpdir(), `${SLUG}-frames-${Date.now()}`)
const OUT_DIR = join(homedir(), 'Desktop/バカゲー動画'); mkdirSync(OUT_DIR, { recursive: true })
// 撮る区間（遊び始めからの秒）。下見の結果から決めた
const CUTS = JSON.parse(process.env.CUTS || '[[1.5,7.5],[13,17],[29,33.5],[52,57],["end",0,3.6]]')

const srv = await serve(ROOT)
const { b, p, errs } = await open({ chromium, port: srv.port, path: '/', ready: '__nkReady' })
await p.evaluate(sd => {
  const F = window.__film
  nk.dbg.seed(sd)
  F.hookSnd(); F.on()
  nk.start()
  let rs = sd * 7919 + 13; const Rb = () => (rs = rs * 16807 % 2147483647) / 2147483647
  F.bot = { next: 0, side: 0, stopAt: -1, resumeAt: 0, seen: '', looks: 0, evN: 0 }
  F.botStep = () => {
    const S = F.bot, G = nk.G
    if (G.ev.length > S.evN) { for (const e of G.ev.slice(S.evN)) F.mark(e[1], e[0] + ' ' + e[2]); S.evN = G.ev.length }
    F.gain('bgm', G.w.st === 'look' || G.w.st === 'caught' ? 0.035 : G.phase === 'play' ? 0.22 : 0.0001)
    F.gain('chalk', G.sceneNow === 'room' && G.phase === 'play' && G.w.st === 'idle' ? 0.32 : 0.0001)
    if (G.phase !== 'play') return
    const w = G.w, t = G.t
    if (w.st !== S.seen) { S.seen = w.st; if (w.st === 'tell') S.stopAt = t + 0.45 + Rb() * 0.15; if (w.st === 'look') S.looks++; if (w.st === 'back' || w.st === 'fake' || w.st === 'idle') S.resumeAt = t + 0.25 }
    const slip = S.looks === 3 && w.st === 'look' && w.t > 0.3
    const danger = (w.st === 'tell' || w.st === 'look' || w.st === 'caught') && S.stopAt >= 0 && t >= S.stopAt && !slip
    if (t >= S.next && !danger && t >= S.resumeAt && G.lock <= 0) { S.side = 1 - S.side; const r = nk.sideXY(S.side); F.tapMark(S.side); nk.tap(S.side); S.next = t + 0.13 + Rb() * 0.04 }
  }
  // 指の印（撮影用。ゲームの画面には無い）
  const st = document.createElement('style'); st.textContent = '.__tap{position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(255,255,255,.5);border:3px solid rgba(40,40,40,.5);pointer-events:none;z-index:99999;animation:__tp .3s ease-out forwards}@keyframes __tp{from{transform:scale(.5);opacity:1}to{transform:scale(1.2);opacity:0}}'
  document.head.appendChild(st)
  F.tapMark = s => { const r = nk.sideXY(s); const d = document.createElement('div'); d.className = '__tap'; d.style.left = r.x + 'px'; d.style.top = (innerHeight - 64) + 'px'; document.body.appendChild(d); window.setTimeout(() => d.remove(), 320) }
}, SEED)

const tick = (F, a) => {
  F.botStep()
  const G = nk.G
  if (G.phase === 'done' && F.endF == null) { F.endF = F.f; F.endAll = (F.all || 0); F.mark('END', 0) }
  F.all = (F.all || 0) + 1
  if (a.mode === 'until') return G.phase === 'play' ? G.t >= a.t : G.phase !== 'kiritsu'
  if (a.mode === 'end') return G.phase === 'done'
  if (a.mode === 'endFor') return F.all - F.endAll >= a.n
  if (a.mode === 'probe') return G.phase === 'done' && F.all - F.endAll > 30 * 2
  return false
}
const rec = new Recorder(p, TMP)
if (PROBE) {
  await rec.run(tick, { ff: true, max: 30 * 140, arg: { mode: 'probe' } })
  console.log(JSON.stringify(await p.evaluate(() => ({ notes: window.__film.notes.map(n => n[2]), R: nk.result() }))))
  console.log('errors', errs)
  await b.close(); srv.close(); process.exit(0)
}
const segs = []
for (const c of CUTS) {
  if (c[0] === 'end') {
    await rec.run(tick, { ff: true, max: 30 * 140, arg: { mode: 'end' } })
    const t0 = rec.sec; await rec.run(tick, { max: 30 * 20, arg: { mode: 'endFor', n: Math.round(c[2] * 30) } }); segs.push(['end', t0, rec.sec])
  } else {
    await rec.run(tick, { ff: true, max: 30 * 140, arg: { mode: 'until', t: c[0] } })
    const t0 = rec.sec; await rec.run(tick, { max: 30 * 60, arg: { mode: 'until', t: c[1] } }); segs.push([c[0], t0, rec.sec])
  }
}
// 最後: 鑑定書の上に題名（タイトル画面と同じ書体）
await p.evaluate(() => {
  const c = document.createElement('div'); c.innerHTML = '練り消し、<br>地球になる'
  c.style.cssText = 'position:fixed;left:0;right:0;top:34%;z-index:99998;text-align:center;font:600 46px/1.15 "Klee One",sans-serif;color:#34332f;background:rgba(246,242,230,.94);padding:18px 0;transform:rotate(-3deg);pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.35)'
  document.body.appendChild(c)
})
await rec.run(tick, { max: 45, arg: { mode: 'x' } })
const log = await p.evaluate(() => ({ rec: window.__film.rec, gains: window.__film.gains, notes: window.__film.notes }))
await b.close(); srv.close()
const dur = rec.sec
const wav = join(TMP, 'mix.wav'), out = join(OUT_DIR, `${SLUG}-x-1080x1920.mp4`)
mix({ rec: log.rec, gains: log.gains, dur, root: ROOT, out: wav })
encode({ frames: TMP, wav, out })
const info = inspect(out)
const st = stills(out, [0.5, ...segs.map(s => (s[1] + s[2]) / 2), dur - 0.6], join(TMP, 'still'))
writeFileSync(join(ROOT, 'promo/film-log.json'), JSON.stringify({ seed: SEED, cuts: CUTS, segs, info, notes: log.notes, errs, frames: TMP }, null, 1))
console.log(JSON.stringify({ out, info, segs, errs, stills: st }, null, 1))
