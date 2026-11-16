// The name a person shows under in the app (Nastavení › Jméno). The e-mail is the
// fixed identity; the name is free text the person picks.

export const NAME_MIN = 2;
export const NAME_MAX = 40;

/** Trims and collapses whitespace → { ok: true, name } or { ok: false, error }. */
export function cleanDisplayName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN) return { ok: false, error: `Jméno musí mít aspoň ${NAME_MIN} znaky.` };
  if (name.length > NAME_MAX) return { ok: false, error: `Jméno může mít nejvýš ${NAME_MAX} znaků.` };
  return { ok: true, name };
}
