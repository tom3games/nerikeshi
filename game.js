// 練り消し、地球になる（nerikeshi）。左右交互タップで消しゴムをこすり、練り消しを地球まで育てる
// 仕様の正本: ~/Desktop/claudecode/ideas/nerikeshi.md
;(() => {
'use strict'
window.__jsUp = true
const D = NK_DATA
const $ = s => document.querySelector(s)
const on = (s, f) => $(s).addEventListener('click', f)
const isJa = () => (navigator.language || 'ja').toLowerCase().startsWith('ja')
let lang = 'ja'
try { lang = localStorage.getItem('nk_lang') || (isJa() ? 'ja' : 'en') } catch (e) { lang = isJa() ? 'ja' : 'en' }
const T = () => D.TXT[lang]

// ---- 乱数（種を固定できる） ----
let seedV = (Date.now() % 2147483646) + 1
const R = () => (seedV = seedV * 16807 % 2147483647) / 2147483647
const rr = (a, b) => a + (b - a) * R()
const pick = a => a[Math.floor(R() * a.length)]
const clamp = (v, a, b) => v < a ? a : v > b ? b : v
const lerp = (a, b, k) => a + (b - a) * k
const sm = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k) }

// ---- 音 ----
const N = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1))
Snd.def({
  rub: N(8, i => `snd/rub${i}.mp3`), pop: N(3, i => `snd/pop${i}.mp3`), absorb: N(4, i => `snd/absorb${i}.mp3`),
  tear: 'snd/tear.mp3', crush: 'snd/crush.mp3', thwack: ['snd/thwack1.mp3', 'snd/thwack2.mp3'], swish: ['snd/swish1.mp3', 'snd/swish2.mp3'],
  cough: 'snd/cough.mp3', giggle: 'snd/giggle.mp3', bell: 'snd/bell.mp3', chime: 'snd/chime.mp3', sat: 'snd/sat.mp3', ufo: 'snd/ufo.mp3',
  crash: 'snd/crash.mp3', drum: 'snd/drumroll.mp3', brk: ['snd/break1.mp3', 'snd/break2.mp3'], jgood: 'snd/jgood.mp3', jmeh: 'snd/jmeh.mp3',
  jstage: 'snd/jstage.mp3', click: 'snd/click.mp3', page: 'snd/page.mp3', snore: 'snd/snore.mp3',
})
const LOOPS = { bgmT: 'snd/bgm_title.mp3', bgm: 'snd/bgm_play.mp3', clock: 'snd/amb_clock.mp3', chalk: 'snd/chalk.mp3', school: 'snd/amb_school.mp3', town: 'snd/amb_town.mp3', space: 'snd/amb_space.mp3', heli: 'snd/heli.mp3' }
let muted = false
try { muted = localStorage.getItem('nk_mute') === '1' } catch (e) {}
Snd.setMute(muted)
const sfx = (n, o) => Snd.play(n, o)
function loopVol(slot, v, tc = 0.15) { const l = Snd.loops[slot]; if (l && l.g && Snd.ctx) { l.g.gain.cancelScheduledValues(Snd.ctx.currentTime); l.g.gain.setTargetAtTime(Math.max(0.0001, v), Snd.ctx.currentTime, tc) } }
const loopsOn = {}
function loop(slot, vol) { if (vol == null) { if (loopsOn[slot]) { Snd.loop(slot, null); loopsOn[slot] = 0 } return } if (!loopsOn[slot]) { Snd.loop(slot, LOOPS[slot], vol); loopsOn[slot] = 1 } else loopVol(slot, vol) }
function allLoopsOff() { for (const k in loopsOn) loop(k, null) }

// ---- 描画の土台（鉛筆の線。3コマで線がふるえる） ----
const cv = $('#cv')
let cx = cv.getContext('2d')
let W = 390, H = 844, DPR = 1, U = 1, LW = 1, KS = 1, BOIL = 0
const INK = '#3b3a36'
function resize() {
  const r = cv.getBoundingClientRect()
  W = Math.max(240, r.width || innerWidth); H = Math.max(320, r.height || innerHeight)
  DPR = Math.min(2, window.devicePixelRatio || 1)
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR)
  U = Math.min(W, H * 0.62) / 390; LW = U / KS
}
function hsh(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967295 }
const jt = (s, i) => hsh((s * 7919 + i * 104729 + BOIL * 15485863) | 0) * 2 - 1
function tracePts(p, seed, j, close) { cx.beginPath(); for (let i = 0; i < p.length; i++) { const x = p[i][0] + jt(seed, i * 2) * j, y = p[i][1] + jt(seed, i * 2 + 1) * j; if (i) cx.lineTo(x, y); else cx.moveTo(x, y) } if (close) cx.closePath() }
function sk(p, o = {}) {
  const j = (o.j == null ? 1 : o.j) * LW, seed = o.seed || 1, close = !o.open
  if (o.fill) { tracePts(p, seed + 3, j * 0.35, true); cx.fillStyle = o.fill; cx.fill() }
  if (o.line === false) return
  cx.strokeStyle = o.col || INK; cx.lineJoin = 'round'; cx.lineCap = 'round'
  const w = (o.w || 1.7) * LW
  cx.lineWidth = w; tracePts(p, seed, j, close); cx.stroke()
  const a = cx.globalAlpha; cx.globalAlpha = a * 0.4; cx.lineWidth = w * 0.7; tracePts(p, seed + 11, j * 1.4, close); cx.stroke(); cx.globalAlpha = a
}
const SEG = () => 22 / KS
function lineP(x1, y1, x2, y2) { const n = clamp(Math.round(Math.hypot(x2 - x1, y2 - y1) / SEG()), 1, 16), p = []; for (let i = 0; i <= n; i++) p.push([lerp(x1, x2, i / n), lerp(y1, y2, i / n)]); return p }
function polyP(pts, close = true) { let out = []; const m = close ? pts.length : pts.length - 1; for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const s = lineP(a[0], a[1], b[0], b[1]); s.pop(); out = out.concat(s) } if (!close) out.push(pts[pts.length - 1]); return out }
const rectP = (x, y, w, h) => polyP([[x, y], [x + w, y], [x + w, y + h], [x, y + h]])
function ellP(x, y, rx, ry, a0 = 0, a1 = Math.PI * 2) { const n = clamp(Math.round(Math.abs(a1 - a0) * Math.max(rx, ry) / (8 / KS)), 14, 72), p = []; for (let i = 0; i < n; i++) { const a = lerp(a0, a1, i / n); p.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]) } if (Math.abs(a1 - a0) < 6.28) p.push([x + Math.cos(a1) * rx, y + Math.sin(a1) * ry]); return p }
function grp(x, y, k, rot, fn) { cx.save(); cx.translate(x, y); if (rot) cx.rotate(rot); cx.scale(k, k); const pk = KS; KS *= k; LW = U / KS; try { fn() } finally { KS = pk; LW = U / KS; cx.restore() } }
function txt(s, x, y, size, o = {}) { cx.font = `${o.wt || 600} ${size}px "Klee One","Hiragino Maru Gothic ProN",sans-serif`; cx.textAlign = o.al || 'center'; cx.textBaseline = o.bl || 'middle'; cx.fillStyle = o.col || INK; cx.fillText(s, x, y) }
function withCtx(ctx2, w, h, fn) { const s = [cx, W, H, U, LW, KS]; cx = ctx2; W = w; H = h; U = Math.min(w, h * 0.62) / 390; KS = 1; LW = U; try { fn() } finally { [cx, W, H, U, LW, KS] = s } }

