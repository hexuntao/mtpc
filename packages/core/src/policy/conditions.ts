import { getByPath } from '@mtpc/shared';
import type { PolicyCondition, PolicyEvaluationContext } from '../types/index.js';

/**
 * 类型守卫函数，用于安全的类型检查
 * 提供运行时类型验证，确保类型安全
 */

/**
 * 检查值是否为有效数字
 * 排除 NaN 值，确保是有效的数字类型
 *
 * @param value 要检查的值
 * @returns 如果是有效数字返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * isNumber(123); // true
 * isNumber('123'); // false
 * isNumber(NaN); // false
 * isNumber(3.14); // true
 * ```
 */
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * 检查值是否为有效日期
 * 确保是 Date 对象且时间有效（不是 NaN）
 *
 * @param value 要检查的值
 * @returns 如果是有效日期返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * isValidDate(new Date()); // true
 * isValidDate(new Date('invalid')); // false
 * isValidDate('2024-01-01'); // false
 * ```
 */
function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * 评估单个策略条件
 * 根据条件类型分发到不同的评估函数
 * 支持字段条件、时间条件、IP 条件和自定义条件
 *
 * @param condition 策略条件对象，包含类型和值
 * @param context 策略评估上下文，包含租户、主体、权限和资源信息
 * @returns 异步布尔值，表示条件是否满足
 *
 * @example
 * ```typescript
 * // 评估字段条件
 * await evaluateCondition(
 *   { type: 'field', field: 'subject.role', operator: 'eq', value: 'admin' },
 *   context
 * );
 *
 * // 评估时间条件
 * await evaluateCondition(
 *   { type: 'time', operator: 'match', value: { hourRange: [9, 17] } },
 *   context
 * );
 * ```
 */
export async function evaluateCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): Promise<boolean> {
  // 输入验证
  if (!condition || typeof condition !== 'object') {
    return false;
  }

  if (!condition.type || typeof condition.type !== 'string') {
    return false;
  }

  // 根据条件类型分发评估
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
 * 评估字段条件
 * 从上下文中解析字段值并与期望值进行比较
 *
 * @param condition 字段条件对象，包含 field、operator、value
 * @param context 策略评估上下文
 * @returns 布尔值，表示字段条件是否满足
 *
 * @example
 * ```typescript
 * // 检查主体角色是否为管理员
 * evaluateFieldCondition(
 *   { type: 'field', field: 'subject.role', operator: 'eq', value: 'admin' },
 *   context
 * );
 *
 * // 检查资源状态是否在指定数组中
 * evaluateFieldCondition(
 *   { type: 'field', field: 'resource.status', operator: 'in', value: ['active', 'pending'] },
 *   context
 * );
 * ```
 */
function evaluateFieldCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): boolean {
  // 输入验证
  if (!condition.field || typeof condition.field !== 'string') {
    return false;
  }

  if (!condition.operator || typeof condition.operator !== 'string') {
    return false;
  }

  // 从上下文中解析字段值
  const fieldValue = resolveFieldValue(condition.field, context);
  const compareValue = condition.value;

  // 比较字段值和期望值
  return compareValues(fieldValue, condition.operator, compareValue);
}

/**
 * 从上下文中解析字段值
 * 支持点号路径访问，如 "subject.roles"、"resource.status"
 * 支持从多个源解析：subject、tenant、resource、request、environment
 *
 * @param field 字段路径，支持点号分隔的嵌套路径
 * @param context 策略评估上下文
 * @returns 解析出的字段值，如果不存在则返回 undefined
 *
 * @example
 * ```typescript
 * // 解析主体角色
 * resolveFieldValue('subject.role', context);
 *
 * // 解析资源状态
 * resolveFieldValue('resource.status', context);
 *
 * // 解析租户ID
 * resolveFieldValue('tenant.id', context);
 *
 * // 解析请求时间戳
 * resolveFieldValue('request.timestamp', context);
 * ```
 */
function resolveFieldValue(field: string, context: PolicyEvaluationContext): unknown {
  // 支持点号路径，如 "subject.roles", "resource.status"
  const [source, ...pathParts] = field.split('.');
  const path = pathParts.join('.');

  let sourceObj: unknown;

  // 根据源类型选择解析对象
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

  // 如果没有嵌套路径，直接返回源对象
  if (!path) {
    return sourceObj;
  }

  // 使用 getByPath 解析嵌套路径
  return getByPath(sourceObj as Record<string, unknown>, path);
}

/**
 * 根据操作符比较值，确保类型安全
 * 支持多种比较操作：相等、大小比较、包含、正则匹配等
 * 对数字、字符串、数组等类型进行安全处理
 *
 * @param actual 实际值（从上下文中解析）
 * @param operator 比较操作符
 * @param expected 期望值
 * @returns 布尔值，表示比较结果
 *
 * @example
 * ```typescript
 * // 相等比较
 * compareValues('admin', 'eq', 'admin'); // true
 * compareValues(123, 'eq', '123'); // false
 *
 * // 大小比较
 * compareValues(10, 'gt', 5); // true
 * compareValues(10, 'gte', 10); // true
 *
 * // 包含比较
 * compareValues(['a', 'b', 'c'], 'contains', 'a'); // true
 * compareValues('hello world', 'contains', 'world'); // true
 *
 * // 数组包含
 * compareValues('admin', 'in', ['admin', 'user']); // true
 *
 * // 正则匹配
 * compareValues('email@example.com', 'matches', '^\\S+@\\S+\\.\\S+$'); // true
 * ```
 */
function compareValues(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;

    // 数值比较（带类型安全检查）
    case 'gt':
      return isNumber(actual) && isNumber(expected) && actual > expected;
    case 'gte':
      return isNumber(actual) && isNumber(expected) && actual >= expected;
    case 'lt':
      return isNumber(actual) && isNumber(expected) && actual < expected;
    case 'lte':
      return isNumber(actual) && isNumber(expected) && actual <= expected;

    // 数组操作
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'notIn':
      return Array.isArray(expected) && !expected.includes(actual);

    // 包含操作（带类型检查）
    case 'contains':
      if (Array.isArray(actual)) {
        return actual.includes(expected);
      }
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.includes(expected);
      }
      return false;

    // 字符串操作
    case 'startsWith':
      return (
        typeof actual === 'string' && typeof expected === 'string' && actual.startsWith(expected)
      );
    case 'endsWith':
      return (
        typeof actual === 'string' && typeof expected === 'string' && actual.endsWith(expected)
      );

    // 正则表达式匹配（带错误处理）
    case 'matches':
      if (typeof actual !== 'string' || typeof expected !== 'string') {
        return false;
      }
      try {
        const regex = new RegExp(expected);
        return regex.test(actual);
      } catch {
        // 无效的正则表达式模式，返回 false
        return false;
      }

    // 存在性检查
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'notExists':
      return actual === undefined || actual === null;

    default:
      return false;
  }
}

/**
 * 评估时间条件
 * 支持基于时间的访问控制，如工作时间限制、日期范围限制等
 * 支持 after/before、星期几、小时范围等条件
 *
 * @param condition 时间条件对象
 * @param context 策略评估上下文
 * @returns 布尔值，表示时间条件是否满足
 *
 * @example
 * ```typescript
 * // 限制工作时间（9:00-17:00）
 * evaluateTimeCondition(
 *   { type: 'time', operator: 'match', value: { hourRange: [9, 17] } },
 *   context
 * );
 *
 * // 限制星期几（周一到周五）
 * evaluateTimeCondition(
 *   { type: 'time', operator: 'match', value: { dayOfWeek: [1, 2, 3, 4, 5] } },
 *   context
 * );
 *
 * // 限制日期范围
 * evaluateTimeCondition(
 *   { type: 'time', operator: 'match', value: { after: '2024-01-01', before: '2024-12-31' } },
 *   context
 * );
 * ```
 */
function evaluateTimeCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): boolean {
  const now = context.request.timestamp;
  const { operator, value } = condition;

  // 验证输入
  if (!operator || typeof operator !== 'string') {
    return false;
  }

  if (!value) {
    return false;
  }

  if (!isValidDate(now)) {
    return false;
  }

  // 处理复杂时间配置对象
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const timeConfig = value as {
      after?: string;
      before?: string;
      dayOfWeek?: number[];
      hourRange?: [number, number];
    };

    // 检查 after/before（带验证）
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

    // 检查星期几（0-6，0 表示周日）
    if (timeConfig.dayOfWeek && Array.isArray(timeConfig.dayOfWeek)) {
      if (timeConfig.dayOfWeek.some(d => typeof d === 'number' && d >= 0 && d <= 6)) {
        if (!timeConfig.dayOfWeek.includes(now.getDay())) {
          return false;
        }
      }
    }

    // 检查小时范围（0-23）
    if (
      timeConfig.hourRange &&
      Array.isArray(timeConfig.hourRange) &&
      timeConfig.hourRange.length === 2
    ) {
      const hour = now.getUTCHours();
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
 * 评估 IP 条件
 * 支持基于客户端 IP 地址的访问控制
 * 支持精确匹配、IP 列表、CIDR 范围和通配符
 *
 * @param condition IP 条件对象
 * @param context 策略评估上下文
 * @returns 布尔值，表示 IP 条件是否满足
 *
 * @example
 * ```typescript
 * // 精确匹配
 * evaluateIpCondition(
 *   { type: 'ip', operator: 'eq', value: '192.168.1.100' },
 *   context
 * );
 *
 * // IP 列表匹配
 * evaluateIpCondition(
 *   { type: 'ip', operator: 'in', value: ['192.168.1.100', '192.168.1.101'] },
 *   context
 * );
 *
 * // CIDR 范围匹配
 * evaluateIpCondition(
 *   { type: 'ip', operator: 'in', value: ['192.168.1.0/24'] },
 *   context
 * );
 *
 * // 通配符匹配
 * evaluateIpCondition(
 *   { type: 'ip', operator: 'in', value: ['192.168.1.*'] },
 *   context
 * );
 * ```
 */
function evaluateIpCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): boolean {
  const clientIp = context.request.ip;

  // 输入验证
  if (!clientIp || typeof clientIp !== 'string') {
    return false;
  }

  if (!condition.value) {
    return false;
  }

  const { operator, value } = condition;

  // IP 列表匹配
  if (operator === 'in' && Array.isArray(value)) {
    return value.some(pattern => matchIp(clientIp, pattern as string));
  }

  // IP 列表排除匹配
  if (operator === 'notIn' && Array.isArray(value)) {
    return !value.some(pattern => matchIp(clientIp, pattern as string));
  }

  // 精确匹配
  if (operator === 'eq' && typeof value === 'string') {
    return matchIp(clientIp, value);
  }

  return false;
}

/**
 * 匹配 IP 地址与模式
 * 支持精确匹配、CIDR 范围匹配和通配符匹配
 * 使用优化的 CIDR 实现，确保正确的网络段比较
 *
 * @param ip 要检查的 IP 地址
 * @param pattern 匹配模式（IP、CIDR、通配符）
 * @returns 布尔值，表示是否匹配
 *
 * @example
 * ```typescript
 * // 精确匹配
 * matchIp('192.168.1.100', '192.168.1.100'); // true
 *
 * // CIDR 范围匹配
 * matchIp('192.168.1.100', '192.168.1.0/24'); // true
 * matchIp('192.168.2.100', '192.168.1.0/24'); // false
 *
 * // 通配符匹配
 * matchIp('192.168.1.100', '192.168.1.*'); // true
 * matchIp('192.168.1.100', '192.168.*.*'); // true
 *
 * // 无效格式
 * matchIp('invalid-ip', '192.168.1.1'); // false
 * ```
 */
function matchIp(ip: string, pattern: string): boolean {
  // 验证 IP 格式（基本 IPv4 验证）
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip)) {
    return false;
  }

  // 精确匹配
  if (ip === pattern) {
    return true;
  }

  // CIDR 范围匹配 - 已修复的实现
  if (pattern.includes('/')) {
    const parts = pattern.split('/');
    if (parts.length !== 2) {
      return false;
    }

    const [network, prefixLengthStr] = parts;
    const prefixLength = parseInt(prefixLengthStr, 10);

    // 验证 CIDR 格式
    if (
      !ipRegex.test(network) ||
      Number.isNaN(prefixLength) ||
      prefixLength < 0 ||
      prefixLength > 32
    ) {
      return false;
    }

    // 将 IP 转换为 32 位整数
    const ipToInt = (ipAddr: string): number => {
      return ipAddr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    };

    const ipInt = ipToInt(ip);
    const networkInt = ipToInt(network);

    // 创建网络掩码
    const mask = (-1 << (32 - prefixLength)) >>> 0;

    // 比较网络部分
    return (ipInt & mask) === (networkInt & mask);
  }

  // 通配符支持（例如：192.168.1.*）
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '\\d{1,3}') + '$');
    return regex.test(ip);
  }

  return false;
}

/**
 * 评估自定义条件
 * 支持执行自定义评估函数，提供最大的灵活性
 * 包含错误处理，确保评估失败时不会影响整个策略评估
 *
 * @param condition 自定义条件对象，包含评估函数
 * @param context 策略评估上下文
 * @returns 异步布尔值，表示自定义条件是否满足
 *
 * @example
 * ```typescript
 * // 使用自定义函数检查复杂的业务逻辑
 * evaluateCustomCondition(
 *   {
 *     type: 'custom',
 *     fn: async (context) => {
 *       // 复杂的业务逻辑检查
 *       const user = context.subject;
 *       const resource = context.resource;
 *       return user.id === resource.ownerId || user.role === 'admin';
 *     }
 *   },
 *   context
 * );
 *
 * // 同步自定义函数
 * evaluateCustomCondition(
 *   {
 *     type: 'custom',
 *     fn: (context) => {
 *       return context.request.headers['x-api-key'] === 'secret-key';
 *     }
 *   },
 *   context
 * );
 * ```
 */
async function evaluateCustomCondition(
  condition: PolicyCondition,
  context: PolicyEvaluationContext
): Promise<boolean> {
  // 输入验证
  if (!condition.fn || typeof condition.fn !== 'function') {
    return false;
  }

  try {
    // 执行自定义评估函数
    const result = await condition.fn(context);
    return result === true;
  } catch (error) {
    // 在生产环境中，应使用适当的日志记录器
    console.error('Custom condition evaluation failed:', error);
    return false;
  }
}

/**
 * 创建字段条件
 * 便捷工厂函数，用于创建字段比较条件
 *
 * @param field 字段路径，支持点号分隔的嵌套路径
 * @param operator 比较操作符（eq, neq, gt, lt, in, contains, matches 等）
 * @param value 要比较的值
 * @returns 字段条件对象
 *
 * @example
 * ```typescript
 * // 创建相等条件
 * fieldCondition('subject.role', 'eq', 'admin');
 *
 * // 创建包含条件
 * fieldCondition('resource.tags', 'contains', 'urgent');
 *
 * // 创建列表包含条件
 * fieldCondition('subject.permissions', 'in', ['read', 'write']);
 *
 * // 创建正则匹配条件
 * fieldCondition('resource.email', 'matches', '^\\S+@company\\.com$');
 * ```
 */
export function fieldCondition(field: string, operator: string, value: unknown): PolicyCondition {
  return { type: 'field', field, operator, value };
}

/**
 * 创建时间条件
 * 便捷工厂函数，用于创建基于时间的访问控制条件
 *
 * @param config 时间配置对象
 * @param config.after 起始时间（ISO 字符串）
 * @param config.before 结束时间（ISO 字符串）
 * @param config.dayOfWeek 允许的星期几数组（0-6，0 表示周日）
 * @param config.hourRange 允许的小时范围 [start, end]（0-23）
 * @returns 时间条件对象
 *
 * @example
 * ```typescript
 * // 工作时间限制（周一到周五 9:00-17:00）
 * timeCondition({
 *   dayOfWeek: [1, 2, 3, 4, 5],
 *   hourRange: [9, 17]
 * });
 *
 * // 日期范围限制
 * timeCondition({
 *   after: '2024-01-01',
 *   before: '2024-12-31'
 * });
 *
 * // 周末限制
 * timeCondition({
 *   dayOfWeek: [6, 0] // 周六和周日
 * });
 * ```
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
 * 创建 IP 条件
 * 便捷工厂函数，用于创建基于 IP 地址的访问控制条件
 *
 * @param operator 操作符（in, notIn, eq）
 * @param value IP 地址、IP 模式或 IP 数组
 * @returns IP 条件对象
 *
 * @example
 * ```typescript
 * // 允许特定 IP
 * ipCondition('eq', '192.168.1.100');
 *
 * // 允许 IP 列表
 * ipCondition('in', ['192.168.1.100', '192.168.1.101']);
 *
 * // 允许 IP 范围（CIDR）
 * ipCondition('in', ['192.168.1.0/24']);
 *
 * // 允许通配符 IP
 * ipCondition('in', ['192.168.1.*']);
 *
 * // 排除特定 IP
 * ipCondition('notIn', ['192.168.1.100']);
 * ```
 */
export function ipCondition(
  operator: 'in' | 'notIn' | 'eq',
  value: string | string[]
): PolicyCondition {
  return { type: 'ip', operator, value };
}

/**
 * 创建自定义条件
 * 便捷工厂函数，用于创建执行自定义逻辑的条件
 *
 * @param fn 自定义评估函数，接收评估上下文并返回布尔值或布尔 Promise
 * @returns 自定义条件对象
 *
 * @example
 * ```typescript
 * // 同步自定义条件
 * customCondition((context) => {
 *   return context.subject.role === 'admin' && context.resource.ownerId === context.subject.id;
 * });
 *
 * // 异步自定义条件
 * customCondition(async (context) => {
 *   // 复杂的数据库查询或 API 调用
 *   const isOwner = await checkResourceOwnership(context.subject.id, context.resource.id);
 *   return isOwner;
 * });
 *
 * // 复杂业务逻辑
 * customCondition((context) => {
 *   const now = new Date();
 *   const hour = now.getHours();
 *   const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
 *   return isWeekday && hour >= 9 && hour <= 17;
 * });
 * ```
 */
export function customCondition(
  fn: (context: PolicyEvaluationContext) => boolean | Promise<boolean>
): PolicyCondition {
  return { type: 'custom', fn };
}
