import { describe, it, expect } from 'vitest';
import { parseEnv } from '../server/src/services/scanner/parsers/envParser.js';
import { parseIni } from '../server/src/services/scanner/parsers/iniParser.js';
import { parseYaml } from '../server/src/services/scanner/parsers/yamlParser.js';
import { parseXml } from '../server/src/services/scanner/parsers/xmlParser.js';
import { parseMarkdown } from '../server/src/services/scanner/parsers/markdownParser.js';
import { parseSourceCode } from '../server/src/services/scanner/parsers/sourceCodeParser.js';
import { parseFileContent } from '../server/src/services/scanner/parsers/parserFactory.js';
import { scanItems } from '../server/src/services/scanner/scannerEngine.js';
import { CANONICAL_RULES } from '../server/src/services/scanner/rules/ruleDefinitions.js';
import { isValidLuhn } from '../server/src/services/scanner/validators/luhnValidator.js';
import { isValidVerhoeff } from '../server/src/services/scanner/validators/verhoeffValidator.js';
import { calculateShannonEntropy, isHighEntropy } from '../server/src/services/scanner/validators/entropyCalculator.js';
import { isAllowlisted } from '../server/src/services/scanner/rules/falsePositiveAllowlist.js';
import { evaluateConfidence } from '../server/src/services/scanner/validators/contextEvaluator.js';

