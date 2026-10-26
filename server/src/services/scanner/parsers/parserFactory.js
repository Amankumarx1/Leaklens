import path from 'path';
import { parseText } from './textParser.js';
import { parseJson } from './jsonParser.js';
import { parseCsv } from './csvParser.js';

export const ALLOWED_EXTENSIONS = new Set(['.txt', '.json', '.csv']);

/**
 * Validates and parses authorized file buffers into structured locational items.
 *
 * @param {string} filename - User or uploaded filename
 * @param {Buffer | string} rawBuffer - File data
 * @returns {{ extension: string, mimeType: string, items: Array<{ location: string, content: string }> }}
 */
export function parseFileContent(filename, rawBuffer) {
  if (!filename || typeof filename !== 'string') {
    const err = new Error('Filename must be provided');
    err.code = 'INVALID_FILENAME';
    throw err;
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const err = new Error(`Unsupported file extension "${ext}". Only .txt, .json, and .csv are supported.`);
    err.code = 'UNSUPPORTED_FORMAT';
    err.status = 415;
    throw err;
  }

  const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer || '');
  if (buffer.length === 0) {
    const err = new Error('The uploaded file is empty.');
    err.code = 'EMPTY_FILE';
    err.status = 400;
    throw err;
  }

  // Check for unexpected binary content / null bytes in first 8KB
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      const err = new Error('Unexpected binary content detected. Binary files are not supported.');
      err.code = 'BINARY_NOT_SUPPORTED';
      err.status = 415;
      throw err;
    }
  }

  const content = buffer.toString('utf8');
  let items = [];
  let mimeType = 'text/plain';

  switch (ext) {
    case '.txt':
      mimeType = 'text/plain';
      items = parseText(content);
      break;
    case '.json':
      mimeType = 'application/json';
      items = parseJson(content);
      break;
    case '.csv':
      mimeType = 'text/csv';
      items = parseCsv(content);
      break;
  }

  return {
    extension: ext,
    mimeType,
    items,
    contentLength: buffer.length
  };
}

export default {
  parseFileContent,
  ALLOWED_EXTENSIONS
};
