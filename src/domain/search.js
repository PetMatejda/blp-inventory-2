// Text search used by every "Hledat…" field — pure functions.
//
// Forgiving on purpose, because phone keyboards change what people type:
//   - case and diacritics do not matter ("svetlo" finds "Světlo")
//   - spaces at the ends and repeated spaces do not matter (iOS adds a space
//     after a word picked from the suggestion bar)
//   - several words may come in any order ("blacktop cloud" finds "Cloud 8x6 blacktop")

/** Lower case, no diacritics, single spaces. */
export const searchKey = (text) => String(text ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

/** True when every word of `query` occurs somewhere in `fields` (string or array of strings). */
export function matchesSearch(fields, query) {
  const q = searchKey(query);
  if (!q) return true;
  const text = searchKey([].concat(fields).filter(Boolean).join(' '));
  return q.split(' ').every((word) => text.includes(word));
}

/**
 * Props for a search <input>: no autocorrect / auto-capitalisation / spell check.
 * Equipment names are not dictionary words — with a Czech keyboard iOS otherwise
 * "corrects" e.g. Cloud into another word and the search finds nothing.
 */
export const SEARCH_INPUT_PROPS = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'none',
  spellCheck: false,
  enterKeyHint: 'search',
};
