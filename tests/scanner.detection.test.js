import { describe, it, expect } from 'vitest';
import { parseText } from '../server/src/services/scanner/parsers/textParser.js';
import { parseJson } from '../server/src/services/scanner/parsers/jsonParser.js';
import { scanItems } from '../server/src/services/scanner/scannerEngine.js';
import { CANONICAL_RULES } from '../server/src/services/scanner/rules/ruleDefinitions.js';
import { maskSecret } from '../server/src/services/scanner/maskingService.js';

describe('Scanner Detection Engine & Masking Verification', () => {
  it('should detect and mask RFC-compliant email addresses', () => {
    const rawContent = 'Contact security lead at sec.ops@corp.internal or alice@example.com for keys.';
    const items = parseText(rawContent);
    const findings = scanItems(items, CANONICAL_RULES);

    const emailFindings = findings.filter(f => f.category === 'EMAIL_ADDRESS');
    expect(emailFindings.length).toBe(2);
    expect(emailFindings[0].severity).toBe('low');
    expect(emailFindings[0].masked_excerpt).toMatch(/^[a-z*]+@[a-z0-9.-]+$/i);
    expect(emailFindings[0].masked_excerpt).not.toBe('sec.ops@corp.internal');
    expect(emailFindings[1].masked_excerpt).not.toBe('alice@example.com');
  });

  it('should detect candidate API keys and redact entropy body', () => {
    const rawContent = 'AWS_SECRET_KEY=key_live_948fbc28a01f7c5e1903\nSTRIPE=sk_test_51Mz0948ab12c984f';
    const items = parseText(rawContent);
    const findings = scanItems(items, CANONICAL_RULES);

    const keyFindings = findings.filter(f => f.category === 'API_KEY_CANDIDATE');
    expect(keyFindings.length).toBe(2);
    expect(keyFindings[0].severity).toBe('high');
    expect(keyFindings[0].masked_excerpt).toContain('***');
    expect(keyFindings[0].masked_excerpt).not.toContain('948fbc28a01f7c5e1903');
    expect(keyFindings[1].masked_excerpt).not.toContain('51Mz0948ab12c984f');
  });

  it('should detect private key header marker and never retain the key body', () => {
    const rawContent = [
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEowIBAAKCAQEA0Yk4...',
      'MIIBvgIBAAKCAQEA7bL3...',
      '-----END RSA PRIVATE KEY-----'
    ].join('\n');

    const items = parseText(rawContent);
    const findings = scanItems(items, CANONICAL_RULES);

    const pkFindings = findings.filter(f => f.category === 'PRIVATE_KEY_MARKER');
    expect(pkFindings.length).toBe(1);
    expect(pkFindings[0].severity).toBe('critical');
    expect(pkFindings[0].masked_excerpt).toBe('[MASKED PRIVATE KEY BLOCK]');
    expect(pkFindings[0].location_reference).toBe('line:1');

    // Asserts raw private key body is never present in findings
    const serialized = JSON.stringify(findings);
    expect(serialized).not.toContain('MIIEowIBAAKCAQEA0Yk4');
    expect(serialized).not.toContain('MIIBvgIBAAKCAQEA7bL3');
  });

  it('should detect configurable internal sensitive identifiers', () => {
    const rawContent = 'Worker identity token: LL-ID-A9F2-4801 assigned to sector 7.';
    const items = parseText(rawContent);
    const findings = scanItems(items, CANONICAL_RULES);

    const idFindings = findings.filter(f => f.category === 'SENSITIVE_IDENTIFIER');
    expect(idFindings.length).toBe(1);
    expect(idFindings[0].severity).toBe('medium');
    expect(idFindings[0].masked_excerpt).toBe('LL-ID-***-4801');
  });

  it('should ignore disabled detection rules', () => {
    const modifiedRules = CANONICAL_RULES.map(r => ({
      ...r,
      is_enabled: r.category !== 'EMAIL_ADDRESS' // Disable email rule
    }));

    const rawContent = 'user@example.com with key_live_1234567890abcdef12';
    const items = parseText(rawContent);
    const findings = scanItems(items, modifiedRules);

    expect(findings.some(f => f.category === 'EMAIL_ADDRESS')).toBe(false);
    expect(findings.some(f => f.category === 'API_KEY_CANDIDATE')).toBe(true);
  });

  it('should accurately track locations in structured JSON files', () => {
    const jsonContent = JSON.stringify({
      services: {
        paymentGateway: {
          adminEmail: 'paymaster@fintech.test',
          credential: 'key_live_998877665544332211'
        }
      }
    });

    const items = parseJson(jsonContent);
    const findings = scanItems(items, CANONICAL_RULES);

    const emailFinding = findings.find(f => f.category === 'EMAIL_ADDRESS' && f.location_reference.startsWith('$.'));
    expect(emailFinding).toBeDefined();
    expect(emailFinding.location_reference).toBe('$.services.paymentGateway.adminEmail');

    const keyFinding = findings.find(f => f.category === 'API_KEY_CANDIDATE' && f.location_reference.startsWith('$.'));
    expect(keyFinding).toBeDefined();
    expect(keyFinding.location_reference).toBe('$.services.paymentGateway.credential');
  });

  it('should deduplicate identical findings found across overlapping item representations', () => {
    const items = [
      { location: 'line:1', content: 'test@example.com' },
      { location: 'line:1', content: 'test@example.com' } // Duplicate line representation
    ];

    const findings = scanItems(items, CANONICAL_RULES);
    expect(findings.length).toBe(1);
  });

  it('should verify maskSecret outputs consistent redactions across all categories', () => {
    expect(maskSecret('EMAIL_ADDRESS', 'security.team@company.internal')).toMatch(/^[a-z*]+@[a-z0-9.-]+$/i);
    expect(maskSecret('API_KEY_CANDIDATE', 'key_live_abcdef1234567890')).toContain('***');
    expect(maskSecret('PRIVATE_KEY_MARKER', '-----BEGIN PRIVATE KEY-----')).toBe('[MASKED PRIVATE KEY BLOCK]');
    expect(maskSecret('SENSITIVE_IDENTIFIER', 'LL-ID-8842-9901')).toBe('LL-ID-***-9901');
  });
});
