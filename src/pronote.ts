import type { AcademicItem } from './types';

export interface PronoteApi {
  fetchSchedule(from: string, to: string): Promise<AcademicItem[]>;
  fetchAssignments(from: string, to: string): Promise<AcademicItem[]>;
}

const plusHours = (date: Date, h: number) => new Date(date.getTime() + h * 3600000).toISOString();

/** Replace this adapter later with a real/local Pronote bridge. Credentials never belong in the app database. */
export class MockPronoteApi implements PronoteApi {
  async fetchSchedule(from: string, _to: string) {
    const d = new Date(from);
    return [
      { id:'p-math-1', externalId:'course-2026-09-04-math', origin:'pronote', type:'course', title:'Mathématiques — Analyse', subjectId:'maths', startsAt:new Date(d.setHours(8,0,0,0)).toISOString(), endsAt:plusHours(new Date(d),2), location:'Salle B12', completed:false },
      { id:'p-phys-1', externalId:'course-2026-09-04-phys', origin:'pronote', type:'course', title:'Physique — Mécanique', subjectId:'physics', startsAt:new Date(d.setHours(10,15,0,0)).toISOString(), endsAt:plusHours(new Date(d),1.5), location:'Labo 2', completed:false },
      { id:'p-kholle-1', externalId:'kholle-2026-09-05-math', origin:'pronote', type:'kholle', title:'Khôlle de Maths', subjectId:'maths', startsAt:new Date(d.setDate(d.getDate()+1)).toISOString(), endsAt:plusHours(new Date(d),1), location:'Salle C04', completed:false },
    ];
  }
  async fetchAssignments(from: string, _to: string) {
    const d = new Date(from);
    return [{ id:'p-homework-1', externalId:'homework-2026-09-05-phys', origin:'pronote', type:'assignment', title:'Exercices 12 à 18 — Mécanique', subjectId:'physics', startsAt:new Date(d.setHours(18,0,0,0)).toISOString(), endsAt:plusHours(new Date(d),1), description:'À préparer pour le prochain cours.', completed:false }];
  }
}

export async function syncPronote(api: PronoteApi, db: any, from: string, to: string) {
  const [schedule, assignments] = await Promise.all([api.fetchSchedule(from,to), api.fetchAssignments(from,to)]);
  const { upsertPronoteItems } = await import('./db');
  await upsertPronoteItems(db, [...schedule, ...assignments]);
  return schedule.length + assignments.length;
}
