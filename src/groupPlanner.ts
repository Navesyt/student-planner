import type { AcademicItem, AcademicType, StudentGroups } from './types';

export interface TableRow { rowIndex: number; cells: string[]; }

const clean = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const token = (value: string) => clean(value).replace(/[^a-z0-9]+/g, ' ').trim();

export function rowMatchesGroups(row: TableRow, groups: StudentGroups) {
  const values = [groups.group, groups.thirdGroup, groups.halfGroup, groups.trinome].filter(Boolean).map(token);
  if (!values.length) return false;
  const cells = row.cells.map(token);
  return values.some(v => cells.some(c => c === v || c.split(' ').includes(v) || c.includes(` ${v} `) || c.startsWith(`${v} `) || c.endsWith(` ${v}`)));
}

function inferType(text: string): AcademicType {
  const s = clean(text);
  if (s.includes('kholle') || s.includes('coloscope')) return 'kholle';
  if (s.includes('devoir') || s.includes('dm')) return 'assignment';
  if (s.includes('ds') || s.includes('examen')) return 'exam';
  if (s.includes('tp')) return 'course';
  return 'event';
}

function findDate(text: string) {
  const m = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (!m) return null;
  const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : new Date().getFullYear();
  return { day:Number(m[1]), month:Number(m[2]), year };
}

function findTime(text: string) {
  const m = text.match(/\b([01]?\d|2[0-3])(?:h|:)([0-5]\d)?\b/i);
  if (!m) return null;
  return { hour:Number(m[1]), minute:Number(m[2] ?? 0) };
}

function toLocalIso(date: {day:number;month:number;year:number}, time: {hour:number;minute:number} | null) {
  const d = new Date(date.year, date.month - 1, date.day, time?.hour ?? 8, time?.minute ?? 0, 0, 0);
  return d.toISOString().slice(0,16);
}

export function rowsToAcademicItems(rows: TableRow[], groups: StudentGroups): AcademicItem[] {
  const matched = rows.filter(row => rowMatchesGroups(row, groups));
  return matched.flatMap(row => {
    const text = row.cells.filter(Boolean).join(' · ');
    const date = findDate(text);
    if (!date) return [];
    const time = findTime(text);
    const startsAt = toLocalIso(date, time);
    const end = new Date(startsAt);
    end.setHours(end.getHours() + 1);
    const type = inferType(text);
    const subject = row.cells.find(c => /math|phys|chim|si|info|anglais|franc|philo|sport/i.test(c));
    const title = subject ? `${type === 'kholle' ? 'Khôlle' : type === 'course' ? 'TP' : type === 'assignment' ? 'Devoir' : type === 'exam' ? 'DS / Examen' : 'Événement'} — ${subject}` : row.cells.filter(Boolean).slice(0,3).join(' — ');
    return [{ id:`generated-${row.rowIndex}-${clean(text).slice(0,32)}`, origin:'generated', type, title:title || 'Événement importé', startsAt, endsAt:end.toISOString().slice(0,16), description:text, completed:false, sourceKey:`row-${row.rowIndex}` }];
  });
}
