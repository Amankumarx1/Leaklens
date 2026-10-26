/**
 * Environment File Parser (.env)
 * Splits environment configuration into line-indexed key-value pairs while ignoring comment blocks.
 */

export function parseEnv(content) {
  if (typeof content !== 'string') {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines and full line comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eqIdx = rawLine.indexOf('=');
    const location = `line:${i + 1}`;
    let field_path = null;
    if (eqIdx !== -1) {
      const key = rawLine.substring(0, eqIdx).trim();
      field_path = `env.${key}`;
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

export default parseEnv;
