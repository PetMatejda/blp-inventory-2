// Osobní: my attendance (today + my month), the whole team's month and the
// calendar of jobs. Rules and numbers: src/domain/attendance.js.
import React, { useMemo, useState } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, ChevronDown, Pencil, ExternalLink, Link2, CalendarDays, Users, UserRound, CopyPlus, MapPin, Package,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet, useDialogs } from '../common/Dialogs';
import { Field, inputCls, SheetButtons } from '../common/FormField';
import { EntrySheet } from './EntrySheet';
import {
  typeOf, hoursOf, monthSummary, teamMonth, daysOfMonth, isWorkday, isoDate, defaultTimes, fmtHours, fmtDays,
} from '../../domain/attendance';
import { buildAgenda } from '../../domain/productionCalendar';
import { plural } from '../../domain/labels';
import { fmtDay, fmtDayLong, fmtMonth, weekdayIndex, shiftMonth } from './dates';

const VOLUNTARY_UNTIL = '2027-01-01';
const signed = (h) => `${h > 0 ? '+' : h < 0 ? '−' : ''}${fmtHours(Math.abs(h))}`;

const MonthNav = ({ value, onChange }) => (
  <div className="flex items-center justify-between gap-2">
    <button onClick={() => onChange(shiftMonth(value, -1))} aria-label="Předchozí měsíc" className="w-11 h-11 rounded-xl border border-outline-variant bg-card-bg flex items-center justify-center active:scale-90">
      <ChevronLeft className="w-5 h-5" />
    </button>
    <h2 className="text-lg font-bold text-on-surface capitalize">{fmtMonth(value.year, value.month)}</h2>
    <button onClick={() => onChange(shiftMonth(value, 1))} aria-label="Další měsíc" className="w-11 h-11 rounded-xl border border-outline-variant bg-card-bg flex items-center justify-center active:scale-90">
      <ChevronRight className="w-5 h-5" />
    </button>
  </div>
);

const Stat = ({ label, value, tone = '' }) => (
  <div className="rounded-xl border border-outline-variant bg-card-bg p-2.5 text-center min-w-0">
    <div className={`text-xl font-bold font-mono truncate ${tone}`}>{value}</div>
    <div className="text-xs text-on-surface-variant">{label}</div>
  </div>
);

/** One record as a row (my own rows open the editor). */
const EntryRow = ({ record, onClick }) => {
  const t = typeOf(record.type);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`w-full min-h-[52px] px-3 py-2 rounded-xl border border-outline-variant bg-surface-container flex items-center gap-3 text-left ${onClick ? 'active:scale-[0.99]' : ''}`}>
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t?.color }} aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block text-base font-semibold text-on-surface">
          {t?.label || record.type}{t?.work ? <span className="font-mono font-normal text-on-surface-variant"> {record.from}–{record.to}</span> : null}
        </span>
        {record.note && <span className="block text-sm text-on-surface-variant truncate">{record.note}</span>}
      </span>
      {t?.work && <span className="font-mono font-bold text-on-surface shrink-0">{fmtHours(hoursOf(record))}</span>}
      {onClick && <Pencil className="w-4 h-4 text-outline shrink-0" />}
    </Tag>
  );
};

