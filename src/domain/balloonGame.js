// „Udrž balón“ — the simulation of the waiting-on-set game (pure, no DOM).
//
// The crew holds a lighting balloon on a rope (`anchor`). Wind pushes the balloon
// away from the anchor; the light falls straight down from the balloon. The actors
// walk around the set and the player moves the anchor so that all of them stay in
// the light. Score = seconds with everyone lit. Too long in the dark = „Stop!“.
//
// All positions are 0..1 of the playfield width, time is in seconds.

export const CFG = {
  RADIUS_START: 0.15, // half-width of the light on the ground
  RADIUS_MIN: 0.1,
  DARK_LIMIT_START: 2.4, // seconds of darkness the director tolerates
  DARK_LIMIT_MIN: 1.3,
  RECOVER: 0.6, // how fast the darkness meter drains while everyone is lit
  SECOND_ACTOR_AT: 40,
  LEVEL_SECONDS: 12,
  GRACE: 1.5, // no darkness is counted right after the start / a continue
  SPRING: 16,
  DAMPING: 5,
  GUST_WARNING: 0.8,
};

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Seeded random numbers (mulberry32) kept in the state, so a run can be replayed in tests.
export const rand = (s) => {
  s.seed = (s.seed + 0x6D2B79F5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const between = (s, lo, hi) => lo + rand(s) * (hi - lo);

export const levelOf = (s) => s.t / CFG.LEVEL_SECONDS;
export const radiusOf = (s) => Math.max(CFG.RADIUS_MIN, CFG.RADIUS_START - levelOf(s) * 0.004);
export const darkLimitOf = (s) => Math.max(CFG.DARK_LIMIT_MIN, CFG.DARK_LIMIT_START - levelOf(s) * 0.08);
export const darkRatio = (s) => clamp(s.dark / darkLimitOf(s), 0, 1);

/** -1 / 1 while a gust is about to come from that side, otherwise 0. */
export const gustWarning = (s) => {
  const wait = s.gust.start - s.t;
  return wait > 0 && wait < CFG.GUST_WARNING ? Math.sign(s.gust.force) : 0;
};

export const newActor = (x) => ({ x, target: x, pause: 1, speed: 0, sprint: false, dir: 1, moving: false });

const scheduleGust = (s) => {
  const level = levelOf(s);
  const start = s.t + between(s, 2.5, 5) / (1 + level * 0.08);
  const force = Math.min(0.3, between(s, 0.08, 0.14) * (1 + level * 0.12)) * (rand(s) < 0.5 ? -1 : 1);
  s.gust = { start, end: start + between(s, 1.2, 2.4), force };
};

export function createGame(seed = 1) {
  const s = {
    seed: seed | 0, t: 0, score: 0, dark: 0, over: false, continued: false, grace: CFG.GRACE,
    anchor: 0.5, balloon: 0.5, vel: 0, wind: 0, phase: 0,
    gust: { start: 0, end: 0, force: 0 },
    actors: [newActor(0.5)], lit: true,
  };
  s.phase = between(s, 0, Math.PI * 2);
  scheduleGust(s);
  return s;
}

/** The player's input: move the hand holding the rope by dx (of the playfield width). */
export function moveAnchor(s, dx) {
  s.anchor = clamp(s.anchor + dx, 0.06, 0.94);
}

const windAt = (s) => {
  const level = levelOf(s);
  const base = (0.03 + Math.min(0.06, level * 0.006)) * Math.sin(s.t * 0.7 + s.phase);
  const { start, end, force } = s.gust;
  const ramp = 0.35;
  const gust = s.t <= start || s.t >= end ? 0 : force * Math.min(1, (s.t - start) / ramp, (end - s.t) / ramp);
  return base + gust;
};

const pickTarget = (s, actor, lead) => {
  const level = levelOf(s);
  if (lead) {
    // The second actor plays the scene with the first one: never further than the light can cover.
    actor.target = clamp(lead.target + between(s, -1, 1) * 0.9 * radiusOf(s), 0.08, 0.92);
  } else {
    let x = between(s, 0.12, 0.88);
    if (Math.abs(x - actor.x) < 0.12) x = actor.x < 0.5 ? x + 0.25 : x - 0.25;
    actor.target = clamp(x, 0.12, 0.88);
  }
  actor.sprint = !lead && rand(s) < Math.min(0.45, 0.12 + level * 0.03); // only the lead dashes across the set
  actor.speed = Math.min(0.24, 0.07 + level * 0.012) * (actor.sprint ? 2 : 1);
};

export const stepActor = (s, actor, lead, dt) => {
  if (actor.pause > 0) {
    actor.pause -= dt;
    actor.moving = false;
    if (actor.pause <= 0) pickTarget(s, actor, lead);
    return;
  }
  const gap = actor.target - actor.x;
  const move = actor.speed * dt;
  actor.moving = true;
  if (Math.abs(gap) <= move) {
    actor.x = actor.target;
    actor.pause = between(s, 0.3, 1.6) / (1 + levelOf(s) * 0.1);
  } else {
    actor.dir = Math.sign(gap);
    actor.x += actor.dir * move;
  }
};

/** Advance the game by dt seconds (mutates and returns the state). */
export function step(s, dt) {
  if (s.over) return s;
  dt = clamp(dt, 0, 0.05);
  s.t += dt;

  if (s.t > s.gust.end) scheduleGust(s);
  s.wind = windAt(s);

  // The balloon hangs on the rope like a damped spring pulled aside by the wind.
  const acc = CFG.SPRING * (s.anchor + s.wind - s.balloon) - CFG.DAMPING * s.vel;
  s.vel += acc * dt;
  s.balloon += s.vel * dt;
  if (s.balloon < 0.04 || s.balloon > 0.96) { s.balloon = clamp(s.balloon, 0.04, 0.96); s.vel = 0; }

  if (s.actors.length === 1 && s.t >= CFG.SECOND_ACTOR_AT) s.actors.push(newActor(s.actors[0].x));
  const [lead, second] = s.actors;
  stepActor(s, lead, null, dt);
  if (second) {
    stepActor(s, second, lead, dt);
    const reach = 1.2 * radiusOf(s);
    second.x = clamp(second.x, lead.x - reach, lead.x + reach);
  }

  const radius = radiusOf(s);
  s.lit = s.actors.every((a) => Math.abs(a.x - s.balloon) <= radius);
  if (s.grace > 0) s.grace -= dt;
  if (s.lit) {
    s.score += dt;
    s.dark = Math.max(0, s.dark - dt * CFG.RECOVER);
  } else if (s.grace <= 0) {
    s.dark += dt;
    if (s.dark >= darkLimitOf(s)) s.over = true;
  }
  return s;
}

/** The bonus second take: carry on once after „Stop!“. Returns false when it is not possible. */
export function continueGame(s) {
  if (!s.over || s.continued) return false;
  s.over = false;
  s.continued = true;
  s.dark = 0;
  s.grace = 2;
  return true;
}
