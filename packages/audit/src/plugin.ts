import type { MTPCContext, PluginContext, PluginDefinition } from '@mtpc/core';
import { InMemoryAuditStore } from './store/memory-store.js';
import type { AuditEntry, AuditOptions, AuditPluginState, AuditStore } from './types.js';

/**
 * Normalize MTPC context into audit context fields
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
 * Create audit plugin
 */
export function createAuditPlugin(
  options: AuditOptions = {}
): PluginDefinition & { state: AuditPluginState } {
  const store: AuditStore = options.store ?? new InMemoryAuditStore();

  const include = {
    permissionChecks: options.include?.permissionChecks ?? true,
    resourceOperations: options.include?.resourceOperations ?? true,
    roleChanges: options.include?.roleChanges ?? true,
    policyChanges: options.include?.policyChanges ?? true,
  };

  const state: AuditPluginState = {
    store,
    options,
  };

  const logEntry = async (entry: AuditEntry): Promise<void> => {
    const masked = options.mask ? options.mask(entry) : entry;
    if (options.async) {
      // Fire and forget
      void store.log(masked);
    } else {
      await store.log(masked);
    }
  };

  return {
    name: '@mtpc/audit',
    version: '0.1.0',
    description: 'Audit logging extension for MTPC',

    state,

    async install(context: PluginContext): Promise<void> {
      // Register global hooks to capture resource operations
      context.registerGlobalHooks({
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
        afterAny: [
          async (mtpcCtx, operation, resourceName, result) => {
            // Optionally, we could log after with result, but beforeAny already logged the operation
            // This hook can be tailored by consumer if needed
          },
        ],
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

    onInit(): void {
      console.log('Audit plugin initialized');
    },

    async onDestroy(): Promise<void> {
      // No-op for now; store cleanup is up to consumer
    },
  };
}
