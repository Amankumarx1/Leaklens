import { describe, it, expect } from 'vitest';
import { isValidIban } from '../server/src/services/scanner/validators/ibanValidator.js';
import { scanItems } from '../server/src/services/scanner/scannerEngine.js';
import { maskSecret } from '../server/src/services/scanner/maskingService.js';
import { CANONICAL_RULES } from '../server/src/services/scanner/rules/ruleDefinitions.js';

describe('Advanced Detection Rules & Capabilities', () => {
  describe('1. ISO 7064 Mod-97 IBAN Validator', () => {
    it('should validate valid International Bank Account Numbers', () => {
      // Valid sample IBANs (mod 97 === 1)
      const validGb = 'GB82WEST12345698765432';
      const validDe = 'DE89370400440532013000';
      const validFr = 'FR1420041010050500013M02606';

      expect(isValidIban(validGb)).toBe(true);
      expect(isValidIban(validDe)).toBe(true);
      expect(isValidIban(validFr)).toBe(true);

      // Spaced format
      expect(isValidIban('GB82 WEST 1234 5698 7654 32')).toBe(true);
    });

    it('should reject tampered or invalid IBANs', () => {
      // Tampered check digits
      expect(isValidIban('GB83WEST12345698765432')).toBe(false);
      expect(isValidIban('DE00370400440532013000')).toBe(false);
      // Bad length or invalid country
      expect(isValidIban('GB1234')).toBe(false);
      expect(isValidIban('ZZ82WEST12345698765432')).toBe(false);
      expect(isValidIban(null)).toBe(false);
      expect(isValidIban('')).toBe(false);
    });
  });

  describe('2. Azure Cloud Secrets Detection', () => {
    it('should detect 512-bit Azure Storage Account Master Keys', () => {
      const azureKey = 'a'.repeat(86) + '==';
      const content = `DefaultEndpointsProtocol=https;AccountName=proddata;AccountKey=${azureKey};EndpointSuffix=core.windows.net`;

      const findings = scanItems([{ location: 'appsettings.json:line 12', content }]);
      const azureFinding = findings.find(f => f.rule_name === 'AZURE_STORAGE_KEY_RULE');

      expect(azureFinding).toBeDefined();
      expect(azureFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(azureFinding.severity).toBe('critical');
      expect(azureFinding.masked_excerpt).toContain('***[MASKED_AZURE_KEY]***');
      expect(azureFinding.masked_excerpt).not.toContain(azureKey);
    });

    it('should detect Azure Blob SAS tokens with signed query parameters', () => {
      const sasToken = '?sv=2021-08-06&ss=b&srt=sco&sp=rwdlacx&se=2026-12-31T23:59:59Z&st=2026-01-01T00:00:00Z&spr=https&sig=dGhpcy1pcy1hLXRlc3QtYXp1cmUtc2FzLXRva2VuLXNpZ25hdHVyZQ==';
      const content = `https://defensevault.blob.core.windows.net/logs/audit.json${sasToken}`;

      const findings = scanItems([{ location: 'export-dump.log:line 4', content }]);
      const sasFinding = findings.find(f => f.rule_name === 'AZURE_SAS_TOKEN_RULE');

      expect(sasFinding).toBeDefined();
      expect(sasFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(sasFinding.severity).toBe('critical');
      expect(sasFinding.masked_excerpt).toContain('sig=***[MASKED_SAS]***');
    });

    it('should detect Azure Cosmos DB master keys', () => {
      const cosmosKey = 'b'.repeat(86) + '==';
      const content = `AccountEndpoint=https://prod-cosmos.documents.azure.com:443/;AccountKey=${cosmosKey};`;

      const findings = scanItems([{ location: 'env.prod:line 8', content }]);
      const cosmosFinding = findings.find(f => f.rule_name === 'AZURE_COSMOS_KEY_RULE');

      expect(cosmosFinding).toBeDefined();
      expect(cosmosFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(cosmosFinding.severity).toBe('critical');
    });
  });

  describe('3. Modern DevOps and Registry Tokens', () => {
    it('should detect GitLab Personal Access Tokens', () => {
      const gitlabPat = ['gl', 'pat-', 'abcdef1234567890_XYZ-'].join('');
      const content = `GITLAB_TOKEN="${gitlabPat}"`;

      const findings = scanItems([{ location: '.gitlab-ci.yml:line 2', content }]);
      const gitlabFinding = findings.find(f => f.rule_name === 'GITLAB_PAT_RULE');

      expect(gitlabFinding).toBeDefined();
      expect(gitlabFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(gitlabFinding.severity).toBe('critical');
      expect(gitlabFinding.masked_excerpt).toContain('glpat-***');
    });

    it('should detect npm registry automation tokens', () => {
      const npmToken = ['np', 'm_', '0123456789abcdef0123456789abcdef0123'].join('');
      const content = `//registry.npmjs.org/:_authToken=${npmToken}`;

      const findings = scanItems([{ location: '.npmrc:line 1', content }]);
      const npmFinding = findings.find(f => f.rule_name === 'NPM_ACCESS_TOKEN_RULE');

      expect(npmFinding).toBeDefined();
      expect(npmFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(npmFinding.masked_excerpt).toContain('npm_***');
    });

    it('should detect PyPI upload API tokens', () => {
      const pypiToken = ['py', 'pi-', 'AgEIcHlwaS5vcmcCJTIzNDU2Nzg5MGFiY2RlZjAxMjM0NTY3ODkwYWJjZGVm'].join('');
      const content = `password = ${pypiToken}`;

      const findings = scanItems([{ location: '.pypirc:line 5', content }]);
      const pypiFinding = findings.find(f => f.rule_name === 'PYPI_UPLOAD_TOKEN_RULE');

      expect(pypiFinding).toBeDefined();
      expect(pypiFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(pypiFinding.masked_excerpt).toContain('pypi-***');
    });

    it('should detect Docker Hub personal access tokens', () => {
      const dockerPat = ['dc', 'kr_', 'pat_', '1234567890abcdef1234567890a'].join('');
      const content = `DOCKER_PASSWORD: ${dockerPat}`;

      const findings = scanItems([{ location: 'docker-compose.yml:line 9', content }]);
      const dockerFinding = findings.find(f => f.rule_name === 'DOCKER_PAT_RULE');

      expect(dockerFinding).toBeDefined();
      expect(dockerFinding.category).toBe('CLOUD_CREDENTIAL');
    });
  });

  describe('4. Cryptographic Key Headers & PII / Financial', () => {
    it('should detect OpenSSH private key PEM markers', () => {
      const content = '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE...';
      const findings = scanItems([{ location: 'id_ed25519:line 1', content }]);
      const sshFinding = findings.find(f => f.rule_name === 'OPENSSH_PRIVATE_KEY_RULE' || f.rule_name === 'PRIVATE_KEY_MARKER_RULE');

      expect(sshFinding).toBeDefined();
      expect(sshFinding.category).toBe('PRIVATE_KEY_MARKER');
      expect(sshFinding.severity).toBe('critical');
    });

    it('should detect PGP private key markers', () => {
      const content = '-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: GnuPG v2...';
      const findings = scanItems([{ location: 'secring.gpg:line 1', content }]);
      const pgpFinding = findings.find(f => f.rule_name === 'PGP_PRIVATE_KEY_RULE');

      expect(pgpFinding).toBeDefined();
      expect(pgpFinding.category).toBe('PRIVATE_KEY_MARKER');
      expect(pgpFinding.severity).toBe('critical');
    });

    it('should detect valid US Social Security Numbers and exclude invalid areas', () => {
      // Valid SSN
      const validSsn = '123-45-6789';
      const validFindings = scanItems([{ location: 'employees.csv:line 3', content: `John Doe,${validSsn}` }]);
      const ssnFinding = validFindings.find(f => f.rule_name === 'US_SSN_RULE');
      expect(ssnFinding).toBeDefined();
      expect(ssnFinding.category).toBe('PERSONAL_IDENTIFIER');
      expect(ssnFinding.masked_excerpt).toBe('***-**-6789');

      // Invalid area 000 or 666
      const invalidFindings = scanItems([{ location: 'test.csv:line 1', content: '000-12-3456 and 666-12-3456' }]);
      expect(invalidFindings.filter(f => f.rule_name === 'US_SSN_RULE').length).toBe(0);
    });

    it('should detect verified IBANs via ISO 7064 Mod-97 and mask them', () => {
      const iban = 'GB82WEST12345698765432';
      const content = `Beneficiary IBAN: ${iban}`;

      const findings = scanItems([{ location: 'wire-transfer.txt:line 7', content }]);
      const ibanFinding = findings.find(f => f.rule_name === 'IBAN_RULE');

      expect(ibanFinding).toBeDefined();
      expect(ibanFinding.category).toBe('FINANCIAL_IDENTIFIER');
      expect(ibanFinding.severity).toBe('critical');
      expect(ibanFinding.masked_excerpt).toContain('GB82 ****');
    });
  });

  describe('5. Multi-Pass Base64 Decoded Stream Scanner', () => {
    it('should decode Base64 encoded secrets in-memory and expose them with decoded provenance', () => {
      // Azure Storage connection string encoded as Base64
      const azureKey = 'k'.repeat(86) + '==';
      const plainSecret = `AccountKey=${azureKey}`;
      const base64Encoded = Buffer.from(plainSecret, 'utf8').toString('base64');

      const k8sManifest = `
apiVersion: v1
kind: Secret
metadata:
  name: azure-storage-secret
data:
  azure-connection: ${base64Encoded}
`;

      const findings = scanItems([{ location: 'k8s/secret.yaml:line 8', content: k8sManifest }]);
      
      // Should find the secret in the decoded stream
      const decodedFinding = findings.find(f => 
        f.rule_name === 'AZURE_STORAGE_KEY_RULE' && 
        f.location_reference.includes('[base64-decoded')
      );

      expect(decodedFinding).toBeDefined();
      expect(decodedFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(decodedFinding.severity).toBe('critical');
      expect(decodedFinding.location_reference).toContain('k8s/secret.yaml:line 8 [base64-decoded');
    });

    it('should decode Base64 encoded AWS keys and Slack tokens', () => {
      const rawAwsKey = 'AKIAIOSFODNN7EXAMPLE';
      const b64Aws = Buffer.from(`AWS_ACCESS_KEY_ID=${rawAwsKey}`, 'utf8').toString('base64');

      const configDump = `config_blob: "${b64Aws}"`;
      const findings = scanItems([{ location: 'config.yml:line 2', content: configDump }]);

      const awsFinding = findings.find(f => 
        f.rule_name === 'AWS_ACCESS_KEY_RULE' && 
        f.location_reference.includes('[base64-decoded')
      );

      expect(awsFinding).toBeDefined();
      expect(awsFinding.category).toBe('CLOUD_CREDENTIAL');
    });
  });

  describe('6. Expanded Cloud & SaaS Service API Credentials', () => {
    it('should detect Google Cloud Service Account JSON credentials', () => {
      const gcpJson = `
{
  "type": "service_account",
  "project_id": "defense-prod",
  "private_key_id": "c1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgk...\\n-----END PRIVATE KEY-----\\n"
}`;
      const findings = scanItems([{ location: 'gcp-sa-key.json:line 2', content: gcpJson }]);
      const gcpFinding = findings.find(f => f.rule_name === 'GCP_SERVICE_ACCOUNT_KEY_RULE');

      expect(gcpFinding).toBeDefined();
      expect(gcpFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(gcpFinding.severity).toBe('critical');
      expect(gcpFinding.masked_excerpt).toBe('[MASKED GCP SERVICE ACCOUNT KEY]');
    });

    it('should detect HashiCorp Vault root and service access tokens', () => {
      const vaultToken = ['s', '123456789012345678901234'].join('.');
      const findings = scanItems([{ location: '.env:line 5', content: `VAULT_TOKEN="${vaultToken}"` }]);
      const vaultFinding = findings.find(f => f.rule_name === 'HASHICORP_VAULT_TOKEN_RULE');

      expect(vaultFinding).toBeDefined();
      expect(vaultFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(vaultFinding.severity).toBe('critical');
      expect(vaultFinding.masked_excerpt).toContain('s.***');
    });

    it('should detect SendGrid mail delivery API keys', () => {
      const sendgridKey = ['S' + 'G', '1234567890123456789012', '1234567890123456789012345678901234567890123'].join('.');
      const findings = scanItems([{ location: 'mail.js:line 10', content: `const apiKey = '${sendgridKey}';` }]);
      const sendgridFinding = findings.find(f => f.rule_name === 'SENDGRID_API_KEY_RULE');

      expect(sendgridFinding).toBeDefined();
      expect(sendgridFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(sendgridFinding.severity).toBe('critical');
      expect(sendgridFinding.masked_excerpt).toContain('SG.***');
    });

    it('should detect Twilio Account SIDs and API tokens', () => {
      const twilioSid = ['A' + 'C', '1234567890abcdef1234567890abcdef'].join('');
      const findings = scanItems([{ location: 'sms.py:line 3', content: `account_sid = '${twilioSid}'` }]);
      const twilioFinding = findings.find(f => f.rule_name === 'TWILIO_CREDENTIAL_RULE');

      expect(twilioFinding).toBeDefined();
      expect(twilioFinding.category).toBe('CLOUD_CREDENTIAL');
      expect(twilioFinding.masked_excerpt).toContain('AC***');
    });

    it('should detect Slack and Discord webhook routing endpoints', () => {
      const slackWebhook = ['https:', '', 'hooks.slack.com', 'services', 'T00000000', 'B00000000', '0123456789abcdef01234567'].join('/');
      const discordWebhook = ['https:', '', 'discord.com', 'api', 'webhooks', '123456789012345678', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'].join('/');

      const slackFindings = scanItems([{ location: 'alerts.ts:line 1', content: slackWebhook }]);
      expect(slackFindings.some(f => f.rule_name === 'SLACK_WEBHOOK_URL_RULE')).toBe(true);

      const discordFindings = scanItems([{ location: 'bot.ts:line 1', content: discordWebhook }]);
      expect(discordFindings.some(f => f.rule_name === 'DISCORD_WEBHOOK_URL_RULE')).toBe(true);
    });

    it('should detect Square payment access tokens and Mailgun keys', () => {
      const squareToken = ['sq0', 'atp-'].join('') + '1234567890123456789012';
      const squareFindings = scanItems([{ location: 'pay.ts:line 1', content: squareToken }]);
      expect(squareFindings.some(f => f.rule_name === 'SQUARE_ACCESS_TOKEN_RULE')).toBe(true);

      const mailgunKey = ['key', '12345678901234567890123456789012'].join('-');
      const mailgunFindings = scanItems([{ location: 'email.ts:line 1', content: mailgunKey }]);
      expect(mailgunFindings.some(f => f.rule_name === 'MAILGUN_API_KEY_RULE')).toBe(true);
    });
  });

  describe('7. Expanded Global Identity & National PII Documents', () => {
    it('should detect UK National Insurance Numbers (NINO)', () => {
      const nino = 'QQ 12 34 56 A';
      const findings = scanItems([{ location: 'payroll.csv:line 4', content: `Employee,${nino}` }]);
      const ninoFinding = findings.find(f => f.rule_name === 'UK_NINO_RULE');

      expect(ninoFinding).toBeDefined();
      expect(ninoFinding.category).toBe('PERSONAL_IDENTIFIER');
      expect(ninoFinding.severity).toBe('high');
      expect(ninoFinding.masked_excerpt).toContain('QQ***');
    });

    it('should validate Canadian Social Insurance Numbers via Luhn mod-10', () => {
      // 046-454-286 passes Luhn mod-10
      const validSin = '046-454-286';
      const validFindings = scanItems([{ location: 'ca-tax.csv:line 2', content: `SIN: ${validSin}` }]);
      const sinFinding = validFindings.find(f => f.rule_name === 'CANADIAN_SIN_RULE');

      expect(sinFinding).toBeDefined();
      expect(sinFinding.category).toBe('PERSONAL_IDENTIFIER');
      expect(sinFinding.severity).toBe('critical');
      expect(sinFinding.masked_excerpt).toBe('***-***-286');

      // 046-454-287 fails Luhn mod-10
      const invalidSin = '046-454-287';
      const invalidFindings = scanItems([{ location: 'ca-tax.csv:line 3', content: `SIN: ${invalidSin}` }]);
      expect(invalidFindings.filter(f => f.rule_name === 'CANADIAN_SIN_RULE').length).toBe(0);
    });

    it('should detect Indian Passport Numbers and Driving Licenses', () => {
      const passport = 'A1234567';
      const dl = 'DL04-20110012345';

      const passportFindings = scanItems([{ location: 'kyc.json:line 2', content: `passport: "${passport}"` }]);
      expect(passportFindings.some(f => f.rule_name === 'INDIAN_PASSPORT_RULE')).toBe(true);

      const dlFindings = scanItems([{ location: 'kyc.json:line 3', content: `license: "${dl}"` }]);
      expect(dlFindings.some(f => f.rule_name === 'INDIAN_DRIVING_LICENSE_RULE')).toBe(true);
    });
  });

  describe('8. Multi-Pass URL-Decoded Stream Scanner', () => {
    it('should decode URL-encoded database connection URLs in access logs', () => {
      const rawDbUri = 'postgres://dbuser:supersecretpass@prod-db.internal:5432/orders';
      const encodedUri = encodeURIComponent(rawDbUri);
      const accessLog = `GET /api/connect?dsn=${encodedUri} HTTP/1.1`;

      const findings = scanItems([{ location: 'access.log:line 102', content: accessLog }]);

      const decodedFinding = findings.find(f => 
        f.rule_name === 'DATABASE_URL_RULE' &&
        f.location_reference.includes('[url-decoded]')
      );

      expect(decodedFinding).toBeDefined();
      expect(decodedFinding.category).toBe('DATABASE_CONNECTION_STRING');
      expect(decodedFinding.severity).toBe('critical');
      expect(decodedFinding.location_reference).toBe('access.log:line 102 [url-decoded]');
      expect(decodedFinding.masked_excerpt).toContain('***');
      expect(decodedFinding.masked_excerpt).not.toContain('supersecretpass');
    });
  });
});
