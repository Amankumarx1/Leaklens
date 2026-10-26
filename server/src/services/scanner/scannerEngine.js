import { maskSecret, computeSecretFingerprint } from './maskingService.js';
import { CANONICAL_RULES } from './rules/ruleDefinitions.js';
import { isAllowlisted } from './rules/falsePositiveAllowlist.js';
import { isValidLuhn } from './validators/luhnValidator.js';
import { isValidVerhoeff } from './validators/verhoeffValidator.js';
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
  'HIGH_ENTROPY_SECRET'
]);

/**
 * Advanced Sensitive-Data Detection Engine
 * Evaluates active rules against parsed file items, performs algorithmic checksum validation
 * (Luhn, Verhoeff), assesses Shannon entropy, enforces false-positive allowlists, evaluates
 * contextual confidence, resolves overlapping candidate spans, and masks all sensitive content.
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
  const activeRules = (customRules || CANONICAL_RULES).filter(r => r.is_enabled);
  const finalFindings = [];
  const seenDedupKeys = new Set();

  for (const item of items) {
    if (!item.content || typeof item.content !== 'string') continue;

    const itemCandidates = [];

    for (const rule of activeRules) {
      if (!rule.pattern) continue;

      // Create fresh regex instance to avoid stateful lastIndex bugs
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags || 'g');
      let match;

      while ((match = regex.exec(item.content)) !== null) {
        const rawMatchedText = match[0];
        if (!rawMatchedText) break; // Avoid infinite loop on zero-width match

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
