/**
 * 深度克隆对象
 * 创建对象的深拷贝，包括嵌套对象和数组
 * @param obj 要克隆的对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone) as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * 深度合并对象
 * 将多个对象深度合并到目标对象，创建新对象而不修改原对象
 * @param target 目标对象
 * @param sources 要合并的源对象列表
 * @returns 合并后的新对象
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  const result = deepClone(target);

  for (const source of sources) {
    if (!source) continue;

    for (const key in source) {
      if (Object.hasOwn(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
          (result as Record<string, unknown>)[key] = deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>
          );
        } else {
          (result as Record<string, unknown>)[key] = deepClone(sourceValue);
        }
      }
    }
  }

  return result;
}

/**
 * 检查值是否为普通对象
 * 普通对象是指直接通过 {} 或 Object.create(null) 创建的对象，不包括数组、函数等
 * @param value 要检查的值
 * @returns 是否为普通对象
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * 从对象中选取指定属性
 * 创建一个只包含指定属性的新对象
 * @param obj 源对象
 * @param keys 要选取的属性键数组
 * @returns 只包含指定属性的新对象
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * 从对象中排除指定属性
 * 创建一个不包含指定属性的新对象
 * @param obj 源对象
 * @param keys 要排除的属性键数组
 * @returns 不包含指定属性的新对象
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * 通过路径获取对象的嵌套值
 * 支持点分隔的字符串路径或字符串数组路径
 * @param obj 源对象
 * @param path 属性路径，如 'a.b.c' 或 ['a', 'b', 'c']
 * @returns 嵌套属性值，如果路径不存在则返回 undefined
 */
export function getByPath(obj: Record<string, unknown>, path: string | string[]): unknown {
  const keys = Array.isArray(path) ? path : path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * 通过路径设置对象的嵌套值
 * 支持点分隔的字符串路径或字符串数组路径，不存在的路径会自动创建
 * @param obj 要修改的对象
 * @param path 属性路径，如 'a.b.c' 或 ['a', 'b', 'c']
 * @param value 要设置的值
 */
export function setByPath(
  obj: Record<string, unknown>,
  path: string | string[],
  value: unknown
): void {
  const keys = Array.isArray(path) ? path : path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || !isPlainObject(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}
