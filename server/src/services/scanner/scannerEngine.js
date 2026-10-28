import { maskSecret, computeSecretFingerprint } from './maskingService.js';
import { CANONICAL_RULES } from './rules/ruleDefinitions.js';
import { isAllowlisted } from './rules/falsePositiveAllowlist.js';
import { isValidLuhn } from './validators/luhnValidator.js';
import { isValidVerhoeff } from './validators/verhoeffValidator.js';
import { isValidIban } from './validators/ibanValidator.js';
import { calculateShannonEntropy } from './validators/entropyCalculator.js';
import { evaluateConfidence } from './validators/contextEvaluator.js';

const SEVERITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0
};

const CONFIDENCE_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1
};

// Generic fallback rules that yield to specialized provider rules when overlapping
const GENERIC_CATEGORIES = new Set([
  'API_KEY_CANDIDATE',
  'HIGH_ENTROPY_SECRET',
  'PASSWORD_CREDENTIAL'
]);

/**
 * Advanced Sensitive-Data Detection Engine
 * Evaluates active rules against parsed file items, performs algorithmic checksum validation
 * (Luhn, Verhoeff, IBAN Mod-97), assesses Shannon entropy, enforces false-positive allowlists,
 * evaluates contextual confidence, performs multi-pass Base64 decoded stream analysis, resolves
 * overlapping candidate spans, and masks all sensitive content.
 *
 * @param {Array<{ location: string, content: string, field_path?: string }>} items - Parsed file segments
 * @param {Array<object>} [customRules] - Optional override rules (defaults to CANONICAL_RULES)
 * @returns {Array<{
 *   rule_id: string,
 *   rule_name: string,
 *   category: string,
 *   severity: string,
 *   confidence: string,
 *   location_reference: string,
 *   field_path?: string,
 *   masked_excerpt: string,
 *   secret_fingerprint: string,
 *   status: string
 * }>}
 */
