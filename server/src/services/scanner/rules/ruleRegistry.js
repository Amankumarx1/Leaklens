/**
 * Rule Registry & Rule Lifecycle Manager
 * Provides query, inspection, enablement, and test simulation facilities for detection rules.
 */

import { CANONICAL_RULES } from './ruleDefinitions.js';

class RuleRegistry {
  constructor() {
    this.rules = new Map();
    this.loadRules(CANONICAL_RULES);
  }

  loadRules(ruleList) {
    this.rules.clear();
    for (const rule of ruleList) {
      this.rules.set(rule.rule_id, { ...rule });
    }
  }

  getAllRules() {
    return Array.from(this.rules.values());
  }

  getActiveRules() {
    return Array.from(this.rules.values()).filter(r => r.is_enabled);
  }

  getRuleById(ruleId) {
    return this.rules.get(ruleId) || null;
  }

  getRulesByCategory(category) {
    return Array.from(this.rules.values()).filter(r => r.category === category);
  }

  enableRule(ruleId) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.is_enabled = true;
      return true;
    }
    return false;
  }

  disableRule(ruleId) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.is_enabled = false;
      return true;
    }
    return false;
  }

  resetToDefaults() {
    this.loadRules(CANONICAL_RULES);
  }
}

export const ruleRegistry = new RuleRegistry();
export default ruleRegistry;
