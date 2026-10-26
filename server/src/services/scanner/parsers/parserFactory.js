import path from 'path';
import { parseText } from './textParser.js';
import { parseJson } from './jsonParser.js';
import { parseCsv } from './csvParser.js';
import { parseEnv } from './envParser.js';
import { parseIni } from './iniParser.js';
import { parseYaml } from './yamlParser.js';
import { parseXml } from './xmlParser.js';
import { parseMarkdown } from './markdownParser.js';
import { parseSourceCode } from './sourceCodeParser.js';

export const ALLOWED_EXTENSIONS = new Set([
  '.txt',
  '.json',
  '.csv',
  '.env',
  '.log',
  '.yaml',
  '.yml',
  '.ini',
  '.cfg',
  '.conf',
  '.xml',
  '.md',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.java',
  '.go',
  '.sh',
  '.sql'
]);

/**
 * Validates and parses authorized file buffers into structured locational items.
 *
 * @param {string} filename - User or uploaded filename
 * @param {Buffer | string} rawBuffer - File data
 * @returns {{ extension: string, mimeType: string, items: Array<{ location: string, content: string, lineNumber?: number }>, contentLength: number }}
 */
export function parseFileContent(filename, rawBuffer) {
  if (!filename || typeof filename !== 'string') {
    const err = new Error('Filename must be provided');
    err.code = 'INVALID_FILENAME';
    throw err;
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const err = new Error(`Unsupported file extension "${ext}". Supported formats: TXT, JSON, CSV, ENV, LOG, YAML, INI, XML, MD, and source code text files.`);
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

  // Check for unexpected binary content / null bytes in first 8KB (reject ELF/PE/ZIP binaries)
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

  let parserName = 'textParser';

  switch (ext) {
    case '.txt':
    case '.log':
      mimeType = 'text/plain';
      parserName = 'textParser';
      items = parseText(content);
      break;
    case '.json':
      mimeType = 'application/json';
      parserName = 'jsonParser';
      items = parseJson(content);
      break;
    case '.csv':
      mimeType = 'text/csv';
      parserName = 'csvParser';
      items = parseCsv(content);
      break;
    case '.env':
      mimeType = 'text/x-env';
      parserName = 'envParser';
      items = parseEnv(content);
      break;
    case '.ini':
    case '.cfg':
    case '.conf':
      mimeType = 'text/x-ini';
      parserName = 'iniParser';
      items = parseIni(content);
      break;
    case '.yaml':
    case '.yml':
      mimeType = 'application/x-yaml';
      parserName = 'yamlParser';
      items = parseYaml(content);
      break;
    case '.xml':
      mimeType = 'application/xml';
      parserName = 'xmlParser';
      items = parseXml(content);
      break;
    case '.md':
      mimeType = 'text/markdown';
      parserName = 'markdownParser';
      items = parseMarkdown(content);
      break;
    case '.js':
    case '.jsx':
    case '.ts':
    case '.tsx':
    case '.py':
    case '.java':
    case '.go':
    case '.sh':
    case '.sql':
      mimeType = 'text/x-source-code';
      parserName = 'sourceCodeParser';
      items = parseSourceCode(content);
      break;
    default:
      mimeType = 'text/plain';
      parserName = 'textParser';
      items = parseText(content);
      break;
  }

  return {
    extension: ext,
    mimeType,
    parserName,
    items,
    contentLength: buffer.length
  };
}

export default {
  parseFileContent,
  ALLOWED_EXTENSIONS
};
