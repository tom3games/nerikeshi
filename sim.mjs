import './mute-auto.mjs'
// 遊び方ごとの分布（注意2回で終わる・時間制限なし）。node sim.mjs [回数=12]。400秒で打ち切り
// human: 人の速さ（1秒に約5回・気づくまで0.55〜0.85秒・4%で同じ側）/ fast / slow / ignore（先生を見ない）/ greedy（振り向く直前まで粘る）/ oneSide（片側だけ）/ idle（何もしない）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 6473, N = +(process.argv[2] || 12)
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }), p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__nkReady)
const BOTS = {
  human: { iv: 0.19, react: [0.55, 0.85], resume: [0.3, 0.6], err: 0.04 },
  fast: { iv: 0.13, react: [0.45, 0.7], resume: [0.25, 0.45], err: 0.03 },
  slow: { iv: 0.3, react: [0.7, 1.0], resume: [0.4, 0.8], err: 0.06 },
  ignore: { iv: 0.19, react: null, err: 0.04 },
  greedy: { iv: 0.15, greedy: true, resume: [0.2, 0.3], err: 0.02 },
  oneSide: { iv: 0.19, react: [0.55, 0.85], resume: [0.3, 0.6], err: 1 },
  idle: { iv: 999 },
}
const out = {}
for (const [name, cfg] of Object.entries(BOTS)) {
  const rows = []
  for (let s = 1; s <= N; s++) {
    rows.push(await p.evaluate(({ cfg, s }) => {
      nk.dbg.seed(s * 101 + 7); nk.start(); nk.dbg.pause(); const G = nk.G
      let rs = s * 7919 + 13; const Rb = () => (rs = rs * 16807 % 2147483647) / 2147483647, U = ([a, b]) => a + (b - a) * Rb()
      let next = 0, side = 0, stopAt = -1, resumeAt = 0, seenSt = '', seenT = 0, f = 0
      while (G.phase !== 'done' && f++ < 60 * 400) {
        nk.dbg.tick(1)
        if (G.phase !== 'play') continue
        const w = G.w, t = G.t
        if (w.st !== seenSt) { seenSt = w.st; seenT = t; if (w.st === 'tell') stopAt = cfg.greedy ? t + w.dur - 0.06 : cfg.react ? t + U(cfg.react) : -1; if ((w.st === 'back' || w.st === 'fake' || w.st === 'idle') && cfg.resume) resumeAt = t + U(cfg.resume) }
        const danger = (w.st === 'tell' || w.st === 'look' || w.st === 'caught') && stopAt >= 0 && t >= stopAt
        const resting = !danger && t < resumeAt && stopAt >= 0
        if (w.st === 'idle' && t >= resumeAt) stopAt = -1
        if (t >= next && !danger && !resting) { side = Rb() < cfg.err ? side : 1 - side; nk.tap(side); next = t + cfg.iv * (0.85 + 0.3 * Rb()) }
      }
      const sc = G.loop * 200 + G.P; return { P: +sc.toFixed(1), loop: G.loop, rank: G.loop ? 10 : nk.rankIdx(), strikes: G.strikes, ended: G.phase !== 'play', t: +G.t.toFixed(1) }
    }, { cfg, s }))
  }
  const Ps = rows.map(r => r.P).sort((a, b) => a - b)
  const Ts = rows.map(r => r.t).sort((a, b) => a - b)
  out[name] = { medianScore: Ps[Math.floor(N / 2)], min: Ps[0], max: Ps[N - 1], ranks: rows.map(r => r.rank).join(','), earth: rows.filter(r => r.P >= 89.4).length, loops: rows.filter(r => r.loop).length, ended: rows.filter(r => r.ended).length, medianSec: Ts[Math.floor(N / 2)] }
  console.log(name.padEnd(8), JSON.stringify(out[name]))
}
await b.close(); server.kill()