// ---- 物の絵（中心 0,0・幅 100 の箱で描く） ----
const SPECK = Array.from({ length: 70 }, (_, i) => ({ a: hsh(i * 3 + 1) * 6.283, d: Math.sqrt(hsh(i * 3 + 2)) * 0.92, s: 0.5 + hsh(i * 3 + 3) * 1.4, c: hsh(i * 7) > 0.55 ? '#4a4945' : '#d6d5cf' }))
const JP = {
  hok: [[18, -46], [28, -48], [38, -44], [45, -39], [37, -33], [28, -30], [22, -34], [15, -39]],
  hon: [[19, -27], [24, -20], [22, -10], [18, 0], [12, 8], [4, 12], [-6, 16], [-16, 18], [-26, 21], [-33, 21], [-30, 15], [-20, 11], [-10, 5], [0, 1], [8, -5], [12, -13], [14, -21]],
  shi: [[-22, 25], [-12, 23], [-8, 28], [-19, 31]],
  kyu: [[-39, 22], [-31, 23], [-30, 33], [-36, 39], [-43, 32]],
}
const ITEM = {
  lead() { sk(rectP(-46, -2, 92, 4), { fill: '#2b2b2b', w: 1, j: .3 }) },
  staple() { sk(polyP([[-30, 9], [-30, -6], [30, -6], [30, 9]], false), { open: true, col: '#7f868e', w: 4, j: .4 }) },
  pencil() {
    sk(rectP(-40, -6, 70, 12), { fill: '#3f7d52', j: .5 }); sk(lineP(-40, 0, 30, 0), { open: true, col: '#2f5f3e', w: 1, j: .3 })
    sk(polyP([[30, -6], [46, 0], [30, 6]]), { fill: '#e9cfa3', j: .4 }); sk(polyP([[40, -2.3], [46, 0], [40, 2.3]]), { fill: '#333', w: 1, j: .2 })
    sk(rectP(-47, -6, 7, 12), { fill: '#cfc8b4', j: .3 })
  },
  eraser() { sk(rectP(-42, -19, 84, 38), { fill: '#fbfbf8', j: .6 }); sk(rectP(-42, -19, 50, 38), { fill: '#d9c69c', j: .6 }); sk(lineP(-34, -6, 0, -6), { open: true, col: '#8a7444', w: 1.2 }); sk(lineP(-34, 4, -8, 4), { open: true, col: '#8a7444', w: 1.2 }) },
  tanakaEraser() { sk(rectP(-36, -16, 72, 32), { fill: '#f3b9c8', j: .6 }); sk(rectP(-36, -16, 40, 32), { fill: '#86b6d8', j: .6 }); sk(ellP(18, 0, 6, 7), { fill: '#d4473f', w: 1 }); sk(lineP(18, -7, 21, -11), { open: true, col: '#3f7d52', w: 1.5 }) },
  pencase() {
    sk(polyP([[-48, -16], [48, -16], [50, 16], [-50, 16]]), { fill: '#4d6c9c', j: .8 })
    sk(lineP(-46, -8, 44, -8), { open: true, col: '#2c3e5c', w: 2 }); for (let x = -42; x < 42; x += 6) sk(lineP(x, -10, x + 2, -6), { open: true, col: '#c9ccd2', w: 1, j: .2 })
    sk(rectP(30, -12, 10, 8), { fill: '#c9ccd2', w: 1 })
  },
  note() { sk(rectP(-42, -32, 84, 64), { fill: '#fbfaf3' }); for (let y = -22; y < 30; y += 9) sk(lineP(-40, y, 40, y), { open: true, col: '#9fbad2', w: 1, j: .3 }); sk(lineP(-28, -30, -28, 30), { open: true, col: '#d98c8c', w: 1, j: .3 }) },
  textbook() { sk(rectP(-34, -44, 68, 88), { fill: '#c9553e' }); sk(rectP(-24, -30, 48, 26), { fill: '#f6efe0', w: 1 }); txt(lang === 'ja' ? '理科' : 'SCI', 0, -17, 15) },
  desk() { sk(polyP([[-48, -16], [48, -16], [42, 4], [-42, 4]]), { fill: '#d3b083' }); for (const x of [-38, 38]) sk(lineP(x, 4, x * 1.05, 44), { open: true, w: 3, col: '#6b6b6b' }); sk(rectP(-36, 4, 72, 12), { fill: '#a98a5e', w: 1.2 }) },
  tanaka() { sk(ellP(0, 14, 44, 18), { fill: '#f3f1ea' }); sk(ellP(-4, -6, 22, 20), { fill: '#2b2a28' }); txt('z', 30, -26, 18, { col: '#56554f' }); txt('z', 40, -40, 13, { col: '#56554f' }) },
  yamada() { sk(ellP(0, 18, 34, 18), { fill: '#2c3340' }); sk(ellP(0, -6, 24, 24), { fill: '#4a3424' }); sk(ellP(16, -22, 9, 16), { fill: '#4a3424' }); sk(ellP(10, -14, 4, 4), { fill: '#c93f3f', w: 1 }) },
  kyotaku() { sk(rectP(-40, -22, 80, 52), { fill: '#a9784a' }); sk(rectP(-46, -30, 92, 9), { fill: '#c08d5c' }); sk(lineP(-30, 6, 30, 6), { open: true, col: '#7a5530', w: 1.2 }) },
  board() { sk(rectP(-50, -28, 100, 56), { fill: '#8a6a45' }); sk(rectP(-46, -24, 92, 48), { fill: '#2f4b3d' }); for (let i = 0; i < 4; i++) sk(lineP(-38, -14 + i * 9, -38 + 30 + i * 12, -14 + i * 9), { open: true, col: '#e6eee4', w: 1.4 }) },
  teacher() { drawTeacher(0, -50, 100, 'look') },
  bar() { sk(lineP(-30, 40, -30, -20), { open: true, w: 3 }); sk(lineP(30, 40, 30, -20), { open: true, w: 3 }); sk(lineP(-36, -20, 36, -20), { open: true, w: 3, col: '#8a8f96' }) },
  gym() { sk(rectP(-45, -6, 90, 34), { fill: '#e2d9c8' }); sk(ellP(0, -6, 45, 20, Math.PI, Math.PI * 2), { fill: '#9a6b52' }); sk(rectP(-10, 10, 20, 18), { fill: '#7a6a58', w: 1.2 }) },
  pool() { sk(rectP(-46, -26, 92, 52), { fill: '#f1efe8' }); sk(rectP(-40, -20, 80, 40), { fill: '#7fbcd9' }); for (let y = -10; y < 20; y += 10) sk(lineP(-38, y, 38, y), { open: true, col: '#f6f6f2', w: 1.2, j: .4 }) },
  school() {
    sk(rectP(-50, -20, 100, 48), { fill: '#efe6d2' }); sk(rectP(-9, -36, 18, 16), { fill: '#efe6d2' }); sk(ellP(0, -28, 5, 5), { fill: '#fbfbf8', w: 1 })
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) { if (c === 3 || c === 4) continue; sk(rectP(-44 + c * 11.5, -14 + r * 14, 7, 8), { fill: '#a9c7d8', w: 1, j: .3 }) }
    sk(rectP(-6, 14, 12, 14), { fill: '#7a6a58', w: 1 })
  },
  konbini() { sk(rectP(-40, -18, 80, 46), { fill: '#fbfbf8' }); sk(rectP(-42, -28, 84, 12), { fill: '#e6b83c' }); sk(rectP(-12, 6, 24, 22), { fill: '#a9c7d8', w: 1 }); sk(rectP(-34, -6, 16, 14), { fill: '#a9c7d8', w: 1 }); sk(rectP(18, -6, 16, 14), { fill: '#a9c7d8', w: 1 }) },
  station() {
    sk(rectP(-50, 10, 100, 12), { fill: '#bdb5a5' }); sk(lineP(-50, 26, 50, 26), { open: true, w: 1.5 })
    sk(polyP([[-46, -16], [26, -16], [34, -6], [34, 10], [-46, 10]]), { fill: '#e7e1d0' }); sk(rectP(-46, 0, 80, 4), { fill: '#3a7f6a', w: .8, j: .2 })
    for (let x = -40; x < 24; x += 13) sk(rectP(x, -11, 8, 7), { fill: '#a9c7d8', w: .8 })
  },
  shotengai() { sk(ellP(0, -2, 48, 26, Math.PI, Math.PI * 2), { open: true, w: 3, col: '#8a6a45' }); for (let i = 0; i < 4; i++) sk(rectP(-46 + i * 23, -2, 21, 26), { fill: ['#e7c9a0', '#f1e3c4', '#d7b48c', '#efd9b6'][i], w: 1.2 }); sk(rectP(-20, -26, 40, 9), { fill: '#bf3a2c', w: 1 }) },
  tower() { sk(polyP([[-22, 50], [-3, -46], [3, -46], [22, 50]]), { fill: '#d9603f', j: .6 }); for (let y = -20; y < 50; y += 16) { const w = 4 + (y + 46) * 0.2; sk(lineP(-w, y, w, y), { open: true, col: '#fbfbf8', w: 2 }) } sk(lineP(0, -46, 0, -58), { open: true, w: 2 }) },
  fuji() { sk(polyP([[-50, 30], [-12, -30], [12, -30], [50, 30]]), { fill: '#5b7ea8' }); sk(polyP([[-12, -30], [12, -30], [22, -14], [10, -18], [0, -10], [-10, -18], [-22, -14]]), { fill: '#fbfbf8', w: 1.2 }) },
  shinkansen() { sk(polyP([[-50, -8], [24, -8], [48, 4], [48, 8], [-50, 8]]), { fill: '#f8f8f4' }); sk(lineP(-50, 3, 46, 3), { open: true, col: '#2d5aa6', w: 2.4 }); for (let x = -44; x < 20; x += 9) sk(rectP(x, -5, 5, 4), { fill: '#a9c7d8', w: .6, j: .1 }) },
  islands() { for (const k in JP) sk(polyP(JP[k]), { fill: '#a3c78e' }) },
  clouds() { for (const [x, y, r] of [[-26, 0, 16], [-8, -8, 20], [14, -2, 18], [30, 6, 12]]) sk(ellP(x, y, r, r * 0.7), { fill: '#fbfbf8', w: 1.2 }) },
  continents() { for (const [x, y, rx, ry] of [[-30, -16, 14, 11], [-20, -24, 10, 8], [-24, 22, 8, 13], [16, -6, 16, 12], [30, 8, 10, 14], [22, -22, 9, 6]]) sk(ellP(x, y, rx, ry), { fill: '#7fae6a', w: 1.4, j: 1.6 }) },
  earth() { sk(ellP(0, 0, 44, 44), { fill: '#4f82bd' }); grp(0, 0, .8, 0, () => ITEM.continents()) },
  moon() { sk(ellP(0, 0, 40, 40), { fill: '#d6d3c7' }); for (const [x, y, r] of [[-12, -10, 8], [14, 6, 10], [-6, 18, 5], [18, -18, 4]]) sk(ellP(x, y, r, r), { fill: '#bcb8aa', w: 1 }) },
  saturn() { sk(ellP(0, 0, 26, 26), { fill: '#d9b878' }); sk(ellP(0, 0, 48, 12, -0.15, Math.PI + 0.15), { open: true, w: 3, col: '#a88a54' }); sk(ellP(0, 0, 48, 12, Math.PI + 0.15, Math.PI * 2 - 0.15), { open: true, w: 3, col: '#a88a54' }) },
  sun() { for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; sk(lineP(Math.cos(a) * 34, Math.sin(a) * 34, Math.cos(a) * 48, Math.sin(a) * 48), { open: true, col: '#d9822b', w: 3 }) } sk(ellP(0, 0, 30, 30), { fill: '#f2b13a', col: '#b8691f' }) },
  galaxy() { for (let arm = 0; arm < 2; arm++) { const p = []; for (let i = 0; i < 26; i++) { const a = arm * Math.PI + i * 0.32, r = 4 + i * 1.8; p.push([Math.cos(a) * r, Math.sin(a) * r * 0.5]) } sk(p, { open: true, col: '#d8d4f2', w: 3 }) } sk(ellP(0, 0, 7, 4), { fill: '#fbf6dc', w: 1, col: '#d8d4f2' }) },
}
function item(id, x, y, s, rot = 0) { grp(x, y, s / 100, rot, ITEM[id]) }

// ---- 先生（後ろ・振り向きかけ・正面・怒り・フェイント） ----
function drawTeacher(x, y, h, st, pal) {
  const P = pal || { hair: '#2b2a28', skin: '#efcfae', jk: '#5d6d78', tie: '#a7473a' }
  grp(x, y, h / 100, 0, () => {
    const front = st === 'look' || st === 'back' || st === 'caught' || st === 'front'
    sk(rectP(-19, 62, 17, 38), { fill: '#3b4048' }); sk(rectP(2, 62, 17, 38), { fill: '#3b4048' })
    sk(polyP([[-21, 23], [21, 23], [24, 66], [-24, 66]]), { fill: P.jk })
    if (front) {
      sk(polyP([[-7, 24], [7, 24], [0, 44]]), { fill: '#f6f4ee', w: 1.2 }); sk(polyP([[-2.5, 28], [2.5, 28], [3.5, 52], [0, 56], [-3.5, 52]]), { fill: P.tie, w: 1 })
      if (st === 'caught') { sk(polyP([[16, 30], [30, 14], [38, -6]], false), { open: true, w: 5, col: P.jk }); sk(ellP(38, -8, 4, 4), { fill: P.skin, w: 1 }) }
      else { sk(lineP(-19, 30, -24, 70), { open: true, w: 5, col: P.jk }); sk(lineP(19, 30, 24, 70), { open: true, w: 5, col: P.jk }); sk(rectP(-10, 58, 20, 14), { fill: '#c9553e', w: 1 }) }
      sk(ellP(0, 12, 11, 12.5), { fill: P.skin })
      sk(ellP(0, 6, 11.5, 8, Math.PI, Math.PI * 2), { fill: P.hair, w: 1.2 })
      sk(ellP(-4.5, 12, 3.6, 3), { w: 1.1 }); sk(ellP(4.5, 12, 3.6, 3), { w: 1.1 }); sk(lineP(-1, 12, 1, 12), { open: true, w: 1 })
      cx.fillStyle = INK; cx.beginPath(); cx.arc(-4.5, 12.4, 1.2, 0, 7); cx.arc(4.5, 12.4, 1.2, 0, 7); cx.fill()
      if (st === 'caught') { sk(lineP(-8, 6, -2, 8), { open: true, w: 1.6 }); sk(lineP(8, 6, 2, 8), { open: true, w: 1.6 }); sk(ellP(0, 19.5, 3, 2.4), { fill: '#7a3b30', w: 1 }); for (const [a, b] of [[14, -2], [18, 2]]) sk(lineP(a, b, a + 4, b - 4), { open: true, col: '#bf3a2c', w: 1.6 }) }
      else sk(lineP(-3, 19.5, 3, 19.5), { open: true, w: 1.2 })
    } else {
      const turn = st === 'tell' || st === 'fake'
      if (st === 'idle' || st === 'write') { sk(polyP([[17, 30], [28, 14], [30, -6]], false), { open: true, w: 5, col: P.jk }); sk(ellP(30, -8, 3.6, 3.6), { fill: P.skin, w: 1 }); sk(lineP(30, -10, 33, -16), { open: true, col: '#f6f6f2', w: 2.2 }) }
      else { sk(lineP(-19, 30, -22, 66), { open: true, w: 5, col: P.jk }); sk(lineP(19, 30, 20, 60), { open: true, w: 5, col: P.jk }) }
      if (st === 'fake') { sk(ellP(14, 50, 3.6, 3.6), { fill: P.skin, w: 1 }); sk(lineP(10, 46, 13, 44), { open: true, col: '#f6f6f2', w: 2 }); sk(lineP(16, 45, 19, 43), { open: true, col: '#f6f6f2', w: 2 }) }
      sk(ellP(0, 12, 11, 12.5), { fill: turn ? P.skin : P.hair })
      if (turn) {
        sk(polyP([[-11, 12], [-10, 2], [-4, -1], [6, -1], [11, 5], [8, 8], [2, 6], [-6, 12], [-10, 20]]), { fill: P.hair, w: 1.2 })
        const down = st === 'fake'
        sk(ellP(6, 12, 3.6, 3), { w: 1.1 }); cx.fillStyle = INK; cx.beginPath(); cx.arc(down ? 6.5 : 4.6, down ? 13.4 : 12, 1.3, 0, 7); cx.fill()
        sk(ellP(-9.5, 13, 2.2, 3.2), { fill: P.skin, w: 1 })
        if (!down) for (let i = 0; i < 3; i++) sk(lineP(-16 - i * 2, 2 + i * 5, -21 - i * 2, 0 + i * 5), { open: true, w: 1.2, col: '#56554f' })
      } else { sk(ellP(-11, 14, 2.4, 3.4), { fill: P.skin, w: 1 }); sk(ellP(11, 14, 2.4, 3.4), { fill: P.skin, w: 1 }) }
    }
  })
}

