// „Filmový kvíz“ — ten questions about cinema for waiting on set (opened from Osobní).
// Rules: src/domain/quiz.js, questions: src/data/quizQuestions.js.
// Same dark look as the balloon game, no sound.
import React, { useEffect, useRef, useState } from 'react';
import { X, Play, RotateCcw, Trophy, ArrowRight, Check, CalendarCheck, Film, Divide } from 'lucide-react';
import { useBackLayer } from '../../hooks/useBackLayer';
import { QUESTIONS } from '../../data/quizQuestions';
import { ROUND_SIZE, TIME_LIMIT, pickRound, pointsFor, fiftyFifty, rememberSeen, fmtPoints } from '../../domain/quiz';
import { weekId } from '../../domain/gameScores';
import { Leaderboard } from './Leaderboard';

const SEEN_KEY = 'blp_quiz_seen_v1';
const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch { return []; } };
const saveSeen = (ids) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* private mode */ } };
const buzz = (pattern) => { if (navigator.vibrate) navigator.vibrate(pattern); };

/**
 * @param scores    records of `quizScores`
 * @param bonus     attendance is filled in → one 50:50 joker per round
 * @param onSubmit  (points) => { weekBest, allBest }
 * @param onLogAttendance  optional: leave the quiz to fill in attendance
 */
