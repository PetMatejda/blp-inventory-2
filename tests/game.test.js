import { describe, it, expect } from 'vitest';
import {
  CFG, createGame, step, moveAnchor, continueGame, radiusOf, darkLimitOf, gustWarning,
} from '../src/domain/balloonGame.js';
import {
  ALL_TIME, weekId, previousWeekId, leaderboard, hasAttendanceBonus, fmtScore,
} from '../src/domain/gameScores.js';
import { createGameActions } from '../src/services/gameActions.js';
import { createMemoryRepo } from './memoryRepo.js';

const DT = 1 / 60;
/** Run the game with a "player" called every frame; stops at the end or after maxSeconds. */
const play = (s, player = () => {}, maxSeconds = 600) => {
  for (let i = 0; i < maxSeconds * 60 && !s.over; i += 1) { player(s); step(s, DT); }
  return s;
};
/** A decent player: holds the rope against the wind under the middle of the actors. */
const follow = (s) => {
  const centre = s.actors.reduce((sum, a) => sum + a.x, 0) / s.actors.length;
  moveAnchor(s, Math.max(-0.02, Math.min(0.02, centre - s.wind - s.anchor)));
};

describe('hra – simulace', () => {
  it('stejné semínko dá stejný průběh', () => {
    const a = play(createGame(7));
    const b = play(createGame(7));
    expect(a.over).toBe(true);
    expect(b.t).toBe(a.t);
    expect(b.score).toBe(a.score);
    expect(play(createGame(8)).t).not.toBe(a.t);
  });

  it('bez hraní hra skončí a skóre nepřesáhne odehraný čas', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = play(createGame(seed));
      expect(s.over).toBe(true);
      expect(s.t).toBeLessThan(120);
      expect(s.score).toBeLessThanOrEqual(s.t + 1e-9);
      expect(s.score).toBeGreaterThan(0); // na začátku herec stojí ve světle
    }
  });

  it('kdo drží balón nad hercem, vydrží déle než ten, kdo nehraje', () => {
    for (const seed of [1, 2, 3]) {
      const idle = play(createGame(seed));
      const good = play(createGame(seed), follow, 300);
      expect(good.score).toBeGreaterThan(idle.score * 1.5);
      expect(good.score).toBeGreaterThan(CFG.SECOND_ACTOR_AT);
    }
  });

  it('po 40 s přijde druhý herec a drží se v dosahu světla', () => {
    const s = createGame(3);
    play(s, follow, CFG.SECOND_ACTOR_AT + 20);
    expect(s.actors).toHaveLength(2);
    expect(Math.abs(s.actors[0].x - s.actors[1].x)).toBeLessThanOrEqual(2 * radiusOf(s));
  });

  it('obtížnost roste: světlo se zužuje a tma se toleruje kratší dobu, ale jen po mez', () => {
    const start = createGame(1);
    const late = { ...createGame(1), t: 200 };
    const veryLate = { ...createGame(1), t: 5000 };
    expect(radiusOf(late)).toBeLessThan(radiusOf(start));
    expect(darkLimitOf(late)).toBeLessThan(darkLimitOf(start));
    expect(radiusOf(veryLate)).toBe(CFG.RADIUS_MIN);
    expect(darkLimitOf(veryLate)).toBe(CFG.DARK_LIMIT_MIN);
  });

  it('balón a ruka zůstávají na place a poryv se ohlásí předem', () => {
    const s = createGame(5);
    let warned = false;
    play(s, (g) => { moveAnchor(g, 0.05); warned ||= gustWarning(g) !== 0; }, 30);
    expect(s.anchor).toBeLessThanOrEqual(0.94);
    expect(s.balloon).toBeLessThanOrEqual(0.96);
    expect(warned).toBe(true);
  });

  it('druhý pokus jde použít jen jednou a jen po Stop', () => {
    const s = createGame(2);
    expect(continueGame(s)).toBe(false);
    play(s);
    const score = s.score;
    expect(continueGame(s)).toBe(true);
    expect(s.over).toBe(false);
    expect(s.dark).toBe(0);
    play(s);
    expect(s.score).toBeGreaterThanOrEqual(score);
    expect(continueGame(s)).toBe(false);
  });
});

