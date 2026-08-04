const loadExcelJs = async () => {
  const module = await import('exceljs');
  return module.default || module;
};

const downloadBuffer = (buffer, filename) => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadRowsAsXlsx = async ({ rows, sheetName, filename, widths = [] }) => {
  if (!Array.isArray(rows) || !rows.length) throw new Error('At least one spreadsheet row is required');

  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Digit Restaurant POS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(String(sheetName || 'Sheet 1').slice(0, 31));
  const headers = Object.keys(rows[0]);
  worksheet.addRow(headers);
  for (const row of rows) worksheet.addRow(headers.map((header) => row[header] ?? ''));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  headerRow.alignment = { vertical: 'middle' };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  headers.forEach((header, index) => {
    worksheet.getColumn(index + 1).width = widths[index] || Math.min(40, Math.max(12, header.length + 2));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
};

const plainCellValue = (value) => {
  if (value == null) return '';
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if ('result' in value) return value.result ?? '';
  if ('text' in value) return value.text ?? '';
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
  return '';
};

export const normalizeWorksheetName = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const worksheetHasMenuColumns = (worksheet) => {
  const headers = worksheet.getRow(1).values
    .slice(1)
    .map((value) => normalizeWorksheetName(plainCellValue(value)));

  const hasCategory = headers.includes('category');
  const hasItem = headers.some((header) => ['item', 'name', 'item name'].includes(header));
  const hasPrice = headers.some((header) => ['price', 'price rs'].includes(header));
  return hasCategory && hasItem && hasPrice;
};

const findPreferredWorksheet = (worksheets, preferredSheetNames) => {
  const preferred = preferredSheetNames.map(normalizeWorksheetName).filter(Boolean);
  const exactMatch = worksheets.find((worksheet) => preferred.includes(normalizeWorksheetName(worksheet.name)));
  if (exactMatch) return exactMatch;

  const descriptiveMatch = worksheets.find((worksheet) => {
    const sheetName = normalizeWorksheetName(worksheet.name);
    return preferred.some((name) => sheetName.startsWith(`${name} `) || sheetName.endsWith(` ${name}`));
  });
  if (descriptiveMatch) return descriptiveMatch;

  const menuWorksheets = worksheets.filter(worksheetHasMenuColumns);
  if (menuWorksheets.length === 1) return menuWorksheets[0];
  return worksheets.length === 1 ? worksheets[0] : null;
};

export const readRowsFromXlsx = async (buffer, preferredSheetNames = []) => {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheetNames = workbook.worksheets.map((worksheet) => worksheet.name);
  const worksheet = findPreferredWorksheet(workbook.worksheets, preferredSheetNames);

  if (!worksheet) return { sheetNames, sheetName: '', rows: [] };

  const headers = worksheet.getRow(1).values.slice(1).map((value) => String(plainCellValue(value)).trim());
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = plainCellValue(row.getCell(index + 1).value);
    });
    if (Object.values(record).some((value) => value !== '')) rows.push(record);
  });

  return { sheetNames, sheetName: worksheet.name, rows };
};
