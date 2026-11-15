// Date labels for the Osobní screen ('YYYY-MM-DD' in, Czech text out).
const DOW = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
const DOW_LONG = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

const parse = (date) => new Date(`${date}T12:00:00`);

/** 'Po 16. 11.' */
export const fmtDay = (date) => { const d = parse(date); return `${DOW[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`; };
/** 'pondělí 16. 11. 2026' */
export const fmtDayLong = (date) => { const d = parse(date); return `${DOW_LONG[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`; };
/** 'listopad 2026' (month 1–12) */
export const fmtMonth = (year, month) => `${MONTHS[month - 1]} ${year}`;
/** Monday = 0 … Sunday = 6 */
export const weekdayIndex = (date) => (parse(date).getDay() + 6) % 7;
export const shiftMonth = ({ year, month }, delta) => {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};