describe('hra – žebříček', () => {
  it('týden podle ISO: začíná v pondělí, přelom roku', () => {
    expect(weekId('2026-11-16')).toBe('2026-W47'); // pondělí
    expect(weekId('2026-11-15')).toBe('2026-W46'); // neděle
    expect(weekId('2027-01-01')).toBe('2026-W53');
    expect(weekId('2024-12-30')).toBe('2025-W01');
    expect(previousWeekId('2026-11-16')).toBe('2026-W46');
    expect(ALL_TIME > weekId('2099-12-31')).toBe(true); // dotaz „od minulého týdne“ zahrne i rekordy
  });

  it('řadí podle nejlepšího výsledku, při shodě vyhrává dřívější', () => {
    const scores = [
      { id: 'a', uid: 'a', week: '2026-W47', best: 40, bestAt: '2026-11-17T10:00:00Z' },
      { id: 'b', uid: 'b', week: '2026-W47', best: 63, bestAt: '2026-11-17T11:00:00Z' },
      { id: 'c', uid: 'c', week: '2026-W47', best: 40, bestAt: '2026-11-16T09:00:00Z' },
      { id: 'd', uid: 'd', week: '2026-W46', best: 99, bestAt: '2026-11-10T09:00:00Z' },
      { id: 'e', uid: 'e', week: '2026-W47', plays: 1 },
    ];
    expect(leaderboard(scores, '2026-W47').map((r) => [r.uid, r.rank])).toEqual([['b', 1], ['c', 2], ['a', 3]]);
    expect(fmtScore(47.26)).toBe('47,3 s');
  });

  it('bonus za docházku: dnešní záznam, o víkendu stačí poslední pracovní den', () => {
    const rec = (date, uid = 'u1') => ({ uid, date, type: 'SKLAD' });
    expect(hasAttendanceBonus([rec('2026-11-16')], 'u1', '2026-11-16')).toBe(true);
    expect(hasAttendanceBonus([rec('2026-11-16', 'u2')], 'u1', '2026-11-16')).toBe(false);
    expect(hasAttendanceBonus([rec('2026-11-13')], 'u1', '2026-11-16')).toBe(false); // pondělí bez zápisu
    expect(hasAttendanceBonus([rec('2026-11-13')], 'u1', '2026-11-14')).toBe(true); // sobota, pátek zapsán
    expect(hasAttendanceBonus([rec('2026-11-12')], 'u1', '2026-11-15')).toBe(false); // neděle, pátek chybí
    expect(hasAttendanceBonus([rec('2026-11-16')], 'u1', '2026-11-17')).toBe(true); // svátek 17. 11., pondělí zapsáno
    expect(hasAttendanceBonus([rec('2026-11-14')], 'u1', '2026-11-14')).toBe(true); // sobotní natáčení
  });
});

describe('hra – ukládání výsledků', () => {
  const setup = () => {
    const mem = createMemoryRepo();
    const user = { id: 'u1', name: 'Petr', email: 'petr@example.cz' };
    const actions = createGameActions({ repo: mem.repo, getState: () => ({ gameScores: mem.all('gameScores') }), getUser: () => user });
    const doc = (week) => mem.all('gameScores').find((r) => r.id === `u1_${week}`);
    return { mem, actions, doc };
  };

  it('první hra založí týdenní i celkový rekord', () => {
    const { actions, doc } = setup();
    expect(actions.submitScore(31.26, { today: '2026-11-16' })).toEqual({ weekBest: true, allBest: true });
    expect(doc('2026-W47')).toMatchObject({ uid: 'u1', userName: 'Petr', week: '2026-W47', best: 31.3, plays: 1 });
    expect(doc('all')).toMatchObject({ week: 'all', best: 31.3, plays: 1 });
  });

  it('horší výsledek rekord nepřepíše, jen přičte hru', () => {
    const { actions, doc } = setup();
    actions.submitScore(50, { today: '2026-11-16' });
    const at = doc('2026-W47').bestAt;
    expect(actions.submitScore(20, { today: '2026-11-17' })).toEqual({ weekBest: false, allBest: false });
    expect(doc('2026-W47')).toMatchObject({ best: 50, bestAt: at, plays: 2 });
  });

  it('nový týden začíná od nuly, celkový rekord zůstává', () => {
    const { actions, doc } = setup();
    actions.submitScore(50, { today: '2026-11-16' });
    expect(actions.submitScore(30, { today: '2026-11-23' })).toEqual({ weekBest: true, allBest: false });
    expect(doc('2026-W48')).toMatchObject({ best: 30, plays: 1 });
    expect(doc('all')).toMatchObject({ best: 50, plays: 2 });
  });

  it('konec po druhém pokusu se nepočítá jako další hra', () => {
    const { mem, actions, doc } = setup();
    actions.submitScore(20, { today: '2026-11-16' });
    actions.submitScore(35, { today: '2026-11-16', countPlay: false });
    expect(doc('2026-W47')).toMatchObject({ best: 35, plays: 1 });
    const writes = mem.log.length;
    actions.submitScore(35, { today: '2026-11-16', countPlay: false }); // nic nového → žádný zápis
    actions.submitScore(0, { today: '2026-11-16' });
    expect(mem.log.length).toBe(writes);
  });

  it('nepřihlášený nic neuloží', () => {
    const mem = createMemoryRepo();
    const actions = createGameActions({ repo: mem.repo, getState: () => ({}), getUser: () => null });
    expect(actions.submitScore(10, { today: '2026-11-16' }).error).toBeTruthy();
    expect(mem.all('gameScores')).toHaveLength(0);
  });
});
