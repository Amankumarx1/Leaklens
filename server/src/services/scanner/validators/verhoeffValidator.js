/**
 * Verhoeff Algorithm Checksum Validator
 * Used by UIDAI for 12-digit Indian Aadhaar number checksum calculation.
 * Defends against false positives when distinguishing random 12-digit numbers
 * from structured identity numbers.
 */

// Multiplication table d
const d = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

// Permutation table p
const p = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

/**
 * Validates whether a number string satisfies the Verhoeff checksum.
 * @param {string} numStr 
 * @returns {boolean}
 */
export function isValidVerhoeff(numStr) {
  if (!numStr || typeof numStr !== 'string') return false;

  const digits = numStr.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return false;

  let c = 0;
  const len = digits.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(digits.charAt(len - 1 - i), 10);
    const perm = p[i % 8][digit];
    c = d[c][perm];
  }

  return c === 0;
}

export default {
  isValidVerhoeff
};
