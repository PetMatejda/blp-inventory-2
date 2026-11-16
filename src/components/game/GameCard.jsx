// The quiet entry to the games at the bottom of Osobní › Moje: „Udrž balón“,
// „Silikonová lázeň“ and „Filmový kvíz“. A game is loaded only when somebody opens it.
// Other screens lead here with setNavFocus({ type: 'games' }) (see PackingList).
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { weekId, leaderboard, hasAttendanceBonus, fmtScore } from '../../domain/gameScores';
import { fmtPoints } from '../../domain/quiz';

const BalloonGame = lazy(() => import('./BalloonGame'));
const QuizGame = lazy(() => import('./QuizGame'));
const FlatLightGame = lazy(() => import('./FlatLightGame'));

/** "Tvůj týden 47,3 s · vede Honza 63,0 s" */
const weekStatus = (scores, week, uid, fmt) => {
  const board = leaderboard(scores, week);
  const mine = board.find((r) => r.uid === uid);
  const leader = board[0];
  return [
    mine ? `Tvůj týden ${fmt(mine.best)}` : null,
    leader && leader.uid !== uid ? `vede ${leader.userName || 'kolega'} ${fmt(leader.best)}` : null,
    leader && leader.uid === uid ? 'vedeš žebříček' : null,
  ].filter(Boolean).join(' · ');
};

const Row = ({ emoji, title, status, hint, onClick }) => (
  <button onClick={onClick} className="w-full min-h-[60px] px-4 py-2.5 flex items-center gap-3 text-left active:bg-surface-container">
    <span className="text-2xl shrink-0" aria-hidden="true">{emoji}</span>
    <span className="flex-1 min-w-0">
      <span className="block text-base font-semibold text-on-surface">{title}</span>
      <span className="block text-sm text-on-surface-variant">{status || hint}</span>
    </span>
    <ChevronRight className="w-5 h-5 text-outline shrink-0" />
  </button>
);

export const GameCard = ({ today }) => {
  const { gameScores, quizScores, flatScores, attendance, currentUser, submitGameScore, navFocus, setNavFocus } = useInventory();
  const [open, setOpen] = useState(null); // 'balloon' | 'flat' | 'quiz'
  const sectionRef = useRef(null);
  const uid = currentUser?.id;
  const week = weekId(today);

  const bonus = useMemo(() => hasAttendanceBonus(attendance, uid, today), [attendance, uid, today]);
  const balloonStatus = useMemo(() => weekStatus(gameScores, week, uid, fmtScore), [gameScores, week, uid]);
  const quizStatus = useMemo(() => weekStatus(quizScores, week, uid, fmtPoints), [quizScores, week, uid]);
  const flatStatus = useMemo(() => weekStatus(flatScores, week, uid, fmtScore), [flatScores, week, uid]);

  // Arriving from a link elsewhere in the app ("Máš hotovo? Tak trénuj"): show the games.
  useEffect(() => {
    if (navFocus?.type !== 'games') return;
    sectionRef.current?.scrollIntoView({ block: 'center' });
    setNavFocus(null);
  }, [navFocus, setNavFocus]);

  const close = useCallback(() => setOpen(null), []);
  const logAttendance = useCallback(() => { setOpen(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);
  const submitBalloon = useCallback((seconds, opts) => submitGameScore(seconds, { ...opts, today }), [submitGameScore, today]);
  const submitFlat = useCallback((seconds) => submitGameScore(seconds, { today, col: 'flatScores' }), [submitGameScore, today]);
  const submitQuiz = useCallback((points) => submitGameScore(points, { today, col: 'quizScores' }), [submitGameScore, today]);
  const shared = { me: currentUser, today, bonus, onClose: close, onLogAttendance: bonus ? undefined : logAttendance };

  return (
    <section ref={sectionRef} className="flex flex-col gap-2">
      <h2 className="text-lg font-bold text-on-surface">Čekáš na place?</h2>
      <div className="rounded-2xl border border-outline-variant bg-card-bg overflow-hidden divide-y divide-outline-variant/60">
        <Row emoji="🎈" title="Udrž balón" status={balloonStatus} hint="Hra na jeden palec: drž světlo na herci." onClick={() => setOpen('balloon')} />
        <Row emoji="💧" title="Silikonová lázeň" status={flatStatus} hint="Namoč flat lighty a udrž je v dešti na Hanyši." onClick={() => setOpen('flat')} />
        <Row emoji="🎬" title="Filmový kvíz" status={quizStatus} hint="Deset otázek o filmu, kameře a světle." onClick={() => setOpen('quiz')} />
      </div>
      <p className="text-sm text-on-surface-variant">
        {bonus
          ? 'Docházku máš zapsanou: v balónu máš život navíc, na jeřábu záložní světlo a v kvízu žolíka 50:50.'
          : 'Se zapsanou dnešní docházkou máš v balónu život navíc, na jeřábu záložní světlo a v kvízu žolíka 50:50.'}
      </p>
      {open && (
        <Suspense fallback={null}>
          {open === 'balloon' && <BalloonGame scores={gameScores} onSubmit={submitBalloon} {...shared} />}
          {open === 'flat' && <FlatLightGame scores={flatScores} onSubmit={submitFlat} {...shared} />}
          {open === 'quiz' && <QuizGame scores={quizScores} onSubmit={submitQuiz} {...shared} />}
        </Suspense>
      )}
    </section>
  );
};
