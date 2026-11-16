// Results of the games (collections `gameScores` – Udrž balón, `quizScores` – Filmový kvíz):
// everyone writes only their own documents,
// everyone approved reads the leaderboard (firestore.rules). See src/domain/gameScores.js.
import { ALL_TIME, scoreDocId, weekId, roundScore } from '../domain/gameScores.js';

/** @param getUser () => { id, name, email } of the signed-in person */
export function createGameActions({ repo, getState, getUser }) {
  return {
    /**
     * Record a finished run. `countPlay: false` for the second end of the same run
     * (after the bonus continue). Returns { weekBest, allBest } — which records fell.
     */
    submitScore(seconds, { today, countPlay = true, col = 'gameScores' } = {}) {
      const user = getUser();
      if (!user?.id) return { error: 'Nejste přihlášeni.' };
      const score = roundScore(seconds);
      if (!(score > 0) || !today) return { weekBest: false, allBest: false };

      const scores = getState()[col] || [];
      const now = new Date().toISOString();
      const result = {};
      const ops = [];
      for (const [key, week] of [['weekBest', weekId(today)], ['allBest', ALL_TIME]]) {
        const id = scoreDocId(user.id, week);
        const old = scores.find((r) => r.id === id);
        const better = score > (old?.best || 0);
        result[key] = better;
        if (!better && !countPlay) continue;
        ops.push({ type: 'merge', col, id, data: {
          uid: user.id,
          userName: user.name || user.email || '',
          week,
          ...(better ? { best: score, bestAt: now } : {}),
          ...(countPlay ? { plays: { __inc: 1 } } : {}),
        } });
      }
      if (ops.length) repo.commit(ops);
      return result;
    },
  };
}
