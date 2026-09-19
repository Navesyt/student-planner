export type Origin = 'manual' | 'timetable' | 'generated';
export type AcademicType = 'course' | 'assignment' | 'kholle' | 'exam' | 'event';
export type GradeType = 'kholle' | 'ds' | 'exam' | 'homework' | 'other';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Subject { id: string; name: string; color: string; teacher?: string; }
export interface AcademicItem {
  id: string; origin: Origin; type: AcademicType; title: string; subjectId?: string; reason?: string;
  startsAt: string; endsAt: string; location?: string; description?: string; completed: boolean;
  linkedItemId?: string; seriesId?: string; sourceDocumentId?: string; sourceKey?: string;
}
export interface InventoryItem { id: string; name: string; category: string; quantity: number; lowStockThreshold: number; }
export interface Grade { id: string; subjectId: string; type: GradeType; value: number; coefficient: number; date: string; note?: string; }
export interface StudentGroups { group?: string; thirdGroup?: string; halfGroup?: string; trinome?: string; }
export interface ImportedDocument { id: string; name: string; format: 'pdf' | 'xlsx' | 'csv' | 'image'; importedAt: string; }
export interface ExportPayload { version: 3; exportedAt: string; subjects: Subject[]; academicItems: AcademicItem[]; inventoryItems: InventoryItem[]; grades: Grade[]; studentGroups: StudentGroups; }