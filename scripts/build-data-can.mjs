// Build script: convert Data.xlsx (23 sheets, one per Times City building)
// into a static lookup JSON: { "<MA_CAN>": [{ ten, sdt, ghiChu }, ...] }
//
// Run:  node scripts/build-data-can.mjs
//
// Source xlsx columns per sheet: Mã Căn | Chủ Nhà | SDT | Ghi Chú

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_XLSX = 'C:/Users/PC/OneDrive/Desktop/zalo_auto 2/Data.xlsx';
const OUT_JSON = resolve(__dirname, '../src/data/dataCan.json');

// Normalize mã căn: uppercase + strip everything that is not A-Z or 0-9
function normCode(v) {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Normalize phone: keep digits only, add leading 0 if missing (Excel drops it)
function normPhone(v) {
  if (v == null || v === '') return '';
  let s = String(v).replace(/[^\d]/g, '');
  if (s && !s.startsWith('0')) s = '0' + s;
  return s;
}

function clean(v) {
  return String(v ?? '').trim();
}

const buf = await readFile(SRC_XLSX);
const wb = XLSX.read(buf, { type: 'buffer' });

const lookup = {};
let totalRows = 0;
let totalCells = 0;

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // rows[0] is header: Mã Căn | Chủ Nhà | SDT | Ghi Chú
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const code = normCode(row[0]);
    if (!code) continue;
    const ten = clean(row[1]);
    const sdt = normPhone(row[2]);
    const ghiChu = clean(row[3]);
    if (!ten && !sdt && !ghiChu) continue;
    if (!lookup[code]) lookup[code] = [];
    lookup[code].push({ ten, sdt, ghiChu });
    totalRows++;
  }
  totalCells++;
}

await mkdir(dirname(OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, JSON.stringify(lookup), 'utf8');

const uniqueCodes = Object.keys(lookup).length;
const multiOwner = Object.values(lookup).filter((a) => a.length > 1).length;
console.log(`Sheets processed: ${totalCells}`);
console.log(`Data rows: ${totalRows}`);
console.log(`Unique codes: ${uniqueCodes}`);
console.log(`Multi-owner codes: ${multiOwner}`);
console.log(`Written: ${OUT_JSON}`);