// ---- 状態 ----
const G = window.__nkG = { scene: 'title', phase: 'title', clk: 0, paused: false }
function fresh() {
  Object.assign(G, {
    phase: 'kiritsu', kt: 0, t: 0, P: 0, Pv: 0, Pmax: 0, stage: 0, sceneNow: 'room', trans: null,
    combo: 0, maxCombo: 0, lastSide: -1, same: 0, lastValidT: -9, strokes: 0, misses: 0, tears: 0, thrills: 0, strikes: 0, turns: 0,
    lock: 0, items: {}, ate: [], rim: [], fly: [], parts: [], wob: 0, squash: 0, roll: 0, rollV: 0, shake: 0, erase: 0, ink: 0, flash: [0, 0],
    w: { type: 'teacher', st: 'idle', t: 0, dur: 0, next: 4.5, fake: false }, chalkShot: null, lastPopT: -9, lastThrillPop: -9,
    bub: null, ev: [], et: 0, endReason: '', bigbang: false, loop: 0, outQueued: false, flashBB: 0, gift: R() < 0.55 ? rr(16, 42) : -1, sleepT: rr(9, 22), drum: false, tutDone: false, tutWatch: false,
    best: null, isBest: false, heads: makeHeads(), noWatch: false, forceTell: false, result: null,
  })
  for (const it of D.ITEMS) G.items[it.id] = 0
}
function makeHeads() {
  const hair = ['#2b2a28', '#3a2f25', '#4a3a2a', '#262626', '#5a4330']
  const hs = []
  for (const [fx, fy, fr] of [[0.14, 0.408, 0.046], [0.38, 0.404, 0.044], [0.62, 0.41, 0.046], [0.86, 0.405, 0.044]]) hs.push({ fx: fx + rr(-0.02, 0.02), fy, fr: fr * rr(0.85, 1.12), hair: pick(hair), tail: R() < 0.35, shirt: R() < 0.5 ? '#2c3340' : '#f3f1ea', ph: rr(0, 6) })
  for (const [fx, fy, fr, id] of [[0.17, 0.472, 0.07], [0.5, 0.478, 0.074, 'yamada']]) hs.push({ fx, fy, fr, hair: id ? '#4a3424' : pick(hair), tail: !!id, shirt: id ? '#2c3340' : '#f3f1ea', ph: rr(0, 6), id })
  return hs
}
const gone = id => G.items[id] >= 1
const log = (k, v) => G.ev.push([+G.t.toFixed(2), k, v])

// ---- 場面ごとの練り消しの位置と大きさ ----
const SC_RANGE = { room: [0, 50], school: [50, 60], town: [60, 70], japan: [70, 80], earth: [80, 90], space: [90, D.BIGBANG] }
function ballGeo(scene, P) {
  const [a, b] = SC_RANGE[scene], q = clamp((P - a) / (b - a), 0, 1)
  if (scene === 'room') {
    const r = lerp(3.5 * U, 0.64 * W, Math.pow(q, 1.6))
    const k1 = sm(q / 0.7), k2 = sm((q - 0.7) / 0.3)
    let x = lerp(0.24 * W, 0.42 * W, k1), y = lerp(0.875 * H, 0.83 * H, k1)
    x = lerp(x, 0.5 * W, k2); y = lerp(y, 0.8 * H, k2)
    if (gone('desk')) x += G.rollV * 0.04 * W
    return { x, y, r }
  }
  const roll = G.rollV * 0.045 * W
  if (scene === 'school') return { x: 0.5 * W + roll, y: lerp(0.76, 0.72, q) * H, r: lerp(0.1, 0.44, Math.pow(q, 1.2)) * W }
  if (scene === 'town') return { x: 0.46 * W + roll, y: 0.72 * H, r: lerp(0.08, 0.42, Math.pow(q, 1.2)) * W }
  if (scene === 'japan') { const m = mapPt(8, -1); return { x: m[0] + roll * 0.5, y: m[1], r: lerp(0.02, 0.44, Math.pow(q, 2)) * W } }
  if (scene === 'earth') { const E = earthGeo(), s = sm(q); return { x: lerp(E.x + E.R * 0.22, E.x, s) + roll * 0.3, y: lerp(E.y - E.R * 0.22, E.y, s), r: lerp(0.06, 1.0, Math.pow(q, 1.8)) * E.R } }
  return { x: 0.5 * W + roll, y: 0.78 * H, r: lerp(0.14, 0.42, Math.pow(q, 0.9)) * W }
}
const mapS = () => 0.98 * W / 100
const mapPt = (lx, ly) => [0.5 * W + lx * mapS(), 0.52 * H + ly * mapS()]
const earthGeo = () => ({ x: 0.5 * W, y: 0.6 * H, R: 0.37 * W })
// 場面の物の置き場 [fx, fy, 幅(W比), 回転]
const POS = {
  lead: [0.6, 0.905, 0.09, 0.2], staple: [0.8, 0.865, 0.06, -0.1], pencil: [0.64, 0.655, 0.32, -0.25], tanakaEraser: [0.92, 0.575, 0.12, 0.1],
  pencase: [0.25, 0.63, 0.36, 0.05], textbook: [0.84, 0.69, 0.2, 0.15], note: [0.5, 0.78, 0.7, 0], desk: [0.5, 0.8, 1, 0], tanaka: [0.9, 0.51, 0.3, 0],
  yamada: [0.5, 0.465, 0.15, 0], kyotaku: [0.72, 0.385, 0.22, 0], board: [0.5, 0.2, 0.88, 0], teacher: [0.4, 0.27, 0.3, 0],
  bar: [0.77, 0.6, 0.2, 0], gym: [0.16, 0.37, 0.28, 0], pool: [0.85, 0.44, 0.26, 0], school: [0.5, 0.25, 0.82, 0],
  konbini: [0.2, 0.5, 0.2, 0], station: [0.5, 0.31, 0.7, 0], shotengai: [0.79, 0.56, 0.3, 0], tower: [0.85, 0.2, 0.16, 0],
  fuji: [0.54, 0.555, 0.1, 0], shinkansen: [0.42, 0.6, 0.28, -0.42], islands: [0.5, 0.52, 0.98, 0],
  clouds: [0.38, 0.52, 0.34, 0], continents: [0.5, 0.6, 0.62, 0], earth: [0.5, 0.6, 0.74, 0],
  moon: [0.24, 0.6, 0.12, 0], saturn: [0.8, 0.6, 0.24, 0], sun: [0.16, 0.42, 0.24, 0], galaxy: [0.82, 0.4, 0.3, 0],
}
const itemPos = id => { const p = POS[id]; return [p[0] * W, p[1] * H, p[2] * W, p[3]] }

// ---- 見張り役 ----
function wType() { const t = D.STAGES[G.stage].watcher; if (t === 'teacher' && gone('teacher')) return null; return t }
function setW(st, dur) { G.w.st = st; G.w.t = 0; G.w.dur = dur }
const lvl = () => G.stage + G.loop * 10
const tellDur = () => G.turns === 0 ? 1.2 : Math.max(0.42, 0.92 - lvl() * 0.032) * rr(0.92, 1.08)
const interval = () => Math.max(1.6, rr(2.7, 5.4) - lvl() * 0.1)
function startTell() {
  const w = G.w
  w.fake = G.turns >= 2 && R() < 0.24
  setW('tell', tellDur()); G.turns++; log('tell', w.type + (w.fake ? ':fake' : ''))
  if (w.type === 'teacher' || w.type === 'cosmic') { loopVol('chalk', 0.0001, 0.05); if (R() < 0.5) sfx('cough', { vol: 0.55, rate: w.type === 'cosmic' ? 0.72 : 1 }) }
  else if (w.type === 'principal') sfx('chime', { vol: 0.8 })
  else if (w.type === 'sat') sfx('sat', { vol: 0.6 })
  else if (w.type === 'ufo') sfx('ufo', { vol: 0.6 })
  if (!G.tutWatch) { G.tutWatch = true; popT(T().tutWatch, 'tut') }
}
function wUpdate(dt) {
  const w = G.w, type = wType()
  if (type !== w.type) { w.type = type; setW('idle', 0); w.next = G.t + 2.4; loopVol('bgm', 0.22) }
  if (!type) return
  w.t += dt
  if (w.st === 'idle') {
    if (!G.noWatch && (G.lock <= 0 || G.forceTell) && G.t >= w.next && (G.turns > 0 || G.forceTell || (G.t > 6.5 && G.strokes >= 12) || G.t > 11)) { G.forceTell = false; startTell() }
  } else if (w.st === 'tell') {
    if (w.t >= w.dur) {
      if (w.fake) { setW('fake', 1.25); say(type, pick(T().w[type].fake)); log('fake', type) }
      else { setW('look', rr(1.3, 2.3)); say(type, pick(T().w[type].look)); sfx('swish', { vol: 0.5 }); loopVol('bgm', 0.035, 0.08); log('look', type) }
    }
  } else if (w.st === 'look') { if (w.t >= w.dur) { setW('back', 0.35); loopVol('bgm', 0.22, 0.3) } }
  else if (w.st === 'caught') { if (w.t >= w.dur) { setW('back', 0.35); loopVol('bgm', 0.22, 0.3) } }
  else if (w.t >= w.dur) { setW('idle', 0); w.next = G.t + interval(); if (type === 'teacher' || type === 'cosmic') loopVol('chalk', 0.32, 0.2) }
}
const watching = () => G.w.type && (G.w.st === 'look' && G.w.t > 0.15)

// ---- 入力 ----
function tap(side, drag) {
  if (G.phase !== 'play') return false
  G.flash[side] = 1
  if (G.lock > 0) return false
  if (watching()) { caught(); return 'caught' }
  if (side === G.lastSide && drag) return 'same'
  if (side === G.lastSide) {
    G.same++; G.combo = 0; G.misses++
    sfx('rub', { vol: 0.25, rate: 0.8, dest: 'muf' })
    if (G.same >= 2) { tear(); return 'tear' }
    return 'miss'
  }
  G.same = 0
  const dt = G.t - G.lastValidT
  const tempo = dt <= 0.14 ? 1.4 : dt <= 0.22 ? 1.22 : dt <= 0.4 ? 1 : 0.72
  G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo)
  const thrill = G.w.st === 'tell' ? 2 : 1
  if (thrill > 1) { G.thrills++; if (G.t - G.lastThrillPop > 0.6) { G.lastThrillPop = G.t; popT(T().thrill, 'sm') } }
  const gain = 0.23 * tempo * (1 + Math.min(G.combo, 40) / 100) * thrill
  G.lastSide = side; G.lastValidT = G.t; G.strokes++
  if (!drag) G.roll = side ? 1 : -1
  addP(gain)
  if (!gone('note')) G.erase = Math.min(1, G.erase + 0.0065)
  sfx('rub', { vol: 0.55 + Math.min(0.3, G.combo * 0.01), rate: lerp(0.9, 1.2, G.stage / 9) })
  spawnCrumbs(1 + Math.round((tempo - 0.7) * 2.2) + (thrill > 1 ? 2 : 0))
  if (!G.tutDone && G.strokes >= 8) G.tutDone = true
  return 'ok'
}
function caught() {
  const w = G.w
  setW('caught', 1.45); G.strikes++; G.combo = 0; G.lock = 1.45; G.shake = 1
  const floor = G.stage * 10
  G.P = Math.max(floor, G.P - 3)
  say(w.type, pick(T().w[w.type].caught)); popT(T().caught, '')
  sfx('thwack', { vol: 0.9 }); sfx('giggle', { vol: 0.45, delay: 0.25 })
  log('caught', w.type)
  if (w.type === 'teacher' || w.type === 'cosmic') G.chalkShot = { t: 0 }
  strikeOut()
}
function strikeOut() { if (G.strikes >= D.STRIKES && !G.outQueued) { G.outQueued = true; G.endReason = 'out'; G.lock = 9; setTimeout0(1.4, () => endSeq('out')) } }
function tear() {
  G.tears++; G.same = 0; G.strikes++; G.lock = 0.8; sfx('tear', { vol: 0.9 }); popT(T().tear, 'big'); G.shake = 0.5; log('tear', G.tears)
  strikeOut()
  if (G.w.type && G.w.st === 'idle') { G.w.next = G.t; G.forceTell = true }
}
// 仮想時計で動くタイマー（dbg.pause に従う）
const timers = []
function setTimeout0(sec, f) { timers.push({ at: G.clk + sec, f }) }

