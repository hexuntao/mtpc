/**
 * @mtpc/adapter-drizzle
 * MTPC 框架的 Drizzle ORM 适配器
 *
 * **功能**：
 * - 提供 Drizzle ORM 的数据访问层
 * - 自动租户隔离
 * - 基础仓储模式
 * - Schema 生成工具
 * - 数据库迁移系统
 * - CRUD 处理器
 *
 * **导出**：
 * - 类型定义
 * - Schema 生成
 * - 仓储和工厂
 * - 查询构建器
 * - PostgreSQL 连接和迁移
 * - CRUD 处理器
 */

// 处理器相关
export * from './handler/index.js';
// PostgreSQL 相关
export * from './pg/index.js';
// 查询相关
export * from './query/index.js';
// 仓储相关
export * from './repository/index.js';
// Schema 相关
export * from './schema/index.js';
// 类型定义
export * from './types.js';
