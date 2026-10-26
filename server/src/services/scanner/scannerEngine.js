import { maskSecret } from './maskingService.js';
import { CANONICAL_RULES } from './rules/ruleDefinitions.js';

/**
 * Core Sensitive-Data Detection Engine
 * Evaluates active rules against parsed content items and generates masked findings.
 *
 * @param {Array<{ location: string, content: string }>} items - Parsed file segments
 * @param {Array<object>} [customRules] - Optional override rules (defaults to CANONICAL_RULES)
 * @returns {Array<{ rule_id: string, rule_name: string, category: string, severity: string, location_reference: string, masked_excerpt: string, status: string }>}
 */
export function scanItems(items, customRules = null) {
  const activeRules = (customRules || CANONICAL_RULES).filter(r => r.is_enabled);
  const findings = [];
  const seenKeys = new Set();

  for (const item of items) {
    if (!item.content || typeof item.content !== 'string') continue;

    for (const rule of activeRules) {
      // Create fresh regex instance to avoid stateful lastIndex bugs
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags || 'g');
      let match;

      while ((match = regex.exec(item.content)) !== null) {
        const rawMatchedText = match[0];
        if (!rawMatchedText) break; // Avoid infinite loops on 0-width match

        // Mask the sensitive value immediately in memory
        const maskedExcerpt = maskSecret(rule.category, rawMatchedText);

        // Deduplication key: rule + location + maskedExcerpt
        const dedupKey = `${rule.rule_id}::${item.location}::${maskedExcerpt}`;
        if (seenKeys.has(dedupKey)) {
          continue;
        }
        seenKeys.add(dedupKey);

        findings.push({
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          category: rule.category,
          severity: rule.severity,
          location_reference: item.location,
          masked_excerpt: maskedExcerpt,
          status: 'detected'
        });
      }
    }
  }

  return findings;
}

export default {
  scanItems
};
