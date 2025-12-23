import { PERMISSION_SEPARATOR } from '../constants.js';

/**
 * 从资源和操作创建权限代码
 * 权限代码格式为：resource:action
 * @param resource 资源名称
 * @param action 操作名称
 * @returns 权限代码字符串
 */
export function createPermissionCode(resource: string, action: string): string {
  return `${resource}${PERMISSION_SEPARATOR}${action}`;
}

/**
 * 解析权限代码为资源和操作
 * 将格式为 resource:action 的权限代码拆分为资源和操作对象
 * @param code 权限代码字符串
 * @returns 包含资源和操作的对象，如果格式无效则返回 null
 */
export function parsePermissionCode(code: string): {
  resource: string;
  action: string;
} | null {
  const parts = code.split(PERMISSION_SEPARATOR);
  if (parts.length !== 2) {
    return null;
  }
  return {
    resource: parts[0],
    action: parts[1],
  };
}

/**
 * 将字符串转换为 kebab-case 格式
 * 例如："Hello World" -> "hello-world"
 * @param str 要转换的字符串
 * @returns kebab-case 格式的字符串
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * 将字符串转换为 camelCase 格式
 * 例如："hello-world" -> "helloWorld"
 * @param str 要转换的字符串
 * @returns camelCase 格式的字符串
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^./, c => c.toLowerCase());
}

/**
 * 将字符串转换为 PascalCase 格式
 * 例如："hello-world" -> "HelloWorld"
 * @param str 要转换的字符串
 * @returns PascalCase 格式的字符串
 */
export function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * 将字符串转换为 snake_case 格式
 * 例如："Hello World" -> "hello_world"
 * @param str 要转换的字符串
 * @returns snake_case 格式的字符串
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

/**
 * 将单词转换为复数形式（简单实现）
 * 支持常见的复数规则，如：book -> books, city -> cities
 * @param word 要转换的单词
 * @returns 复数形式的单词
 */
export function pluralize(word: string): string {
  if (word.endsWith('y') && !['ay', 'ey', 'iy', 'oy', 'uy'].some(v => word.endsWith(v))) {
    return word.slice(0, -1) + 'ies';
  }
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
    return word + 'es';
  }
  return word + 's';
}

/**
 * 将单词转换为单数形式（简单实现）
 * 支持常见的单数规则，如：books -> book, cities -> city
 * @param word 要转换的单词
 * @returns 单数形式的单词
 */
export function singularize(word: string): string {
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  }
  if (word.endsWith('es')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}