export function scanItems(items, customRules = null) {
  const activeRules = (customRules || CANONICAL_RULES).filter(r => r.is_enabled && r.pattern);
  
  // Pre-compile regular expressions ONCE per scan execution instead of inside nested loops
  const compiledRules = activeRules.map(rule => {
    const flags = rule.pattern.flags || '';
    const globalFlags = flags.includes('g') ? flags : flags + 'g';
    return {
      rule,
      regex: new RegExp(rule.pattern.source, globalFlags)
    };
  });

  // Multi-pass Base64 Stream Extraction:
  // Detects base64 encoded strings in manifests, environment files, and configs,
  // decodes them safely in memory, and passes the decoded stream for deep inspection.
  const allItemsToScan = [...items];
  const BASE64_PATTERN = /[A-Za-z0-9+/]{32,}={0,2}/g;

  for (const item of items) {
    if (!item.content || typeof item.content !== 'string' || item.content.length < 32) continue;

    BASE64_PATTERN.lastIndex = 0;
    let b64Match;
    let b64Idx = 1;

    while ((b64Match = BASE64_PATTERN.exec(item.content)) !== null) {
      const b64Candidate = b64Match[0];
      if (b64Candidate.length % 4 !== 0 || b64Candidate.length > 32768) continue;

      try {
        const decodedBuf = Buffer.from(b64Candidate, 'base64');
        const decodedStr = decodedBuf.toString('utf8');

        // Verify decoded content contains predominantly printable ASCII/whitespace
        const printableMatches = decodedStr.match(/[\x20-\x7E\r\n\t]/g);
        const printableRatio = printableMatches ? printableMatches.length / decodedStr.length : 0;

        if (printableRatio >= 0.85 && decodedStr.length >= 10 && decodedStr !== b64Candidate) {
          allItemsToScan.push({
            location: `${item.location} [base64-decoded #${b64Idx}]`,
            content: decodedStr,
            field_path: item.field_path ? `${item.field_path}.[b64_decoded_${b64Idx}]` : null
          });
          b64Idx++;
        }
      } catch (_e) {
        // Ignore unparseable binary streams
      }
    }
  }

  // Multi-pass URL-Decoded Stream Extraction:
  // Decodes percent-encoded query parameters and access logs carrying obscured credentials.
  for (const item of items) {
    if (!item.content || typeof item.content !== 'string' || !item.content.includes('%')) continue;

    if (/%[0-9A-Fa-f]{2}/.test(item.content)) {
      try {
        const decoded = decodeURIComponent(item.content.replace(/\+/g, ' '));
        if (decoded && decoded !== item.content && decoded.length >= 8) {
          allItemsToScan.push({
            location: `${item.location} [url-decoded]`,
            content: decoded,
            field_path: item.field_path ? `${item.field_path}.[url_decoded]` : null
          });
        }
      } catch (_e) {
        try {
          const sanitized = item.content.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
          const decoded = decodeURIComponent(sanitized.replace(/\+/g, ' '));
          if (decoded && decoded !== item.content && decoded.length >= 8) {
            allItemsToScan.push({
              location: `${item.location} [url-decoded]`,
              content: decoded,
              field_path: item.field_path ? `${item.field_path}.[url_decoded]` : null
            });
          }
        } catch (_err) {
          // Ignore invalid URL-encoding
        }
      }
    }
  }

  const finalFindings = [];
  const seenDedupKeys = new Set();

  for (const item of allItemsToScan) {
    if (!item.content || typeof item.content !== 'string' || item.content.length === 0) continue;

    const itemCandidates = [];

    for (const { rule, regex } of compiledRules) {
      // Reset stateful index cleanly before scanning this item
      regex.lastIndex = 0;
      let match;

      while ((match = regex.exec(item.content)) !== null) {
        const rawMatchedText = match[0];
        if (!rawMatchedText) {
          regex.lastIndex++; // Advance index to avoid zero-width match loop
          break;
        }

        const matchIndex = match.index;
        const matchLength = rawMatchedText.length;

        // 1. Algorithmic Checksum Validation
        if (rule.validatorName === 'luhn') {
          if (!isValidLuhn(rawMatchedText)) {
            continue; // Suppress random digit sequences failing Luhn check
          }
        } else if (rule.validatorName === 'verhoeff') {
          if (!isValidVerhoeff(rawMatchedText)) {
            continue; // Suppress random 12-digit numbers failing Aadhaar Verhoeff
          }
        } else if (rule.validatorName === 'iban') {
          if (!isValidIban(rawMatchedText)) {
            continue; // Suppress random strings failing ISO 7064 Mod-97 check
          }
        }

        // 2. Shannon Entropy Validation for generic entropy rules
        if (rule.strategy === 'entropy') {
          const entropy = calculateShannonEntropy(rawMatchedText);
          const minEntropy = rule.minEntropy || 4.2;
          if (entropy < minEntropy) {
            continue; // Suppress low-entropy strings
          }
        }

        // 3. False-Positive Allowlist Verification
        if (isAllowlisted(rule.category, rawMatchedText, item.content)) {
          continue; // Suppress documentation placeholders, template tags, or dummy values
        }

        // 4. Context-Aware Confidence Rating
        const confidence = evaluateConfidence(item.content, matchIndex, matchLength, {
          baseConfidence: rule.confidence || 'medium',
          validated: Boolean(rule.validatorName)
        });

        // 5. In-Memory Masking & Salted Fingerprinting
        const maskedExcerpt = maskSecret(rule.category, rawMatchedText);
        const secretFingerprint = computeSecretFingerprint(rawMatchedText);

        itemCandidates.push({
          start: matchIndex,
          end: matchIndex + matchLength,
          length: matchLength,
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          category: rule.category,
          severity: rule.severity,
          confidence,
          location_reference: item.location,
          field_path: item.field_path || (item.location.startsWith('$.') ? item.location : null),
          masked_excerpt: maskedExcerpt,
          secret_fingerprint: secretFingerprint,
          status: 'detected'
        });
      }
    }

    if (itemCandidates.length === 0) continue;

    // 6. Overlapping Span Resolution & Prioritization
    // Sort candidates primarily by starting position, then highest severity, then highest confidence
    itemCandidates.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      const sevDiff = (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0);
      if (sevDiff !== 0) return sevDiff;
      const confDiff = (CONFIDENCE_WEIGHT[b.confidence] || 0) - (CONFIDENCE_WEIGHT[a.confidence] || 0);
      if (confDiff !== 0) return confDiff;
      return b.length - a.length;
    });

    const acceptedCandidates = [];

    for (const candidate of itemCandidates) {
      let isSuppressed = false;

      for (let i = 0; i < acceptedCandidates.length; i++) {
        const accepted = acceptedCandidates[i];

        // Check if candidate overlaps with an already accepted finding
        const overlaps = candidate.start < accepted.end && candidate.end > accepted.start;
        if (overlaps) {
          // If candidate is a generic rule and accepted is a specialized rule, drop candidate
          if (GENERIC_CATEGORIES.has(candidate.category) && !GENERIC_CATEGORIES.has(accepted.category)) {
            isSuppressed = true;
            break;
          }

          // If accepted is a generic rule and candidate is specialized, replace accepted with candidate
          if (!GENERIC_CATEGORIES.has(candidate.category) && GENERIC_CATEGORIES.has(accepted.category)) {
            acceptedCandidates[i] = candidate;
            isSuppressed = true;
            break;
          }

          // Compare severity
          const candSev = SEVERITY_WEIGHT[candidate.severity] || 0;
          const accSev = SEVERITY_WEIGHT[accepted.severity] || 0;
          if (candSev > accSev) {
            acceptedCandidates[i] = candidate;
            isSuppressed = true;
            break;
          } else if (candSev < accSev) {
            isSuppressed = true;
            break;
          }

          // Compare confidence
          const candConf = CONFIDENCE_WEIGHT[candidate.confidence] || 0;
          const accConf = CONFIDENCE_WEIGHT[accepted.confidence] || 0;
          if (candConf > accConf) {
            acceptedCandidates[i] = candidate;
            isSuppressed = true;
            break;
          } else {
            isSuppressed = true;
            break;
          }
        }
      }

      if (!isSuppressed) {
        acceptedCandidates.push(candidate);
      }
    }

    // 7. Deduplicate across multiple item occurrences
    for (const cand of acceptedCandidates) {
      const dedupKey = `${cand.rule_id}::${cand.location_reference}::${cand.masked_excerpt}`;
      if (seenDedupKeys.has(dedupKey)) {
        continue;
      }
      seenDedupKeys.add(dedupKey);

      finalFindings.push({
        rule_id: cand.rule_id,
        rule_name: cand.rule_name,
        category: cand.category,
        severity: cand.severity,
        confidence: cand.confidence,
        location_reference: cand.location_reference,
        field_path: cand.field_path,
        masked_excerpt: cand.masked_excerpt,
        secret_fingerprint: cand.secret_fingerprint,
        status: cand.status
      });
    }
  }

  return finalFindings;
}

export default {
  scanItems
};
