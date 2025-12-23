import {
  MissingTenantContextError,
  MTPCError,
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
} from '@mtpc/shared';
import type { Context, ErrorHandler } from 'hono';
import type { ApiResponse, ErrorHandlerOptions } from '../types.js';

/**
 * 根据错误类型获取对应的 HTTP 状态码
 *
 * **状态码映射规则**：
 * - 403: 权限拒绝 (PermissionDeniedError, UNAUTHORIZED, DENIED)
 * - 404: 资源未找到 (ResourceNotFoundError, NOT_FOUND)
 * - 400: 请求无效 (ValidationError, MissingTenantContextError, VALIDATION, INVALID)
 * - 500: 其他未处理的错误
 *
 * @param err - MTPC 错误对象
 * @returns HTTP 状态码
 */
function getStatusCode(err: MTPCError) {
  if (err instanceof PermissionDeniedError) {
    return 403;
  }

  if (err instanceof MissingTenantContextError) {
    return 400;
  }

  if (err instanceof ResourceNotFoundError) {
    return 404;
  }

  if (err instanceof ValidationError) {
    return 400;
  }

  // 根据错误代码进行模糊匹配
  // 这样即使不是标准错误类型，也能返回合适的状态码
  if (err.code?.includes('NOT_FOUND')) {
    return 404;
  }

  if (err.code?.includes('DENIED') || err.code?.includes('UNAUTHORIZED')) {
    return 403;
  }

  if (err.code?.includes('VALIDATION') || err.code?.includes('INVALID')) {
    return 400;
  }

  return 500;
}

/**
 * MTPC 统一错误处理器
 * 处理所有 MTPC 相关错误并返回标准化的 API 错误响应
 *
 * **修复说明**：
 * - 使用 isProduction 配置替代直接访问 process.env，支持非 Node.js 运行环境
 * - 使用可配置的 logger 替代 console.error，支持生产级日志系统
 *
 * @param options - 错误处理器配置选项
 * @returns Hono 错误处理函数
 *
 * @example
 * ```typescript
 * app.onError(mtpcErrorHandler({
 *   isProduction: true,
 *   includeStack: false,
 *   logger: (err, context) => winston.error(context, { error: err }),
 *   onError: async (err, c) => {
 *     await logError(err);
 *   }
 * }));
 * ```
 */
export function mtpcErrorHandler(options: ErrorHandlerOptions = {}): ErrorHandler {
  // 解构配置，isProduction 默认根据 NODE_ENV 判断
  const {
    includeStack = false,
    isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production',
    onError,
    logger,
  } = options;

  return async (err: Error, c: Context): Promise<Response> => {
    // 如果提供了自定义错误处理回调，先执行它
    // 可用于日志记录、监控告警等场景
    if (onError) {
      await onError(err, c);
    }

    // 处理 MTPC 标准错误
    if (err instanceof MTPCError) {
      const status = getStatusCode(err);

      const response: ApiResponse = {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      };

      // 非生产环境可以选择包含堆栈信息，方便调试
      if (includeStack && err.stack) {
        (response.error as Record<string, unknown>).stack = err.stack;
      }

      return c.json(response, status);
    }

    // 处理 Zod 验证错误
    // ZodError 有特定的结构，需要单独处理以提供友好的验证错误信息
    if (err.name === 'ZodError') {
      const zodErr = err as unknown as {
        issues: Array<{ path: (string | number)[]; message: string }>;
      };
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: { issues: zodErr.issues },
          },
        } satisfies ApiResponse,
        400
      );
    }

    // 处理未预期的通用错误
    // 生产环境隐藏错误详情，防止信息泄露
    // **修复说明**：使用可配置的 logger，未提供时回退到 console.error
    if (logger) {
      logger(err, 'Unhandled error');
    } else {
      console.error('Unhandled error:', err);
    }

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        // 生产环境返回通用消息，开发环境返回实际错误信息
        message: isProduction ? 'Internal server error' : err.message,
      },
    };

    // 非生产环境且配置了 includeStack 时，包含堆栈信息
    if (includeStack && !isProduction && err.stack) {
      (response.error as Record<string, unknown>).stack = err.stack;
    }

    return c.json(response, 500);
  };
}

/**
 * 404 Not Found 处理器
 * 当请求的路由不存在时被调用
 *
 * **响应格式**：
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "NOT_FOUND",
 *     "message": "Route not found: GET /api/unknown"
 *   }
 * }
 * ```
 *
 * @param c - Hono 上下文
 * @returns 404 响应
 *
 * @example
 * ```typescript
 * const app = new Hono();
 * app.notFound(notFoundHandler);
 * ```
 */
export function notFoundHandler(c: Context): Response {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
    } satisfies ApiResponse,
    404
  );
}
