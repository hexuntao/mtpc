import { Hono } from 'hono';
import type { AuditQueryFilter, AuditQueryOptions } from '@mtpc/audit';
import { z } from 'zod';
import { zodValidator } from '@hono/zod-validator';
import { DatabaseAuditStore } from '../store/audit-store.js';

// 创建审计存储实例
const auditStore = new DatabaseAuditStore();

export const auditRoutes = new Hono();

/**
 * 查询审计日志（分页）
 *
 * GET /api/audit/logs?tenantId=xxx&limit=50&offset=0&category=permission
 */
auditRoutes.get(
  '/logs',
  zodValidator(
    'query',
    z.object({
      tenantId: z.string().optional(),
      subjectId: z.string().optional(),
      resource: z.string().optional(),
      resourceId: z.string().optional(),
      category: z.enum(['permission', 'resource', 'role', 'policy', 'system', 'custom']).optional(),
      decision: z.enum(['allow', 'deny', 'error', 'info']).optional(),
      action: z.string().optional(),
      permission: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.coerce.number().min(1).max(500).default(50),
      offset: z.coerce.number().min(0).default(0),
      orderBy: z.enum(['timestamp', 'tenant', 'subject']).default('timestamp'),
      orderDirection: z.enum(['asc', 'desc']).default('desc'),
    })
  ),
  async (c) => {
    const query = c.req.valid('query');

    // 构建过滤条件
    const filter: AuditQueryFilter = {};
    if (query.tenantId) filter.tenantId = query.tenantId;
    if (query.subjectId) filter.subjectId = query.subjectId;
    if (query.resource) filter.resource = query.resource;
    if (query.resourceId) filter.resourceId = query.resourceId;
    if (query.category) filter.category = query.category;
    if (query.decision) filter.decision = query.decision;
    if (query.action) filter.action = query.action;
    if (query.permission) filter.permission = query.permission;
    if (query.from) filter.from = new Date(query.from);
    if (query.to) filter.to = new Date(query.to);

    // 构建查询选项
    const options: AuditQueryOptions = {
      filter,
      limit: query.limit,
      offset: query.offset,
      orderBy: query.orderBy,
      orderDirection: query.orderDirection,
    };

    // 查询审计日志
    const result = await auditStore.query(options);

    return c.json({
      success: true,
      data: result.entries,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.limit < result.total,
      },
    });
  }
);

/**
 * 获取单条审计日志详情
 *
 * GET /api/audit/logs/:id
 */
auditRoutes.get('/logs/:id', async (c) => {
  const id = c.req.param('id');

  // 查询单条记录
  const result = await auditStore.query({
    filter: { },
    limit: 1,
    offset: 0,
  });

  // 查找匹配的记录
  const entry = result.entries.find((e) => e.id === id);

  if (!entry) {
    return c.json(
      {
        success: false,
        error: 'AUDIT_LOG_NOT_FOUND',
        message: '审计日志不存在',
      },
      404
    );
  }

  return c.json({
    success: true,
    data: entry,
  });
});

/**
 * 统计审计日志数量
 *
 * GET /api/audit/logs/count?tenantId=xxx&category=permission
 */