export const QuizGame = ({ scores, me, today, bonus, onSubmit, onClose, onLogAttendance, questions = QUESTIONS }) => {
  const [phase, setPhase] = useState('ready'); // ready | question | answer | over
  const [round, setRound] = useState([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null); // chosen option, -1 = time ran out
  const [hidden, setHidden] = useState([]); // options removed by the joker
  const [jokerUsed, setJokerUsed] = useState(false);
  const [points, setPoints] = useState(0);
  const [gained, setGained] = useState(0);
  const [right, setRight] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [result, setResult] = useState(null);
  const timeRef = useRef(TIME_LIMIT);
  const week = weekId(today);
  const question = round[index];

  useBackLayer(true, onClose);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const answer = (i) => {
    const correct = i === question.correct;
    const earned = pointsFor(correct, timeRef.current);
    buzz(correct ? 20 : [60, 50, 60]);
    setPicked(i);
    setGained(earned);
    setPoints((p) => p + earned);
    if (correct) setRight((n) => n + 1);
    setPhase('answer');
  };
  const answerRef = useRef(answer);
  answerRef.current = answer;

  // The clock of one question.
  useEffect(() => {
    if (phase !== 'question') return undefined;
    const started = performance.now();
    timeRef.current = TIME_LIMIT;
    setTimeLeft(TIME_LIMIT);
    const timer = setInterval(() => {
      const left = TIME_LIMIT - (performance.now() - started) / 1000;
      timeRef.current = left;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) { clearInterval(timer); answerRef.current(-1); }
    }, 100);
    return () => clearInterval(timer);
  }, [phase, index]);

  const start = () => {
    setRound(pickRound(questions, loadSeen()));
    setIndex(0); setPicked(null); setHidden([]); setJokerUsed(false);
    setPoints(0); setRight(0); setResult(null);
    setPhase('question');
  };

  const next = () => {
    if (index + 1 < round.length) {
      setIndex(index + 1); setPicked(null); setHidden([]);
      setPhase('question');
      return;
    }
    saveSeen(rememberSeen(loadSeen(), round.map((q) => q.id), questions.length));
    const saved = onSubmit(points) || {};
    setResult({ weekBest: !!saved.weekBest, allBest: !!saved.allBest });
    setPhase('over');
  };

  const playJoker = () => { setHidden(fiftyFifty(question)); setJokerUsed(true); };

  const primaryBtn = 'h-14 rounded-2xl bg-amber-400 text-black text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98]';
  const optionCls = (i) => {
    const base = 'w-full min-h-[56px] px-4 py-3 rounded-2xl border text-left text-base font-semibold flex items-center gap-3 transition-colors';
    if (phase === 'question') return `${base} border-white/20 bg-white/10 text-white active:scale-[0.98]`;
    if (i === question.correct) return `${base} border-emerald-400 bg-emerald-500/25 text-emerald-100`;
    if (i === picked) return `${base} border-red-400 bg-red-500/25 text-red-100`;
    return `${base} border-white/10 bg-white/5 text-white/40`;
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Filmový kvíz" className="fixed inset-0 z-[70] bg-slate-950 text-white flex justify-center pt-safe-top select-none">
      <div className="relative w-full max-w-[720px] h-full flex flex-col">
        <div className="flex items-center gap-3 px-2 pt-2 shrink-0">
          <button onClick={onClose} aria-label="Zavřít kvíz" className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center active:scale-90">
            <X className="w-5 h-5" />
          </button>
          {question && phase !== 'ready' && phase !== 'over' ? (
            <>
              <span className="flex-1 text-sm font-semibold text-white/70">Otázka {index + 1} / {round.length}</span>
              <span className="font-mono text-xl font-bold pr-2" aria-label="Body">{points}</span>
            </>
          ) : <span className="flex-1 text-base font-bold">Filmový kvíz</span>}
        </div>

        {(phase === 'question' || phase === 'answer') && question && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-3">
            <div className="h-1.5 rounded-full bg-white/15 overflow-hidden" role="timer" aria-label={`Zbývá ${Math.ceil(timeLeft)} s`}>
              <div className={`h-full rounded-full ${timeLeft < 5 ? 'bg-red-400' : 'bg-amber-400'}`}
                style={{ width: `${(phase === 'question' ? timeLeft / TIME_LIMIT : 0) * 100}%`, transition: 'width 100ms linear' }} />
            </div>
            <h2 className="text-xl font-bold leading-snug py-2">{question.q}</h2>

            <div className="flex flex-col gap-2">
              {question.options.map((text, i) => (
                hidden.includes(i) ? <div key={i} className="min-h-[56px] rounded-2xl border border-dashed border-white/10" aria-hidden="true" /> : (
                  <button key={i} disabled={phase !== 'question'} onClick={() => answer(i)} className={optionCls(i)}>
                    <span className="flex-1">{text}</span>
                    {phase === 'answer' && i === question.correct && <Check className="w-5 h-5 shrink-0" />}
                    {phase === 'answer' && i === picked && i !== question.correct && <X className="w-5 h-5 shrink-0" />}
                  </button>
                )
              ))}
            </div>

            {phase === 'question' && bonus && !jokerUsed && (
              <button onClick={playJoker} className="self-start h-11 px-4 rounded-xl border border-emerald-400/50 text-emerald-300 text-sm font-semibold flex items-center gap-2 active:scale-95">
                <Divide className="w-4 h-4" /> Žolík 50:50 za docházku
              </button>
            )}

            {phase === 'answer' && (
              <div className="flex flex-col gap-3 animate-fade-in">
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className={`text-sm font-bold ${picked === question.correct ? 'text-emerald-300' : 'text-red-300'}`}>
                    {picked === question.correct ? `Správně, +${gained} b.` : picked === -1 ? 'Čas vypršel' : 'Vedle'}
                  </p>
                  <p className="text-base text-white/85 mt-1">{question.note}</p>
                </div>
                <button onClick={next} className={primaryBtn}>
                  {index + 1 < round.length ? 'Další otázka' : 'Výsledek'} <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {(phase === 'ready' || phase === 'over') && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex flex-col justify-end">
            <div className="mx-auto w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-4 flex flex-col gap-3">
              {phase === 'ready' ? (
                <>
                  <div className="flex items-center gap-3">
                    <Film className="w-9 h-9 text-amber-400 shrink-0" />
                    <p className="text-sm text-white/75">
                      {ROUND_SIZE} otázek o filmu, kameře a světle. Na každou máš {TIME_LIMIT} vteřin, za rychlou odpověď je víc bodů.
                    </p>
                  </div>
                  <button onClick={start} className={primaryBtn}><Play className="w-5 h-5 fill-current" /> Začít</button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Film className="w-9 h-9 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold font-mono">{fmtPoints(points)}</h2>
                      <p className="text-sm text-white/75">Správně {right} z {round.length}</p>
                    </div>
                  </div>
                  {(result?.allBest || result?.weekBest) && (
                    <p className="flex items-center gap-2 rounded-xl bg-amber-400/20 text-amber-200 px-3 py-2 text-sm font-semibold">
                      <Trophy className="w-4 h-4 shrink-0" /> {result.allBest ? 'Tvůj nový osobní rekord!' : 'Tvůj nejlepší výsledek tohoto týdne!'}
                    </p>
                  )}
                  <button onClick={start} className={primaryBtn}><RotateCcw className="w-5 h-5" /> Další kolo</button>
                </>
              )}

              {bonus ? (
                phase === 'ready' && (
                  <p className="flex items-center gap-2 text-sm text-emerald-300">
                    <CalendarCheck className="w-4 h-4 shrink-0" /> Docházku máš zapsanou: v každém kole máš žolíka 50:50.
                  </p>
                )
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2">
                  <p className="flex-1 text-sm text-white/75">Zapiš si dnešní docházku a dostaneš do každého kola žolíka 50:50.</p>
                  {onLogAttendance && (
                    <button onClick={onLogAttendance} className="h-10 px-3 rounded-lg bg-white/15 text-sm font-semibold shrink-0 active:scale-95">Zapsat</button>
                  )}
                </div>
              )}

              <Leaderboard scores={scores} week={week} myId={me?.id} fmt={fmtPoints} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizGame;
