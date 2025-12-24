import type { MTPCContext, ResourceHooks } from '@mtpc/core';
import type { VersioningConfig } from './types.js';

/**
 * 创建乐观锁 / 版本控制相关的 Hooks。
 *
 * 注意：
 * - 核心层不知道现有版本号，无法真正做”冲突检测“（需要 ORM/DB 支持）。
 * - 这里仅负责在 beforeUpdate 中：
 *    1) 若请求中带 version 字段，则保留下来给上层用于检查。
 *    2) 在 afterUpdate 之前，可以选择性地为数据打上 +1 的 version 字段。
 * - 实际的版本校验应由 Adapter（例如 Drizzle 层）利用该字段完成。
 */
export function createVersioningHooks<T extends Record<string, unknown>>(
  config: VersioningConfig
): Partial<ResourceHooks<T>> {
  const versionField = config.versionField ?? 'version';

  return {
    beforeUpdate: [
      async (ctx: MTPCContext, id: string, data: Partial<T>) => {
        // 这里只做透传，不修改数据，由 ORM 在更新时利用 versionField 做并发控制。
        // 如果需要，可以在 metadata 中记录期望版本。
        return {
          proceed: true,
          data,
        };
      },
    ],
    afterUpdate: [
      async (ctx: MTPCContext, id: string, _data: Partial<T>, updated: T) => {
        // 若资源 schema 中存在 version 字段，应用侧可在此处做日志或统计。
        // 不主动改写 updated，以避免和 ORM 的返回结果冲突。
      },
    ],
  };
}
