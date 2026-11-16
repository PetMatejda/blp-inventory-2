// Weekly / all-time ranking shown inside both games (dark panel).
import React, { useMemo, useState } from 'react';
import { ALL_TIME, leaderboard } from '../../domain/gameScores';

export const Leaderboard = ({ scores, week, myId, fmt }) => {
  const [mode, setMode] = useState('week');
  const rows = useMemo(() => leaderboard(scores, mode === 'week' ? week : ALL_TIME), [scores, week, mode]);
  const top = rows.slice(0, 5);
  const mine = rows.find((r) => r.uid === myId);
  const shown = mine && mine.rank > 5 ? [...top, mine] : top;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex bg-white/10 p-1 rounded-xl" role="tablist">
        {[['week', 'Tento týden'], ['all', 'Rekordy']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
            className={`flex-1 h-9 rounded-lg text-sm font-semibold ${mode === id ? 'bg-white/20 text-white' : 'text-white/60'}`}>
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-white/60 text-center py-2">
          {mode === 'week' ? 'Tento týden ještě nikdo nehrál. Buď první.' : 'Zatím žádný rekord.'}
        </p>
      ) : (
        <ol className="flex flex-col gap-1">
          {shown.map((r) => (
            <li key={r.id} className={`flex items-center gap-2 h-9 px-3 rounded-lg text-sm ${r.uid === myId ? 'bg-amber-400/20 text-amber-200 font-semibold' : 'text-white/90'}`}>
              <span className="w-5 font-mono text-white/60">{r.rank}.</span>
              <span className="flex-1 truncate">{r.userName || 'Bez jména'}</span>
              <span className="font-mono font-semibold">{fmt(r.best)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
