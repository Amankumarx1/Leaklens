/**
 * YAML File Parser (.yaml, .yml)
 * Safe line-and-key parser that maps keys to structured YAMLPath locations.
 * Avoids unsafe YAML object instantiation to defend against deserialization exploits.
 */

export function parseYaml(content) {
  if (typeof content !== 'string') {
    throw new Error('YAML parser requires string content');
  }

  const lines = content.split(/\r?\n/);
  const items = [];
  const keyStack = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const indent = rawLine.search(/\S/);
    const depth = Math.floor(indent / 2);

    // Adjust stack depth
    while (keyStack.length > depth) {
      keyStack.pop();
    }

    const colonIdx = trimmed.indexOf(':');
    let location = `line:${i + 1}`;

    if (colonIdx !== -1) {
      const key = trimmed.substring(0, colonIdx).trim();
      const value = trimmed.substring(colonIdx + 1).trim();

      keyStack[depth] = key;
      const pathStr = keyStack.slice(0, depth + 1).join('.');

      location = `${pathStr} (line:${i + 1})`;

      if (value) {
        items.push({
          location,
          content: rawLine,
          lineNumber: i + 1
        });
        continue;
      }
    }

    items.push({
      location,
      content: rawLine,
      lineNumber: i + 1
    });
  }

  return items;
}

export default parseYaml;
