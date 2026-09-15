import type { AcademicItem, AcademicType, StudentGroups } from './types';

export interface TableRow { rowIndex: number; cells: string[]; }

const clean = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const compact = (value: unknown) => clean(value).replace(/[^a-z0-9]+/g, '');

const SUBJECT_RE = /math|mathem|phys|chim|si|info|informat|anglais|franc|philo|sport/i;
const DAY_RE = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)$/i;
const TIME_RE = /^(?:[01]?\d|2[0-3])(?:h|:)[0-5]?\d?$/i;
const MONTHS: Record<string, number> = { janv:1, janvier:1, fevr:2, fevrier:2, mars:3, avril:4, mai:5, juin:6, juil:7, juillet:7, aout:8, sept:9, septembre:9, oct:10, octobre:10, nov:11, novembre:11, dec:12, decembre:12 };

function groupCandidates(groups: StudentGroups) { return [groups.group, groups.thirdGroup, groups.halfGroup].filter(Boolean).map(compact); }
function trinomeCandidate(value?: string) { const m = value ? compact(value).match(/^0*(\d{1,3})$/) : null; return m ? Number(m[1]) : null; }

export function rowMatchesGroups(row: TableRow, groups: StudentGroups) {
  const groupValues = groupCandidates(groups);
  const trinome = trinomeCandidate(groups.trinome);
  const cells = row.cells.map(compact);
  return groupValues.some(g => cells.some(c => c === g)) || (trinome !== null && cells.some(c => /^\d{1,3}$/.test(c) && Number(c) === trinome));
}

function inferType(text: string): AcademicType {
  const s = clean(text);
  if (s.includes('kholle') || s.includes('colloscope') || s.includes('coloscope')) return 'kholle';
  if (s.includes('tp')) return 'course';
  if (s.includes('devoir') || s.includes('dm')) return 'assignment';
  if (s.includes('ds') || s.includes('examen')) return 'exam';
  return 'event';
}

function parseTime(value: string) {
  const m = clean(value).match(/\b([01]?\d|2[0-3])(?:h|:)([0-5]\d)?\b/i);
  return m ? { hour:Number(m[1]), minute:Number(m[2] ?? 0) } : null;
}

function parseDate(value: string, fallbackYear = new Date().getFullYear()) {
  const s = clean(value).replace(/\./g, '');
  let m = s.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (m) return { day:Number(m[1]), month:Number(m[2]), year:m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : fallbackYear };
  m = s.match(/\b(\d{1,2})[- ]([a-z]+)(?:[- ](\d{2,4}))?\b/i);
  if (!m) return null;
  const month = MONTHS[m[2]];
  return month ? { day:Number(m[1]), month, year:m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : fallbackYear } : null;
}

function iso(date: {day:number;month:number;year:number}, time: {hour:number;minute:number}) {
  const d = new Date(date.year, date.month - 1, date.day, time.hour, time.minute, 0, 0);
  return d.toISOString().slice(0, 16);
}

interface WeekColumn { date:{day:number;month:number;year:number}; index:number; }

function findWeekColumns(rows: TableRow[]): WeekColumn[] {
  for (const row of rows) {
    const parsed = row.cells.map((cell,index) => { const date = parseDate(cell); return date ? { date, index } : null; }).filter((x): x is WeekColumn => !!x);
    if (parsed.length < 4) continue;
    let year = parsed[0].date.year;
    let previousMonth = parsed[0].date.month;
    const normalized = parsed.map((x,i) => {
      if (i > 0 && x.date.month < previousMonth) year += 1;
      previousMonth = x.date.month;
      return { ...x, date:{ ...x.date, year } };
    });
    return normalized;
  }
  return [];
}

function prefixInfo(cells: string[]) {
  const timeIndex = cells.findIndex(c => TIME_RE.test(c.replace(/\s/g, '')) || parseTime(c) !== null);
  if (timeIndex < 0) return null;
  const time = parseTime(cells[timeIndex]);
  if (!time) return null;
  const prefix = cells.slice(0, timeIndex).filter(Boolean);
  return { timeIndex, time, day:prefix.find(c => DAY_RE.test(c.trim())), subject:prefix.find(c => SUBJECT_RE.test(c)), prefix };
}

function matchesCell(cell: string, groups: StudentGroups) {
  const c = compact(cell);
  if (!c || c === 'pasdetd' || c === '-') return false;
  if (groupCandidates(groups).includes(c)) return true;
  const trinome = trinomeCandidate(groups.trinome);
  return trinome !== null && /^\d{1,3}$/.test(c) && Number(c) === trinome;
}

function titleFor(subject: string | undefined, type: AcademicType, cell: string) {
  const label = type === 'kholle' ? 'Khôlle' : type === 'course' ? 'TP' : type === 'assignment' ? 'Devoir' : type === 'exam' ? 'DS / Examen' : 'Événement';
  return `${label}${subject ? ` — ${subject}` : ''}${cell ? ` · ${cell}` : ''}`;
}

export function rowsToAcademicItems(rows: TableRow[], groups: StudentGroups): AcademicItem[] {
  const weeks = findWeekColumns(rows);
  if (!weeks.length) return fallbackRowsToAcademicItems(rows, groups);

  let currentSubject: string | undefined;
  const result: AcademicItem[] = [];
  for (const row of rows) {
    const info = prefixInfo(row.cells);
    if (!info) {
      const subjectOnly = row.cells.find(c => SUBJECT_RE.test(c) && c.length < 40);
      if (subjectOnly) currentSubject = subjectOnly.trim();
      continue;
    }
    const text = row.cells.join(' · ');
    const type = inferType(text);
    const subject = info.subject ?? currentSubject;
    const weekCells = row.cells.slice(info.timeIndex + 1, info.timeIndex + 1 + weeks.length);
    weeks.forEach((week, weekOffset) => {
      const cell = weekCells[weekOffset] ?? '';
      if (!matchesCell(cell, groups)) return;
      const startsAt = iso(week.date, info.time);
      const end = new Date(startsAt); end.setHours(end.getHours() + (type === 'course' ? 2 : 1));
      result.push({ id:`generated-${row.rowIndex}-${weekOffset}-${compact(cell)}`, origin:'generated', type, title:titleFor(subject, type, cell), startsAt, endsAt:end.toISOString().slice(0,16), description:`${text} · Semaine du ${week.date.day}/${week.date.month}`, completed:false, sourceKey:`row-${row.rowIndex}-week-${weekOffset}` });
    });
  }
  return dedupe(result);
}

function fallbackRowsToAcademicItems(rows: TableRow[], groups: StudentGroups): AcademicItem[] {
  return rows.filter(row => rowMatchesGroups(row, groups)).flatMap(row => {
    const info = prefixInfo(row.cells); if (!info) return [];
    const text = row.cells.join(' · ');
    const date = row.cells.map(parseDate).find(Boolean); if (!date) return [];
    const type = inferType(text); const start = iso(date!, info.time); const end = new Date(start); end.setHours(end.getHours() + 1);
    return [{ id:`generated-${row.rowIndex}`, origin:'generated', type, title:titleFor(info.subject, type, ''), startsAt:start, endsAt:end.toISOString().slice(0,16), description:text, completed:false, sourceKey:`row-${row.rowIndex}` }];
  });
}

function dedupe(items: AcademicItem[]) {
  const seen = new Set<string>();
  return items.filter(item => { const key = `${item.startsAt}|${item.title}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
