import { describe, it, expect } from 'vitest';
import {
  hoursOf, validateEntry, cleanEntry, monthSummary, teamMonth, isHoliday, isWorkday, daysOfMonth, defaultTimes,
} from '../src/domain/attendance.js';
import { buildAgenda, validateCalendar, titlesOn } from '../src/domain/productionCalendar.js';
import { createAttendanceActions } from '../src/services/attendanceActions.js';
import { createMemoryRepo } from './memoryRepo.js';

const rec = (date, type, from = '', to = '', extra = {}) => ({ id: `${date}-${type}-${from}`, uid: 'u1', userName: 'Petr', date, type, from, to, ...extra });

describe('docházka – výpočty', () => {
  it('počítá hodiny, i přes půlnoc; nepřítomnost má 0 h', () => {
    expect(hoursOf(rec('2026-11-02', 'SKLAD', '08:00', '16:30'))).toBe(8.5);
    expect(hoursOf(rec('2026-11-02', 'TOCBA', '18:00', '02:00'))).toBe(8);
    expect(hoursOf(rec('2026-11-02', 'DOVOLENA'))).toBe(0);
  });

  it('zná české svátky včetně Velikonoc', () => {
    expect(isHoliday('2026-11-17')).toBe(true);
    expect(isHoliday('2026-04-03')).toBe(true); // Velký pátek 2026
    expect(isHoliday('2026-04-06')).toBe(true); // Velikonoční pondělí 2026
    expect(isHoliday('2027-03-29')).toBe(true); // Velikonoční pondělí 2027
    expect(isWorkday('2026-11-16')).toBe(true);
    expect(isWorkday('2026-11-14')).toBe(false); // sobota
    expect(daysOfMonth(2026, 2)).toHaveLength(28);
  });

  it('měsíc: norma se snižuje o dovolenou, půldny se dělí, chybějící dny jen do včerejška', () => {
    const records = [
      rec('2026-11-02', 'SKLAD', '08:00', '16:00'),
      rec('2026-11-03', 'SKLAD', '08:00', '12:00'),
      rec('2026-11-03', 'TOCBA', '12:00', '18:00'),
      rec('2026-11-04', 'DOVOLENA'),
      rec('2026-10-30', 'SKLAD', '08:00', '16:00'), // jiný měsíc
    ];
    const s = monthSummary(records, 2026, 11, { today: '2026-11-09' });
    expect(s.workdays).toBe(20); // listopad 2026: 21 všedních dnů − 17. 11.
    expect(s.hours).toBe(18);
    expect(s.norm).toBe(20 * 8 - 8);
    expect(s.diff).toBe(18 - 152);
    expect(s.days.SKLAD).toBe(1.5);
    expect(s.days.TOCBA).toBe(0.5);
    expect(s.jobDays).toBe(0.5);
    expect(s.missing).toEqual(['2026-11-05', '2026-11-06']);
  });

  it('tým: jeden řádek na člověka, jen kdo má v měsíci záznam', () => {
    const records = [
      rec('2026-11-02', 'SKLAD', '08:00', '16:00'),
      { ...rec('2026-11-02', 'RIGGING', '07:00', '19:00'), id: 'x', uid: 'u2', userName: 'Marek' },
      { ...rec('2026-10-02', 'SKLAD', '08:00', '16:00'), id: 'y', uid: 'u3', userName: 'Robin' },
    ];
    const team = teamMonth(records, 2026, 11, { today: '2026-11-03' });
    expect(team.map((p) => p.userName)).toEqual(['Marek', 'Petr']);
    expect(team[0].hours).toBe(12);
  });

  it('nový záznam nabídne časy z posledního pracovního dne', () => {
    expect(defaultTimes([])).toEqual({ from: '08:00', to: '16:00', type: 'SKLAD' });
    expect(defaultTimes([rec('2026-11-02', 'SKLAD', '08:00', '16:00'), rec('2026-11-05', 'RIGGING', '06:30', '18:00'), rec('2026-11-06', 'NEMOC')]))
      .toEqual({ from: '06:30', to: '18:00', type: 'RIGGING' });
  });
});

describe('docházka – kontroly zápisu', () => {
  const day = [rec('2026-11-02', 'SKLAD', '08:00', '12:00')];
  it('vyžaduje typ a čas', () => {
    expect(validateEntry({ date: '2026-11-02', type: '' })).toMatch(/co jste dělali/);
    expect(validateEntry({ date: '2026-11-02', type: 'SKLAD', from: '08:00', to: '' })).toMatch(/čas/);
    expect(validateEntry({ date: '2026-11-02', type: 'SKLAD', from: '08:00', to: '08:00' })).toMatch(/stejný/);
    expect(validateEntry({ date: '2026-11-02', type: 'SKLAD', from: '08:00', to: '16:00' })).toBeNull();
  });
  it('hlídá překryv a kombinaci s nepřítomností', () => {
    expect(validateEntry({ date: '2026-11-02', type: 'TOCBA', from: '11:00', to: '18:00' }, day)).toMatch(/překrývá/);
    expect(validateEntry({ date: '2026-11-02', type: 'TOCBA', from: '12:00', to: '18:00' }, day)).toBeNull();
    expect(validateEntry({ date: '2026-11-02', type: 'DOVOLENA' }, day)).toMatch(/celý den/);
    expect(validateEntry({ date: '2026-11-02', type: 'SKLAD', from: '13:00', to: '15:00' }, [rec('2026-11-02', 'NEMOC')])).toMatch(/nepřítomnost/);
    // oprava vlastního záznamu se nepočítá jako překryv
    expect(validateEntry({ ...day[0], to: '13:00' }, day)).toBeNull();
  });
  it('nepřítomnost se ukládá bez časů', () => {
    expect(cleanEntry({ date: '2026-11-02', type: 'NEMOC', from: '08:00', to: '16:00', note: ' chřipka ' }))
      .toEqual({ date: '2026-11-02', type: 'NEMOC', from: '', to: '', note: 'chřipka' });
  });
});