// ── Shared links (existing overviews in Cowork) ──────────────────────
const LinkCard = ({ field, title, hint, icon: Icon }) => {
  const { personalLinks, setPersonalLinks } = useInventory();
  const { toast } = useDialogs();
  const url = personalLinks?.[field] || '';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const save = (e) => {
    e.preventDefault();
    const v = value.trim();
    if (v && !/^https:\/\//i.test(v)) { toast({ text: 'Odkaz musí začínat https://' }); return; }
    setPersonalLinks({ [field]: v });
    setEditing(false);
    toast({ text: v ? 'Odkaz uložen pro celý tým' : 'Odkaz odebrán' });
  };

  return (
    <div className="flex items-stretch gap-2">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex-1 min-h-[56px] px-4 py-2 rounded-xl border border-outline-variant bg-card-bg flex items-center gap-3 active:scale-[0.99]">
          <Icon className="w-5 h-5 text-primary shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-base font-semibold text-on-surface">{title}</span>
            <span className="block text-sm text-on-surface-variant">{hint}</span>
          </span>
          <ExternalLink className="w-5 h-5 text-outline shrink-0" />
        </a>
      ) : (
        <button onClick={() => { setValue(''); setEditing(true); }}
          className="flex-1 min-h-[56px] px-4 py-2 rounded-xl border border-dashed border-outline bg-card-bg flex items-center gap-3 text-left active:scale-[0.99]">
          <Link2 className="w-5 h-5 text-primary shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-base font-semibold text-on-surface">{title}</span>
            <span className="block text-sm text-on-surface-variant">Vložit odkaz na sdílený přehled</span>
          </span>
        </button>
      )}
      {url && (
        <button onClick={() => { setValue(url); setEditing(true); }} aria-label={`Změnit odkaz: ${title}`}
          className="w-12 rounded-xl border border-outline-variant bg-card-bg flex items-center justify-center text-on-surface-variant active:scale-90">
          <Pencil className="w-5 h-5" />
        </button>
      )}
      {editing && (
        <Sheet title={title} subtitle="Odkaz uvidí všichni přihlášení členové týmu" onClose={() => setEditing(false)} dismissOnBackdrop={false}
          footer={<SheetButtons onCancel={() => setEditing(false)} form={`link-${field}`} submitLabel="Uložit odkaz" />}>
          <form id={`link-${field}`} onSubmit={save}>
            <Field label="Adresa (https://…)">
              <input type="url" value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://claude.ai/artifact/…" autoFocus autoComplete="off" inputMode="url" className={inputCls} />
            </Field>
          </form>
        </Sheet>
      )}
    </div>
  );
};

