/**
 * Markdown Documentation Parser (.md)
 * Tracks lines and flags fenced code blocks or table rows where sensitive credentials frequently leak.
 */

export function parseMarkdown(content) {
  if (typeof content !== 'string') {
    throw new Error('Markdown parser requires string content');
  }

  const lines = content.split(/\r?\n/);
  const items = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (!trimmed) continue;

    const location = inCodeBlock 
      ? `code-block (line:${i + 1})`
      : `line:${i + 1}`;

    items.push({
      location,
      content: rawLine,
      lineNumber: i + 1
    });
  }

  return items;
}

export default parseMarkdown;
