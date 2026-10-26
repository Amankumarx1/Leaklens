/**
 * Shannon Entropy Calculator
 * Measures information density of candidate secret strings to identify
 * cryptographic keys, high-entropy tokens, and generated passwords.
 */

/**
 * Calculates Shannon entropy in bits per character.
 * @param {string} str 
 * @returns {number}
 */
export function calculateShannonEntropy(str) {
  if (!str || typeof str !== 'string' || str.length === 0) return 0;

  const len = str.length;
  const frequencies = new Map();

  for (let i = 0; i < len; i++) {
    const char = str[i];
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Checks if a string qualifies as high entropy based on its character set.
 * @param {string} token 
 * @param {number} [threshold] 
 * @returns {boolean}
 */
export function isHighEntropy(token, threshold = 4.2) {
  if (!token || token.length < 16) return false;
  return calculateShannonEntropy(token) >= threshold;
}

export default {
  calculateShannonEntropy,
  isHighEntropy
};
