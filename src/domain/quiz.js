// Film quiz (Osobní › Filmový kvíz): one round = 10 questions, 15 s each.
// Points: 100 for a correct answer + up to 50 for speed. Questions: src/data/quizQuestions.js.
// The weekly leaderboard lives in `quizScores` (same shape as `gameScores`).

export const ROUND_SIZE = 10;
export const TIME_LIMIT = 15;

export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Questions for one round: the ones this phone has not seen yet come first.
 * Returns [{ id, q, note, options: [4 shuffled answers], correct: index }].
 */
export function pickRound(questions, seenIds = [], rng = Math.random) {
  const seen = new Set(seenIds);
  const fresh = shuffle(questions.filter((q) => !seen.has(q.id)), rng);
  const old = shuffle(questions.filter((q) => seen.has(q.id)), rng);
  return shuffle([...fresh, ...old].slice(0, ROUND_SIZE), rng).map((q) => {
    const options = shuffle(q.a, rng);
    return { id: q.id, q: q.q, note: q.note, options, correct: options.indexOf(q.a[0]) };
  });
}

export const pointsFor = (correct, secondsLeft) =>
  (correct ? 100 + Math.round(50 * Math.min(1, Math.max(0, secondsLeft / TIME_LIMIT))) : 0);

/** The 50:50 joker: indexes of two wrong answers to hide. */
export function fiftyFifty(question, rng = Math.random) {
  return shuffle([0, 1, 2, 3].filter((i) => i !== question.correct), rng).slice(0, 2);
}

/** Seen question ids after a round; starts again once everything has been seen. */
export function rememberSeen(seenIds, roundIds, total) {
  const all = [...new Set([...seenIds, ...roundIds])];
  return all.length >= total ? [...roundIds] : all;
}

export const fmtPoints = (points) => `${Math.round(points || 0)} b.`;
