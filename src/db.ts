import type { SQLiteDatabase } from 'expo-sqlite';
import type { AcademicItem, Grade, InventoryItem, Subject } from './types';

export async function initDb(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS academic_items (
      id TEXT PRIMARY KEY NOT NULL, external_id TEXT, origin TEXT NOT NULL CHECK(origin IN ('pronote','manual')),
      type TEXT NOT NULL, title TEXT NOT NULL, subject_id TEXT, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
      location TEXT, description TEXT, completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(subject_id) REFERENCES subjects(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pronote_external ON academic_items(origin, external_id);
    CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0, low_stock_threshold INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS grades (id TEXT PRIMARY KEY NOT NULL, subject_id TEXT NOT NULL, type TEXT NOT NULL, value REAL NOT NULL CHECK(value >= 0 AND value <= 20), coefficient REAL NOT NULL DEFAULT 1, date TEXT NOT NULL, note TEXT, FOREIGN KEY(subject_id) REFERENCES subjects(id));
  `);

  const subjectCount = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM subjects');
  if (!subjectCount?.n) {
    await db.runAsync('INSERT INTO subjects VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)',
      'maths', 'Maths', '#4F46E5', 'physics', 'Physique', '#0891B2', 'cs', 'Informatique', '#16A34A', 'philo', 'Philosophie', '#D97706');
  }
  const inventoryCount = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM inventory_items');
  if (!inventoryCount?.n) {
    await db.runAsync('INSERT INTO inventory_items VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
      'pens', 'Stylos', 'Papeterie', 6, 2, 'notebook', 'Cahiers', 'Papeterie', 2, 1, 'usb', 'Clé USB', 'Informatique', 1, 1);
  }
}

export async function listSubjects(db: SQLiteDatabase): Promise<Subject[]> { return db.getAllAsync<Subject>('SELECT id,name,color FROM subjects ORDER BY name'); }
export async function listAcademic(db: SQLiteDatabase): Promise<AcademicItem[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM academic_items ORDER BY starts_at');
  return rows.map(r => ({ id:r.id, externalId:r.external_id ?? undefined, origin:r.origin, type:r.type, title:r.title, subjectId:r.subject_id ?? undefined, startsAt:r.starts_at, endsAt:r.ends_at, location:r.location ?? undefined, description:r.description ?? undefined, completed:!!r.completed }));
}
export async function listInventory(db: SQLiteDatabase): Promise<InventoryItem[]> { return db.getAllAsync<InventoryItem>('SELECT id,name,category,quantity,low_stock_threshold as lowStockThreshold FROM inventory_items ORDER BY category,name'); }
export async function listGrades(db: SQLiteDatabase): Promise<Grade[]> { return db.getAllAsync<Grade>('SELECT id,subject_id as subjectId,type,value,coefficient,date,note FROM grades ORDER BY date DESC'); }

export async function upsertPronoteItems(db: SQLiteDatabase, items: AcademicItem[]) {
  await db.withTransactionAsync(async () => {
    for (const x of items) {
      if (x.origin !== 'pronote' || !x.externalId) continue;
      await db.runAsync(`INSERT INTO academic_items (id,external_id,origin,type,title,subject_id,starts_at,ends_at,location,description,completed)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(origin,external_id) DO UPDATE SET type=excluded.type,title=excluded.title,subject_id=excluded.subject_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,location=excluded.location,description=excluded.description,completed=excluded.completed`,
        x.id, x.externalId, 'pronote', x.type, x.title, x.subjectId ?? null, x.startsAt, x.endsAt, x.location ?? null, x.description ?? null, x.completed ? 1 : 0);
    }
  });
}

export async function addManualItem(db: SQLiteDatabase, x: AcademicItem) {
  await db.runAsync(`INSERT INTO academic_items (id,origin,type,title,subject_id,starts_at,ends_at,location,description,completed) VALUES (?,?,?,?,?,?,?,?,?,?)`, x.id, 'manual', x.type, x.title, x.subjectId ?? null, x.startsAt, x.endsAt, x.location ?? null, x.description ?? null, x.completed ? 1 : 0);
}
export async function updateManualItem(db: SQLiteDatabase, x: AcademicItem) {
  if (x.origin !== 'manual') throw new Error('Pronote items are read-only');
  await db.runAsync(`UPDATE academic_items SET type=?,title=?,subject_id=?,starts_at=?,ends_at=?,location=?,description=?,completed=? WHERE id=? AND origin='manual'`, x.type, x.title, x.subjectId ?? null, x.startsAt, x.endsAt, x.location ?? null, x.description ?? null, x.completed ? 1 : 0, x.id);
}
export async function deleteManualItem(db: SQLiteDatabase, id: string) { await db.runAsync(`DELETE FROM academic_items WHERE id=? AND origin='manual'`, id); }
export async function toggleAcademicItem(db: SQLiteDatabase, id: string) { await db.runAsync(`UPDATE academic_items SET completed=1-completed WHERE id=? AND origin='manual'`, id); }

export async function addInventory(db: SQLiteDatabase, x: InventoryItem) { await db.runAsync('INSERT INTO inventory_items VALUES (?,?,?,?,?)', x.id,x.name,x.category,x.quantity,x.lowStockThreshold); }
export async function updateInventory(db: SQLiteDatabase, x: InventoryItem) { await db.runAsync('UPDATE inventory_items SET name=?,category=?,quantity=?,low_stock_threshold=? WHERE id=?', x.name,x.category,x.quantity,x.lowStockThreshold,x.id); }
export async function deleteInventory(db: SQLiteDatabase, id: string) { await db.runAsync('DELETE FROM inventory_items WHERE id=?', id); }
export async function changeInventory(db: SQLiteDatabase, id: string, delta: number) { await db.runAsync('UPDATE inventory_items SET quantity=MAX(0,quantity+?) WHERE id=?', delta, id); }

export async function addGrade(db: SQLiteDatabase, x: Grade) { await db.runAsync('INSERT INTO grades VALUES (?,?,?,?,?,?,?)', x.id,x.subjectId,x.type,x.value,x.coefficient,x.date,x.note ?? null); }
export async function updateGrade(db: SQLiteDatabase, x: Grade) { await db.runAsync('UPDATE grades SET subject_id=?,type=?,value=?,coefficient=?,date=?,note=? WHERE id=?', x.subjectId,x.type,x.value,x.coefficient,x.date,x.note ?? null,x.id); }
export async function deleteGrade(db: SQLiteDatabase, id: string) { await db.runAsync('DELETE FROM grades WHERE id=?', id); }

export async function exportData(db: SQLiteDatabase) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    subjects: await listSubjects(db),
    academicItems: await listAcademic(db),
    inventoryItems: await listInventory(db),
    grades: await listGrades(db),
  };
}
