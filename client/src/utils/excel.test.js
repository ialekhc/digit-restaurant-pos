import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { normalizeWorksheetName, readRowsFromXlsx } from './excel.js';

const addMenuSheet = (workbook, name, item = 'Mixed Grill Platter') => {
  const worksheet = workbook.addWorksheet(name);
  worksheet.addRow(['Category', 'Item', 'Price (Rs.)']);
  worksheet.addRow(['Sharing Platters', item, 1200]);
  return worksheet;
};

test('normalizes worksheet punctuation and spacing', () => {
  assert.equal(normalizeWorksheetName('  Combo-Platter_Menu  '), 'combo platter menu');
});

test('selects a Combo alias from a workbook with multiple sheets', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Instructions').addRow(['Read me']);
  addMenuSheet(workbook, 'Combo');

  const result = await readRowsFromXlsx(await workbook.xlsx.writeBuffer(), [
    'combo platter menu',
    'combo platter',
    'combo'
  ]);

  assert.equal(result.sheetName, 'Combo');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].Item, 'Mixed Grill Platter');
});

test('falls back to the only menu-shaped worksheet', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Notes').addRow(['Instructions']);
  addMenuSheet(workbook, 'August Upload', 'Family Platter');

  const result = await readRowsFromXlsx(await workbook.xlsx.writeBuffer(), ['combo platter menu']);

  assert.equal(result.sheetName, 'August Upload');
  assert.equal(result.rows[0].Item, 'Family Platter');
});
