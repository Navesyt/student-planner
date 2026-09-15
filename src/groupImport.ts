import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import { extractText, isAvailable } from '@paul_sizon/expo-pdf-text-extract';
import type { ImportedDocument, StudentGroups } from './types';
import { rowsToAcademicItems, type TableRow } from './groupPlanner';

export interface ImportedScope { document: ImportedDocument; rows: TableRow[]; }

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const DATE_TOKEN = /\b\d{1,2}[-/](?:\d{1,2}|[A-Za-zÀ-ÿ]+)\b/gi;

function rowsFromSheet(values: unknown[][]): TableRow[] {
  return values.map((row, rowIndex) => ({ rowIndex, cells: row.map(value => String(value ?? '').trim()) })).filter(row => row.cells.some(Boolean));
}

async function readSpreadsheet(uri: string): Promise<TableRow[]> {
  const response = await fetch(uri);
  const data = await response.arrayBuffer();
  const workbook = XLSX.read(data, { type:'array', cellDates:true });
  const rows: TableRow[] = [];
  workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header:1, raw:false, defval:'' });
    rows.push(...rowsFromSheet(values));
  });
  return rows;
}

function splitPdfLine(line: string, positions: number[], width: number): string[] {
  if (positions.length < 4) return line.split(/\t| {2,}|;/).map(x => x.trim()).filter(Boolean);
  const cells = [line.slice(0, positions[0]).trim()];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : Math.min(line.length, start + width);
    cells.push(line.slice(start, end).trim());
  }
  return cells;
}

function rowsFromPdfText(text: string): TableRow[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const header = lines.find(line => [...line.matchAll(DATE_TOKEN)].length >= 4);
  if (!header) return lines.map((line,rowIndex) => ({ rowIndex, cells:line.split(/\t| {2,}|;/).map(x=>x.trim()).filter(Boolean) }));

  const matches = [...header.matchAll(DATE_TOKEN)];
  const positions = matches.map(m => m.index ?? 0);
  const gaps = positions.slice(1).map((p,i)=>p-positions[i]);
  const width = gaps.length ? Math.max(1, Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length)) : 10;
  return lines.map((line,rowIndex) => ({ rowIndex, cells:splitPdfLine(line,positions,width) })).filter(row => row.cells.some(Boolean));
}

async function readPdf(uri: string): Promise<TableRow[]> {
  if (!isAvailable()) throw new Error('La lecture PDF nécessite une development build Expo, pas Expo Go.');
  const text = await extractText(uri);
  return rowsFromPdfText(text);
}

export async function pickAndParseScope(): Promise<ImportedScope | null> {
  const result = await DocumentPicker.getDocumentAsync({ type:['application/pdf','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], copyToCacheDirectory:true, multiple:false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const name = asset.name || 'scope';
  const lower = name.toLowerCase();
  const format: ImportedDocument['format'] = lower.endsWith('.pdf') ? 'pdf' : lower.endsWith('.csv') ? 'csv' : 'xlsx';
  const rows = format === 'pdf' ? await readPdf(asset.uri) : await readSpreadsheet(asset.uri);
  return { document:{ id:id(), name, format, importedAt:new Date().toISOString() }, rows };
}

export async function importScopeForStudent(groups: StudentGroups) {
  const scope = await pickAndParseScope();
  if (!scope) return null;
  return { ...scope, items: rowsToAcademicItems(scope.rows, groups) };
}
