// „Silikonová lázeň“ — the game about making indoor flat lights rain-proof (pure, no DOM).
//
// Phase 1, the workshop (`dip`): flat lights are dipped into a silicone bath one by one.
//   The player drags the light down and up. A good coat = the whole light under the
//   surface, soaked long enough but not too long, and pulled out slowly (no bubbles).
// Phase 2, the night on the Hanyš crane (`crane`): the lights hang in a row on the crane
//   arm and it rains. The player moves the arm so the actor stays under a working light
//   and switches single lights off for a while so they dry out / cool down:
//   a leaky coat lets water in (short circuit), a thick coat overheats.
// Score = seconds the actor was lit. Positions are 0..1 of the screen, time in seconds.
import { clamp, between, newActor, stepActor, darkLimitOf } from './balloonGame.js';

export const FL = {
  DIP_TIME: 25,
  MAX_LIGHTS: 6,
  // The light's travel `y`: 0 = hanging above the bath, 1 = on the bottom.
  TOUCH_Y: 0.35, // the lower edge reaches the surface
  UNDER_Y: 0.85, // the whole light is under the surface
  SOAK_MIN: 0.5, // seconds fully under for a full coat
  SOAK_MAX: 1.5, // more than this = too thick
  PULL_LIMIT: 0.65, // travel per second; pulling out faster leaves bubbles
  SEGMENT: 0.085, // width of the ground lit by one light
  DRY: 0.14,
  COOL: 0.16,
  GRACE: 2,
};

export const VERDICTS = {
  GOOD: 'Dobrá práce',
  SHALLOW: 'Nedomočené',
  THIN: 'Tenká vrstva',
  BUBBLES: 'Bubliny',
  THICK: 'Moc tlustá vrstva',
};

const newPanel = () => ({ y: 0, maxSub: 0, soak: 0, pull: 0, fast: 0, moved: 0, speed: 0, tooFast: false });

/** How much of the light is under the surface (0..1). */
export const submerged = (y) => clamp((y - FL.TOUCH_Y) / (FL.UNDER_Y - FL.TOUCH_Y), 0, 1);

/** The finished coat: leak and heat are 0 (perfect) .. 1 (hopeless). */
export function gradePanel(p) {
  const shallow = 1 - p.maxSub;
  const thin = clamp((FL.SOAK_MIN - p.soak) / FL.SOAK_MIN, 0, 1);
  const bubbles = p.pull > 0 ? p.fast / p.pull : 0;
  const leak = clamp(Math.max(shallow, thin) * 0.7 + bubbles * 0.6, 0, 1);
  const heat = clamp((p.soak - FL.SOAK_MAX) / FL.SOAK_MAX, 0, 1);
  const verdict = shallow > 0.05 ? 'SHALLOW' : thin > 0.2 ? 'THIN' : bubbles > 0.25 ? 'BUBBLES' : heat > 0.15 ? 'THICK' : 'GOOD';
  return { leak, heat, verdict };
}

export function createGame(seed = 1) {
  return {
    seed: seed | 0, phase: 'dip',
    timeLeft: FL.DIP_TIME, cur: newPanel(), lights: [], lastVerdict: null,
    // crane phase (filled by startCrane)
    t: 0, score: 0, dark: 0, over: false, grace: FL.GRACE, lit: true,
    hand: 0.5, arm: 0.5, rain: 0, rainPhase: 0, actors: [],
  };
}

// ── Phase 1: the workshop ────────────────────────────────────────────
/** The player's drag: move the hanging light by dy of its travel (down = positive). */
export function dipMove(s, dy) {
  if (s.phase !== 'dip') return;
  const p = s.cur;
  const before = p.y;
  p.y = clamp(p.y + dy, 0, 1);
  const up = before - p.y;
  // Pulling out through the surface: remember how far and how much of it was too fast.
  if (up > 0 && before > FL.TOUCH_Y && p.maxSub > 0) {
    const through = Math.min(before, FL.UNDER_Y) - Math.max(p.y, FL.TOUCH_Y);
    if (through > 0) { p.pull += through; p.moved += through; }
  }
}