auditRoutes.get(
  '/logs/count',
  zodValidator(
    'query',
    z.object({
      tenantId: z.string().optional(),
      subjectId: z.string().optional(),
      resource: z.string().optional(),
      resourceId: z.string().optional(),
      category: z.enum(['permission', 'resource', 'role', 'policy', 'system', 'custom']).optional(),
      decision: z.enum(['allow', 'deny', 'error', 'info']).optional(),
      action: z.string().optional(),
      permission: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
  ),
  async (c) => {
    const query = c.req.valid('query');

    // 构建过滤条件
    const filter: AuditQueryFilter = {};
    if (query.tenantId) filter.tenantId = query.tenantId;
    if (query.subjectId) filter.subjectId = query.subjectId;
    if (query.resource) filter.resource = query.resource;
    if (query.resourceId) filter.resourceId = query.resourceId;
    if (query.category) filter.category = query.category;
    if (query.decision) filter.decision = query.decision;
    if (query.action) filter.action = query.action;
    if (query.permission) filter.permission = query.permission;
    if (query.from) filter.from = new Date(query.from);
    if (query.to) filter.to = new Date(query.to);

    // 统计数量
    const count = await auditStore.count(filter);

    return c.json({
      success: true,
      data: { count },
    });
  }
);

/**
 * 导出审计日志为 CSV
 *
 * GET /api/audit/export?tenantId=xxx&category=permission
 */
auditRoutes.get(
  '/export',
  zodValidator(
    'query',
    z.object({
      tenantId: z.string().optional(),
      subjectId: z.string().optional(),
      resource: z.string().optional(),
      resourceId: z.string().optional(),
      category: z.enum(['permission', 'resource', 'role', 'policy', 'system', 'custom']).optional(),
      decision: z.enum(['allow', 'deny', 'error', 'info']).optional(),
      action: z.string().optional(),
      permission: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
  ),
  async (c) => {
    const query = c.req.valid('query');

    // 构建过滤条件
    const filter: AuditQueryFilter = {};
    if (query.tenantId) filter.tenantId = query.tenantId;
    if (query.subjectId) filter.subjectId = query.subjectId;
    if (query.resource) filter.resource = query.resource;
    if (query.resourceId) filter.resourceId = query.resourceId;
    if (query.category) filter.category = query.category;
    if (query.decision) filter.decision = query.decision;
    if (query.action) filter.action = query.action;
    if (query.permission) filter.permission = query.permission;
    if (query.from) filter.from = new Date(query.from);
    if (query.to) filter.to = new Date(query.to);

    // 查询所有匹配的记录（最多 10000 条）
    const result = await auditStore.query({
      filter,
      limit: 10000,
      offset: 0,
      orderBy: 'timestamp',
      orderDirection: 'desc',
    });

    // 生成 CSV
    const headers = [
      'ID',
      'Tenant ID',
      'Subject ID',
      'Subject Type',
      'Timestamp',
      'Category',
      'Action',
      'Resource',
      'Resource ID',
      'Permission',
      'Decision',
      'Success',
      'Reason',
      'IP',
      'Path',
      'Method',
    ];

    const rows = result.entries.map((entry) => [
      entry.id,
      entry.tenantId,
      entry.subjectId || '',
      entry.subjectType || '',
      entry.timestamp.toISOString(),
      entry.category,
      entry.action,
      entry.resource || '',
      entry.resourceId || '',
      entry.permission || '',
      entry.decision,
      entry.success.toString(),
      entry.reason || '',
      entry.ip || '',
      entry.path || '',
      entry.method || '',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    // 返回 CSV 文件
    return c.text(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-logs-${Date.now()}.csv"`,
    });
  }
);

/**
 * 清除审计日志
 *
 * DELETE /api/audit/logs?tenantId=xxx&category=permission
 */
auditRoutes.delete(
  '/logs',
  zodValidator(
    'query',
    z.object({
      tenantId: z.string().optional(),
      subjectId: z.string().optional(),
      resource: z.string().optional(),
      resourceId: z.string().optional(),
      category: z.enum(['permission', 'resource', 'role', 'policy', 'system', 'custom']).optional(),
      decision: z.enum(['allow', 'deny', 'error', 'info']).optional(),
      action: z.string().optional(),
      permission: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
  ),
  async (c) => {
    const query = c.req.valid('query');

    // 构建过滤条件
    const filter: AuditQueryFilter = {};
    if (query.tenantId) filter.tenantId = query.tenantId;
    if (query.subjectId) filter.subjectId = query.subjectId;
    if (query.resource) filter.resource = query.resource;
    if (query.resourceId) filter.resourceId = query.resourceId;
    if (query.category) filter.category = query.category;
    if (query.decision) filter.decision = query.decision;
    if (query.action) filter.action = query.action;
    if (query.permission) filter.permission = query.permission;
    if (query.from) filter.from = new Date(query.from);
    if (query.to) filter.to = new Date(query.to);

    // 统计要删除的记录数
    const count = await auditStore.count(filter);

    // 清除记录
    await auditStore.clear(filter);

    return c.json({
      success: true,
      message: `已清除 ${count} 条审计日志`,
      data: { deleted: count },
    });
  }
);
