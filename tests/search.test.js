// Search fields and the finer light groups of the filter chips.
import { describe, it, expect } from 'vitest';
import { matchesSearch, searchKey } from '../src/domain/search.js';
import { lightGroupOf } from '../src/domain/lightGroups.js';
import { FILTER_CATEGORIES, filterIdOf } from '../src/utils/categoryIcons.jsx';

describe('hledání', () => {
  it('ignores case, diacritics and stray spaces', () => {
    expect(searchKey('  Světlo   Springball ')).toBe('svetlo springball');
    expect(matchesSearch('Cloud 8x6x1 m blacktop', 'cloud')).toBe(true);
    expect(matchesSearch('Cloud 8x6x1 m blacktop', 'Cloud ')).toBe(true); // iOS adds a space after a suggestion
    expect(matchesSearch('Cloud 8x6x1 m blacktop', 'CLOUD')).toBe(true);
    expect(matchesSearch('Světlo springball 3 kW', 'svetlo')).toBe(true);
    expect(matchesSearch('Svetlo springball 3 kW', 'světlo')).toBe(true);
  });

  it('finds several words in any order and across fields', () => {
    expect(matchesSearch('Cloud 8x6x1 m blacktop', 'blacktop cloud')).toBe(true);
    expect(matchesSearch(['Cloud 8x6x1 m White', undefined, 'Lights'], 'cloud lights')).toBe(true);
    expect(matchesSearch('Cloud 8x6x1 m White', 'cloud blacktop')).toBe(false);
    expect(matchesSearch('Kostka 2x2x2 m blacktop', 'cloud')).toBe(false);
  });

  it('an empty query matches everything', () => {
    expect(matchesSearch('Kostka', '   ')).toBe(true);
  });
});

describe('skupiny světel ve filtru', () => {
  it('sorts lights by their name', () => {
    const group = Object.fromEntries([
      'LED panel long RGBA', 'LED net 4x4ft 2700K', 'Pad-light bi-color', 'Springball LED 600 W',
      'Balloon 5x1000 W Tungsten', 'Gaffair 4 kW HMI', 'Kabel 4x4000 W HMI', '2x1000 W Tungsten',
      'Cloud 8x6x1 m blacktop', 'Kostka 2x2x2 m blacktop', 'Koule 3 m white', 'Tuba 5x2 m white',
      'Tube 5,2 m x 2,6 m blacktop', 'Zero gravity 3 m blacktop', 'Gaffair 4 kW B/W', 'Elipsa 3,7x4,3 m white',
      'Underwater Lamp INTECA',
    ].map((name) => [name, lightGroupOf(name)]));
    expect(group).toEqual({
      'LED panel long RGBA': 'led', 'LED net 4x4ft 2700K': 'led', 'Pad-light bi-color': 'led', 'Springball LED 600 W': 'led',
      'Balloon 5x1000 W Tungsten': 'hmi', 'Gaffair 4 kW HMI': 'hmi', 'Kabel 4x4000 W HMI': 'hmi', '2x1000 W Tungsten': 'hmi',
      'Cloud 8x6x1 m blacktop': 'balloon', 'Kostka 2x2x2 m blacktop': 'balloon', 'Koule 3 m white': 'balloon', 'Tuba 5x2 m white': 'balloon',
      'Tube 5,2 m x 2,6 m blacktop': 'balloon', 'Zero gravity 3 m blacktop': 'balloon', 'Gaffair 4 kW B/W': 'balloon', 'Elipsa 3,7x4,3 m white': 'balloon',
      'Underwater Lamp INTECA': 'other',
    });
  });

  it('the filter has light groups instead of one "Světla" chip; other categories stay', () => {
    expect(FILTER_CATEGORIES.map((c) => c.label).slice(0, 5)).toEqual(['LED', 'HMI / Tungsten', 'Balony', 'Ostatní světla', 'Balasty & Zdroje']);
    expect(FILTER_CATEGORIES.some((c) => c.id === 'Lights')).toBe(false);
    expect(filterIdOf({ name: 'LED panel RGB carbon', category: 'Lights' })).toBe('Lights:led');
    expect(filterIdOf({ name: 'Cloud 6x6x1 m White', category: 'Světla' })).toBe('Lights:balloon');
    expect(filterIdOf({ name: 'Kabel 32A 20 m', category: 'Cables' })).toBe('Cables');
  });
});