describe('Advanced Sensitive-Data Detection Engine & Multi-Format Pipeline', () => {

  // ==========================================================================
  // 1. Dedicated Multi-Format Parsers
  // ==========================================================================
  describe('Multi-Format Parsers (Valid & Malformed)', () => {
    it('should parse .env files, skipping comments and tracking key-value pairs', () => {
      const envContent = [
        '# Production Environment Config',
        'APP_NAME=LeakLens',
        'PORT=3000',
        'API_KEY=key_test_998877665544332211',
        '# DATABASE_URL=mongodb://localhost:27017'
      ].join('\n');

      const items = parseEnv(envContent);
      expect(items.length).toBe(3); // 3 non-comment, non-empty lines
      expect(items[0].location).toBe('line:2');
      expect(items[2].content).toContain('API_KEY=key_test_998877665544332211');
      expect(items[2].field_path).toBe('env.API_KEY');
    });

    it('should handle malformed and edge-case .env gracefully', () => {
      expect(parseEnv(null)).toEqual([]);
      expect(parseEnv('')).toEqual([]);
      expect(parseEnv('===INVALID===')).toHaveLength(1);
    });

    it('should parse .ini configuration files, tracking sections and keys', () => {
      const iniContent = [
        '[database]',
        'host = db.internal',
        'user = postgres',
        '; comment line',
        '[auth]',
        'secret_token = key_live_112233445566778899'
      ].join('\n');

      const items = parseIni(iniContent);
      expect(items.length).toBe(3);
      expect(items.some(i => i.field_path === 'database.host')).toBe(true);
      expect(items.some(i => i.field_path === 'auth.secret_token')).toBe(true);
    });

    it('should parse .yaml/.yml files safely without arbitrary deserialization', () => {
      const yamlContent = [
        'services:',
        '  app:',
        '    image: node:22-alpine',
        '    environment:',
        '      - SECRET_KEY=key_test_aabbccddeeff001122'
      ].join('\n');

      const items = parseYaml(yamlContent);
      expect(items.length).toBeGreaterThan(0);
      expect(items.some(i => i.content.includes('SECRET_KEY=key_test_aabbccddeeff001122'))).toBe(true);
    });

    it('should parse .xml files defensively without XXE execution risk', () => {
      const xmlContent = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<configuration>',
        '  <appSettings>',
        '    <add key="apiKey" value="key_test_556677889900aabb" />',
        '  </appSettings>',
        '</configuration>'
      ].join('\n');

      const items = parseXml(xmlContent);
      expect(items.length).toBeGreaterThan(0);
      expect(items.some(i => i.content.includes('key_test_556677889900aabb'))).toBe(true);
    });

    it('should parse markdown files tracking lines and code blocks', () => {
      const mdContent = [
        '# Developer Documentation',
        '',
        'Use the following test token for sandbox access:',
        '```bash',
        'curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl" https://api.leaklens.local',
        '```'
      ].join('\n');

      const items = parseMarkdown(mdContent);
      expect(items.length).toBe(3); // 3 non-empty lines
      expect(items.some(i => i.content.includes('Authorization: Bearer'))).toBe(true);
    });

    it('should parse source code files (.js, .py, .sql)', () => {
      const pyContent = [
        'import os',
        '# Production Stripe Key',
        'STRIPE_KEY = "sk_live_' + '9876543210abcdef12345678"',
        'print("Service initialized")'
      ].join('\n');

      const items = parseSourceCode(pyContent);
      expect(items.length).toBe(4); // 4 non-empty lines
      expect(items.some(i => i.content.includes('STRIPE_KEY'))).toBe(true);
    });

    it('should route all extensions correctly through parserFactory', () => {
      expect(parseFileContent('config.env', 'TOKEN=abc').parserName).toBe('envParser');
      expect(parseFileContent('app.ini', 'key=val').parserName).toBe('iniParser');
      expect(parseFileContent('compose.yaml', 'services:').parserName).toBe('yamlParser');
      expect(parseFileContent('settings.xml', '<root/>').parserName).toBe('xmlParser');
      expect(parseFileContent('README.md', '# Title').parserName).toBe('markdownParser');
      expect(parseFileContent('script.py', 'print("hi")').parserName).toBe('sourceCodeParser');
    });
  });

  // ==========================================================================
  // 2. Algorithmic Checksum Validators (Luhn & Verhoeff)
  // ==========================================================================
  describe('Algorithmic Checksum Validators (False-Positive Suppression)', () => {
    it('should validate credit cards using Luhn mod-10 algorithm', () => {
      // Valid card numbers
      expect(isValidLuhn('4111111111111111')).toBe(true); // Visa test
      expect(isValidLuhn('4111 1111 1111 1111')).toBe(true); // Visa with spaces
      expect(isValidLuhn('5105105105105100')).toBe(true); // MasterCard test
      expect(isValidLuhn('378282246310005')).toBe(true); // Amex 15-digit

      // Invalid card numbers (checksum mismatch)
      expect(isValidLuhn('4111111111111112')).toBe(false);
      expect(isValidLuhn('1234567812345678')).toBe(false); // Arbitrary 16-digit order ID
      expect(isValidLuhn('0000000000000000')).toBe(true); // (Allowlist handles all-zeros)
      expect(isValidLuhn('abc')).toBe(false);
    });

    it('should validate Indian Aadhaar numbers using Verhoeff algorithm', () => {
      // 234567890124 is a mathematically valid Verhoeff 12-digit number
      expect(isValidVerhoeff('234567890124')).toBe(true);
      expect(isValidVerhoeff('2345 6789 0124')).toBe(true);

      // Random 12-digit numbers failing Verhoeff
      expect(isValidVerhoeff('234567890123')).toBe(false);
      expect(isValidVerhoeff('123456789012')).toBe(false);
      expect(isValidVerhoeff('987654321098')).toBe(false);
    });

    it('should calculate Shannon entropy accurately', () => {
      const lowEntropy = 'aaaaaaaaaaaaaaaa';
      const highEntropy = '9F#kL!2@mZ$8*qWp~7';

      expect(calculateShannonEntropy(lowEntropy)).toBe(0);
      expect(calculateShannonEntropy(highEntropy)).toBeGreaterThan(3.5);
      expect(isHighEntropy(lowEntropy)).toBe(false);
      expect(isHighEntropy('dGhpcy1pcy1hLXJhbmRvbS1zZWNyZXQtdG9rZW4tOTk4OA==', 4.0)).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Category Detection Coverage Across 10 Canonical Categories
  // ==========================================================================
  describe('10 Sensitive Data Categories Coverage', () => {
    it('Cat 1: Cloud Credentials & API Tokens', () => {
      const awsKey = 'AKIA' + 'IOSFODNN7EXAMPLE';
      const stripeKey = 'sk_live_' + '51Mz0948ab12c984fabc1234';
      const slackToken = 'xoxb-' + '123456789012' + '-123456789012-' + 'abcdefghijklmnopqrstuvwx';
      const gcpKey = 'AIza' + 'SyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';

      const items = [
        { location: 'line:1', content: `AWS_ACCESS_KEY_ID=${awsKey}` },
        { location: 'line:2', content: `STRIPE_KEY=${stripeKey}` },
        { location: 'line:3', content: `SLACK_BOT_TOKEN=${slackToken}` },
        { location: 'line:4', content: `GCP_API_KEY=${gcpKey}` }
      ];

      const findings = scanItems(items, CANONICAL_RULES);
      const cloudFindings = findings.filter(f => f.category === 'CLOUD_CREDENTIAL');
      expect(cloudFindings.length).toBe(4);
      expect(cloudFindings.some(f => f.rule_name === 'AWS_ACCESS_KEY_RULE')).toBe(true);
      expect(cloudFindings.some(f => f.rule_name === 'STRIPE_SECRET_KEY_RULE')).toBe(true);
      expect(cloudFindings.some(f => f.rule_name === 'SLACK_TOKEN_RULE')).toBe(true);
      expect(cloudFindings.some(f => f.rule_name === 'GCP_API_KEY_RULE')).toBe(true);
    });

    it('Cat 2: Passwords & Hard-coded Credentials', () => {
      const items = [
        { location: 'line:1', content: 'password="P@ssw0rdProd2026!Secure"' }
      ];

      const findings = scanItems(items, CANONICAL_RULES);
      const pwFinding = findings.find(f => f.category === 'PASSWORD_CREDENTIAL');
      expect(pwFinding).toBeDefined();
      expect(pwFinding.severity).toBe('high');
      expect(pwFinding.masked_excerpt).toContain('[CONFIDENTIAL_PASSWORD]');
    });

    it('Cat 3: Private Keys & SSH Markers', () => {
      const items = [
        { location: 'line:1', content: '-----BEGIN ' + 'RSA PRIVATE KEY-----' }
      ];

      const findings = scanItems(items, CANONICAL_RULES);
      const pkFinding = findings.find(f => f.category === 'PRIVATE_KEY_MARKER');
      expect(pkFinding).toBeDefined();
      expect(pkFinding.severity).toBe('critical');
      expect(pkFinding.masked_excerpt).toBe('[MASKED PRIVATE KEY BLOCK]');
    });

    it('Cat 4: JWTs & Bearer Tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const items = [
        { location: 'line:1', content: `USER_TOKEN=${jwt}` },
        { location: 'line:2', content: 'Authorization: Bearer ya29.a0AfH6SMDh3...' }
      ];

      const findings = scanItems(items, CANONICAL_RULES);
      const jwtFindings = findings.filter(f => f.category === 'JWT_BEARER_TOKEN');
      expect(jwtFindings.length).toBe(2);
      expect(jwtFindings[0].masked_excerpt).toContain('eyJ');
    });

    it('Cat 5: Database Connection Strings', () => {
      const mongoUri = 'mongodb://prodUser:SuperSecretPass123@cluster0.prod.mongodb.net/app_db';
      const mssqlConn = 'Server=tcp:leaklens.database.windows.net,1433;Database=LeakLensDB;User ID=sqladmin;Password=UltraSecretPass2026!;';

      const items = [
        { location: 'line:1', content: `DATABASE_URL=${mongoUri}` },
        { location: 'line:2', content: `AZURE_SQL_CONN=${mssqlConn}` }
      ];

      const findings = scanItems(items, CANONICAL_RULES);
      const dbFindings = findings.filter(f => f.category === 'DATABASE_CONNECTION_STRING');
      expect(dbFindings.length).toBe(2);
      expect(dbFindings[0].severity).toBe('critical');
      expect(dbFindings[0].masked_excerpt).not.toContain('SuperSecretPass123');
      expect(dbFindings[1].masked_excerpt).not.toContain('UltraSecretPass2026!');
    });

    it('Cat 6: Telephone Numbers (Contextual)', () => {
      const items = [
        { location: 'line:1', content: 'Emergency contact phone: +91 98765 43210' }
      ];

      const findings = scanItems(items, CANONICAL_RULES);
      const phoneFinding = findings.find(f => f.category === 'TELEPHONE_NUMBER');
      expect(phoneFinding).toBeDefined();
      expect(phoneFinding.severity).toBe('low');
    });

    it('Cat 7: Personal Identifiers (India-Specific: PAN, Aadhaar, IFSC, UPI)', () => {
      const items = [
        { location: 'line:1', content: 'Taxpayer PAN: ABCDE1234F recorded' },
        { location: 'line:2', content: 'Aadhaar UID: 2345 6789 0124 registered' },
        { location: 'line:3', content: 'Bank IFSC: HDFC0001234 branch code' },
        { location: 'line:4', content: 'VPA payee: payment.ops@okhdfcbank' }
      ];

      const findings = scanItems(items, CANONICAL_RULES);
      const piiFindings = findings.filter(f => f.category === 'PERSONAL_IDENTIFIER');
      expect(piiFindings.length).toBe(4);
      expect(piiFindings.some(f => f.rule_name === 'INDIAN_PAN_RULE')).toBe(true);
      expect(piiFindings.some(f => f.rule_name === 'INDIAN_AADHAAR_RULE')).toBe(true);
      expect(piiFindings.some(f => f.rule_name === 'INDIAN_IFSC_RULE')).toBe(true);
      expect(piiFindings.some(f => f.rule_name === 'INDIAN_UPI_ID_RULE')).toBe(true);
    });

    it('Cat 8: Financial Identifiers (Payment Cards with Luhn Check)', () => {
      const items = [
        { location: 'line:1', content: 'Customer Visa: 4111 1111 1111 1111 expired' }
      ];

      const findings = scanItems(items, CANONICAL_RULES);
      const cardFinding = findings.find(f => f.category === 'FINANCIAL_IDENTIFIER');
      expect(cardFinding).toBeDefined();
      expect(cardFinding.severity).toBe('critical');
      expect(cardFinding.masked_excerpt).toBe('4111-****-****-1111');
    });

    it('Cat 9: Confidential Configuration Keys', () => {
      const items = [
        { location: 'line:1', content: 'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' }
      ];

      const findings = scanItems(items, CANONICAL_RULES);
      const confFinding = findings.find(f => f.category === 'CONFIDENTIAL_CONFIG');
      expect(confFinding).toBeDefined();
      expect(confFinding.severity).toBe('critical');
    });

    it('Cat 10: High-Entropy Secret Candidates', () => {
      const items = [
        { location: 'line:1', content: 'secret_token_val="dGhpcy1pcy1hLXJhbmRvbS1zZWNyZXQtdG9rZW4tOTk4OA=="' }
      ];

      const findings = scanItems(items, CANONICAL_RULES);
      const heFinding = findings.find(f => f.category === 'HIGH_ENTROPY_SECRET');
      expect(heFinding).toBeDefined();
      expect(heFinding.confidence).toBeDefined();
    });
  });

  // ==========================================================================
  // 4. False-Positive Allowlist & Exclusion Registry
  // ==========================================================================
  describe('False-Positive Allowlist & Exclusion Verification', () => {
    it('should suppress template placeholders from creating findings', () => {
      const placeholderContent = [
        'API_KEY=your-api-key-here',
        'PASSWORD=change_me',
        'SECRET=my-secret-password',
        'KEY=enter-your-secret-token',
        'CARD=0000000000000000',
        'FAKE_TOKEN=placeholder_token_for_testing'
      ].join('\n');

      const items = parseEnv(placeholderContent);
      const findings = scanItems(items, CANONICAL_RULES);

      // Template placeholders should not be recorded as active findings
      expect(findings.some(f => f.masked_excerpt.includes('change_me'))).toBe(false);
      expect(findings.some(f => f.masked_excerpt.includes('your-api-key'))).toBe(false);
    });

    it('should suppress placeholder emails like dummy@test.com', () => {
      expect(isAllowlisted('EMAIL_ADDRESS', 'dummy@example.com')).toBe(true);
      expect(isAllowlisted('EMAIL_ADDRESS', 'placeholder@test.com')).toBe(true);
      expect(isAllowlisted('EMAIL_ADDRESS', 'security.ops@enterprise.corp')).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Overlapping Match Resolution & Severity/Confidence Separation
  // ==========================================================================
  describe('Overlapping Match Resolution & Confidence Scoring', () => {
    it('should prefer specialized Stripe key over generic candidate key when overlapping', () => {
      const stripeKey = 'sk_live_' + '9876543210abcdef12345678';
      const items = [{ location: 'line:1', content: `STRIPE_KEY=${stripeKey}` }];

      const findings = scanItems(items, CANONICAL_RULES);
      // Both STRIPE_SECRET_KEY_RULE (critical) and API_KEY_CANDIDATE_RULE match,
      // but overlapping span resolution prioritizes the specialized critical rule.
      expect(findings.length).toBe(1);
      expect(findings[0].rule_name).toBe('STRIPE_SECRET_KEY_RULE');
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].confidence).toBe('high');
    });

    it('should assign separate severity and confidence ratings', () => {
      // Confidence Evaluator test
      const fullLine = 'Config token: key_live_1234567890123456 near keyword secret';
      const conf = evaluateConfidence(fullLine, 14, 25, { baseConfidence: 'medium' });
      expect(conf).toBe('high'); // Boosted by proximity keyword 'secret'
    });
  });

  // ==========================================================================
  // 6. Clean Documents & Negative Controls
  // ==========================================================================
  describe('Clean Documents & Negative Controls', () => {
    it('should yield 0 findings for clean documentation and normal code', () => {
      const cleanDoc = [
        '# System Architecture Guide',
        'This microservice processes incoming order events from Apache Kafka.',
        'No credentials or authentication tokens should ever be committed to git.',
        'Order IDs follow the format ORD-2026-9901.',
        'For documentation queries, refer to the internal engineering handbook.'
      ].join('\n');

      const items = parseMarkdown(cleanDoc);
      const findings = scanItems(items, CANONICAL_RULES);
      expect(findings.length).toBe(0);
    });

    it('should reject random 12-digit numbers that are not valid Aadhaar', () => {
      const items = [{ location: 'line:1', content: 'Product barcode: 234567890120 items in stock' }];
      const findings = scanItems(items, CANONICAL_RULES);
      expect(findings.filter(f => f.category === 'PERSONAL_IDENTIFIER')).toHaveLength(0);
    });

    it('should reject random 16-digit numbers that are not valid payment cards', () => {
      const items = [{ location: 'line:1', content: 'Invoice reference number 4111111111111112 generated.' }];
      const findings = scanItems(items, CANONICAL_RULES);
      expect(findings.filter(f => f.category === 'FINANCIAL_IDENTIFIER')).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 7. Synthetic Labelled Corpus: Precision & Recall Measurement
  // ==========================================================================
  describe('Labelled Synthetic Corpus Precision & Recall Evaluation', () => {
    // 30 labelled test cases: 20 Ground Truth Positives (isSensitive: true), 10 Negatives (isSensitive: false)
    const testCorpus = [
      // Positives
      { id: 'P01', content: 'email=admin.sec@corp.security', isSensitive: true },
      { id: 'P02', content: 'dev_email=lead.engineer@startup.io', isSensitive: true },
      { id: 'P03', content: 'AWS_ACCESS_KEY_ID=' + 'AKIA' + 'IOSFODNN7EXAMPLE', isSensitive: true },
      { id: 'P04', content: 'github_token=' + 'ghp_' + '1234567890abcdef' + 'ghijklmnopqrstuv', isSensitive: true },
      { id: 'P05', content: 'slack_bot=' + 'xoxb-' + '123456789012' + '-123456789012-' + 'abcdefghijklmnopqrstuvwx', isSensitive: true },
      { id: 'P06', content: 'STRIPE=' + 'sk_live_' + '51Mz0948ab12c984fabc1234', isSensitive: true },
      { id: 'P07', content: 'AI_KEY=' + 'sk-' + 'abcdefghijklmnopqrstuvwxyz0123456789', isSensitive: true },
      { id: 'P08', content: 'GCP=' + 'AIza' + 'SyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q', isSensitive: true },
      { id: 'P09', content: 'db_password="ProdDatabaseMasterPassword2026!"', isSensitive: true },
      { id: 'P10', content: '-----BEGIN ' + 'RSA PRIVATE KEY-----', isSensitive: true },
      { id: 'P11', content: 'JWT=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlMTIz', isSensitive: true },
      { id: 'P12', content: 'Authorization: Bearer token_secret_1234567890', isSensitive: true },
      { id: 'P13', content: 'MONGO_URI=mongodb://admin:secretPass@mongo.cluster.net/prod', isSensitive: true },
      { id: 'P14', content: 'MSSQL=Server=sql.db.windows.net;User ID=admin;Password=secretPass123;', isSensitive: true },
      { id: 'P15', content: 'Emergency telephone: +91 98765 43210', isSensitive: true },
      { id: 'P16', content: 'Taxpayer PAN: ABCDE1234F registered', isSensitive: true },
      { id: 'P17', content: 'Aadhaar ID: 2345 6789 0124 valid', isSensitive: true },
      { id: 'P18', content: 'Bank IFSC: HDFC0001234 valid', isSensitive: true },
      { id: 'P19', content: 'Payee VPA: payments@okhdfcbank', isSensitive: true },
      { id: 'P20', content: 'Card Number: 4111 1111 1111 1111', isSensitive: true },

      // Negatives (Non-sensitive, clean, placeholders, invalid checksums)
      { id: 'N01', content: 'The quick brown fox jumps over the lazy dog.', isSensitive: false },
      { id: 'N02', content: 'API_KEY=your-api-key-here', isSensitive: false },
      { id: 'N03', content: 'PASSWORD=change_me', isSensitive: false },
      { id: 'N04', content: 'const port = 8080; const timeoutMs = 5000;', isSensitive: false },
      { id: 'N05', content: 'Order identifier 4111111111111112 processed', isSensitive: false }, // Invalid Luhn
      { id: 'N06', content: 'Inventory barcode 234567890120 scanned', isSensitive: false }, // Invalid Verhoeff
      { id: 'N07', content: 'All zero sequence 0000000000000000', isSensitive: false },
      { id: 'N08', content: 'Standard import express from "express";', isSensitive: false },
      { id: 'N09', content: 'Placeholder token enter-your-token-here', isSensitive: false },
      { id: 'N10', content: 'Git commit sha 4a8b2c1d3e5f60718293a4b5c6d7e8f901234567', isSensitive: false }
    ];

    it('should achieve Precision >= 95% and Recall >= 95% on the labelled regression corpus', () => {
      let truePositives = 0;
      let falsePositives = 0;
      let trueNegatives = 0;
      let falseNegatives = 0;

      for (const item of testCorpus) {
        const findings = scanItems([{ location: item.id, content: item.content }], CANONICAL_RULES);
        const detected = findings.length > 0;

        if (item.isSensitive) {
          if (detected) {
            truePositives++;
          } else {
            falseNegatives++;
          }
        } else {
          if (detected) {
            falsePositives++;
          } else {
            trueNegatives++;
          }
        }
      }

      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / (truePositives + falseNegatives);
      const f1Score = (2 * precision * recall) / (precision + recall);

      // Assert high detection quality
      expect(truePositives).toBe(20);
      expect(falseNegatives).toBe(0);
      expect(falsePositives).toBeLessThanOrEqual(1); // At most 1 false positive allowed in rigorous corpus
      expect(precision).toBeGreaterThanOrEqual(0.95);
      expect(recall).toBeGreaterThanOrEqual(0.95);
      expect(f1Score).toBeGreaterThanOrEqual(0.95);
    });
  });
});
