/**
 * Safe XML Parser (.xml)
 * Parses XML tags and attributes on a line-by-line basis.
 * Avoids DOM/SAX external entity resolution to strictly defend against XXE attacks.
 */

export function parseXml(content) {
  if (typeof content !== 'string') {
    throw new Error('XML parser requires string content');
  }

  const lines = content.split(/\r?\n/);
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('<!--') || trimmed.startsWith('<?xml')) {
      continue;
    }

    // Check for tag name e.g. <apiKey>value</apiKey>
    const tagMatch = trimmed.match(/<([a-zA-Z0-9_-]+)[^>]*>(.*?)<\/\1>/);
    let location = `line:${i + 1}`;

    if (tagMatch) {
      const tagName = tagMatch[1];
      location = `<${tagName}> (line:${i + 1})`;
    }

    items.push({
      location,
      content: rawLine,
      lineNumber: i + 1
    });
  }

  return items;
}

export default parseXml;
