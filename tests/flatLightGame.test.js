import { describe, it, expect } from 'vitest';
import {
  FL, createGame, dipMove, stepDip, gradePanel, submerged, startCrane, stepCrane, moveArm, toggleLight,
  segmentOf, isShining, aliveCount,
} from '../src/domain/flatLightGame.js';

const DT = 1 / 60;
/** Move the hanging light to `to` at `speed` (travel per second), then stay for `hold` seconds. */
const drive = (s, to, speed, hold = 0) => {
  while (s.phase === 'dip' && Math.abs(s.cur.y - to) > 1e-6) {
    const step = Math.sign(to - s.cur.y) * Math.min(speed * DT, Math.abs(to - s.cur.y));
    dipMove(s, step);
    const lights = s.lights.length;
    stepDip(s, DT);
    if (s.lights.length !== lights) return; // finished and replaced by a new light
  }
  for (let t = 0; t < hold && s.phase === 'dip'; t += DT) stepDip(s, DT);
};
/** One whole dip: down, soak, up. Returns the graded light. */
const dip = (s, { depth = 1, soak = 0.8, pull = 0.4 } = {}) => {
  drive(s, depth, 3, soak);
  drive(s, 0, pull);
  return s.lights[s.lights.length - 1];
};

describe('silikonová lázeň – dílna', () => {
  it('ponor: od hladiny po úplné potopení', () => {
    expect(submerged(0)).toBe(0);
    expect(submerged(FL.TOUCH_Y)).toBe(0);
    expect(submerged(FL.UNDER_Y)).toBe(1);
    expect(submerged(1)).toBe(1);
  });

  it('poctivě namočené světlo je bez vady', () => {
    const light = dip(createGame(1));
    expect(light.verdict).toBe('GOOD');
    expect(light.leak).toBeLessThan(0.05);
    expect(light.heat).toBe(0);
  });

  it('rychlé vytažení nechá bubliny', () => {
    const light = dip(createGame(1), { pull: 3 });
    expect(light.verdict).toBe('BUBBLES');
    expect(light.leak).toBeGreaterThan(0.4);
  });

  it('nedomočené a krátce namočené světlo propouští', () => {
    const shallow = dip(createGame(1), { depth: 0.6 });
    expect(shallow.verdict).toBe('SHALLOW');
    expect(shallow.leak).toBeGreaterThan(0.3);
    const thin = dip(createGame(1), { depth: 0.86, soak: 0 });
    expect(thin.verdict).toBe('THIN');
    expect(thin.leak).toBeGreaterThan(0.3);
  });

  it('moc dlouho v lázni znamená tlustou vrstvu, která hřeje', () => {
    const light = dip(createGame(1), { soak: 2.6 });
    expect(light.verdict).toBe('THICK');
    expect(light.heat).toBeGreaterThan(0.5);
    expect(light.leak).toBeLessThan(0.05);
  });

  it('opětovné potopení spraví bubliny', () => {
    const s = createGame(1);
    drive(s, 1, 3, 0.6);
    drive(s, 0.5, 3); // škubnutí nahoru
    drive(s, 1, 3, 0.1); // zpátky pod hladinu
    drive(s, 0, 0.4);
    expect(s.lights[0].verdict).toBe('GOOD');
  });

  it('světlo, které se silikonu nedotklo, se nepočítá', () => {
    const s = createGame(1);
    drive(s, 0.2, 3);
    drive(s, 0, 3);
    expect(s.lights).toHaveLength(0);
  });

  it('dílna končí po čase nebo po šesti světlech', () => {
    const slow = createGame(1);
    for (let t = 0; t < FL.DIP_TIME + 1; t += DT) stepDip(slow, DT);
    expect(slow.phase).toBe('dipped');
    expect(slow.lights).toHaveLength(0);

    const fast = createGame(1);
    while (fast.phase === 'dip') dip(fast, { soak: 0.55, pull: 0.6 });
    expect(fast.lights).toHaveLength(FL.MAX_LIGHTS);
    expect(fast.timeLeft).toBeGreaterThan(0);
    expect(gradePanel({ maxSub: 1, soak: 1, pull: 0.5, fast: 0 }).verdict).toBe('GOOD');
  });
});

