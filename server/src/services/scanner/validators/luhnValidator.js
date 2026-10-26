/**
 * Luhn Algorithm Checksum Validator
 * Used to validate candidate credit/debit payment card numbers (Visa, MasterCard, Amex, RuPay, Discover)
 * and eliminate false positives from random 15-16 digit sequences.
 */

export function isValidLuhn(numberString) {
  if (!numberString || typeof numberString !== 'string') return false;

  // Clean non-digits (spaces and hyphens)
  const digits = numberString.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;

  let sum = 0;
  let alternate = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    alternate = !alternate;
  }

  return (sum % 10 === 0);
}

export default {
  isValidLuhn
};
