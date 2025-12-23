/**
 * 简单的防抖实现
 * 防抖函数用于限制函数在短时间内多次调用，只执行最后一次调用
 * @param fn 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖处理后的函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 简单的节流实现
 * 节流函数用于限制函数在指定时间内只能执行一次
 * @param fn 要节流的函数
 * @param limit 限制时间（毫秒）
 * @returns 节流处理后的函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 重试异步函数
 * 用于在异步操作失败时自动重试，支持指数退避策略
 * @param fn 要重试的异步函数
 * @param options 重试选项
 * @returns 异步函数执行结果
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    /** 最大重试次数，默认为 3 */
    maxAttempts?: number;
    /** 初始延迟时间（毫秒），默认为 1000 */
    delay?: number;
    /** 退避乘数，默认为 2 */
    backoff?: number;
    /** 自定义重试条件，返回 true 则重试 */
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 2, shouldRetry = () => true } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }

      await sleep(delay * backoff ** (attempt - 1));
    }
  }

  throw lastError;
}

/**
 * 睡眠指定毫秒数
 * 用于在异步函数中添加延迟
 * @param ms 睡眠时长（毫秒）
 * @returns Promise 对象
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建一个延迟 Promise
 * 允许手动控制 Promise 的 resolve 和 reject
 * @returns 包含 promise、resolve 和 reject 的对象
 */
export function createDeferred<T>(): {
  /** Promise 对象 */
  promise: Promise<T>;
  /** 用于 resolve Promise 的函数 */
  resolve: (value: T) => void;
  /** 用于 reject Promise 的函数 */
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

/**
 * 为 Promise 添加超时包装
 * 如果 Promise 在指定时间内未完成，则抛出超时错误
 * @param promise 要包装的 Promise
 * @param ms 超时时间（毫秒）
 * @param message 超时错误消息，默认为 "Operation timed out"
 * @returns 包装后的 Promise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = '操作超时'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]);
}
