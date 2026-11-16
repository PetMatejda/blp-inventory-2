// „Udrž balón“ — the full-screen game for waiting on set (opened from Osobní).
// Rules and numbers: src/domain/balloonGame.js, leaderboard: src/domain/gameScores.js.
// Always a night scene (independent of the app theme), no sound, only short vibrations.
import React, { useEffect, useRef, useState } from 'react';
import { X, Play, RotateCcw, Trophy, Clapperboard, CalendarCheck } from 'lucide-react';
import { useBackLayer } from '../../hooks/useBackLayer';
import {
  CFG, createGame, step, moveAnchor, continueGame, radiusOf, darkRatio, gustWarning,
} from '../../domain/balloonGame';
import { weekId, fmtScore } from '../../domain/gameScores';
import { Leaderboard } from './Leaderboard';
import { drawPerson } from './draw';

const WARM = '255,234,170';
const buzz = (pattern) => { if (navigator.vibrate) navigator.vibrate(pattern); };

// ── Drawing ──────────────────────────────────────────────────────────
function drawScene(ctx, W, H, s, now, fx) {
  const ground = H * 0.78;
  const footY = ground + (H - ground) * 0.16;
  const bx = s.balloon * W;
  const by = H * 0.27 + Math.sin(now * 1.3) * 4;
  const R = radiusOf(s) * W;
  const rx = Math.min(W * 0.11, 70);
  const ry = rx * 0.66;
  const actorH = Math.min(H * 0.13, 96);

  // Night sky, stars, tree line, ground.
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, '#05070d');
  sky.addColorStop(1, '#141c30');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, ground);
  ctx.fillStyle = '#ffffff';
  for (const st of fx.stars) {
    ctx.globalAlpha = 0.2 + 0.4 * Math.abs(Math.sin(now * st.tw + st.p));
    ctx.fillRect(st.x * W, st.y * ground * 0.75, st.r, st.r);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0a0e17';
  ctx.beginPath();
  ctx.moveTo(0, ground);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, ground - 16 - 10 * Math.sin(x * 0.021) - 6 * Math.sin(x * 0.063 + 1));
  ctx.lineTo(W, ground);
  ctx.fill();
  ctx.fillStyle = '#0b0f18';
  ctx.fillRect(0, ground, W, H - ground);

  // The set: a camera on a tripod and a flag on a stand (silhouettes).
  ctx.strokeStyle = '#1c2436';
  ctx.fillStyle = '#1c2436';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const cam = W * 0.93;
  ctx.beginPath();
  ctx.moveTo(cam, footY - actorH * 0.8); ctx.lineTo(cam - actorH * 0.22, footY);
  ctx.moveTo(cam, footY - actorH * 0.8); ctx.lineTo(cam + actorH * 0.22, footY);
  ctx.moveTo(cam, footY - actorH * 0.8); ctx.lineTo(cam, footY);
  ctx.stroke();
  ctx.fillRect(cam - actorH * 0.3, footY - actorH * 1.02, actorH * 0.42, actorH * 0.24);
  ctx.fillRect(cam - actorH * 0.42, footY - actorH * 0.97, actorH * 0.14, actorH * 0.14);
  const stand = W * 0.06;
  ctx.beginPath();
  ctx.moveTo(stand, footY); ctx.lineTo(stand, footY - actorH * 1.5);
  ctx.moveTo(stand - actorH * 0.2, footY); ctx.lineTo(stand, footY - actorH * 0.3); ctx.lineTo(stand + actorH * 0.2, footY);
  ctx.stroke();
  ctx.fillRect(stand - actorH * 0.05, footY - actorH * 1.55, actorH * 0.5, actorH * 0.36);

  // Light: the cone and its pool on the ground.
  const cone = ctx.createLinearGradient(0, by, 0, footY);
  cone.addColorStop(0, `rgba(${WARM},0.32)`);
  cone.addColorStop(1, `rgba(${WARM},0.07)`);
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(bx - rx * 0.6, by + ry * 0.5);
  ctx.lineTo(bx + rx * 0.6, by + ry * 0.5);
  ctx.lineTo(bx + R, footY);
  ctx.lineTo(bx - R, footY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(${WARM},0.2)`;
  ctx.beginPath();
  ctx.ellipse(bx, footY, R, (H - ground) * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wind streaks (stronger wind = more visible).
  const windAlpha = Math.min(0.55, Math.abs(s.wind) * 3);
  if (windAlpha > 0.05) {
    ctx.strokeStyle = `rgba(200,220,255,${windAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const st of fx.streaks) {
      const x = st.x * W;
      const y = st.y * ground * 0.85 + 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.sign(s.wind) * st.len * W, y);
    }
    ctx.stroke();
  }

  // The grip holding the rope, and the rope.
  const ax = s.anchor * W;
  const gripH = actorH * 0.8;
  drawPerson(ctx, ax, footY, gripH, '#2b3449', { armUp: true });
  const handX = ax + gripH * 0.1;
  const handY = footY - gripH * 0.94;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.quadraticCurveTo((handX + bx) / 2 + s.wind * W * 0.35, (handY + by) / 2 + 24, bx, by + ry);
  ctx.stroke();

  // Actors: warm when lit, dark otherwise.
  s.actors.forEach((a, i) => {
    const lit = Math.abs(a.x - s.balloon) <= radiusOf(s);
    const color = lit ? (i ? '#ffd3b5' : '#ffe6b3') : '#8a4b58'; // out of the light = dull red, easy to tell from the grip
    drawPerson(ctx, a.x * W, footY, actorH * (i ? 0.93 : 1), color, { phase: now * (a.sprint ? 16 : 9) + i, moving: a.moving });
  });

  // The balloon.
  ctx.save();
  ctx.shadowColor = `rgba(${WARM},0.9)`;
  ctx.shadowBlur = 45;
  const glow = ctx.createRadialGradient(bx, by - ry * 0.2, ry * 0.1, bx, by, rx);
  glow.addColorStop(0, '#ffffff');
  glow.addColorStop(0.7, '#fff1c9');
  glow.addColorStop(1, '#f4d58a');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c9b074';
  ctx.fillRect(bx - 4, by + ry - 1, 8, 6);

  // The scene gets darker as the director loses patience.
  const dark = darkRatio(s);
  if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${0.5 * dark})`; ctx.fillRect(0, 0, W, H); }

  // Gust warning on the side the wind will come from.
  const warn = gustWarning(s);
  if (warn && Math.sin(now * 18) > -0.3) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = warn > 0 ? 'left' : 'right';
    ctx.fillText(warn > 0 ? '››› poryv' : 'poryv ‹‹‹', warn > 0 ? 12 : W - 12, H * 0.27);
  }

  // HUD: score and the darkness meter.
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
  if (!s.lit) {
    ctx.fillStyle = '#fca5a5';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('herec je ve tmě', W / 2, 82);
  }
  if (s.actors.length === 2 && s.t - CFG.SECOND_ACTOR_AT < 2.5) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('Druhý herec na place!', W / 2, H * 0.5);
  }
}

// ── The game ─────────────────────────────────────────────────────────
/**
 * @param scores    records of `gameScores`
 * @param me        { id } of the signed-in person
 * @param today     YYYY-MM-DD
 * @param bonus     attendance is filled in → one continue after „Stop!“
 * @param onSubmit  (seconds, { countPlay }) => { weekBest, allBest }
 * @param onLogAttendance  optional: leave the game to fill in attendance
 */
export const BalloonGame = ({ scores, me, today, bonus, onSubmit, onClose, onLogAttendance }) => {
  const [phase, setPhase] = useState('ready'); // ready | playing | over
  const [result, setResult] = useState(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  if (!gameRef.current) gameRef.current = createGame(1);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const keys = useRef({ left: false, right: false });
  const lastX = useRef(null);
  const week = weekId(today);

  useBackLayer(true, onClose);

  const finish = () => {
    const s = gameRef.current;
    const saved = onSubmit(s.score, { countPlay: !s.continued }) || {};
    buzz([80, 60, 80]);
    setResult({ score: s.score, weekBest: !!saved.weekBest, allBest: !!saved.allBest, canContinue: bonus && !s.continued });
    setPhase('over');
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const start = () => {
    gameRef.current = createGame(Math.floor(Math.random() * 2147483647));
    setResult(null);
    setPhase('playing');
  };
  const secondTake = () => { if (continueGame(gameRef.current)) setPhase('playing'); };

  // Render loop: draws all the time, the game only moves while playing.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const fx = {
      stars: Array.from({ length: 45 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() < 0.2 ? 2 : 1, tw: 0.4 + Math.random(), p: Math.random() * 6 })),
      streaks: Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), len: 0.03 + Math.random() * 0.05 })),
    };
    let frame = 0;
    let last = performance.now();
    let wasLit = true;

    const tick = (time) => {
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      const s = gameRef.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }

      if (phaseRef.current === 'playing') {
        const dir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
        if (dir) moveAnchor(s, dir * 0.7 * dt);
        step(s, dt);
        if (wasLit && !s.lit) buzz(12);
        wasLit = s.lit;
        if (s.over) finishRef.current();
      }
      for (const st of fx.streaks) st.x = (st.x + s.wind * 4 * dt + 1) % 1;

      if (W && H) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawScene(ctx, W, H, s, time / 1000, fx);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Keyboard (desktop) and no page scroll behind the game.
  useEffect(() => {
    const set = (down) => (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = down;
      else if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = down;
      else if (down && e.key === 'Escape') onClose();
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

  const onPointerDown = (e) => { lastX.current = e.clientX; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onPointerMove = (e) => {
    if (lastX.current == null || phaseRef.current !== 'playing') return;
    moveAnchor(gameRef.current, ((e.clientX - lastX.current) / e.currentTarget.clientWidth) * 1.15);
    lastX.current = e.clientX;
  };
  const onPointerUp = () => { lastX.current = null; };

  const primaryBtn = 'h-14 rounded-2xl bg-amber-400 text-black text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98]';
  const secondaryBtn = 'h-12 rounded-xl border border-white/25 text-white text-base font-semibold flex items-center justify-center gap-2 active:scale-[0.98]';

  return (
    <div role="dialog" aria-modal="true" aria-label="Hra Udrž balón" className="fixed inset-0 z-[70] bg-black flex justify-center pt-safe-top select-none">
      <div className="relative w-full max-w-[720px] h-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        />
        <button onClick={onClose} aria-label="Zavřít hru" className="absolute top-2 left-2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90">
          <X className="w-5 h-5" />
        </button>

        {phase !== 'playing' && (
          <div className="absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto overscroll-contain p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-fade-in">
            <div className="mx-auto max-w-md rounded-3xl bg-slate-900/90 backdrop-blur border border-white/15 p-4 flex flex-col gap-3 text-white">
              {phase === 'ready' ? (
                <>
                  <div>
                    <h2 className="text-xl font-bold">Udrž balón</h2>
                    <p className="text-sm text-white/75 mt-1">
                      Táhni prstem doleva a doprava a drž světlo na herci. Fouká, tak lano přidržuj proti větru. Když je herec moc dlouho ve tmě, režisér zavelí Stop.
                    </p>
                  </div>
                  <button onClick={start} className={primaryBtn}><Play className="w-5 h-5 fill-current" /> Hrát</button>
                </>
              ) : (
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
                  {result.canContinue && (
                    <button onClick={secondTake} className={primaryBtn}><Clapperboard className="w-5 h-5" /> Život navíc (pokračovat)</button>
                  )}
                  <button onClick={start} className={result.canContinue ? secondaryBtn : primaryBtn}><RotateCcw className="w-5 h-5" /> Hrát znovu</button>
                </>
              )}

              {bonus ? (
                phase === 'ready' && (
                  <p className="flex items-center gap-2 text-sm text-emerald-300">
                    <CalendarCheck className="w-4 h-4 shrink-0" /> Docházku máš zapsanou: v každé hře máš život navíc.
                  </p>
                )
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2">
                  <p className="flex-1 text-sm text-white/75">Zapiš si dnešní docházku a dostaneš do každé hry život navíc.</p>
                  {onLogAttendance && (
                    <button onClick={onLogAttendance} className="h-10 px-3 rounded-lg bg-white/15 text-sm font-semibold shrink-0 active:scale-95">Zapsat</button>
                  )}
                </div>
              )}

              <Leaderboard scores={scores} week={week} myId={me?.id} fmt={fmtScore} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BalloonGame;