// ── My attendance ────────────────────────────────────────────────────
const MySection = ({ month, setMonth, today }) => {
  const { attendance, currentUser, fillAttendanceDays } = useInventory();
  const { confirm, toast } = useDialogs();
  const [editing, setEditing] = useState(null); // entry in the editor
  const [openDay, setOpenDay] = useState(null); // day with records shown in a sheet

  const mine = useMemo(() => attendance.filter((r) => r.uid === currentUser?.id), [attendance, currentUser?.id]);
  const summary = useMemo(() => monthSummary(mine, month.year, month.month, { today }), [mine, month, today]);
  const todays = mine.filter((r) => r.date === today);
  const defaults = defaultTimes(mine);

  const newEntry = (date) => {
    const sameDay = mine.filter((r) => r.date === date).sort((a, b) => String(a.to).localeCompare(String(b.to)));
    const last = sameDay[sameDay.length - 1];
    // A second part of the day starts where the first one ended.
    setEditing({ date, type: defaults.type, from: last?.to || defaults.from, to: last ? '' : defaults.to, note: '' });
  };
  const edit = (r) => setEditing({ id: r.id, date: r.date, type: r.type, from: r.from, to: r.to, note: r.note || '' });
  const tapDay = (date) => (summary.byDate[date]?.length ? setOpenDay(date) : newEntry(date));

  const fillMissing = async () => {
    const t = typeOf(defaults.type);
    const ok = await confirm({
      title: `Doplnit ${summary.missing.length} ${plural(summary.missing.length, 'den', 'dny', 'dní')}?`,
      message: `Do nevyplněných pracovních dnů (${summary.missing.map((d) => fmtDay(d).replace(/^\S+ /, '')).join(', ')}) se zapíše ${t.label} ${defaults.from}–${defaults.to}. Jednotlivé dny pak můžete opravit.`,
      confirmLabel: 'Doplnit',
    });
    if (!ok) return;
    const r = fillAttendanceDays(summary.missing, { type: defaults.type, from: defaults.from, to: defaults.to, note: '' });
    toast({ text: `Doplněno ${r.saved} ${plural(r.saved, 'den', 'dny', 'dní')}` });
  };

  const days = daysOfMonth(month.year, month.month);
  const lead = weekdayIndex(days[0]);
  // While entering is voluntary, do not nag people who have not started using it in that month.
  const showMissing = summary.missing.length > 0 && (today >= VOLUNTARY_UNTIL || summary.filledDays > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Today */}
      <section className="bg-card-bg border border-outline-variant rounded-2xl p-4 flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Dnes</h2>
          <p className="text-sm text-on-surface-variant capitalize">{fmtDayLong(today)}</p>
        </div>
        {todays.map((r) => <EntryRow key={r.id} record={r} onClick={() => edit(r)} />)}
        {todays.length === 0 ? (
          <button onClick={() => newEntry(today)} className="h-14 rounded-2xl bg-primary text-on-primary text-base font-bold flex items-center justify-center gap-2 shadow active:scale-[0.98]">
            <Plus className="w-6 h-6 stroke-[2.5]" /> Zapsat dnešek
          </button>
        ) : typeOf(todays[0].type)?.work && (
          <button onClick={() => newEntry(today)} className="h-12 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-base font-semibold flex items-center justify-center gap-2 active:scale-[0.98]">
            <Plus className="w-5 h-5" /> Přidat další část dne
          </button>
        )}
      </section>

      {/* My month */}
      <section className="flex flex-col gap-3">
        <MonthNav value={month} onChange={setMonth} />
        <div className="grid grid-cols-3 gap-2">
          <Stat label="odpracováno" value={fmtHours(summary.hours)} />
          <Stat label="norma" value={fmtHours(summary.norm)} />
          <Stat label="rozdíl" value={signed(summary.diff)} tone={summary.filledDays === 0 ? 'text-on-surface-variant' : summary.diff < 0 ? 'text-error' : 'text-secondary'} />
        </div>

        {showMissing && (
          <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 flex items-center gap-3">
            <p className="flex-1 text-sm text-on-surface">
              <strong>{summary.missing.length} {plural(summary.missing.length, 'pracovní den', 'pracovní dny', 'pracovních dní')}</strong> bez záznamu.
              Klepněte na den v kalendáři, nebo je doplňte najednou.
            </p>
            <button onClick={fillMissing} className="h-11 px-3 rounded-xl border border-outline-variant bg-card-bg text-sm font-semibold text-on-surface flex items-center gap-1.5 shrink-0 active:scale-95">
              <CopyPlus className="w-4 h-4" /> Doplnit
            </button>
          </div>
        )}

        <div className="bg-card-bg border border-outline-variant rounded-2xl p-2">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-on-surface-variant pb-1" aria-hidden="true">
            {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
            {days.map((date) => {
              const list = summary.byDate[date] || [];
              const hours = list.reduce((sum, r) => sum + hoursOf(r), 0);
              const off = !isWorkday(date);
              const missing = showMissing && summary.missing.includes(date);
              const label = list.length
                ? list.map((r) => typeOf(r.type)?.label).join(' + ')
                : missing ? 'bez záznamu' : off ? 'volný den' : '';
              return (
                <button key={date} onClick={() => tapDay(date)} aria-label={`${fmtDayLong(date)}${label ? `, ${label}` : ''}`}
                  className={`h-14 rounded-lg border flex flex-col items-center justify-between py-1 active:scale-95 ${
                    date === today ? 'border-primary ring-2 ring-primary/40' : missing ? 'border-dashed border-amber-500' : 'border-outline-variant/60'
                  } ${off && !list.length ? 'bg-surface-container-high/60' : 'bg-surface-container'}`}>
                  <span className={`text-sm font-semibold leading-none ${off ? 'text-on-surface-variant' : 'text-on-surface'}`}>{Number(date.slice(8))}</span>
                  <span className="text-xs font-mono leading-none text-on-surface-variant">{hours ? fmtDays(hours) : list.length ? '—' : ''}</span>
                  <span className="flex gap-0.5 w-full px-1 h-1.5">
                    {list.map((r) => <span key={r.id} className="flex-1 rounded-full" style={{ backgroundColor: typeOf(r.type)?.color }} />)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-sm text-on-surface-variant">
          Dny: zakázky {fmtDays(summary.jobDays)} · sklad {fmtDays(summary.days.SKLAD)} · dovolená {fmtDays(summary.days.DOVOLENA)} · volno M {fmtDays(summary.days.VOLNO)} · nemoc {fmtDays(summary.days.NEMOC)}
        </p>
        {today < VOLUNTARY_UNTIL && (
          <p className="text-sm text-on-surface-variant">
            Do konce roku 2026 je zápis v aplikaci dobrovolný. Od 1. 1. 2027 se docházka bude brát jen odtud.
          </p>
        )}
      </section>

      {openDay && (
        <Sheet title={fmtDayLong(openDay)} subtitle="Klepnutím záznam opravíte" onClose={() => setOpenDay(null)}>
          {(summary.byDate[openDay] || mine.filter((r) => r.date === openDay)).map((r) => (
            <EntryRow key={r.id} record={r} onClick={() => { setOpenDay(null); edit(r); }} />
          ))}
          <button onClick={() => { const d = openDay; setOpenDay(null); newEntry(d); }}
            className="h-12 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-base font-semibold flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" /> Přidat další část dne
          </button>
        </Sheet>
      )}
      {editing && <EntrySheet entry={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

// ── Team ─────────────────────────────────────────────────────────────
const TeamSection = ({ month, setMonth, today }) => {
  const { attendance } = useInventory();
  const [person, setPerson] = useState(null);
  const team = useMemo(() => teamMonth(attendance, month.year, month.month, { today }), [attendance, month, today]);
  const detail = person && team.find((p) => p.uid === person);
  const cols = [
    ['Hodiny', (p) => fmtHours(p.hours)],
    ['Rozdíl', (p) => signed(p.diff)],
    ['Zakázky', (p) => fmtDays(p.jobDays)],
    ['Sklad', (p) => fmtDays(p.days.SKLAD)],
    ['Dovol.', (p) => fmtDays(p.days.DOVOLENA)],
    ['Volno M', (p) => fmtDays(p.days.VOLNO)],
    ['Nemoc', (p) => fmtDays(p.days.NEMOC)],
    ['Chybí', (p) => p.missing.length || '–'],
  ];

  return (
    <div className="flex flex-col gap-3">
      <MonthNav value={month} onChange={setMonth} />
      {team.length === 0 ? (
        <p className="bg-card-bg border border-outline-variant rounded-2xl p-6 text-center text-base text-on-surface-variant">
          V tomto měsíci zatím nikdo docházku do aplikace nezapsal.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto bg-card-bg border border-outline-variant rounded-2xl">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-on-surface-variant">
                  <th className="sticky left-0 bg-card-bg px-3 py-2 font-semibold">Kdo</th>
                  {cols.map(([label]) => <th key={label} className="px-2 py-2 font-semibold text-right whitespace-nowrap">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {team.map((p) => (
                  <tr key={p.uid} onClick={() => setPerson(p.uid)} className="border-t border-outline-variant/60 cursor-pointer active:bg-surface-container">
                    <th scope="row" className="sticky left-0 bg-card-bg px-3 h-12 text-left font-semibold text-on-surface whitespace-nowrap">
                      <button onClick={() => setPerson(p.uid)} className="flex items-center gap-1 h-12">{p.userName} <ChevronRight className="w-4 h-4 text-outline" /></button>
                    </th>
                    {cols.map(([label, get]) => (
                      <td key={label} className={`px-2 text-right font-mono whitespace-nowrap ${label === 'Rozdíl' ? (p.diff < 0 ? 'text-error' : 'text-secondary') : 'text-on-surface'}`}>{get(p)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-on-surface-variant">Dny jsou po typech práce, „Zakázky“ = točba + rigging + travel. Klepnutím na jméno uvidíte jednotlivé dny.</p>
        </>
      )}
      <LinkCard field="attendanceUrl" title="Přehled docházky 2026" hint="Sdílený přehled celého roku" icon={Users} />

      {detail && (
        <Sheet title={detail.userName} subtitle={`${fmtMonth(month.year, month.month)} · ${fmtHours(detail.hours)}`} onClose={() => setPerson(null)}>
          {Object.keys(detail.byDate).sort().map((date) => (
            <div key={date} className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-on-surface-variant">{fmtDay(date)}</span>
              {detail.byDate[date].map((r) => <EntryRow key={r.id} record={r} />)}
            </div>
          ))}
        </Sheet>
      )}
    </div>
  );
};

// ── Calendar of jobs ─────────────────────────────────────────────────
const CalendarSection = ({ today }) => {
  const { productionCalendar, jobs, setCurrentJobId, setActiveTab } = useInventory();
  const [days, setDays] = useState(14);
  const [open, setOpen] = useState(null);
  const agenda = useMemo(() => buildAgenda({ calendar: productionCalendar, jobs, from: today, days }), [productionCalendar, jobs, today, days]);
  const openJob = (id) => { setCurrentJobId(id); setActiveTab('packing'); };

  return (
    <div className="flex flex-col gap-3">
      <LinkCard field="calendarUrl" title="BLP kalendář (Gantt)" hint="Celý plán z Tabulky prací" icon={CalendarDays} />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-on-surface">Co se bude dělat</h2>
        <div className="flex bg-card-bg p-1 rounded-xl border border-outline-variant" role="tablist">
          {[14, 30].map((n) => (
            <button key={n} role="tab" aria-selected={days === n} onClick={() => setDays(n)}
              className={`h-9 px-3 rounded-lg text-sm font-semibold ${days === n ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
              {n} dní
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-on-surface-variant">
        {productionCalendar
          ? `Tabulka prací ${productionCalendar.tableDate || ''}${productionCalendar.updatedAt ? ` · aktualizováno ${new Date(productionCalendar.updatedAt).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''} + zakázky v aplikaci.`
          : 'Zatím jen zakázky z této aplikace. Termíny z Tabulky prací najdete ve sdíleném kalendáři výše.'}
      </p>

      {agenda.length === 0 && (
        <p className="bg-card-bg border border-outline-variant rounded-2xl p-6 text-center text-base text-on-surface-variant">
          Na příštích {days} dní tu nic není.
        </p>
      )}
      {agenda.map(({ date, items }) => (
        <section key={date} className="flex flex-col gap-1.5">
          <h3 className={`text-sm font-bold capitalize ${date === today ? 'text-primary' : 'text-on-surface-variant'}`}>
            {date === today ? 'Dnes · ' : ''}{fmtDayLong(date).replace(/ \d{4}$/, '')}
          </h3>
          {items.map((it) => {
            const expanded = open === it.key;
            const hasDetail = it.gear || it.notes || it.crew;
            return (
              <div key={it.key} className="bg-card-bg border border-outline-variant rounded-xl overflow-hidden flex">
                <span className="w-1.5 shrink-0" style={{ backgroundColor: it.color }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => (it.jobId ? openJob(it.jobId) : setOpen(expanded ? null : it.key))}
                    aria-expanded={it.jobId ? undefined : expanded}
                    className="w-full min-h-[56px] px-3 py-2 flex items-center gap-2 text-left active:bg-surface-container"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold" style={{ color: it.color }}>{it.label}{it.status === 'tbc' ? ' · TBC' : it.status === 'not_confirmed' ? ' · nepotvrzeno' : ''}</span>
                      <span className="block text-base font-semibold text-on-surface leading-snug break-words">{it.title}</span>
                      {(it.project || it.location) && (
                        <span className="block text-sm text-on-surface-variant truncate">{[it.project, it.location].filter(Boolean).join(' · ')}</span>
                      )}
                    </span>
                    {it.jobId ? <ChevronRight className="w-5 h-5 text-outline shrink-0" />
                      : hasDetail ? <ChevronDown className={`w-5 h-5 text-outline shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} /> : null}
                  </button>
                  {expanded && hasDetail && (
                    <div className="px-3 pb-3 flex flex-col gap-1.5 text-sm text-on-surface">
                      {it.location && <p className="flex gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-on-surface-variant" /> {it.location}</p>}
                      {it.gear && <p className="flex gap-2"><Package className="w-4 h-4 mt-0.5 shrink-0 text-on-surface-variant" /> {it.gear}</p>}
                      {it.crew && <p className="flex gap-2"><Users className="w-4 h-4 mt-0.5 shrink-0 text-on-surface-variant" /> Crew {it.crew}</p>}
                      {it.notes && <p className="text-on-surface-variant">{it.notes}</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
};

const TABS = [
  { id: 'me', label: 'Moje', icon: UserRound },
  { id: 'team', label: 'Tým', icon: Users },
  { id: 'calendar', label: 'Kalendář', icon: CalendarDays },
];

export const PersonalScreen = () => {
  const today = isoDate(new Date());
  const [tab, setTab] = useState('me');
  const [month, setMonth] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });

  return (
    <div className="max-w-4xl mx-auto pb-28">
      <div className="sticky top-app-bar z-30 bg-surface-container border-b border-outline-variant px-3 py-2">
        <div className="flex bg-card-bg p-1 rounded-xl border border-outline-variant" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`flex-1 h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${tab === t.id ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 pt-4">
        {tab === 'me' && <MySection month={month} setMonth={setMonth} today={today} />}
        {tab === 'team' && <TeamSection month={month} setMonth={setMonth} today={today} />}
        {tab === 'calendar' && <CalendarSection today={today} />}
      </div>
    </div>
  );
};