describe('silikonová lázeň – noc na jeřábu', () => {
  const crane = (coats, opts) => startCrane({ ...createGame(4), phase: 'dipped', lights: coats.map((c) => ({ ...c })) }, opts);
  const good = { leak: 0, heat: 0, verdict: 'GOOD' };
  /** Keeps the middle of the row above the actor. */
  const follow = (s) => moveArm(s, Math.max(-0.02, Math.min(0.02, s.actors[0].x - s.hand)));
  const play = (s, player = follow, maxSeconds = 600) => {
    for (let i = 0; i < maxSeconds * 60 && !s.over; i += 1) { player(s); stepCrane(s, DT); }
    return s;
  };

  it('světla visí vedle sebe a každé svítí na svůj pruh', () => {
    const s = crane([good, good, good]);
    expect(segmentOf(s, 0)[1]).toBeCloseTo(segmentOf(s, 1)[0]);
    expect(segmentOf(s, 2)[1] - segmentOf(s, 0)[0]).toBeCloseTo(3 * FL.SEGMENT);
    expect((segmentOf(s, 0)[0] + segmentOf(s, 2)[1]) / 2).toBeCloseTo(s.arm);
  });

  it('bez světel je tma a hra hned skončí', () => {
    const s = play(crane([]));
    expect(s.over).toBe(true);
    expect(s.score).toBe(0);
  });

  it('děravá světla v dešti zkratují, tlustá se přehřejí, dobrá vydrží déle', () => {
    const s = crane([{ leak: 1, heat: 0 }, { leak: 0, heat: 1 }, good]);
    for (let i = 0; i < 20 * 60; i += 1) { s.dark = 0; stepCrane(s, DT); }
    expect(s.lights[0].dead).toBe('WET');
    expect(s.lights[1].dead).toBe('HOT');
    expect(s.lights[2].dead).toBe(null);
    expect(aliveCount(s)).toBe(1);
  });

  it('vypnuté světlo schne a nesvítí; mrtvé už zapnout nejde', () => {
    const s = crane([{ leak: 1, heat: 0 }, good]);
    for (let i = 0; i < 4 * 60; i += 1) { s.dark = 0; stepCrane(s, DT); }
    const wet = s.lights[0].wet;
    expect(wet).toBeGreaterThan(0.2);
    expect(toggleLight(s, 0)).toBe(true);
    expect(isShining(s.lights[0])).toBe(false);
    for (let i = 0; i < 2 * 60; i += 1) { s.dark = 0; stepCrane(s, DT); }
    expect(s.lights[0].wet).toBeLessThan(wet);
    s.lights[0].dead = 'WET';
    expect(toggleLight(s, 0)).toBe(false);
    expect(toggleLight(s, 9)).toBe(false);
  });

  it('poctivá dílna se vyplatí: dobrá světla dají lepší skóre než odbytá', () => {
    const bad = { leak: 0.8, heat: 0, verdict: 'BUBBLES' };
    const careful = play(crane([good, good, good, good]));
    const sloppy = play(crane([bad, bad, bad, bad, bad, bad]));
    expect(careful.over).toBe(true);
    expect(careful.score).toBeGreaterThan(sloppy.score * 1.5);
    expect(careful.score).toBeLessThanOrEqual(careful.t + 1e-9);
  });

  it('bonus za docházku přidá jedno dobré světlo ze zálohy', () => {
    const s = crane([{ leak: 0.5, heat: 0, verdict: 'THIN' }], { spare: true });
    expect(s.lights).toHaveLength(2);
    expect(s.lights[1]).toMatchObject({ leak: 0, heat: 0, spare: true, on: true });
  });

  it('stejné semínko dá stejný průběh', () => {
    const a = play(crane([good, good]));
    const b = play(crane([good, good]));
    expect(b.t).toBe(a.t);
    expect(b.score).toBe(a.score);
  });
});
