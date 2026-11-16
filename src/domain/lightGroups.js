// Finer groups inside the "Světla" category, used by the filter chips in
// Sklad › Stav and Katalog. The category stored on the item stays `Lights`;
// the group is read from the item's name (pure, tested), so nothing has to be
// filled in by hand:
//
//   led      LED panels, LED nets, Pad-light, Springball LED, RGB / bi-color
//   hmi      HMI and tungsten light sources (and their head cables)
//   balloon  balloon envelopes: Cloud, Kostka, Koule, Elipsa, Tuba, Zero gravity, Gaffair
//   other    whatever is left (e.g. underwater lamps)
//
// Order matters: "Springball LED 600 W" is LED, "Balloon 5x1000 W Tungsten" is
// HMI / Tungsten, "Gaffair 4 kW HMI" is HMI / Tungsten, "Gaffair 4 kW B/W" a balloon.
import { searchKey } from './search.js';

export const LIGHT_GROUPS = [
  { id: 'led', label: 'LED' },
  { id: 'hmi', label: 'HMI / Tungsten' },
  { id: 'balloon', label: 'Balony' },
  { id: 'other', label: 'Ostatní světla' },
];

const RULES = [
  ['led', /\bled\b|rgb|bi-?color|pad-?light|flatlight/],
  ['hmi', /hmi|tungsten|halogen/],
  ['balloon', /cloud|kostka|koule|elipsa|tub[ae]\b|zero gravity|gaffair|balon|balloon|blacktop/],
];

/** Group id of a light by its name. */
export function lightGroupOf(name) {
  const key = searchKey(name);
  return RULES.find(([, re]) => re.test(key))?.[0] || 'other';
}
