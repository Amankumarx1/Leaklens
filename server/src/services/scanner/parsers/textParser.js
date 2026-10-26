/**
 * Plain Text File Parser
 * Splits text into lines and attaches 1-indexed line references.
 */
export function parseText(content) {
  if (typeof content !== 'string') {
    throw new Error('Text parser requires string content');
  }

  const lines = content.split(/\r?\n/);
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    items.push({
      location: `line:${i + 1}`,
      content: lines[i],
      lineNumber: i + 1
    });
  }

  return items;
}

export default parseText;
