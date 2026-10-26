import { describe, it, expect } from 'vitest';
import { parseFileContent } from '../server/src/services/scanner/parsers/parserFactory.js';

describe('File Upload Parsing & Security Controls', () => {
  it('should successfully parse valid plain text files (.txt)', () => {
    const content = Buffer.from('First line\nSecond line with secrets\nThird line');
    const result = parseFileContent('app_config.txt', content);

    expect(result.extension).toBe('.txt');
    expect(result.mimeType).toBe('text/plain');
    expect(result.items.length).toBe(3);
    expect(result.items[0].location).toBe('line:1');
    expect(result.items[0].content).toBe('First line');
  });

  it('should successfully parse valid JSON files (.json)', () => {
    const jsonStr = JSON.stringify({ database: { user: 'admin', host: 'localhost' } });
    const result = parseFileContent('settings.json', Buffer.from(jsonStr));

    expect(result.extension).toBe('.json');
    expect(result.mimeType).toBe('application/json');
    expect(result.items.some(i => i.location === '$.database.user')).toBe(true);
  });

  it('should successfully parse valid CSV files (.csv)', () => {
    const csvContent = 'id,name,email\n1,Alice,alice@corp.test\n2,Bob,bob@corp.test';
    const result = parseFileContent('users_export.csv', Buffer.from(csvContent));

    expect(result.extension).toBe('.csv');
    expect(result.mimeType).toBe('text/csv');
    expect(result.items.some(i => i.location === 'row:2,col:email')).toBe(true);
  });

  it('should reject unsupported file extensions with 415 error', () => {
    const unsupportedFiles = ['document.pdf', 'executable.exe', 'archive.zip', 'archive.tar', 'image.png'];

    for (const filename of unsupportedFiles) {
      expect(() => {
        parseFileContent(filename, Buffer.from('sample content'));
      }).toThrowError(/Unsupported file extension/);
    }
  });

  it('should reject empty files with descriptive error', () => {
    expect(() => {
      parseFileContent('empty.txt', Buffer.alloc(0));
    }).toThrowError('The uploaded file is empty.');
  });

  it('should reject malformed JSON files', () => {
    const malformedJson = '{ "user": "alice", "missingClosingBracket": ';
    expect(() => {
      parseFileContent('invalid.json', Buffer.from(malformedJson));
    }).toThrowError(/Malformed JSON content/);
  });

  it('should reject unexpected binary content and null bytes', () => {
    // Construct buffer with null byte representing compiled binary / ELF / PE header
    const binaryBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01, 0x01, 0x00]);
    expect(() => {
      parseFileContent('disguised.txt', binaryBuffer);
    }).toThrowError(/Unexpected binary content detected/);
  });
});
