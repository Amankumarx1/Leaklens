/**
 * INI / Configuration File Parser (.ini, .cfg, .conf)
 * Parses INI sections and properties with line-indexed locations.
 */

export function parseIni(content) {
  if (typeof content !== 'string') {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const items = [];
  let currentSection = 'default';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).trim();
      continue;
    }

    const eqIdx = rawLine.indexOf('=');
    let location = `[${currentSection}] line:${i + 1}`;
    let field_path = null;
    if (eqIdx !== -1) {
      const key = rawLine.substring(0, eqIdx).trim();
      field_path = `${currentSection}.${key}`;
      location = `[${currentSection}].${key} (line:${i + 1})`;
    }

    items.push({
      location,
      field_path,
      content: rawLine,
      lineNumber: i + 1
    });
  }

  return items;
}

export default parseIni;