describe('docházka – akce', () => {
  const setup = (records = []) => {
    const mem = createMemoryRepo({ attendance: records });
    const user = { id: 'u1', name: 'Petr', email: 'petr@example.cz' };
    const actions = createAttendanceActions({ repo: mem.repo, getState: () => ({ attendance: mem.all('attendance') }), getUser: () => user });
    return { mem, actions };
  };
  it('uloží, opraví a smaže vlastní záznam', () => {
    const { mem, actions } = setup();
    const { record } = actions.saveEntry({ date: '2026-11-02', type: 'SKLAD', from: '08:00', to: '16:00', note: 'firma' });
    expect(record).toMatchObject({ uid: 'u1', userName: 'Petr', date: '2026-11-02', type: 'SKLAD' });
    expect(mem.all('attendance')).toHaveLength(1);
    expect(actions.saveEntry({ id: record.id, date: '2026-11-02', type: 'TOCBA', from: '08:00', to: '18:00' }).record.type).toBe('TOCBA');
    expect(mem.all('attendance')[0]).toMatchObject({ type: 'TOCBA', to: '18:00', createdAt: record.createdAt });
    actions.deleteEntry(record.id);
    expect(mem.all('attendance')).toHaveLength(0);
  });
  it('odmítne chybný zápis a cizí záznam', () => {
    const { actions } = setup([{ ...rec('2026-11-02', 'SKLAD', '08:00', '16:00'), id: 'other', uid: 'u2' }]);
    expect(actions.saveEntry({ date: '2026-11-02', type: 'SKLAD', from: '08:00', to: '' }).error).toMatch(/čas/);
    expect(actions.saveEntry({ id: 'other', date: '2026-11-02', type: 'SKLAD', from: '08:00', to: '10:00' }).error).toMatch(/cizí/i);
    expect(actions.deleteEntry('other').error).toMatch(/cizí/i);
    // cizí záznam ve stejný den nevadí
    expect(actions.saveEntry({ date: '2026-11-02', type: 'SKLAD', from: '08:00', to: '16:00' }).record).toBeTruthy();
  });
  it('zkopíruje poslední pracovní den do vybraných dnů', () => {
    const { mem, actions } = setup([rec('2026-11-02', 'SKLAD', '08:00', '16:00', { note: 'firma' })]);
    const r = actions.fillDays(['2026-11-03', '2026-11-04', '2026-11-02'], { type: 'SKLAD', from: '08:00', to: '16:00', note: 'firma' });
    expect(r.saved).toBe(2); // 2. 11. už záznam má
    expect(mem.all('attendance')).toHaveLength(3);
  });
});

describe('kalendář jobů', () => {
  const calendar = {
    projects: [{ id: 'bw', name: 'Birdwatch', jobs: [{
      id: 'snow', title: 'Snowcat', location: 'Stage D', gear: '250× 4×2',
      phases: [{ type: 'rigging', label: 'Rigging', start: '2026-11-16', end: '2026-11-18' }, { type: 'shoot', start: '2026-11-25', end: '2026-11-25' }],
    }] }],
  };
  const jobs = [{ id: 'j1', name: 'Granilla', status: 'ACTIVE', riggingDate: '2026-11-17', deriggingDate: '2026-11-19' }, { id: 'j2', name: 'Stará', status: 'ARCHIVED', riggingDate: '2026-11-17' }];

  it('rozloží fáze po dnech a přidá zakázky z aplikace', () => {
    const agenda = buildAgenda({ calendar, jobs, from: '2026-11-17', days: 7 });
    expect(agenda.map((d) => d.date)).toEqual(['2026-11-17', '2026-11-18', '2026-11-19']);
    expect(agenda[0].items.map((i) => i.title)).toEqual(['Snowcat', 'Granilla']);
    expect(agenda[0].items[0]).toMatchObject({ label: 'Rigging', project: 'Birdwatch', location: 'Stage D' });
    expect(agenda[2].items[0]).toMatchObject({ title: 'Granilla', jobId: 'j1', type: 'derigg' });
    expect(titlesOn(calendar, jobs, '2026-11-17')).toEqual(['Snowcat', 'Granilla']);
  });
  it('kontroluje tvar dat', () => {
    expect(validateCalendar(calendar)).toBeNull();
    expect(validateCalendar({ projects: [{ name: 'X', jobs: [{ title: 'Y', phases: [{ start: '9.10.', end: '9.10.' }] }] }] })).toMatch(/YYYY-MM-DD/);
    expect(validateCalendar({})).toMatch(/projects/);
  });
});
