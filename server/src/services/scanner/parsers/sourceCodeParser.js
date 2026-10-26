/**
 * Source Code File Parser (.js, .ts, .py, .java, .go, .sh, .sql)
 * Splits code into line items with line numbers and detects declaration context.
 */

export function parseSourceCode(content) {
  if (typeof content !== 'string') {
    throw new Error('Source code parser requires string content');
  }

  const lines = content.split(/\r?\n/);
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    // Detect variable / constant assignment name if present
    const varMatch = trimmed.match(/(?:const|let|var|val|export|set)?\s*([a-zA-Z0-9_]+)\s*[:=]/);
    let location = `line:${i + 1}`;
    if (varMatch && varMatch[1]) {
      location = `${varMatch[1]} (line:${i + 1})`;
    }

    items.push({
      location,
      content: rawLine,
      lineNumber: i + 1
    });
  }

  return items;
}

export default parseSourceCode;