// ---- 育つ・取りこむ ----
function addP(g) {
  G.P += g; G.Pmax = Math.max(G.Pmax, G.P)
  const s = Math.min(9, Math.floor(G.P / 10))
  if (s > G.stage) {
    const from = D.STAGES[G.stage].scene; G.stage = s; const to = D.STAGES[s].scene
    log('stage', s)
    if (to !== from) { G.trans = { from, t: 0 }; popT(T().stageName[s], 'big ink'); sfx('jstage', { vol: 0.6 }); sceneSound(to); const fl = G.fly; G.fly = []; for (const f of fl) landed(f); G.parts = [] }
  }
  if (!G.drum && G.P >= 86.5) { G.drum = true; sfx('drum', { vol: 0.6 }) }
  if (G.P >= D.BIGBANG && G.phase === 'play') bigBang()
}
let lastFlyT = -9
function absorbTick() {
  const sc = D.STAGES[G.stage].scene
  for (const it of D.ITEMS) {
    if (G.items[it.id] !== 0 || G.P < it.p) continue
    if (it.scene !== sc) { G.items[it.id] = 2; G.ate.push(it.id); continue }
    if (G.clk - lastFlyT < 0.14) return
    lastFlyT = G.clk; G.items[it.id] = 1
    const [x, y, s, rot] = itemPos(it.id)
    G.fly.push({ id: it.id, x, y, s, rot, t: 0, dur: it.id === 'teacher' || it.id === 'earth' || it.id === 'islands' ? 0.9 : 0.6 })
  }
}
const BIG = { desk: 1, board: 1, teacher: 1, school: 1, station: 1, islands: 1, earth: 1, continents: 1, sun: 1, galaxy: 1, gym: 1, tower: 1 }
function landed(f) {
  G.items[f.id] = 2; G.ate.push(f.id); log('ate', f.id)
  G.rim.push({ id: f.id, a: rr(-Math.PI * 0.92, -Math.PI * 0.08) })
  G.wob = Math.min(1.4, G.wob + (BIG[f.id] ? 1 : 0.5)); G.squash = 0.12
  sfx('absorb', { vol: BIG[f.id] ? 1 : 0.7, rate: BIG[f.id] ? 0.8 : 1.05 })
  if (BIG[f.id]) { sfx('brk', { vol: 0.55 }); G.shake = Math.max(G.shake, 0.6) }
  const L = T().itemLine[f.id]
  if (L) { if (L[0] === 'big') { popT(L[1], 'big'); sfx('crash', { vol: 0.8 }); Snd.duck(0.3, 2) } else say(L[0], L[1]) }
  if (f.id === 'tanaka' || f.id === 'yamada' || f.id === 'teacher' || f.id === 'desk') sfx('giggle', { vol: 0.35, delay: 0.3 })
}
function spawnCrumbs(n) {
  const sc = G.sceneNow
  for (let i = 0; i < n && G.parts.length < 160; i++) {
    let x, y
    if (sc === 'room' && !gone('desk')) { const e = eraserPos(); x = e.x + rr(-0.11, 0.11) * W; y = e.y + rr(0.02, 0.06) * W }
    else { const b = ballGeo(sc, G.Pv); const a = rr(0.15, 0.85) * Math.PI; x = b.x + Math.cos(a) * b.r * rr(1.05, 1.5) * (R() < 0.5 ? -1 : 1); y = b.y + Math.sin(a) * b.r * rr(0.6, 1.1) }
    G.parts.push({ x, y, vx: rr(-80, 80) * U, vy: rr(-120, -30) * U, t: 0, s: rr(1.4, 3.2) * U, c: CRUMB[sc] || '#8b8a84' })
  }
}
const CRUMB = { room: '#8b8a84', school: '#f2ecda', town: '#c96f4a', japan: '#8fbf7a', earth: '#7fa9d6', space: '#e8e6ff' }
const eraserPos = () => ({ x: 0.5 * W + G.rollV * 0.16 * W, y: 0.765 * H })

// ---- 吹き出しと判定の文字 ----
const bubEl = $('#bub'), popEl = $('#pop')
function whoPos(who) {
  const b = ballGeo(G.sceneNow, G.Pv)
  if (who === 'teacher') return gone('teacher') ? [b.x, b.y - b.r] : [teacherX() + 0.04 * W, 0.12 * H]
  if (who === 'tanaka') return gone('tanaka') ? [b.x, b.y - b.r] : [0.84 * W, 0.44 * H]
  if (who === 'back') return [0.5 * W, 0.9 * H]
  if (who === 'yamada') return gone('yamada') ? [b.x, b.y - b.r] : [0.5 * W, 0.42 * H]
  if (who === 'principal') return [0.26 * W, 0.45 * H]
  if (who === 'heli') return [0.66 * W, 0.15 * H]
  if (who === 'sat') return [0.5 * W, 0.15 * H]
  if (who === 'ufo') return [0.72 * W, 0.24 * H]
  if (who === 'cosmic') return [0.5 * W, 0.12 * H]
  return [b.x, Math.max(0.2 * H, b.y - b.r)]
}
function say(who, text) {
  const cur = G.bub
  if (cur && cur.pri && G.clk < cur.until && who !== cur.who) return
  const dur = Math.max(1.4, 0.9 + 0.09 * text.length)
  G.bub = { who, text, until: G.clk + dur, pri: G.w.st === 'caught' }
  bubEl.textContent = text; bubEl.classList.add('on'); placeBub()
}
function placeBub() {
  if (!G.bub) return
  const [x, y] = whoPos(G.bub.who), bw = bubEl.offsetWidth, bh = bubEl.offsetHeight
  const right = x > W * 0.6
  bubEl.classList.toggle('r', right)
  const left = clamp(right ? x - bw + 16 : x - 16, 8, W - bw - 8), top = clamp(y - bh - 6, 70, H - bh - 8)
  bubEl.style.left = left + 'px'; bubEl.style.top = top + 'px'
}
let popTimer = 0
function popT(text, cls) {
  G.lastPopT = G.t
  popEl.className = ''; void popEl.offsetWidth; popEl.textContent = text
  popEl.className = 'on ' + (cls || '')
  popEl.style.fontSize = /sm/.test(cls || '') ? '22px' : ''
  if (/tut/.test(cls || '')) { popEl.style.fontSize = '24px'; popEl.style.color = 'var(--ink)' } else popEl.style.color = ''
  clearTimeout(popTimer); popTimer = setTimeout(() => { popEl.className = '' }, 950)
}

// ---- 場面の音 ----
function sceneSound(sc) {
  if (sc === 'room') { loop('clock', 0.3); loop('chalk', 0.32) }
  else { loop('clock', null); loop('chalk', null) }
  loop('school', sc === 'school' ? 0.16 : null)
  loop('town', sc === 'town' ? 0.3 : null)
  loop('space', sc === 'japan' || sc === 'earth' || sc === 'space' ? 0.22 : null)
  if (sc === 'space') loop('chalk', 0.2)
  loop('heli', sc === 'town' ? 0.0001 : null)
}

// ---- 進行 ----
function startGame() {
  fresh(); G.scene = 'play'; G.sceneNow = 'room'
  show('vPlay'); resize(); lastT = performance.now(); acc = 0
  Snd.init(); loop('bgmT', null); loop('bgm', 0.22); sceneSound('room'); loopVol('chalk', 0.0001)
  sfx('click', { vol: 0.5 })
  window.TM && TM.start()
  log('start', 0)
}
function bigBang() {
  G.loop++; G.bigbang = true; log('bigbang', G.loop)
  popT(T().bigbang, 'big'); sfx('crash', { vol: 1 }); G.shake = 1.4; G.flashBB = 1
  const from = G.sceneNow
  G.P = 0; G.Pv = 0; G.stage = 0; G.drum = false; G.erase = 0; G.ink = 0; G.fly = []; G.parts = []; G.heads = makeHeads()
  for (const it of D.ITEMS) G.items[it.id] = 0
  G.trans = { from, t: 0 }; sceneSound('room'); setW('idle', 0); G.w.type = 'teacher'; G.w.next = G.t + 2.5
  setTimeout0(1.1, () => popT(T().nextPeriod.replace('{n}', G.loop + 1), 'big ink'))
}
function endSeq(reason) {
  if (G.phase !== 'play') return
  G.phase = 'endSeq'; G.et = 0; G.endReason = reason; G.lock = 9; log('end', reason)
  loop('heli', null); loopVol('chalk', 0.0001)
  sfx('crush', { vol: 0.8 }); sfx('bell', { vol: 0.7, delay: 0.6 }); say(G.w.type || 'teacher', T().confiscLine); popT(T().confisc, 'big')
}
function update(dt) {
  G.clk += dt
  BOIL = Math.floor(G.clk * 7) % 3
  for (let i = timers.length - 1; i >= 0; i--) if (G.clk >= timers[i].at) { const f = timers[i].f; timers.splice(i, 1); f() }
  if (G.scene !== 'play') return
  if (G.phase === 'kiritsu') {
    const k0 = G.kt; G.kt += dt
    for (let i = 0; i < 3; i++) if (k0 < i * 0.45 && G.kt >= i * 0.45) { popT(T().kiritsu[i], 'big ink'); if (i === 2) sfx('page', { vol: 0.5 }) }
    if (G.kt >= 1.4) { G.phase = 'play'; loopVol('chalk', 0.32); popT(T().tutTap, 'tut') }
  } else if (G.phase === 'play') {
    G.t += dt; G.lock = Math.max(0, G.lock - dt)
    wUpdate(dt); absorbTick()
    if (G.w.st === 'idle' && (G.w.type === 'teacher')) G.ink = Math.min(1, G.ink + dt * 0.03)
    if (G.gift > 0 && G.t >= G.gift && G.w.st === 'idle' && G.sceneNow === 'room') { G.gift = -1; say('back', T().backGift); addP(2); spawnCrumbs(14); log('gift', 1) }
    if (G.sleepT > 0 && G.t >= G.sleepT && !gone('tanaka') && !G.bub) { G.sleepT = G.t + rr(14, 24); say('tanaka', pick(T().tanakaSleep)); sfx('snore', { vol: 0.35 }) }
  } else if (G.phase === 'endSeq') {
    G.et += dt
    if (G.et >= 2.5) { G.phase = 'done'; showResult() }
  }
  // 見た目
  G.Pv += (G.P - G.Pv) * Math.min(1, dt * 7)
  G.rollV += (G.roll - G.rollV) * Math.min(1, dt * 22)
  G.flashBB = Math.max(0, (G.flashBB || 0) - dt * 0.9); G.wob *= Math.pow(0.04, dt); G.squash *= Math.pow(0.02, dt); G.shake *= Math.pow(0.02, dt)
  G.flash[0] *= Math.pow(0.005, dt); G.flash[1] *= Math.pow(0.005, dt)
  if (G.trans) { G.trans.t += dt; if (G.trans.t > 0.95) G.trans = null }
  G.sceneNow = D.STAGES[G.stage].scene
  // heli の音量（近づく）
  if (G.sceneNow === 'town' && G.phase === 'play') loopVol('heli', G.w.st === 'tell' ? 0.25 + G.w.t * 0.3 : (G.w.st === 'look' || G.w.st === 'caught') ? 0.5 : 0.03, 0.2)
  // 飛んでいく物
  for (let i = G.fly.length - 1; i >= 0; i--) { const f = G.fly[i]; f.t += dt; if (f.t >= f.dur) { G.fly.splice(i, 1); landed(f) } }
  // 消しカス
  const b = ballGeo(G.sceneNow, G.Pv)
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i]; p.t += dt
    if (p.t < 0.16) { p.vy += 500 * U * dt; p.x += p.vx * dt; p.y += p.vy * dt; continue }
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1, sp = (300 + p.t * 900) * U
    p.x += dx / d * sp * dt; p.y += dy / d * sp * dt
    if (d < Math.max(4 * U, b.r * 0.85) || p.t > 1.6) { G.parts.splice(i, 1); G.wob = Math.min(1.4, G.wob + 0.03); if (G.clk - (G.popT || 0) > 0.09) { G.popT = G.clk; sfx('pop', { vol: 0.22, rate: rr(0.9, 1.3) }) } }
  }
  if (G.chalkShot) { G.chalkShot.t += dt; if (G.chalkShot.t > 0.32) G.chalkShot = null }
  if (G.bub && G.clk > G.bub.until) { G.bub = null; bubEl.classList.remove('on') }
}

