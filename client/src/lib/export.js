/**
 * Minimal Excel (XLSX) export utility using SheetJS-compatible CSV+Excel trick.
 * For a real xlsx we use a data URI with the Excel-compatible HTML table format.
 * No npm package needed.
 */

/** Download data as CSV */
export function downloadCSV(filename, headers, rows) {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download data as Excel (.xlsx) using an HTML table wrapped in Excel XML */
export function downloadExcel(filename, headers, rows, sheetName = 'Sheet1') {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  const thead = `<tr>${headers.map(h => `<th style="background:#4f46e5;color:#fff;font-weight:bold;border:1px solid #ccc;padding:6px 10px">${esc(h)}</th>`).join('')}</tr>`;
  const tbody = rows.map((row, i) =>
    `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">${row.map(cell =>
      `<td style="border:1px solid #e2e8f0;padding:5px 10px">${esc(cell)}</td>`
    ).join('')}</tr>`
  ).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"/></head>
    <body>
      <table>
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download a JSON blob as a pretty-printed JSON file */
export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
