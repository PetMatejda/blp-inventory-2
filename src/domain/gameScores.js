// Leaderboard of the game „Udrž balón“ (collection `gameScores`).
// One document per person and week (`{uid}_{week}`) plus one all-time (`{uid}_all`):
//   { uid, userName, week: '2026-W47' | 'all', best, bestAt, plays }
import { isWorkday } from './attendance.js';

export const ALL_TIME = 'all';
export const scoreDocId = (uid, week) => `${uid}_${week}`;

const shiftDay = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** ISO week of a YYYY-MM-DD date, e.g. '2026-W47' (weeks start on Monday; sorts as text). */
export function weekId(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // Thursday decides the year
  const week = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** The week before the one of the given date (the listener loads from here on). */
export const previousWeekId = (iso) => weekId(shiftDay(iso, -7));

/** Ranking for one week (or ALL_TIME): best first, the earlier result wins a tie. */
export function leaderboard(scores, week) {
  return (scores || [])
    .filter((r) => r.week === week && r.best > 0)
    .sort((a, b) => b.best - a.best || String(a.bestAt || '').localeCompare(String(b.bestAt || '')))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * The second take is the reward for keeping attendance: today has a record, or —
 * on a weekend / holiday — the last working day has one (nobody should invent
 * Saturday records just to play).
 */
export function hasAttendanceBonus(attendance, uid, today) {
  if (!uid) return false;
  const has = (date) => (attendance || []).some((r) => r.uid === uid && r.date === date);
  if (has(today)) return true;
  if (isWorkday(today)) return false;
  for (let i = 1, date = shiftDay(today, -1); i <= 10; i += 1, date = shiftDay(date, -1)) {
    if (isWorkday(date)) return has(date);
  }
  return false;
}

export const roundScore = (seconds) => Math.round(seconds * 10) / 10;
export const fmtScore = (seconds) => `${roundScore(seconds || 0).toFixed(1).replace('.', ',')} s`;
