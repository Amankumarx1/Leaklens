import { errorResponse } from '../utils/apiResponse.js';

/**
 * Validates request payload against a schema specification.
 * 
 * @param {object} schema - Map of field name to validator rules: { type, required, min, max, enum, match }
 * @param {'body' | 'query' | 'params'} [source='body'] - Request source property to validate
 */
export function validateRequest(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source] || {};
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      // Required check
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      // If value is not provided and not required, skip further checks
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Type check
      if (rules.type) {
        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push({ field, message: `${field} must be a string` });
        } else if (rules.type === 'number' && typeof value !== 'number' && isNaN(Number(value))) {
          errors.push({ field, message: `${field} must be a valid number` });
        } else if (rules.type === 'boolean' && typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push({ field, message: `${field} must be a boolean` });
        } else if (rules.type === 'array' && !Array.isArray(value)) {
          errors.push({ field, message: `${field} must be an array` });
        }
      }

      // Enum check
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
      }

      // Min/Max string length
      if (typeof value === 'string') {
        if (rules.min && value.length < rules.min) {
          errors.push({ field, message: `${field} must be at least ${rules.min} characters` });
        }
        if (rules.max && value.length > rules.max) {
          errors.push({ field, message: `${field} cannot exceed ${rules.max} characters` });
        }
        if (rules.match && !rules.match.test(value)) {
          errors.push({ field, message: `${field} format is invalid` });
        }
      }
    }

    if (errors.length > 0) {
      return errorResponse(res, 'Request validation failed', 'VALIDATION_ERROR', 400, errors);
    }

    next();
  };
}

export default validateRequest;
