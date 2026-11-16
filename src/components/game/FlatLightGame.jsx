// „Silikonová lázeň“ — how BLP made indoor flat lights rain-proof for the Hanyš crane.
// Phase 1: dip the lights in silicone (drag down, hold, pull out slowly).
// Phase 2: the night on the crane — move the arm, tap a light to switch it off so it dries.
// Rules and numbers: src/domain/flatLightGame.js. No sound, only short vibrations.
import React, { useEffect, useRef, useState } from 'react';
import { X, Play, RotateCcw, Trophy, Clapperboard, CalendarCheck, ArrowRight, Droplets } from 'lucide-react';
import { useBackLayer } from '../../hooks/useBackLayer';
import {
  FL, VERDICTS, createGame, dipMove, stepDip, submerged, startCrane, stepCrane, moveArm, toggleLight,
  segmentOf, isShining, darkRatio,
} from '../../domain/flatLightGame';
import { weekId, fmtScore } from '../../domain/gameScores';
import { Leaderboard } from './Leaderboard';
import { drawPerson } from './draw';

const WARM = '255,240,200';
const buzz = (pattern) => { if (navigator.vibrate) navigator.vibrate(pattern); };

// ── Drawing ──────────────────────────────────────────────────────────
/**
 * The flat light as the crew knows it: an aluminium frame with two cross-bars, three
 * pairs of LED strips, the black driver box in the corner and the red/black cable.
 * @param coat  how much of it (from the bottom, 0..1) is covered with silicone
 * @param glow  0 = off, 1 = shining
 */
function drawFlatLight(ctx, x, y, w, h, { coat = 0, glow = 0, dead = false } = {}) {
  const bar = Math.max(2, w * 0.06);
  const alu = dead ? '#4a4741' : '#b9b3a7';
  ctx.save();

  // Cross-bars and frame.
  ctx.fillStyle = dead ? '#3b3934' : '#a39d92';
  ctx.fillRect(x + bar, y + h / 3 - bar / 2, w - 2 * bar, bar);
  ctx.fillRect(x + bar, y + (2 * h) / 3 - bar / 2, w - 2 * bar, bar);
  ctx.fillStyle = alu;
  ctx.fillRect(x, y, w, bar);
  ctx.fillRect(x, y + h - bar, w, bar);
  ctx.fillRect(x, y, bar, h);
  ctx.fillRect(x + w - bar, y, bar, h);

  // Three pairs of LED strips.
  const strip = Math.max(1.5, w * 0.05);
  if (glow > 0) { ctx.shadowColor = `rgba(${WARM},${0.9 * glow})`; ctx.shadowBlur = w * 0.35; }
  ctx.fillStyle = dead ? '#55524c' : glow > 0 ? `rgba(255,${246 - 10 * (1 - glow)},${214 + 20 * glow},1)` : '#e9e6dd';
  for (const fx of [0.2, 0.5, 0.8]) {
    ctx.fillRect(x + w * fx - strip * 1.25, y + bar, strip, h - 2 * bar);
    ctx.fillRect(x + w * fx + strip * 0.25, y + bar, strip, h - 2 * bar);
  }
  ctx.shadowBlur = 0;

  // Red + black cable with its two junction plates, running between the strips.
  const cx = x + w * 0.65;
  ctx.fillStyle = dead ? '#3b3934' : '#8f8a80';
  ctx.fillRect(cx - w * 0.07, y + h * 0.09, w * 0.14, h * 0.05);
  ctx.fillRect(cx - w * 0.07, y + h * 0.84, w * 0.14, h * 0.05);
  ctx.lineWidth = Math.max(1, w * 0.022);
  ctx.lineCap = 'round';
  for (const [color, off] of [['#c62828', -1], ['#141414', 1]]) {
    ctx.strokeStyle = dead ? '#2a2a2a' : color;
    ctx.beginPath();
    ctx.moveTo(cx + off * w * 0.015, y + h * 0.11);
    ctx.bezierCurveTo(cx + off * w * 0.05, y + h * 0.35, cx - off * w * 0.04, y + h * 0.6, cx + off * w * 0.015, y + h * 0.86);
    ctx.stroke();
  }
  // Driver box in the top corner (black with an orange label).
  ctx.fillStyle = '#121212';
  ctx.fillRect(x + w * 0.27, y + bar * 1.1, w * 0.19, h * 0.1);
  if (!dead && w > 40) {
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(x + w * 0.29, y + bar * 1.1 + h * 0.022, w * 0.14, Math.max(1.5, h * 0.01));
    ctx.fillRect(x + w * 0.29, y + bar * 1.1 + h * 0.048, w * 0.1, Math.max(1.5, h * 0.01));
    ctx.fillRect(x + w * 0.29, y + bar * 1.1 + h * 0.072, w * 0.12, Math.max(1.5, h * 0.01));
  }

  // The silicone coat: a milky, glossy film from the bottom up.
  if (coat > 0) {
    const top = y + h * (1 - coat);
    ctx.fillStyle = 'rgba(214,234,244,0.34)';
    ctx.fillRect(x - 1, top, w + 2, y + h - top + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + w * 0.1, top, Math.max(1, w * 0.03), y + h - top);
  }
  ctx.restore();
}

