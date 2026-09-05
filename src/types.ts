export type Origin = 'pronote' | 'manual';
export type AcademicType = 'course' | 'assignment' | 'kholle' | 'exam' | 'event';
export type GradeType = 'kholle' | 'ds' | 'exam' | 'homework' | 'other';

export interface Subject { id: string; name: string; color: string; }
export interface AcademicItem {
  id: string; externalId?: string; origin: Origin; type: AcademicType; title: string;
  subjectId?: string; startsAt: string; endsAt: string; location?: string; description?: string; completed: boolean;
}
export interface InventoryItem { id: string; name: string; category: string; quantity: number; lowStockThreshold: number; }
export interface Grade { id: string; subjectId: string; type: GradeType; value: number; coefficient: number; date: string; note?: string; }
export interface ExportPayload { version: 1; exportedAt: string; subjects: Subject[]; academicItems: AcademicItem[]; inventoryItems: InventoryItem[]; grades: Grade[]; }