export function stepDip(s, dt) {
  if (s.phase !== 'dip') return s;
  dt = clamp(dt, 0, 0.05);
  const p = s.cur;
  const sub = submerged(p.y);
  p.maxSub = Math.max(p.maxSub, sub);
  if (sub >= 1) {
    p.soak += dt;
    // Back under completely: the earlier pull no longer matters, bubbles close again.
    p.pull = 0; p.fast = 0;
  }
  // Speed of the pull, smoothed over a few frames (touch events come unevenly).
  if (dt > 0) p.speed = p.speed * 0.6 + (p.moved / dt) * 0.4;
  p.tooFast = p.speed > FL.PULL_LIMIT;
  if (p.tooFast) p.fast += p.moved;
  p.moved = 0;

  if (p.y <= 0.02 && p.maxSub > 0) {
    const graded = gradePanel(p);
    s.lights.push(graded);
    s.lastVerdict = graded.verdict;
    s.cur = newPanel();
    if (s.lights.length >= FL.MAX_LIGHTS) { s.phase = 'dipped'; return s; }
  }
  s.timeLeft -= dt;
  if (s.timeLeft <= 0) { s.timeLeft = 0; s.phase = 'dipped'; }
  return s;
}

// ── Phase 2: the night on the crane ──────────────────────────────────
/** Hang the lights on the crane. `spare` = one well-made light from the workshop shelf (attendance bonus). */
export function startCrane(s, { spare = false } = {}) {
  const coats = spare ? [...s.lights, { leak: 0, heat: 0, verdict: 'GOOD', spare: true }] : s.lights;
  s.lights = coats.map((l) => ({ ...l, wet: 0, temp: 0, on: true, dead: null }));
  s.phase = 'crane';
  s.t = 0; s.score = 0; s.dark = 0; s.over = false; s.grace = FL.GRACE; s.lit = true;
  s.hand = 0.5; s.arm = 0.5;
  s.rainPhase = between(s, 0, Math.PI * 2);
  s.actors = [newActor(0.5)];
  return s;
}

export const levelOf = (s) => s.t / 12;

/** The strip of ground under light `i`: [from, to]. */
export function segmentOf(s, i) {
  const left = s.arm - (s.lights.length * FL.SEGMENT) / 2 + i * FL.SEGMENT;
  return [left, left + FL.SEGMENT];
}

export const isShining = (light) => light.on && !light.dead;

export function moveArm(s, dx) {
  s.hand = clamp(s.hand + dx, 0.08, 0.92);
}

/** Switch one light off (it dries and cools) or back on. */
export function toggleLight(s, i) {
  const light = s.lights[i];
  if (!light || light.dead || s.phase !== 'crane') return false;
  light.on = !light.on;
  return true;
}

export function stepCrane(s, dt) {
  if (s.phase !== 'crane' || s.over) return s;
  dt = clamp(dt, 0, 0.05);
  s.t += dt;
  const level = levelOf(s);

  // Showers come and go and slowly get heavier.
  s.rain = clamp(0.4 + 0.35 * Math.sin(s.t * 0.3 + s.rainPhase) + level * 0.06, 0.15, 1.6);
  // The heavy arm follows the hand with a delay and sways a little in the wind.
  const sway = Math.min(0.05, 0.01 + level * 0.004) * Math.sin(s.t * 0.9 + s.rainPhase * 2);
  s.arm += (s.hand + sway - s.arm) * Math.min(1, 4 * dt);

  for (const light of s.lights) {
    if (light.dead) continue;
    if (light.on) {
      light.wet += s.rain * (0.007 * level + light.leak * 0.22) * dt;
      light.temp += light.heat * 0.14 * dt;
    } else {
      light.wet = Math.max(0, light.wet - FL.DRY * dt);
      light.temp = Math.max(0, light.temp - FL.COOL * dt);
    }
    if (light.wet >= 1) { light.dead = 'WET'; light.on = false; }
    else if (light.temp >= 1) { light.dead = 'HOT'; light.on = false; }
  }

  const actor = s.actors[0];
  stepActor(s, actor, null, dt);
  s.lit = s.lights.some((light, i) => {
    if (!isShining(light)) return false;
    const [from, to] = segmentOf(s, i);
    return actor.x >= from && actor.x <= to;
  });

  if (s.grace > 0) s.grace -= dt;
  if (s.lit) {
    s.score += dt;
    s.dark = Math.max(0, s.dark - dt * 0.6);
  } else if (s.grace <= 0) {
    s.dark += dt;
    if (s.dark >= darkLimitOf(s)) { s.over = true; s.phase = 'over'; }
  }
  return s;
}

export const darkRatio = (s) => clamp(s.dark / darkLimitOf(s), 0, 1);
export const aliveCount = (s) => s.lights.filter((l) => !l.dead).length;