const VERDICT_COLOR = { GOOD: '#34d399', SHALLOW: '#f87171', THIN: '#fbbf24', BUBBLES: '#fbbf24', THICK: '#fb923c' };

function drawWorkshop(ctx, W, H, s, now) {
  const p = s.cur;
  const ph = Math.min(H * 0.25, W * 0.9);
  const pw = ph / 2;
  const topY = 104;
  const travel = 2 * ph;
  const surface = topY + FL.TOUCH_Y * travel + ph;
  const tubBottom = topY + 3 * ph + 14;
  const tubW = Math.min(W * 0.78, pw * 3.2);
  const tubX = (W - tubW) / 2;
  const px = (W - pw) / 2;
  const py = topY + p.y * travel;

  // Workshop wall and floor.
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#1b1613');
  wall.addColorStop(1, '#0d0b09');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#16120f';
  ctx.fillRect(0, tubBottom + 6, W, H - tubBottom);

  // Rope and hook.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, py - 10);
  ctx.moveTo(px + pw * 0.15, py); ctx.lineTo(W / 2, py - 10); ctx.lineTo(px + pw * 0.85, py);
  ctx.stroke();

  // The tub (back wall), the light, then the silicone in front of it.
  ctx.fillStyle = '#2b3542';
  ctx.fillRect(tubX, surface - 26, tubW, tubBottom - surface + 26);
  const sub = submerged(p.y);
  drawFlatLight(ctx, px, py, pw, ph, { coat: Math.max(p.maxSub, sub) });

  const wave = Math.sin(now * 2) * 1.5;
  ctx.fillStyle = 'rgba(222,236,243,0.62)';
  ctx.fillRect(tubX + 5, surface + wave, tubW - 10, tubBottom - surface - 5 - wave);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(tubX + 5, surface + wave, tubW - 10, 2);
  ctx.strokeStyle = '#55657a';
  ctx.lineWidth = 5;
  ctx.strokeRect(tubX, surface - 26, tubW, tubBottom - surface + 26);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SILIKON', W / 2, tubBottom - 10);

  // Drips while it is being pulled out.
  if (p.maxSub > 0 && py + ph > surface - ph && sub < 1) {
    ctx.fillStyle = 'rgba(222,236,243,0.8)';
    for (let i = 0; i < 3; i += 1) {
      const dy = ((now * (p.tooFast ? 260 : 120) + i * 37) % 60);
      if (py + ph + dy < surface) ctx.fillRect(px + pw * (0.2 + i * 0.3), py + ph + dy, 2, 7);
    }
  }

  // Coat meter beside the tub: how long it has soaked (green = just right).
  const mx = tubX + tubW + 10;
  const mh = ph;
  const my = surface;
  const scale = FL.SOAK_MAX * 1.7;
  if (mx + 12 < W) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(mx, my, 8, mh);
    ctx.fillStyle = 'rgba(52,211,153,0.45)';
    ctx.fillRect(mx, my + mh * (1 - FL.SOAK_MAX / scale), 8, mh * ((FL.SOAK_MAX - FL.SOAK_MIN) / scale));
    const level = Math.min(1, p.soak / scale);
    ctx.fillStyle = p.soak > FL.SOAK_MAX ? '#fb923c' : p.soak >= FL.SOAK_MIN ? '#34d399' : '#e5e7eb';
    ctx.fillRect(mx - 2, my + mh * (1 - level) - 2, 12, 4);
  }

  // What to do right now.
  let hint = 'Stáhni světlo celé pod hladinu';
  let color = 'rgba(255,255,255,0.75)';
  if (p.tooFast) { hint = 'Pomalu! Dělají se bubliny'; color = '#f87171'; }
  else if (sub >= 1 && p.soak < FL.SOAK_MIN) hint = 'Chvíli podrž…';
  else if (sub >= 1 && p.soak <= FL.SOAK_MAX) { hint = 'Teď pomalu vytáhni'; color = '#34d399'; }
  else if (sub >= 1) { hint = 'Už ven, vrstva tloustne!'; color = '#fb923c'; }
  else if (p.maxSub >= 1) hint = 'Pomalu a plynule až nahoru';
  ctx.fillStyle = color;
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(hint, W / 2, Math.min(H - 18, tubBottom + 34));

  // HUD: time and the finished lights.
  const barW = Math.min(W * 0.5, 240);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 30px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`${Math.ceil(s.timeLeft)} s`, W / 2, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect((W - barW) / 2, 50, barW, 6);
  ctx.fillStyle = s.timeLeft < 6 ? '#ef4444' : '#fbbf24';
  ctx.fillRect((W - barW) / 2, 50, barW * (s.timeLeft / FL.DIP_TIME), 6);
  const slot = 16;
  const rowX = W / 2 - (FL.MAX_LIGHTS * (slot + 6) - 6) / 2;
  for (let i = 0; i < FL.MAX_LIGHTS; i += 1) {
    const light = s.lights[i];
    ctx.fillStyle = light ? VERDICT_COLOR[light.verdict] : 'rgba(255,255,255,0.14)';
    ctx.fillRect(rowX + i * (slot + 6), 66, slot, slot * 1.5);
  }
  if (s.lastVerdict && s.verdictAt && now - s.verdictAt < 1.6) {
    ctx.fillStyle = VERDICT_COLOR[s.lastVerdict];
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(VERDICTS[s.lastVerdict], W / 2, surface - 44);
  }
}

