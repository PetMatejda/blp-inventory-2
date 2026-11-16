import { describe, it, expect } from 'vitest';
import { QUESTIONS } from '../src/data/quizQuestions.js';
import { ROUND_SIZE, TIME_LIMIT, pickRound, pointsFor, fiftyFifty, rememberSeen, fmtPoints } from '../src/domain/quiz.js';
import { createGameActions } from '../src/services/gameActions.js';
import { createMemoryRepo } from './memoryRepo.js';

const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe('kvíz – otázky', () => {
  it('je jich dost a každá má čtyři různé odpovědi a zajímavost', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(100);
    for (const q of QUESTIONS) {
      expect(q.q.trim().length, q.q).toBeGreaterThan(5);
      expect(q.a, q.q).toHaveLength(4);
      expect(new Set(q.a.map((x) => x.trim().toLowerCase())).size, q.q).toBe(4);
      expect(q.a.every((x) => x.trim().length > 0), q.q).toBe(true);
      expect(q.note?.trim().length, q.q).toBeGreaterThan(5);
    }
  });
  it('otázky se neopakují a mají jedinečná čísla', () => {
    expect(new Set(QUESTIONS.map((q) => q.q)).size).toBe(QUESTIONS.length);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });
});

describe('kvíz – kolo', () => {
  it('vybere 10 různých otázek a správnou odpověď najde i po zamíchání', () => {
    const round = pickRound(QUESTIONS, [], seeded(5));
    expect(round).toHaveLength(ROUND_SIZE);
    expect(new Set(round.map((q) => q.id)).size).toBe(ROUND_SIZE);
    for (const q of round) {
      const source = QUESTIONS.find((x) => x.id === q.id);
      expect(q.options[q.correct]).toBe(source.a[0]);
      expect([...q.options].sort()).toEqual([...source.a].sort());
    }
    // Správná odpověď není pořád na stejném místě.
    expect(new Set(pickRound(QUESTIONS, [], seeded(9)).map((q) => q.correct)).size).toBeGreaterThan(1);
  });

  it('dává přednost otázkám, které telefon ještě neviděl', () => {
    const seen = QUESTIONS.slice(0, QUESTIONS.length - 4).map((q) => q.id);
    const round = pickRound(QUESTIONS, seen, seeded(3));
    const fresh = QUESTIONS.slice(-4).map((q) => q.id);
    expect(fresh.every((id) => round.some((q) => q.id === id))).toBe(true);
    expect(round).toHaveLength(ROUND_SIZE);
  });

  it('pamatuje si viděné otázky a po vyčerpání začne znovu', () => {
    expect(rememberSeen([1, 2], [2, 3], 10)).toEqual([1, 2, 3]);
    expect(rememberSeen([1, 2, 3], [4, 5], 5)).toEqual([4, 5]);
  });

  it('body: 100 za správnou odpověď a až 50 za rychlost', () => {
    expect(pointsFor(true, TIME_LIMIT)).toBe(150);
    expect(pointsFor(true, 0)).toBe(100);
    expect(pointsFor(true, TIME_LIMIT / 2)).toBe(125);
    expect(pointsFor(true, -3)).toBe(100);
    expect(pointsFor(false, TIME_LIMIT)).toBe(0);
    expect(fmtPoints(1234.4)).toBe('1234 b.');
  });

  it('žolík 50:50 schová dvě špatné odpovědi', () => {
    for (const q of pickRound(QUESTIONS, [], seeded(11))) {
      const hidden = fiftyFifty(q, seeded(q.id));
      expect(hidden).toHaveLength(2);
      expect(new Set(hidden).size).toBe(2);
      expect(hidden).not.toContain(q.correct);
    }
  });

  it('výsledek kvízu se ukládá do vlastního žebříčku', () => {
    const mem = createMemoryRepo();
    const actions = createGameActions({
      repo: mem.repo,
      getState: () => ({ gameScores: mem.all('gameScores'), quizScores: mem.all('quizScores') }),
      getUser: () => ({ id: 'u1', name: 'Petr' }),
    });
    expect(actions.submitScore(1180, { today: '2026-11-16', col: 'quizScores' })).toEqual({ weekBest: true, allBest: true });
    actions.submitScore(900, { today: '2026-11-17', col: 'quizScores' });
    expect(mem.all('quizScores').find((r) => r.id === 'u1_2026-W47')).toMatchObject({ best: 1180, plays: 2, week: '2026-W47' });
    expect(mem.all('gameScores')).toHaveLength(0);
  });
});