// ---- 場面の描画 ----
function teacherX() { return (0.27 + 0.18 * G.ink) * W }
function drawRoom() {
  const deskTop = 0.535 * H
  cx.fillStyle = '#ebe4d2'; cx.fillRect(0, 0, W, H)
  for (let i = 0; i < 5; i++) sk(lineP(0, H * (0.33 + i * 0.006), W, H * (0.33 + i * 0.006)), { open: true, col: 'rgba(120,100,70,.12)', w: 1, j: .3 })
  // 黒板
  if (!gone('board') && G.items.board === 0) {
    const bx = 0.06 * W, by = 0.095 * H, bw = 0.88 * W, bh = 0.205 * H
    sk(rectP(bx - 6 * U, by - 6 * U, bw + 12 * U, bh + 12 * U), { fill: '#8a6a45' }); sk(rectP(bx, by, bw, bh), { fill: '#2f4b3d', col: '#1e3328' })
    txt(T().board, bx + 14 * U, by + 20 * U, 17 * U, { al: 'left', col: 'rgba(240,244,236,.88)' })
    const rows = 4, ink = G.ink
    for (let r = 0; r < rows; r++) { const k = clamp(ink * rows - r, 0, 1); if (k <= 0) break; const y = by + (44 + r * 24) * U, x0 = bx + 22 * U, x1 = x0 + (bw - 60 * U) * k; const p = []; for (let x = x0; x <= x1; x += 9 * U) p.push([x, y + ((x / (9 * U)) % 2 ? -4 : 3) * U]); if (p.length > 1) sk(p, { open: true, col: 'rgba(236,242,232,.78)', w: 1.5, j: .5, seed: r + 40 }) }
    sk(rectP(bx + bw * 0.62, by + bh - 4 * U, 30 * U, 5 * U), { fill: '#f3efe2', w: 1 })
  }
  // 先生
  if (G.items.teacher === 0) { const st = teacherState(); drawTeacher(teacherX(), 0.115 * H, 0.27 * H, st) }
  if (G.items.kyotaku === 0) { const [x, y, s] = itemPos('kyotaku'); item('kyotaku', x, y, s) }
  // 前の席の頭
  for (const h of G.heads) {
    if (h.id && G.items[h.id] !== 0) continue
    const x = h.fx * W, y = h.fy * H + Math.sin(G.clk * 1.3 + h.ph) * 0.8 * U, r = h.fr * W
    sk(ellP(x, y + r * 1.25, r * 1.55, r * 0.85, Math.PI, Math.PI * 2), { fill: h.shirt })
    sk(ellP(x - r * 0.95, y + r * 0.15, r * 0.18, r * 0.26), { fill: '#efcfae', w: 1 }); sk(ellP(x + r * 0.95, y + r * 0.15, r * 0.18, r * 0.26), { fill: '#efcfae', w: 1 })
    sk(ellP(x, y, r, r * 1.05), { fill: h.hair, seed: Math.round(h.ph * 10) })
    sk(polyP([[x - r * 0.3, y - r * 0.95], [x - r * 0.1, y - r * 1.25], [x + r * 0.05, y - r * 0.98]], false), { open: true, w: 1.4, col: h.hair })
    if (h.tail) { sk(ellP(x + r * 0.05, y + r * 0.95, r * 0.32, r * 0.55), { fill: h.hair }); if (h.id) sk(ellP(x, y + r * 0.55, r * 0.14, r * 0.12), { fill: '#c93f3f', w: 1 }) }
  }
  // 田中くん（となりで寝ている）
  if (G.items.tanaka === 0) {
    sk(polyP([[0.76 * W, 0.535 * H], [1.05 * W, 0.535 * H], [1.05 * W, 0.62 * H], [0.74 * W, 0.62 * H]]), { fill: '#cdaa7c' })
    const [x, y, s] = itemPos('tanaka'); item('tanaka', x, y + Math.sin(G.clk * 1.1) * 1.5 * U, s)
    if (G.items.tanakaEraser === 0) { const [ex, ey, es, er] = itemPos('tanakaEraser'); item('tanakaEraser', ex, ey, es, er) }
  }
  // 自分の机
  if (G.items.desk === 0) {
    sk(polyP([[-0.02 * W, deskTop], [0.8 * W, deskTop], [0.8 * W, H * 1.02], [-0.02 * W, H * 1.02]]), { fill: '#d3b083' })
    for (let i = 0; i < 6; i++) sk(lineP(0, deskTop + (0.05 + i * 0.075) * H, 0.79 * W, deskTop + (0.06 + i * 0.075) * H), { open: true, col: 'rgba(120,85,45,.25)', w: 1, j: 1.5, seed: 70 + i })
    if (G.items.note === 0) drawNote()
    for (const id of ['pencase', 'pencil', 'textbook', 'staple', 'lead']) if (G.items[id] === 0) { const [x, y, s, r] = itemPos(id); item(id, x, y, s, r) }
  } else {
    cx.fillStyle = '#c4a77c'; cx.fillRect(0, deskTop + 0.03 * H, W, H)
    for (let i = 0; i < 7; i++) { const x = (i + 0.5) / 7 * W; sk(lineP(x, deskTop + 0.03 * H, lerp(x, 0.5 * W, -0.6), H), { open: true, col: 'rgba(90,60,30,.25)', w: 1, j: 1, seed: 90 + i }) }
  }
}
function drawNote() {
  const x0 = 0.07 * W, y0 = 0.565 * H, x1 = 0.79 * W
  sk(polyP([[x0, y0], [x1, y0 - 2 * U], [x1 + 4 * U, H * 1.03], [x0 - 2 * U, H * 1.03]]), { fill: '#fbfaf3' })
  for (let y = y0 + 0.035 * H; y < H; y += 0.032 * H) sk(lineP(x0 + 2 * U, y, x1, y), { open: true, col: '#b8cde0', w: 1, j: .3, seed: Math.round(y) })
  sk(lineP(x0 + 0.08 * W, y0, x0 + 0.08 * W, H), { open: true, col: '#d98c8c', w: 1.2, j: .3 })
  // 自分で書いたノート（こするほど消える）
  const a = 1 - G.erase
  if (a > 0.02) { cx.globalAlpha = a; for (let r = 0; r < 9; r++) { const y = y0 + (0.06 + r * 0.032) * H; const len = (0.34 + hsh(r + 5) * 0.32) * W; const p = []; for (let x = x0 + 0.11 * W; x < x0 + 0.11 * W + len; x += 6 * U) p.push([x, y - (hsh(r * 31 + Math.round(x)) * 7) * U]); sk(p, { open: true, col: '#5f5e58', w: 1.1, j: .3, seed: r + 300 }) } cx.globalAlpha = 1 }
  if (G.strokes > 0) { cx.globalAlpha = Math.min(0.22, G.strokes * 0.003); cx.fillStyle = '#9e9d97'; cx.beginPath(); cx.ellipse(0.5 * W, 0.78 * H, 0.26 * W, 0.045 * W, 0, 0, 7); cx.fill(); cx.globalAlpha = 1 }
  if (G.tears > 0) { const p = []; for (let i = 0; i <= 10; i++) p.push([x1 - (i % 2 ? 10 : 2) * U - G.tears * 3 * U, y0 + 0.05 * H + i * 0.03 * H]); sk(p, { open: true, w: 1.6, seed: 500 + G.tears }) }
}
function teacherState() {
  const w = G.w
  if (G.phase === 'kiritsu') return 'front'
  if (G.phase === 'endSeq' || G.phase === 'done') return 'caught'
  if (w.type !== 'teacher' && w.type !== 'cosmic') return 'write'
  return w.st === 'idle' ? 'write' : w.st
}
function drawSchool() {
  const g = cx.createLinearGradient(0, 0, 0, 0.32 * H); g.addColorStop(0, '#c7dfee'); g.addColorStop(1, '#eef2ee'); cx.fillStyle = g; cx.fillRect(0, 0, W, 0.34 * H)
  sk(polyP([[0, 0.3 * H], [0.2 * W, 0.26 * H], [0.45 * W, 0.29 * H], [0.7 * W, 0.25 * H], [W, 0.29 * H], [W, 0.34 * H], [0, 0.34 * H]]), { fill: '#b9cfa8', w: 1.2 })
  cx.fillStyle = '#dcc7a0'; cx.fillRect(0, 0.33 * H, W, H)
  sk(ellP(0.5 * W, 0.74 * H, 0.44 * W, 0.15 * H), { col: '#f7f2e4', w: 2.5, j: .8 })
  for (const [x, y] of [[0.06, 0.3], [0.94, 0.31], [0.3, 0.33]]) { sk(lineP(x * W, y * H, x * W, (y + 0.05) * H), { open: true, w: 2.5, col: '#6b4f33' }); sk(ellP(x * W, (y - 0.015) * H, 0.05 * W, 0.04 * W), { fill: '#7fa86a', w: 1.2 }) }
  for (const id of ['school', 'gym', 'pool', 'bar']) if (G.items[id] === 0) { const [x, y, s] = itemPos(id); item(id, x, y, s) }
  // 朝礼台とスピーカー
  sk(lineP(0.08 * W, 0.4 * H, 0.08 * W, 0.6 * H), { open: true, w: 2.5, col: '#7f868e' })
  sk(polyP([[0.08 * W, 0.41 * H], [0.15 * W, 0.395 * H], [0.15 * W, 0.435 * H]]), { fill: '#c9ccd2', w: 1.4 })
  const w = G.w
  if (w.st === 'tell' || w.st === 'look' || w.st === 'caught' || w.st === 'fake') for (let i = 0; i < 3; i++) sk(ellP(0.16 * W, 0.415 * H, (8 + i * 7 + (G.clk * 30 % 7)) * U, (10 + i * 8) * U, -0.8, 0.8), { open: true, w: 1.3 })
  sk(rectP(0.19 * W, 0.53 * H, 0.15 * W, 0.04 * H), { fill: '#bfa27a' }); for (const x of [0.2, 0.33]) sk(lineP(x * W, 0.57 * H, x * W, 0.6 * H), { open: true, w: 2 })
  const up = w.st !== 'idle' && w.st !== 'back'
  drawPrincipal(up ? 0.265 * W : 0.38 * W, up ? 0.445 * H : 0.505 * H, 0.1 * H, w.st)
}
function drawPrincipal(x, y, h, st) {
  grp(x, y, h / 100, 0, () => {
    const front = st === 'look' || st === 'caught' || st === 'fake' || st === 'tell'
    sk(polyP([[-20, 30], [20, 30], [24, 100], [-24, 100]]), { fill: '#3b3a3f' })
    sk(ellP(0, 14, 14, 15), { fill: '#efcfae' }); sk(ellP(0, 20, 15, 9, 0.2, Math.PI - 0.2), { open: true, w: 2.5, col: '#d8d8d8' })
    if (front) { sk(ellP(-5, 13, 3.6, 3), { w: 1 }); sk(ellP(5, 13, 3.6, 3), { w: 1 }); cx.fillStyle = INK; cx.beginPath(); cx.arc(-5, 13.4, 1.3, 0, 7); cx.arc(5, 13.4, 1.3, 0, 7); cx.fill(); sk(lineP(-6, 23, 6, 23), { open: true, w: 3, col: '#e8e8e8' }) }
    if (st === 'look' || st === 'tell') { sk(lineP(16, 40, 10, 22), { open: true, w: 5, col: '#3b3a3f' }); sk(rectP(6, 14, 6, 10), { fill: '#2b2b2b', w: 1 }) }
    if (st === 'caught') { sk(lineP(18, 36, 40, 20), { open: true, w: 5, col: '#3b3a3f' }); sk(lineP(40, 20, 50, 16), { open: true, w: 2.4 }) }
  })
}
const HOUSES = Array.from({ length: 26 }, (_, i) => ({ x: hsh(i * 5 + 1), y: hsh(i * 5 + 2), c: ['#e7c9a0', '#d7dfe5', '#f1e3c4', '#c9d6c0', '#e9d2d2'][i % 5], r: ['#9a5b48', '#5b6b85', '#6b7f5a'][i % 3], s: 0.7 + hsh(i * 5 + 3) * 0.5 }))
function drawTown() {
  cx.fillStyle = '#cfe0ea'; cx.fillRect(0, 0, W, 0.12 * H)
  cx.fillStyle = '#e4dccb'; cx.fillRect(0, 0.12 * H, W, H)
  for (const y of [0.37, 0.8]) { cx.fillStyle = '#a9a69e'; cx.fillRect(0, y * H, W, 0.035 * H); sk(lineP(0, (y + 0.0175) * H, W, (y + 0.0175) * H), { open: true, col: '#f3efe2', w: 1.2, j: .4 }) }
  cx.fillStyle = '#a9a69e'; cx.fillRect(0.3 * W, 0.12 * H, 0.04 * W, H); cx.fillRect(0.68 * W, 0.12 * H, 0.04 * W, H)
  for (const h of HOUSES) { const x = h.x * W, y = (0.14 + h.y * 0.84) * H; if (Math.abs(x - 0.32 * W) < 0.05 * W || Math.abs(x - 0.7 * W) < 0.05 * W) continue; const s = 0.07 * W * h.s; sk(rectP(x - s / 2, y - s * 0.45, s, s * 0.7), { fill: h.c, w: 1.1, seed: Math.round(h.x * 99) }); sk(polyP([[x - s * 0.6, y - s * 0.45], [x, y - s * 0.9], [x + s * 0.6, y - s * 0.45]]), { fill: h.r, w: 1.1 }) }
  sk(lineP(0, 0.34 * H, W, 0.34 * H), { open: true, w: 2 }); sk(lineP(0, 0.355 * H, W, 0.355 * H), { open: true, w: 2 })
  for (const id of ['station', 'konbini', 'shotengai', 'tower']) if (G.items[id] === 0) { const [x, y, s] = itemPos(id); item(id, x, y, s) }
}
function drawJapan() {
  cx.fillStyle = '#bcd6e6'; cx.fillRect(0, 0, W, H)
  for (let i = 0; i < 14; i++) { const x = hsh(i + 900) * W, y = hsh(i + 950) * H; sk(ellP(x, y, 9 * U, 4 * U, Math.PI * 1.1, Math.PI * 1.9), { open: true, col: 'rgba(80,120,160,.5)', w: 1 }) }
  if (G.items.islands === 0) { const [x, y, s] = itemPos('islands'); item('islands', x, y, s) }
  for (const id of ['shinkansen', 'fuji']) if (G.items[id] === 0) { const [x, y, s, r] = itemPos(id); item(id, x, y, s, r) }
}
const STARS = Array.from({ length: 70 }, (_, i) => [hsh(i + 2000), hsh(i + 3000), 0.6 + hsh(i + 4000) * 1.4])
function drawStars(c) { cx.fillStyle = c || '#121522'; cx.fillRect(0, 0, W, H); cx.fillStyle = '#e8e6f6'; for (const [x, y, s] of STARS) { cx.globalAlpha = 0.5 + 0.5 * Math.sin(G.clk * 2 + x * 40); cx.beginPath(); cx.arc(x * W, y * H, s * U, 0, 7); cx.fill() } cx.globalAlpha = 1 }
function drawEarth(ballOnly) {
  drawStars()
  const E = earthGeo()
  sk(ellP(0.84 * W, 0.2 * H, 0.07 * W, 0.07 * W), { fill: '#d6d3c7', col: '#9a978c' })
  drawUfo()
  if (G.items.earth === 0) {
    sk(ellP(E.x, E.y, E.R, E.R), { fill: '#4f82bd', col: '#2b4f7c', w: 2 })
    cx.save(); cx.beginPath(); cx.arc(E.x, E.y, E.R, 0, 7); cx.clip()
    if (G.items.continents === 0) item('continents', E.x, E.y, E.R * 2.05)
    if (G.items.clouds === 0) item('clouds', E.x - E.R * 0.3, E.y + E.R * 0.35, E.R * 0.9)
    const b = ballGeo('earth', G.Pv); drawBall(b.x, b.y, b.r, { noRim: true })
    cx.restore()
  }
}
function drawUfo() {
  const w = G.w; if (w.type !== 'ufo') return
  const peek = w.st === 'tell' ? sm(w.t / w.dur) : (w.st === 'look' || w.st === 'caught') ? 1 : w.st === 'fake' ? 1 - sm(w.t / w.dur) : w.st === 'back' ? 1 - sm(w.t / w.dur) : 0
  if (peek <= 0.01) return
  const x = 0.84 * W - peek * 0.13 * W, y = 0.2 * H
  if (w.st === 'look' || w.st === 'caught') { const b = ballGeo('earth', G.Pv); cx.fillStyle = w.st === 'caught' ? 'rgba(200,255,170,.4)' : 'rgba(170,240,150,.22)'; cx.beginPath(); cx.moveTo(x - 8 * U, y + 6 * U); cx.lineTo(b.x - b.r * 0.6, b.y); cx.lineTo(b.x + b.r * 0.6, b.y); cx.lineTo(x + 8 * U, y + 6 * U); cx.fill() }
  sk(ellP(x, y, 26 * U, 8 * U), { fill: '#b9c0c6', col: '#3b3a36' }); sk(ellP(x, y - 6 * U, 11 * U, 9 * U, Math.PI, Math.PI * 2), { fill: '#bfe3d4', w: 1.2 })
  for (let i = -1; i <= 1; i++) { cx.fillStyle = (Math.floor(G.clk * 6) + i) % 2 ? '#f2d14a' : '#fff6c2'; cx.beginPath(); cx.arc(x + i * 13 * U, y + 2 * U, 2.4 * U, 0, 7); cx.fill() }
}
function drawSpace() {
  drawStars('#151632')
  // 宇宙の黒板と先生
  const bx = 0.06 * W, by = 0.095 * H, bw = 0.88 * W, bh = 0.2 * H
  sk(rectP(bx - 6 * U, by - 6 * U, bw + 12 * U, bh + 12 * U), { fill: '#5a4a72' }); sk(rectP(bx, by, bw, bh), { fill: '#1d2340', col: '#0f1326' })
  txt(T().board, bx + 14 * U, by + 20 * U, 17 * U, { al: 'left', col: 'rgba(236,232,255,.85)' })
  for (let i = 0; i < 9; i++) { cx.fillStyle = '#fbf6dc'; cx.beginPath(); cx.arc(bx + (0.15 + hsh(i + 77) * 0.75) * bw, by + (0.35 + hsh(i + 88) * 0.55) * bh, 1.6 * U, 0, 7); cx.fill() }
  drawTeacher(0.42 * W, 0.115 * H, 0.27 * H, teacherState(), { hair: '#2a2550', skin: '#d9d3f2', jk: '#3d3a6b', tie: '#f2b13a' })
  for (const id of ['sun', 'galaxy', 'moon', 'saturn']) if (G.items[id] === 0) { const [x, y, s] = itemPos(id); item(id, x, y + Math.sin(G.clk + x) * 2 * U, s) }
}
function drawHeli() {
  const w = G.w; if (G.sceneNow !== 'town' || w.type !== 'heli') return
  const k = w.st === 'tell' ? sm(w.t / w.dur) : (w.st === 'look' || w.st === 'caught') ? 1 : (w.st === 'back' || w.st === 'fake') ? 1 - sm(w.t / w.dur) : 0
  if (k <= 0.01) return
  const x = lerp(1.2 * W, 0.72 * W, k), y = 0.16 * H + Math.sin(G.clk * 3) * 3 * U
  if (w.st === 'look' || w.st === 'caught') { const b = ballGeo('town', G.Pv); cx.fillStyle = w.st === 'caught' ? 'rgba(255,248,190,.5)' : 'rgba(255,244,170,.28)'; cx.beginPath(); cx.moveTo(x - 6 * U, y + 10 * U); cx.lineTo(b.x - b.r * 0.9, b.y + b.r * 0.4); cx.lineTo(b.x + b.r * 0.9, b.y + b.r * 0.4); cx.lineTo(x + 6 * U, y + 10 * U); cx.fill() }
  grp(x, y, U, 0, () => {
    sk(ellP(0, 0, 26, 13), { fill: '#e7e1d0' }); sk(ellP(-12, -2, 9, 7), { fill: '#a9c7d8', w: 1 }); sk(rectP(20, -4, 34, 6), { fill: '#e7e1d0', w: 1.4 }); sk(lineP(54, -10, 54, 6), { open: true, w: 2 })
    sk(lineP(-2, -13, -2, -18), { open: true, w: 2 }); const a = Math.sin(G.clk * 60) * 44; sk(lineP(-2 - a, -18, -2 + a, -18), { open: true, w: 2.2, col: '#56554f' }); sk(lineP(-16, 14, 14, 14), { open: true, w: 2 })
  })
}
function drawSat() {
  const w = G.w; if (G.sceneNow !== 'japan' || w.type !== 'sat') return
  const k = w.st === 'idle' ? (G.clk * 0.05) % 1 : 0.5
  const x = w.st === 'idle' ? lerp(-0.1 * W, 1.1 * W, k) : 0.5 * W, y = w.st === 'idle' ? 0.08 * H : 0.11 * H
  if (w.st === 'look' || w.st === 'caught') { const b = ballGeo('japan', G.Pv); cx.fillStyle = w.st === 'caught' ? 'rgba(255,255,255,.55)' : 'rgba(190,225,255,.3)'; cx.beginPath(); cx.moveTo(x - 4 * U, y + 8 * U); cx.lineTo(b.x - b.r * 1.1, b.y); cx.lineTo(b.x + b.r * 1.1, b.y); cx.lineTo(x + 4 * U, y + 8 * U); cx.fill() }
  grp(x, y, U, 0, () => {
    sk(rectP(-9, -7, 18, 14), { fill: '#d9b86a' }); sk(rectP(-40, -5, 28, 10), { fill: '#3d5a8a', w: 1.2 }); sk(rectP(12, -5, 28, 10), { fill: '#3d5a8a', w: 1.2 })
    cx.fillStyle = (w.st === 'tell' && Math.floor(G.clk * 8) % 2) || w.st === 'look' || w.st === 'caught' ? '#e04a3a' : '#5a5953'; cx.beginPath(); cx.arc(0, 9, 3.4, 0, 7); cx.fill()
  })
}
function drawScene(sc) {
  if (sc === 'room') drawRoom()
  else if (sc === 'school') drawSchool()
  else if (sc === 'town') drawTown()
  else if (sc === 'japan') drawJapan()
  else if (sc === 'earth') drawEarth()
  else drawSpace()
  const b = ballGeo(sc, G.Pv)
  if (sc !== 'earth' || G.items.earth !== 0) drawBall(b.x, b.y, b.r)
  if (sc === 'room' && G.items.desk === 0) { const e = eraserPos(); item('eraser', e.x, e.y, 0.25 * W, G.rollV * -0.05 + (G.roll - G.rollV) * 0.12) }
  if (sc === 'town') drawHeli()
  if (sc === 'japan') drawSat()
}
function drawBall(x, y, r, o = {}) {
  if (r < 0.6) return
  const t = G.clk, wob = G.wob || 0
  if (!o.noRim && G.rim) { for (const it of G.rim.slice(-7)) { const a = it.a + (G.rollV || 0) * 0.2; const s = r * (BIG[it.id] ? 0.78 : 0.62); grp(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, s / 100, a + Math.PI / 2, ITEM[it.id]) } }
  const n = 44, pts = [], sq = G.squash || 0
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const k = 1 + 0.035 * Math.sin(a * 3 + 1.1) + 0.022 * Math.sin(a * 5 + 2.3) + wob * 0.06 * Math.sin(a * 2 + t * 18); pts.push([x + Math.cos(a) * r * k * (1 + sq), y + Math.sin(a) * r * k * (1 - sq)]) }
  const g = cx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.05)
  g.addColorStop(0, '#c4c3bd'); g.addColorStop(0.45, '#95948e'); g.addColorStop(1, '#5d5c58')
  cx.save(); tracePts(pts, 5, 0, true); cx.fillStyle = g; cx.fill(); cx.clip()
  if (r > 5) {
    for (const s of SPECK) { cx.fillStyle = s.c; cx.globalAlpha = 0.45; cx.beginPath(); cx.arc(x + Math.cos(s.a + (G.rollV || 0) * 0.3) * s.d * r, y + Math.sin(s.a + (G.rollV || 0) * 0.3) * s.d * r, Math.max(0.6, s.s * r * 0.03), 0, 7); cx.fill() }
    cx.globalAlpha = 0.4; for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4; sk(ellP(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.28, r * (0.42 - i * 0.05), r * (0.16 + i * 0.03), a, a + 2.2), { open: true, col: i % 2 ? '#d7d6d0' : '#4a4945', w: Math.max(1, r / 50), j: .5, seed: 600 + i }) }
    for (let i = 0; i < 4; i++) sk(ellP(x + r * 0.32, y - r * 0.18, r * (0.06 + i * 0.045), r * (0.05 + i * 0.035), 3.6, 5.9), { open: true, col: '#55544f', w: Math.max(0.8, r / 90), j: .3, seed: 650 + i })
    cx.globalAlpha = 1
  }
  cx.fillStyle = 'rgba(255,255,255,.3)'; cx.beginPath(); cx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.11, -0.6, 0, 7); cx.fill()
  cx.restore()
  sk(pts, { w: r > 30 ? 2.2 : 1.3, col: '#3b3a36', j: 0.5 })
}
function drawFly() {
  const b = ballGeo(G.sceneNow, G.Pv)
  for (const f of G.fly) {
    const k = sm(f.t / f.dur), k2 = k * k
    const x = lerp(f.x, b.x, k2), y = lerp(f.y, b.y, k2) - Math.sin(k * Math.PI) * 0.06 * H, s = f.s * lerp(1, 0.25, k2)
    grp(x, y, 1, f.rot + k * 2, () => { cx.scale(1 + k * 0.4, 1 - k * 0.3); item(f.id, 0, 0, s) })
  }
}
function drawParts() { for (const p of G.parts) { cx.fillStyle = p.c; cx.beginPath(); cx.ellipse(p.x, p.y, p.s, p.s * 0.7, p.t * 3, 0, 7); cx.fill() } }
function drawHints() {
  const y = H - 54 * U - (G.sceneNow === 'room' ? 0 : 6 * U), r = 32 * U
  const next = G.lastSide === 0 ? 1 : G.lastSide === 1 ? 0 : -1
  for (const s of [0, 1]) {
    const x = s ? W - 58 * U : 58 * U
    const glow = G.flash[s] + (next === s && G.phase === 'play' ? 0.25 + 0.15 * Math.sin(G.clk * 10) : 0)
    cx.globalAlpha = 0.85
    sk(ellP(x, y, r, r), { fill: `rgba(251,249,241,${0.35 + glow * 0.5})`, col: G.sceneNow === 'earth' || G.sceneNow === 'space' ? '#e8e6f6' : INK, w: 1.8, seed: 700 + s })
    const d = s ? 1 : -1
    sk(polyP([[x - d * 8 * U, y - 12 * U], [x + d * 8 * U, y], [x - d * 8 * U, y + 12 * U]], false), { open: true, w: 3, col: G.sceneNow === 'earth' || G.sceneNow === 'space' ? '#e8e6f6' : INK, seed: 710 + s })
    cx.globalAlpha = 1
  }
}
function drawChalkShot() {
  if (!G.chalkShot) return
  const k = G.chalkShot.t / 0.32, e = G.items.desk === 0 ? eraserPos() : ballGeo(G.sceneNow, G.Pv)
  const x0 = teacherX() + 0.08 * W, y0 = 0.12 * H, x = lerp(x0, e.x, k), y = lerp(y0, e.y, k) - Math.sin(k * Math.PI) * 0.05 * H
  grp(x, y, U * (1 + k * 2), k * 9, () => sk(rectP(-6, -2, 12, 4), { fill: '#f6f6f2', w: 1 }))
}
function render() {
  cx.setTransform(DPR, 0, 0, DPR, 0, 0)
  if (G.scene !== 'play') return
  const sh = G.shake * 6 * U
  cx.save(); if (sh > 0.3) cx.translate((hsh(Math.floor(G.clk * 60)) - 0.5) * sh * 2, (hsh(Math.floor(G.clk * 60) + 9) - 0.5) * sh * 2)
  drawScene(G.sceneNow)
  if (G.trans && G.trans.from !== G.sceneNow) {
    const k = sm(G.trans.t / 0.9), b = ballGeo(G.sceneNow, G.Pv)
    cx.save(); cx.globalAlpha = 1 - k; cx.translate(b.x, b.y); cx.scale(lerp(1, 0.18, k), lerp(1, 0.18, k)); cx.translate(-b.x, -b.y); drawScene(G.trans.from); cx.restore(); cx.globalAlpha = 1
  }
  drawFly(); drawParts(); drawChalkShot()
  // 見られている間は画面のふちに赤い鉛筆の線
  if (G.w.st === 'look' || G.w.st === 'caught') { cx.globalAlpha = G.w.st === 'caught' ? 0.8 : 0.45 + 0.15 * Math.sin(G.clk * 12); sk(rectP(5 * U, 5 * U, W - 10 * U, H - 10 * U), { col: '#bf3a2c', w: 4, j: 2 }); cx.globalAlpha = 1 }
  if ((G.phase === 'play' || G.phase === 'kiritsu') && G.strokes < 10) drawHints()
  if (G.flashBB > 0) { cx.fillStyle = `rgba(255,252,240,${G.flashBB})`; cx.fillRect(-20, -20, W + 40, H + 40) }
  cx.restore()
  hud()
}
// ---- HUD ----
const hW = $('#hW'), hX = $('#hX')
let hudKey = ''
function massG(P) { const M = D.MASS; if (P <= M[0][0]) return M[0][1]; for (let i = 1; i < M.length; i++) if (P <= M[i][0]) { const [p0, m0] = M[i - 1], [p1, m1] = M[i]; return Math.exp(lerp(Math.log(m0), Math.log(m1), (P - p0) / (p1 - p0))) } return M[M.length - 1][1] }
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
function fmtMass(g) {
  const ja = lang === 'ja', f1 = v => v < 10 ? v.toFixed(1) : String(Math.floor(v))
  if (g < 1) return g.toFixed(2) + (ja ? 'g' : ' g')
  if (g < 1000) return f1(g) + (ja ? 'g' : ' g')
  if (g < 1e6) return f1(g / 1000) + (ja ? 'kg' : ' kg')
  const t = g / 1e6
  if (!ja) { if (t < 1e6) return Math.floor(t).toLocaleString('en-US') + ' t'; const e = Math.floor(Math.log10(t)), m = t / Math.pow(10, e); return m.toFixed(1) + '×10' + String(e).split('').map(c => SUP[+c]).join('') + ' t' }
  if (t < 1e4) return Math.floor(t).toLocaleString('ja-JP') + 'トン'
  for (const [v, u] of [[1e44, '載'], [1e40, '正'], [1e36, '澗'], [1e32, '溝'], [1e28, '穣'], [1e24, '万垓'], [1e20, '垓'], [1e16, '京'], [1e12, '兆'], [1e8, '億'], [1e4, '万']]) if (t >= v) return Math.floor(t / v).toLocaleString('ja-JP') + u + 'トン'
  return Math.floor(t) + 'トン'
}
function massText(P) { const m = fmtMass(massG(P)); return G.loop ? T().loopMass.replace('{n}', G.loop).replace('{m}', m) : m }
const scoreOf = () => G.loop * 200 + G.P
function sizeLbl(P) { let s = T().sizes[0][1]; for (const [p, n] of T().sizes) if (P >= p) s = n; return s + T().sizeSuffix }
function hud() {
  const m = massText(G.Pv), key = m + G.strikes
  if (key !== hudKey) { hudKey = key; hW.textContent = m; hX.innerHTML = Array.from({ length: D.STRIKES }, (_, i) => `<i class="${i < G.strikes ? 'on' : ''}"></i>`).join('') }
  if (G.bub) placeBub()
}

