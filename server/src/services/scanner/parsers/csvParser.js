/**
 * CSV File Parser
 * Safely parses comma-separated records and tracks row/column coordinates.
 */

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsv(content) {
  if (typeof content !== 'string') {
    throw new Error('CSV parser requires string content');
  }

  const rawLines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (rawLines.length === 0) {
    return [];
  }

  const headerRow = parseCsvLine(rawLines[0]);
  const items = [];

  // Add line items
  for (let i = 0; i < rawLines.length; i++) {
    items.push({
      location: `line:${i + 1}`,
      content: rawLines[i],
      lineNumber: i + 1
    });

    // Also add cell-specific references for rows > 0
    if (i > 0) {
      const cells = parseCsvLine(rawLines[i]);
      for (let c = 0; c < cells.length; c++) {
        const headerName = headerRow[c] || `col_${c + 1}`;
        items.push({
          location: `row:${i + 1},col:${headerName}`,
          content: cells[c],
          lineNumber: i + 1
        });
      }
    }
  }

  return items;
}

export default parseCsv;
