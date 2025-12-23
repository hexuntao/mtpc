import { getByPath } from '@mtpc/shared';
import type {
  PolicyCondition,
  PolicyConditionType,
  PolicyEvaluationContext,
} from '../types/index.js';

/**
 * Type guards for safe type checking
 */
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Evaluate a single condition
 */
export async function evaluateCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): Promise<boolean> {
  switch (condition.type) {
    case 'field':
      return evaluateFieldCondition(condition, context);
    case 'time':
      return evaluateTimeCondition(condition, context);
    case 'ip':
      return evaluateIpCondition(condition, context);
    case 'custom':
      return evaluateCustomCondition(condition, context);
    default:
      return false;
  }
}

/**
 * Evaluate field condition
 */
function evaluateFieldCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): boolean {
  if (!condition.field || !condition.operator) {
    return false;
  }

  // Resolve field value from context
  const fieldValue = resolveFieldValue(condition.field, context);
  const compareValue = condition.value;

  return compareValues(fieldValue, condition.operator, compareValue);
}

/**
 * Resolve field value from context
 */
function resolveFieldValue(field: string, context: PolicyEvaluationContext): unknown {
  // Support dotted paths like "subject.roles", "resource.status"
  const [source, ...pathParts] = field.split('.');
  const path = pathParts.join('.');

  let sourceObj: unknown;

  switch (source) {
    case 'subject':
      sourceObj = context.subject;
      break;
    case 'tenant':
      sourceObj = context.tenant;
      break;
    case 'resource':
      sourceObj = context.resource;
      break;
    case 'request':
      sourceObj = context.request;
      break;
    case 'environment':
      sourceObj = context.environment;
      break;
    default:
      return undefined;
  }

  if (!path) {
    return sourceObj;
  }

  return getByPath(sourceObj as Record<string, unknown>, path);
}

/**
 * Compare values based on operator with type safety
 */
function compareValues(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;

    // Numeric comparisons with type safety
    case 'gt':
      return isNumber(actual) && isNumber(expected) && actual > expected;
    case 'gte':
      return isNumber(actual) && isNumber(expected) && actual >= expected;
    case 'lt':
      return isNumber(actual) && isNumber(expected) && actual < expected;
    case 'lte':
      return isNumber(actual) && isNumber(expected) && actual <= expected;

    // Array operations
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'notIn':
      return Array.isArray(expected) && !expected.includes(actual);

    // Contains operations with type checking
    case 'contains':
      if (Array.isArray(actual)) {
        return actual.includes(expected);
      }
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.includes(expected);
      }
      return false;

    // String operations
    case 'startsWith':
      return (
        typeof actual === 'string' && typeof expected === 'string' && actual.startsWith(expected)
      );
    case 'endsWith':
      return (
        typeof actual === 'string' && typeof expected === 'string' && actual.endsWith(expected)
      );

    // Regex matching with error handling
    case 'matches':
      if (typeof actual !== 'string' || typeof expected !== 'string') {
        return false;
      }
      try {
        const regex = new RegExp(expected);
        return regex.test(actual);
      } catch {
        // Invalid regex pattern, return false
        return false;
      }

    // Existence checks
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'notExists':
      return actual === undefined || actual === null;

    default:
      return false;
  }
}

/**
 * Evaluate time condition
 */
function evaluateTimeCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): boolean {
  const now = context.request.timestamp;
  const { operator, value } = condition;

  if (!operator || !value || !isValidDate(now)) {
    return false;
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const timeConfig = value as {
      after?: string;
      before?: string;
      dayOfWeek?: number[];
      hourRange?: [number, number];
    };

    // Check after/before with proper validation
    if (timeConfig.after) {
      const afterDate = new Date(timeConfig.after);
      if (isValidDate(afterDate) && now < afterDate) {
        return false;
      }
    }

    if (timeConfig.before) {
      const beforeDate = new Date(timeConfig.before);
      if (isValidDate(beforeDate) && now > beforeDate) {
        return false;
      }
    }

    // Check day of week (0-6)
    if (timeConfig.dayOfWeek && Array.isArray(timeConfig.dayOfWeek)) {
      const dayOfWeek = now.getDay();
      if (timeConfig.dayOfWeek.some(d => typeof d === 'number' && d >= 0 && d <= 6)) {
        if (!timeConfig.dayOfWeek.includes(now.getDay())) {
          return false;
        }
      }
    }

    // Check hour range (0-23)
    if (
      timeConfig.hourRange &&
      Array.isArray(timeConfig.hourRange) &&
      timeConfig.hourRange.length === 2
    ) {
      const hour = now.getHours();
      const [start, end] = timeConfig.hourRange;
      if (
        isNumber(start) &&
        isNumber(end) &&
        start >= 0 &&
        start <= 23 &&
        end >= 0 &&
        end <= 23 &&
        start <= end
      ) {
        if (hour < start || hour > end) {
          return false;
        }
      }
    }

    return true;
  }

  return false;
}

/**
 * Evaluate IP condition
 */
function evaluateIpCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): boolean {
  const clientIp = context.request.ip;

  if (!clientIp || !condition.value) {
    return false;
  }

  const { operator, value } = condition;

  if (operator === 'in' && Array.isArray(value)) {
    return value.some(pattern => matchIp(clientIp, pattern as string));
  }

  if (operator === 'notIn' && Array.isArray(value)) {
    return !value.some(pattern => matchIp(clientIp, pattern as string));
  }

  if (operator === 'eq' && typeof value === 'string') {
    return matchIp(clientIp, value);
  }

  return false;
}

/**
 * Match IP against pattern with improved CIDR support
 * Note: For production, consider using a library like 'ipaddr.js'
 */
function matchIp(ip: string, pattern: string): boolean {
  // Validate IP format (basic IPv4)
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip)) {
    return false;
  }

  // Exact match
  if (ip === pattern) {
    return true;
  }

  // CIDR notation - FIXED implementation
  if (pattern.includes('/')) {
    const parts = pattern.split('/');
    if (parts.length !== 2) {
      return false;
    }

    const [network, prefixLengthStr] = parts;
    const prefixLength = parseInt(prefixLengthStr, 10);

    // Validate CIDR format
    if (
      !ipRegex.test(network) ||
      Number.isNaN(prefixLength) ||
      prefixLength < 0 ||
      prefixLength > 32
    ) {
      return false;
    }

    // Convert IP to 32-bit number
    const ipToInt = (ipAddr: string): number => {
      return ipAddr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    };

    const ipInt = ipToInt(ip);
    const networkInt = ipToInt(network);

    // Create mask
    const mask = (-1 << (32 - prefixLength)) >>> 0;

    // Compare network portions
    return (ipInt & mask) === (networkInt & mask);
  }

  // Wildcard support (e.g., 192.168.1.*)
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '\\d{1,3}') + '$');
    return regex.test(ip);
  }

  return false;
}

/**
 * Evaluate custom condition with better error handling
 */
async function evaluateCustomCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): Promise<boolean> {
  if (!condition.fn) {
    return false;
  }

  try {
    const result = await condition.fn(context);
    return result === true;
  } catch (error) {
    // In production, use a proper logger
    console.error('Custom condition evaluation failed:', error);
    return false;
  }
}

/**
 * Create a field condition
 */
export function fieldCondition(field: string, operator: string, value: unknown): PolicyCondition {
  return { type: 'field', field, operator, value };
}

/**
 * Create a time condition
 */
export function timeCondition(config: {
  after?: string;
  before?: string;
  dayOfWeek?: number[];
  hourRange?: [number, number];
}): PolicyCondition {
  return { type: 'time', operator: 'match', value: config };
}

/**
 * Create an IP condition
 */
export function ipCondition(
  operator: 'in' | 'notIn' | 'eq',
  value: string | string[]
): PolicyCondition {
  return { type: 'ip', operator, value };
}

/**
 * Create a custom condition
 */
export function customCondition(
  fn: (context: PolicyEvaluationContext) => boolean | Promise<boolean>
): PolicyCondition {
  return { type: 'custom', fn };
}