// ---- 自己ベスト（この端末だけ） ----
function loadBest() { try { return JSON.parse(localStorage.getItem('nk_best') || 'null') } catch (e) { return null } }
function saveBest() {
  const b = loadBest(), sc = scoreOf()
  G.isBest = sc > 0.5 && (!b || sc > b.s)
  if (G.isBest) { G.best = { s: sc, m: massText(G.P), r: rankIdx(), l: G.loop }; try { localStorage.setItem('nk_best', JSON.stringify(G.best)) } catch (e) {} } else G.best = b
  showBest()
}
function showBest() { const b = loadBest(); $('#tBest').textContent = b ? T().best.replace('{m}', b.m) : '' }

// ---- 結果（鑑定書） ----
function rankIdx() { if (G.loop) return 10; const th = [0, 3, 12, 31.5, 40, 50, 60, 70, 89.4, 92]; let r = 0; for (let i = 0; i < th.length; i++) if (G.P >= th[i]) r = i; return r }
function result() {
  const ri = rankIdx(), rk = T().ranks[ri], ate = G.ate.slice()
  return { rank: ri, title: G.loop > 1 ? T().loopTitle.replace('{n}', G.loop) : rk.t, price: rk.price, comment: rk.c, mass: massText(G.P), size: G.loop ? T().loopSize : sizeLbl(G.P), ate, strokes: G.strokes, strikes: G.strikes, loop: G.loop, score: +scoreOf().toFixed(2), best: G.best, isBest: G.isBest, P: +G.P.toFixed(2), thrills: G.thrills, maxCombo: G.maxCombo, reason: G.endReason }
}
function ateText(r, max = 5) {
  if (!r.ate.length) return T().certNone
  const names = r.ate.slice(-max).reverse().map(id => T().items[id])
  const more = r.ate.length - names.length
  return names.join(lang === 'ja' ? '・' : ', ') + (more > 0 ? (lang === 'ja' ? '　' : ' ') + T().certMore.replace('{n}', more) : '')
}
function showResult() {
  allLoopsOff(); loop('bgmT', 0.2)
  saveBest()
  const r = fillResult()
  sfx(r.rank >= 7 ? 'jgood' : 'jmeh', { vol: 0.7 })
  show('vEnd')
  const c = $('#cert'), st = $('#stamp'); c.classList.remove('in'); st.classList.remove('hit'); void c.offsetWidth; c.classList.add('in')
  setTimeout(() => { st.classList.add('hit'); sfx('thwack', { vol: 0.5, rate: 0.7 }) }, 550)
  drawCertBall($('#certBall'))
  window.TM && TM.end(Math.round(r.score * 10), r.rank >= 8)
  log('result', r.rank)
}
function fillResult() {
  const r = G.result = result(), t = T()
  $('#cH').textContent = t.cert; $('#cRank').textContent = r.title
  $('#cItem').textContent = t.certItemV
  $('#cDl').innerHTML = [[t.certMass, r.mass], [t.certSize, r.size], [t.certStroke, t.certStrokeV.replace('{n}', Math.floor(r.strokes / 2))], [t.certBest, r.isBest ? t.certNew : (r.best ? r.best.m : '')]].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')
  $('#cAte').innerHTML = `<b>${t.certAte}</b>${ateText(r)}`
  $('#cPriceL').textContent = t.certPrice; $('#cPrice').textContent = r.price; $('#cCmt').textContent = '「' + r.comment + '」'; $('#cBy').textContent = t.certBy
  const st = $('#stamp'); st.textContent = r.conf ? t.certConf : t.certStamp; st.className = r.conf ? 'conf' : ''
  $('#bSave').textContent = t.save; $('#bPost').textContent = t.post; $('#bAgain').textContent = t.again
  return r
}
function drawCertBall(c, scale = 1) {
  const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height)
  withCtx(g, c.width, c.height, () => { U = c.width / 300 * scale; LW = U; const r = c.width * (G.rim && G.rim.length ? 0.33 : 0.14 + Math.min(0.15, G.P / 200)); drawBall(c.width / 2, c.height * 0.58, r) })
}
async function drawCard() {
  const c = $('#card'), g = c.getContext('2d'), r = G.result, t = T()
  try { await document.fonts.load('600 40px "Klee One"', t.cert + r.title) } catch (e) {}
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.fillStyle = '#3d3b36'; g.fillRect(0, 0, 1080, 1440)
  g.fillStyle = '#fbf7ea'; g.fillRect(60, 60, 960, 1320)
  g.strokeStyle = '#7a5b2e'; g.lineWidth = 4; g.strokeRect(84, 84, 912, 1272); g.lineWidth = 1.5; g.strokeRect(96, 96, 888, 1248)
  const F = (w, s) => `${w} ${s}px "Klee One","Hiragino Maru Gothic ProN",sans-serif`
  g.fillStyle = '#5a3f17'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = F(600, 62); g.fillText(t.cert, 540, 180)
  g.fillStyle = '#b49b6c'; g.fillRect(180, 228, 720, 3)
  g.fillStyle = '#34332f'; g.font = F(600, r.title.length > 12 ? 58 : 72); g.fillText(r.title, 540, 310)
  const bc = document.createElement('canvas'); bc.width = 420; bc.height = 420; drawCertBall(bc); g.drawImage(bc, 120, 360, 400, 400)
  g.textAlign = 'left'; let y = 430
  for (const [a, b] of [[t.certMass, r.mass], [t.certSize, r.size], [t.certStroke, t.certStrokeV.replace('{n}', Math.floor(r.strokes / 2))], [t.certStrike, t.certStrikeV.replace('{n}', r.strikes)]]) { g.fillStyle = '#7a6a4e'; g.font = F(400, 32); g.fillText(a, 560, y); g.fillStyle = '#34332f'; g.font = F(600, 40); wrapText(g, b, 560, y + 48, 400, 46); y += 130 }
  g.fillStyle = '#b49b6c'; g.fillRect(140, 930, 800, 2)
  g.fillStyle = '#7a6a4e'; g.font = F(400, 32); g.fillText(t.certAte, 140, 985); g.fillStyle = '#34332f'; g.font = F(600, 36); wrapText(g, ateText(r, 6), 140, 1040, 800, 48)
  g.fillStyle = '#b49b6c'; g.fillRect(140, 1130, 800, 2)
  g.fillStyle = '#7a6a4e'; g.font = F(400, 34); g.fillText(t.certPrice, 140, 1185); g.textAlign = 'right'; g.fillStyle = '#bf3a2c'; g.font = F(600, r.price.length > 10 ? 40 : 56); g.fillText(r.price, 940, 1185)
  g.textAlign = 'left'; g.fillStyle = '#34332f'; g.font = F(600, 36); g.fillText('「' + r.comment + '」', 140, 1260)
  g.textAlign = 'right'; g.fillStyle = '#7a6a4e'; g.font = F(400, 28); g.fillText(t.certBy, 940, 1312)
  g.save(); g.translate(840, 420); g.rotate(-0.24); g.strokeStyle = 'rgba(191,58,44,.85)'; g.lineWidth = 9; g.fillStyle = 'rgba(191,58,44,.9)'; g.textAlign = 'center'; g.font = F(600, r.conf ? 64 : 50)
  if (r.conf) { g.strokeRect(-150, -55, 300, 110) } else { g.beginPath(); g.arc(0, 0, 110, 0, 7); g.stroke() }
  g.fillText(r.conf ? t.certConf : t.certStamp, 0, 4); g.restore()
  g.textAlign = 'center'; g.fillStyle = '#d8d2c2'; g.font = F(400, 28); g.fillText((lang === 'ja' ? 'ひまつぶし横丁　' : 'Himatsubushi Yokocho  ') + 'tom3games.com', 540, 1412)
}
function wrapText(g, s, x, y, maxW, lh) { let line = ''; const chars = lang === 'ja' ? [...s] : s.split(/(\s+)/); for (const ch of chars) { const test = line + ch; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = ch.trimStart ? ch.trimStart() : ch; y += lh } else line = test } g.fillText(line, x, y) }