function drawCrane(ctx, W, H, s, now, fx) {
  const ground = H * 0.78;
  const footY = ground + (H - ground) * 0.16;
  const actorH = Math.min(H * 0.13, 96);
  const trussY = H * 0.2;
  const pw = FL.SEGMENT * W * 0.8;
  const ph = pw * 2;
  const armX = s.arm * W;
  const n = s.lights.length;
  const rowW = n * FL.SEGMENT * W;

  // Night, ground, tree line.
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, '#04060b');
  sky.addColorStop(1, '#121a2b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, ground);
  ctx.fillStyle = '#090d15';
  ctx.beginPath();
  ctx.moveTo(0, ground);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, ground - 16 - 10 * Math.sin(x * 0.021) - 6 * Math.sin(x * 0.063 + 1));
  ctx.lineTo(W, ground);
  ctx.fill();
  ctx.fillStyle = '#0a0e16';
  ctx.fillRect(0, ground, W, H - ground);

  // The crane: truck at the edge, boom up to the head above the lights.
  const headY = H * 0.12;
  ctx.fillStyle = '#1b2333';
  ctx.fillRect(-6, footY - actorH * 0.55, actorH * 0.9, actorH * 0.4);
  ctx.beginPath(); ctx.arc(actorH * 0.2, footY - actorH * 0.1, actorH * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(actorH * 0.6, footY - actorH * 0.1, actorH * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a3550';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(actorH * 0.35, footY - actorH * 0.5); ctx.lineTo(armX, headY); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(armX, headY); ctx.lineTo(armX - rowW / 2 + 4, trussY);
  ctx.moveTo(armX, headY); ctx.lineTo(armX + rowW / 2 - 4, trussY);
  ctx.stroke();
  ctx.fillStyle = '#39445c';
  ctx.fillRect(armX - rowW / 2 - 4, trussY - 3, rowW + 8, 6);

  // Light cones first, then the actor, then the lights themselves.
  s.lights.forEach((light, i) => {
    if (!isShining(light)) return;
    const [from, to] = segmentOf(s, i);
    const cx = ((from + to) / 2) * W;
    const flicker = light.wet > 0.55 && Math.sin(now * 38 + i * 2) < 0 ? 0.35 : 1;
    const cone = ctx.createLinearGradient(0, trussY + ph, 0, footY);
    cone.addColorStop(0, `rgba(${WARM},${0.3 * flicker})`);
    cone.addColorStop(1, `rgba(${WARM},${0.08 * flicker})`);
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(cx - pw / 2, trussY + 6 + ph);
    ctx.lineTo(cx + pw / 2, trussY + 6 + ph);
    ctx.lineTo(to * W, footY);
    ctx.lineTo(from * W, footY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(${WARM},${0.18 * flicker})`;
    ctx.fillRect(from * W, footY - 3, (to - from) * W, (H - ground) * 0.2);
  });

  const actor = s.actors[0];
  if (actor) drawPerson(ctx, actor.x * W, footY, actorH, s.lit ? '#ffe6b3' : '#8a4b58', { phase: now * (actor.sprint ? 16 : 9), moving: actor.moving });

  s.lights.forEach((light, i) => {
    const [from, to] = segmentOf(s, i);
    const x = ((from + to) / 2) * W - pw / 2;
    const y = trussY + 6;
    const shining = isShining(light);
    const flicker = light.wet > 0.55 && Math.sin(now * 38 + i * 2) < 0 ? 0.4 : 1;
    drawFlatLight(ctx, x, y, pw, ph, { coat: 1, glow: shining ? flicker : 0, dead: !!light.dead });
    if (light.dead) {
      ctx.strokeStyle = light.dead === 'HOT' ? '#fb923c' : '#60a5fa';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + pw - 3, y + ph - 3);
      ctx.moveTo(x + pw - 3, y + 3); ctx.lineTo(x + 3, y + ph - 3);
      ctx.stroke();
      return;
    }
    if (!light.on) {
      ctx.fillStyle = 'rgba(4,6,11,0.55)';
      ctx.fillRect(x - 1, y - 1, pw + 2, ph + 2);
    }
    // Water (blue) and heat (orange) gauges under the light.
    const gy = y + ph + 5;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, gy, pw, 4);
    ctx.fillStyle = light.wet > 0.7 ? '#ef4444' : '#60a5fa';
    ctx.fillRect(x, gy, pw * Math.min(1, light.wet), 4);
    if (light.heat > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, gy + 6, pw, 4);
      ctx.fillStyle = light.temp > 0.7 ? '#ef4444' : '#fb923c';
      ctx.fillRect(x, gy + 6, pw * Math.min(1, light.temp), 4);
    }
  });

  // Rain: more and longer streaks in a heavier shower.
  ctx.strokeStyle = `rgba(190,215,255,${Math.min(0.6, 0.2 + s.rain * 0.3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const drops = Math.min(fx.drops.length, Math.round(fx.drops.length * Math.min(1, s.rain)));
  for (let i = 0; i < drops; i += 1) {
    const d = fx.drops[i];
    const y = ((d.y + now * d.v) % 1) * H;
    ctx.moveTo(d.x * W, y);
    ctx.lineTo(d.x * W - 3, y + 10 + s.rain * 8);
  }
  ctx.stroke();

  const dark = darkRatio(s);
  if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${0.5 * dark})`; ctx.fillRect(0, 0, W, H); }

  // HUD.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = s.lit ? '#ffffff' : '#fca5a5';
  ctx.font = '700 40px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(s.score.toFixed(1).replace('.', ','), W / 2, 46);
  const barW = Math.min(W * 0.5, 240);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect((W - barW) / 2, 58, barW, 6);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect((W - barW) / 2, 58, barW * dark, 6);
  ctx.font = '600 13px system-ui, sans-serif';
  if (!s.lit && s.grace <= 0) {
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('herec je ve tmě', W / 2, 82);
  } else if (s.t < 7) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Táhni rameno. Ťuknutím světlo vypneš, ať vyschne.', W / 2, H * 0.52);
  }
}

// ── The game ─────────────────────────────────────────────────────────
/**
 * @param scores    records of `flatScores`
 * @param bonus     attendance is filled in → one well-made spare light on the crane
 * @param onSubmit  (seconds) => { weekBest, allBest }
 */
export const FlatLightGame = ({ scores, me, today, bonus, onSubmit, onClose, onLogAttendance }) => {
  const [phase, setPhase] = useState('ready'); // ready | dip | dipped | crane | over
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  if (!gameRef.current) gameRef.current = createGame(1);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const keys = useRef({ left: false, right: false, up: false, down: false });
  const pointer = useRef(null);
  const week = weekId(today);

  useBackLayer(true, onClose);

  const handlers = useRef({});
  handlers.current.dipped = () => {
    const s = gameRef.current;
    const good = s.lights.filter((l) => l.verdict === 'GOOD').length;
    setSummary({ total: s.lights.length, good });
    buzz(40);
    setPhase('dipped');
  };
  handlers.current.over = () => {
    const s = gameRef.current;
    const saved = onSubmit(s.score) || {};
    buzz([80, 60, 80]);
    setResult({ score: s.score, weekBest: !!saved.weekBest, allBest: !!saved.allBest });
    setPhase('over');
  };

  const start = () => {
    gameRef.current = createGame(Math.floor(Math.random() * 2147483647));
    setResult(null); setSummary(null);
    setPhase('dip');
  };
  const toCrane = () => { startCrane(gameRef.current, { spare: bonus }); setPhase('crane'); };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const fx = { drops: Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), v: 0.9 + Math.random() * 0.6 })) };
    let frame = 0;
    let last = performance.now();
    let wasLit = true;
    let wasFast = false;

    const tick = (time) => {
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      const now = time / 1000;
      const s = gameRef.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }

      if (phaseRef.current === 'dip') {
        const dir = (keys.current.down ? 1 : 0) - (keys.current.up ? 1 : 0);
        if (dir) dipMove(s, dir * (dir > 0 ? 1.6 : 0.5) * dt);
        const count = s.lights.length;
        stepDip(s, dt);
        if (s.lights.length !== count) { s.verdictAt = now; buzz(s.lastVerdict === 'GOOD' ? 20 : [40, 40, 40]); }
        if (s.cur.tooFast && !wasFast) buzz(10);
        wasFast = s.cur.tooFast;
        if (s.phase === 'dipped') handlers.current.dipped();
      } else if (phaseRef.current === 'crane') {
        const dir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
        if (dir) moveArm(s, dir * 0.7 * dt);
        stepCrane(s, dt);
        if (wasLit && !s.lit) buzz(12);
        wasLit = s.lit;
        if (s.over) handlers.current.over();
      }

      if (W && H) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.textBaseline = 'alphabetic';
        if (s.phase === 'crane' || s.phase === 'over') drawCrane(ctx, W, H, s, now, fx);
        else drawWorkshop(ctx, W, H, s, now);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const map = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
    const set = (down) => (e) => {
      if (map[e.key]) { keys.current[map[e.key]] = down; e.preventDefault(); }
      else if (down && e.key === 'Escape') onClose();
      else if (down && /^[1-9]$/.test(e.key) && phaseRef.current === 'crane') toggleLight(gameRef.current, Number(e.key) - 1);
    };
    const down = set(true);
    const up = set(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const onPointerDown = (e) => {
    pointer.current = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, at: performance.now(), dragged: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const p = pointer.current;
    if (!p) return;
    const s = gameRef.current;
    const canvas = e.currentTarget;
    if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 8) p.dragged = true;
    if (phaseRef.current === 'dip') {
      const travel = 2 * Math.min(canvas.clientHeight * 0.25, canvas.clientWidth * 0.9);
      dipMove(s, (e.clientY - p.y) / travel);
    } else if (phaseRef.current === 'crane' && p.dragged) {
      moveArm(s, ((e.clientX - p.x) / canvas.clientWidth) * 1.1);
    }
    p.x = e.clientX; p.y = e.clientY;
  };
  const onPointerUp = (e) => {
    const p = pointer.current;
    pointer.current = null;
    if (!p || p.dragged || phaseRef.current !== 'crane' || performance.now() - p.at > 400) return;
    // A tap: switch the light in that column off / on.
    const s = gameRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const i = s.lights.findIndex((_, k) => { const [from, to] = segmentOf(s, k); return x >= from && x <= to; });
    if (i >= 0 && toggleLight(s, i)) buzz(15);
  };

  const primaryBtn = 'h-14 rounded-2xl bg-amber-400 text-black text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98]';
  const panelOpen = phase === 'ready' || phase === 'dipped' || phase === 'over';
  const lightsWord = (n) => (n === 1 ? 'světlo' : n >= 2 && n <= 4 ? 'světla' : 'světel');

  return (
    <div role="dialog" aria-modal="true" aria-label="Hra Silikonová lázeň" className="fixed inset-0 z-[70] bg-black flex justify-center pt-safe-top select-none">
      <div className="relative w-full max-w-[720px] h-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { pointer.current = null; }}
        />
        <button onClick={onClose} aria-label="Zavřít hru" className="absolute top-2 left-2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90">
          <X className="w-5 h-5" />
        </button>

        {panelOpen && (
          <div className="absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto overscroll-contain p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-fade-in">
            <div className="mx-auto max-w-md rounded-3xl bg-slate-900/90 backdrop-blur border border-white/15 p-4 flex flex-col gap-3 text-white">
              {phase === 'ready' && (
                <>
                  <div>
                    <h2 className="text-xl font-bold">Silikonová lázeň</h2>
                    <p className="text-sm text-white/75 mt-1">
                      Flat lighty jsou do interiéru, ale na Hanyši bude pršet. V dílně je namoč do silikonu:
                      stáhni světlo celé pod hladinu, chvíli podrž a pomalu vytáhni. Máš {FL.DIP_TIME} vteřin a nejvýš {FL.MAX_LIGHTS} světel.
                    </p>
                  </div>
                  <button onClick={start} className={primaryBtn}><Droplets className="w-5 h-5" /> Do dílny</button>
                </>
              )}
              {phase === 'dipped' && summary && (
                <>
                  <div>
                    <h2 className="text-xl font-bold">
                      {summary.total ? `Z dílny ${summary.total >= 2 && summary.total <= 4 ? 'jdou' : 'jde'} ${summary.total} ${lightsWord(summary.total)}` : 'Z dílny nejde nic'}
                    </h2>
                    <p className="text-sm text-white/75 mt-1">
                      {summary.total > 0 && `Bez vady ${summary.good}, s vadou ${summary.total - summary.good}. `}
                      {bonus && 'Za docházku bereš z police jedno poctivě namočené navíc. '}
                      {summary.total + (bonus ? 1 : 0) > 0
                        ? 'Na place táhni rameno jeřábu, ať herec zůstane pod světlem. Ťuknutím světlo vypneš, aby vyschlo nebo vychladlo.'
                        : 'Bez světel se točit nedá.'}
                    </p>
                  </div>
                  {summary.total + (bonus ? 1 : 0) > 0
                    ? <button onClick={toCrane} className={primaryBtn}>Na plac <ArrowRight className="w-5 h-5" /></button>
                    : <button onClick={start} className={primaryBtn}><RotateCcw className="w-5 h-5" /> Zpátky do dílny</button>}
                </>
              )}
              {phase === 'over' && result && (
                <>
                  <div className="flex items-center gap-3">
                    <Clapperboard className="w-9 h-9 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold">Stop!</h2>
                      <p className="text-sm text-white/75">Herec byl ve světle <strong className="font-mono text-white">{fmtScore(result.score)}</strong></p>
                    </div>
                  </div>
                  {(result.allBest || result.weekBest) && (
                    <p className="flex items-center gap-2 rounded-xl bg-amber-400/20 text-amber-200 px-3 py-2 text-sm font-semibold">
                      <Trophy className="w-4 h-4 shrink-0" /> {result.allBest ? 'Tvůj nový osobní rekord!' : 'Tvůj nejlepší výsledek tohoto týdne!'}
                    </p>
                  )}
                  <button onClick={start} className={primaryBtn}><Play className="w-5 h-5 fill-current" /> Znovu do dílny</button>
                </>
              )}

              {phase !== 'dipped' && (bonus ? (
                phase === 'ready' && (
                  <p className="flex items-center gap-2 text-sm text-emerald-300">
                    <CalendarCheck className="w-4 h-4 shrink-0" /> Docházku máš zapsanou: na jeřáb dostaneš jedno záložní světlo navíc.
                  </p>
                )
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2">
                  <p className="flex-1 text-sm text-white/75">Zapiš si dnešní docházku a dostaneš na jeřáb záložní světlo navíc.</p>
                  {onLogAttendance && (
                    <button onClick={onLogAttendance} className="h-10 px-3 rounded-lg bg-white/15 text-sm font-semibold shrink-0 active:scale-95">Zapsat</button>
                  )}
                </div>
              ))}

              {phase !== 'dipped' && <Leaderboard scores={scores} week={week} myId={me?.id} fmt={fmtScore} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlatLightGame;
