// @mtpc/audit - MTPC 的审计日志插件

import type { MTPCContext, PluginContext, PluginDefinition } from '@mtpc/core';
import { InMemoryAuditStore } from './store/memory-store.js';
import type { AuditEntry, AuditOptions, AuditPluginState, AuditStore } from './types.js';

/**
 * 将 MTPC 上下文转换为审计上下文字段
 * @param ctx MTPC 上下文对象
 * @returns 规范化的审计上下文字段
 */
function normalizeContext(ctx: MTPCContext): {
  tenantId: string;
  subjectId?: string;
  subjectType?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  path?: string;
  method?: string;
} {
  return {
    tenantId: ctx.tenant.id,
    subjectId: ctx.subject.id,
    subjectType: ctx.subject.type,
    ip: ctx.request.ip,
    userAgent: ctx.request.userAgent,
    requestId: ctx.request.requestId,
    path: ctx.request.path,
    method: ctx.request.method,
  };
}

/**
 * 创建审计日志插件
 * @param options 审计配置选项
 * @returns 审计插件定义和状态
 */
export function createAuditPlugin(
  options: AuditOptions = {}
): PluginDefinition & { state: AuditPluginState } {
  // 如果没有提供存储，则使用内存存储（仅用于测试/演示）
  const store: AuditStore = options.store ?? new InMemoryAuditStore();

  // 处理包含选项，确保所有选项都有默认值
  const include = {
    permissionChecks: options.include?.permissionChecks ?? true,
    resourceOperations: options.include?.resourceOperations ?? true,
    roleChanges: options.include?.roleChanges ?? true,
    policyChanges: options.include?.policyChanges ?? true,
  };

  // 插件状态
  const state: AuditPluginState = {
    store,
    options,
  };

  /**
   * 记录审计日志条目
   * @param entry 审计日志条目
   */
  const logEntry = async (entry: AuditEntry): Promise<void> => {
    // 应用掩码（如果配置了）
    const masked = options.mask ? options.mask(entry) : entry;
    if (options.async) {
      // 异步记录（即发即弃）
      store.log(masked);
    } else {
      // 同步记录
      await store.log(masked);
    }
  };

  // 返回插件定义
  return {
    name: '@mtpc/audit',
    version: '0.1.0',
    description: 'MTPC 的审计日志扩展',

    state,

    /**
     * 安装插件
     * @param context 插件上下文
     */
    async install(context: PluginContext): Promise<void> {
      // 注册全局钩子来捕获资源操作
      context.registerGlobalHooks({
        // 在任何资源操作之前调用
        beforeAny: [
          async (mtpcCtx, operation, resourceName) => {
            if (!include.resourceOperations) {
              return { proceed: true };
            }

            const norm = normalizeContext(mtpcCtx);

            const entry: AuditEntry = {
              id: '',
              tenantId: norm.tenantId,
              timestamp: new Date(),
              subjectId: norm.subjectId,
              subjectType: norm.subjectType,
              category: 'resource',
              action: operation,
              resource: resourceName,
              decision: 'info',
              success: true,
              path: norm.path,
              method: norm.method,
              ip: norm.ip,
              userAgent: norm.userAgent,
              requestId: norm.requestId,
            };

            await logEntry(entry);

            return { proceed: true };
          },
        ],
        // 在任何资源操作之后调用
        afterAny: [
          async (_mtpcCtx, _operation, _resourceName, _result) => {
            // 可选：我们可以在这里记录结果，但 beforeAny 已经记录了操作
            // 消费者可以根据需要定制此钩子
          },
        ],
        // 当操作发生错误时调用
        onError: [
          async (mtpcCtx, operation, resourceName, error) => {
            if (!include.resourceOperations) {
              return;
            }

            const norm = normalizeContext(mtpcCtx);

            const entry: AuditEntry = {
              id: '',
              tenantId: norm.tenantId,
              timestamp: new Date(),
              subjectId: norm.subjectId,
              subjectType: norm.subjectType,
              category: 'resource',
              action: operation,
              resource: resourceName,
              decision: 'error',
              success: false,
              reason: error.message,
              path: norm.path,
              method: norm.method,
              ip: norm.ip,
              userAgent: norm.userAgent,
              requestId: norm.requestId,
              metadata: {
                errorName: error.name,
              },
            };

            await logEntry(entry);
          },
        ],
      });
    },

    /**
     * 插件初始化时调用
     */
    onInit(): void {
      console.log('审计日志插件已初始化');
    },

    /**
     * 插件销毁时调用
     */
    async onDestroy(): Promise<void> {
      // 目前不需要特殊清理，存储清理由消费者负责
    },
  };
}