// ---- 画面切替と文言 ----
function show(id) { for (const v of ['vTitle', 'vPlay', 'vEnd']) $('#' + v).hidden = v !== id; G.scene = id === 'vPlay' ? 'play' : id === 'vEnd' ? 'end' : 'title' }
function applyLang() {
  const t = T(); document.documentElement.lang = lang
  const d = new Date(), wd = lang === 'ja' ? '日月火水木金土'[d.getDay()] : ''
  $('#tDate').textContent = lang === 'ja' ? `${d.getMonth() + 1}月${d.getDate()}日（${wd}）　3時間目` : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}  3rd period`
  $('#tH').innerHTML = lang === 'ja' ? '<span>練り消し、</span><span>地球になる</span>' : '<span class="en">The Kneaded Eraser</span><span class="en">Becomes Earth</span>'
  showBest(); $('#tSub').textContent = t.sub; $('#bStartT').textContent = t.start
  $('#bHow').textContent = t.how; $('#bLang').textContent = t.lang
  $('#howH').textContent = t.howH; $('#howBody').innerHTML = t.howBody.map(s => `<li>${s}</li>`).join('')
  $('#howCred').innerHTML = `${t.credits}<br><a href="privacy.html" target="_blank" rel="noopener">${t.privacy}</a>`; $('#howClose').textContent = t.howClose
  $('#loadTxt').textContent = t.loading
  if (G.scene === 'end') fillResult()
}
function setMuteIcons() { for (const b of ['#bMute', '#bMute2']) { $(b + ' .wave').style.display = muted ? 'none' : ''; $(b + ' .x').style.display = muted ? '' : 'none' } }
function toggleMute() { muted = !muted; Snd.setMute(muted); try { localStorage.setItem('nk_mute', muted ? '1' : '0') } catch (e) {} setMuteIcons() }

on('#bStart', () => { Snd.init(); startGame() })
on('#bHow', () => { $('#how').hidden = false; sfx('page', { vol: 0.5 }) })
on('#howClose', () => { $('#how').hidden = true })
$('#how').addEventListener('click', e => { if (e.target.id === 'how') $('#how').hidden = true })
on('#bLang', () => { lang = lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('nk_lang', lang) } catch (e) {} applyLang() })
on('#bMute', () => { Snd.init(); toggleMute(); if (!muted) loop('bgmT', 0.2) })
on('#bMute2', toggleMute)
on('#bAgain', () => { sfx('click', { vol: 0.5 }); startGame() })
on('#bSave', async () => {
  window.TM && TM.share('save'); await drawCard()
  $('#card').toBlob(async b => {
    if (!b) return
    const file = new File([b], 'nerikeshi.png', { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/.test(navigator.userAgent)) { try { await navigator.share({ files: [file] }); return } catch (e) { if (e && e.name === 'AbortError') return } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'nerikeshi.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000)
  })
})
on('#bPost', () => {
  window.TM && TM.share('x'); const r = G.result
  const text = T().postText.replace('{r}', r.title).replace('{m}', r.mass)
  open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://tom3games.com/play/nerikeshi/'), '_blank')
})
// なぞる: 消しゴムは指の位置について行き、向きが変わるたびに1回こする。動かさずに離したらタップ（押した側へ1回）
const PTR = {}, SWIPE = 12
const fingerRoll = x => { const r = cv.getBoundingClientRect(); return clamp(((x - r.left) / r.width - 0.5) * 2.6, -1.15, 1.15) }
cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId) } catch (er) {} PTR[e.pointerId] = { x0: e.clientX, anchor: e.clientX, dir: 0, drag: false } }, { passive: false })
cv.addEventListener('pointermove', e => {
  const p = PTR[e.pointerId]; if (!p) return
  const x = e.clientX
  if (!p.drag && Math.abs(x - p.x0) >= SWIPE) p.drag = true
  if (!p.drag) return
  if (G.phase === 'play' && G.lock <= 0) G.roll = fingerRoll(x)
  if (p.dir === 0) { if (Math.abs(x - p.anchor) >= SWIPE) { p.dir = Math.sign(x - p.anchor); p.anchor = x; tap(p.dir > 0 ? 1 : 0, true) } }
  else if ((x - p.anchor) * p.dir > 0) p.anchor = x
  else if (Math.abs(x - p.anchor) >= SWIPE) { p.dir = -p.dir; p.anchor = x; tap(p.dir > 0 ? 1 : 0, true) }
})
const ptrEnd = e => { const p = PTR[e.pointerId]; if (!p) return; delete PTR[e.pointerId]; if (!p.drag && e.type === 'pointerup') { const r = cv.getBoundingClientRect(); tap(p.x0 - r.left < r.width / 2 ? 0 : 1) } }
cv.addEventListener('pointerup', ptrEnd); cv.addEventListener('pointercancel', ptrEnd)
cv.addEventListener('contextmenu', e => e.preventDefault())
addEventListener('keydown', e => { if (e.repeat || G.scene !== 'play') return; const k = e.code; if (k === 'ArrowLeft' || k === 'KeyA' || k === 'KeyF') tap(0); else if (k === 'ArrowRight' || k === 'KeyD' || k === 'KeyJ') tap(1) })
addEventListener('resize', resize)
addEventListener('pointerdown', () => { if (G.scene === 'title' && !muted) { Snd.init(); if (!loopsOn.bgmT) loop('bgmT', 0.2) } }, { once: true })

// ---- タイトルの練り消し ----
const tBall = $('#tBall')
function drawTitleBall() {
  const g = tBall.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 560, 560)
  withCtx(g, 560, 560, () => {
    U = 1.8; LW = U
    const save = { rim: G.rim, wob: G.wob, rollV: G.rollV, squash: G.squash }
    G.rim = [{ id: 'pencil', a: -2.5 }, { id: 'school', a: -1.75 }, { id: 'tower', a: -1.05 }, { id: 'saturn', a: -0.4 }, { id: 'teacher', a: -2.1 + Math.PI }]
    G.wob = 0.2 + 0.2 * Math.sin(G.clk * 2); G.rollV = Math.sin(G.clk * 1.4) * 0.6; G.squash = 0
    drawBall(296, 300, 172)
    item('eraser', 120, 500, 150, -0.25)
    for (let i = 0; i < 9; i++) { g.fillStyle = '#8b8a84'; g.beginPath(); g.ellipse(170 + hsh(i + 50) * 120, 470 + hsh(i + 60) * 60, 5 + hsh(i) * 4, 4, i, 0, 7); g.fill() }
    Object.assign(G, save)
  })
}

// ---- 回す ----
let lastT = performance.now(), acc = 0
function frame() {
  requestAnimationFrame(frame)
  const now = performance.now(); let d = (now - lastT) / 1000; lastT = now; if (d > 0.25) d = 0.25
  if (!G.paused) { acc += d; let n = 0; while (acc >= 1 / 60 && n < 20) { update(1 / 60); acc -= 1 / 60; n++ } }
  if (G.scene === 'play') render()
  else if (G.scene === 'title' && !G.paused) { if (!G.clk) G.clk = 0; drawTitleBall() }
}

// ---- 読み込み（フォントと短い音を先に） ----
async function boot() {
  applyLang(); setMuteIcons(); resize()
  const list = ['snd/rub1.mp3', 'snd/rub2.mp3', 'snd/rub3.mp3', 'snd/pop1.mp3', 'snd/absorb1.mp3', 'snd/absorb2.mp3', 'snd/thwack1.mp3', 'snd/swish1.mp3', 'snd/tear.mp3', 'snd/click.mp3']
  let done = 0; const total = list.length + 1, bar = $('#loadBar i')
  const tick = () => { done++; bar.style.width = Math.round(done / total * 100) + '%' }
  const font = (document.fonts ? Promise.all([document.fonts.load('600 20px "Klee One"', '練り消し、地球になる'), document.fonts.load('400 20px "Klee One"', 'あ')]) : Promise.resolve()).catch(() => {}).then(tick)
  const snds = list.map(u => fetch(u).then(r => r.arrayBuffer()).catch(() => {}).then(tick))
  await Promise.race([Promise.all([font, ...snds]), new Promise(r => setTimeout(r, 12000))])
  const l = $('#loading'); l.style.opacity = '0'; setTimeout(() => { l.style.display = 'none' }, 380)
  window.__nkReady = true
}
requestAnimationFrame(frame)
boot()

// 実機・シミュレーターでの通し確認用（?demo=1）。人の速さで本物の pointerdown を送る（1秒に約5回・気づくまで約0.7秒）
if (/[?&]demo=[12]/.test(location.search)) {
  const swipe = /demo=2/.test(location.search)   // 2 はなぞりで遊ぶ
  muted = true; Snd.setMute(true); setMuteIcons()   // 確認中は絶対に鳴らさない
  const go = () => {
    if (!window.__nkReady) return setTimeout(go, 200)
    $('#bStart').click()
    let side = 0, stopAt = -1, resumeAt = 0, seen = ''
    const step = () => {
      if (G.scene === 'end') { if (!G.demoAgain) { G.demoAgain = 1 } return }
      const w = G.w, t = G.t || 0
      if (w && w.st !== seen) { seen = w.st; if (w.st === 'tell') stopAt = t + 0.6 + Math.random() * 0.25; if (w.st === 'back' || w.st === 'fake' || w.st === 'idle') resumeAt = t + 0.4 }
      const danger = w && (w.st === 'tell' || w.st === 'look' || w.st === 'caught') && stopAt >= 0 && t >= stopAt
      if (G.phase === 'play' && !danger && t >= resumeAt) {
        side = 1 - side; const r = cv.getBoundingClientRect()
        const o = { bubbles: true, cancelable: true, clientX: r.left + r.width * (side ? 0.8 : 0.2), clientY: r.top + r.height * 0.72, pointerType: 'touch', pointerId: 7 }
        if (swipe) { if (!G.demoDown) { G.demoDown = 1; cv.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: r.left + r.width * 0.5 })) } cv.dispatchEvent(new PointerEvent('pointermove', o)) }
        else { cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o)) }
      }
      setTimeout(step, 170 + Math.random() * 60)
    }
    step()
  }
  go()
}

// ---- 検証用の窓口 ----
window.nk = {
  G, D, tap, start: startGame, result: () => G.result, rankIdx, fmtMass, massG, sizeLbl, lang: () => lang,
  state: () => ({ loop: G.loop, roll: +(G.rollV || 0).toFixed(3), eraserX: G.items && G.items.desk === 0 ? Math.round(eraserPos().x) : null, phase: G.phase, scene: G.scene, sceneNow: G.sceneNow, t: +((G.t || 0).toFixed(3)), P: +((G.P || 0).toFixed(3)), stage: G.stage, w: G.w && { ...G.w }, strikes: G.strikes, strokes: G.strokes, combo: G.combo, ate: (G.ate || []).slice(), lock: G.lock, bub: G.bub && G.bub.text }),
  sideXY: s => { const r = cv.getBoundingClientRect(); return { x: r.left + r.width * (s ? 0.8 : 0.2), y: r.top + r.height * 0.72 } },
  dbg: {
    pause(b = true) { G.paused = b; lastT = performance.now(); acc = 0 },
    step(n = 1) { for (let i = 0; i < n; i++) update(1 / 60); render() },
    tick(n = 1) { for (let i = 0; i < n; i++) update(1 / 60) },
    seed(s) { seedV = (s % 2147483646) + 1 },
    setP(p) { G.P = p; G.Pv = p; addP(0); absorbTick() },
    finish() { for (let k = 0; k < D.STRIKES; k++) { G.lock = 0; G.w.type = G.w.type || 'teacher'; setW('look', 5); G.w.t = 0.3; tap(G.lastSide ? 0 : 1); this.tick(20) } this.tick(300) },
    skipKiritsu() { if (G.phase === 'kiritsu') { G.kt = 1.39; update(1 / 60) } },
    render,
  },
}
})()
