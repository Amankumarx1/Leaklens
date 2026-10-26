/**
 * JSON File Parser
 * Validates JSON structure, traverses object trees, and maps keys to JSONPath locations.
 */

function flattenJson(obj, currentPath = '$', results = []) {
  if (obj === null || obj === undefined) {
    return results;
  }

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    results.push({
      location: currentPath,
      content: String(obj)
    });
    return results;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      flattenJson(item, `${currentPath}[${index}]`, results);
    });
    return results;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      flattenJson(value, `${currentPath}.${key}`, results);
    }
  }

  return results;
}

export function parseJson(content) {
  if (typeof content !== 'string') {
    throw new Error('JSON parser requires string content');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    const error = new Error(`Malformed JSON content: ${err.message}`);
    error.code = 'MALFORMED_JSON';
    throw error;
  }

  const items = flattenJson(parsed);

  // Also include line-based items so regex matching can detect raw tokens within multi-line keys
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    items.push({
      location: `line:${idx + 1}`,
      content: line,
      lineNumber: idx + 1
    });
  });

  return items;
}

export default parseJson;
