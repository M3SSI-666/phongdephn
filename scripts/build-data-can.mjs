// Build script: convert Data.xlsx (23 sheets, one per Times City building)
// into a static lookup JSON:
//   {
//     byCode:  { "<MA_CAN>": [{ ten, sdt, ghiChu }, ...] },
//     byPhone: { "<SDT>":    [{ code, ten }, ...] }
//   }
//
// Run:  node scripts/build-data-can.mjs
//
// Source xlsx columns per sheet: Mã Căn | Chủ Nhà | SDT | Ghi Chú

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_XLSX = resolve(__dirname, 'Data.xlsx');
const OUT_JSON = resolve(__dirname, '../src/data/dataCan.json');

// Normalize mã căn: uppercase + strip everything that is not A-Z or 0-9
function normCode(v) {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Normalize a single phone: digits only, add leading 0 if missing (Excel drops it)
function normOnePhone(v) {
  let s = String(v ?? '').replace(/[^\d]/g, '');
  if (s && !s.startsWith('0')) s = '0' + s;
  return s;
}

// A cell may contain multiple phones separated by ; , / whitespace etc.
// Return an array of normalized, de-duplicated phone numbers.
function normPhones(v) {
  if (v == null || v === '') return [];
  const parts = String(v).split(/[;,/\n\r]+|\s{2,}/);
  const out = [];
  for (const p of parts) {
    const n = normOnePhone(p);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

function clean(v) {
  return String(v ?? '').trim();
}

const buf = await readFile(SRC_XLSX);
const wb = XLSX.read(buf, { type: 'buffer' });

const byCode = {};
const byPhone = {};
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
    const sdt = normPhones(row[2]);
    const ghiChu = clean(row[3]);
    if (!ten && sdt.length === 0 && !ghiChu) continue;

    if (!byCode[code]) byCode[code] = [];
    byCode[code].push({ ten, sdt, ghiChu });

    // Reverse index: phone -> [{ code, ten }] (skip duplicate code+ten pairs)
    for (const p of sdt) {
      if (!byPhone[p]) byPhone[p] = [];
      if (!byPhone[p].some((e) => e.code === code && e.ten === ten)) {
        byPhone[p].push({ code, ten });
      }
    }
    totalRows++;
  }
  totalCells++;
}

await mkdir(dirname(OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, JSON.stringify({ byCode, byPhone }), 'utf8');

const uniqueCodes = Object.keys(byCode).length;
const multiOwner = Object.values(byCode).filter((a) => a.length > 1).length;
const uniquePhones = Object.keys(byPhone).length;
console.log(`Sheets processed: ${totalCells}`);
console.log(`Data rows: ${totalRows}`);
console.log(`Unique codes: ${uniqueCodes}`);
console.log(`Multi-owner codes: ${multiOwner}`);
console.log(`Unique phones: ${uniquePhones}`);
console.log(`Written: ${OUT_JSON}`);
