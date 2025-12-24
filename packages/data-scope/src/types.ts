import type { FilterCondition, MTPCContext } from '@mtpc/core';

/**
 * 范围类型 - 预定义范围模式
 */
export type ScopeType =
  | 'all'          // 无限制（管理员）
  | 'tenant'       // 租户隔离（访问租户内所有数据）
  | 'department'   // 部门隔离（访问同部门数据）
  | 'team'         // 团队隔离（访问同团队数据）
  | 'self'         // 个人隔离（仅访问个人数据）
  | 'subordinates' // 层级隔离（访问个人及下属数据）
  | 'custom';      // 自定义条件

/**
 * 范围值解析器
 * 用于在运行时根据上下文动态解析范围值
 */
export type ScopeValueResolver = (ctx: MTPCContext) => unknown | Promise<unknown>;

/**
 * 层级解析器接口
 * 用于解析层级关系（如组织结构）
 *
 * @example
 * ```typescript
 * const orgHierarchyResolver: HierarchyResolver = {
 *   async resolveRoot(rootId: string): Promise<string[]> {
 *     // 返回从根节点到所有子节点的 ID 列表
 *     const descendants = await getOrgDescendants(rootId);
 *     return [rootId, ...descendants.map(d => d.id)];
 *   }
 * };
 *
 * const dataScope = createDataScope({
 *   hierarchyResolver: orgHierarchyResolver
 * });
 * ```
 */
export interface HierarchyResolver {
  /**
   * 解析层级关系
   * @param rootId 根节点 ID（如部门 ID）
   * @returns 包含根节点和所有子节点的 ID 列表
   */
  resolveRoot(rootId: string): Promise<string[]>;
}

/**
 * 范围条件操作符
 */
export type ScopeConditionOperator =
  | 'eq'        // 等于
  | 'neq'       // 不等于
  | 'in'        // 在数组中
  | 'notIn'     // 不在数组中
  | 'contains'  // 数组包含（用于数组字段）
  | 'hierarchy'; // 层级关系（需要配合 HierarchyResolver 使用）

/**
 * 范围条件定义
 * 定义数据范围的具体过滤条件
 */
export interface ScopeCondition {
  /** 资源上要检查的字段名（如：departmentId、createdBy） */
  field: string;
  /** 比较操作符 */
  operator: ScopeConditionOperator;
  /** 静态值或解析函数（运行时动态计算值） */
  value: unknown | ScopeValueResolver;
  /** 可选：上下文中的字段路径（用于文档和调试） */
  contextField?: string;
}

/**
 * 数据范围定义
 * 定义一个完整的数据访问范围
 */
export interface DataScopeDefinition {
  /** 唯一标识符（如：scope:department） */
  id: string;
  /** 显示名称（如：本部门） */
  name: string;
  /** 范围描述 */
  description?: string;
  /** 范围类型 */
  type: ScopeType;
  /** 应用条件（仅 custom 类型需要） */
  conditions?: ScopeCondition[];
  /** 优先级（数值越大越优先，默认 0） */
  priority?: number;
  /** 是否可与其他范围组合（默认 true） */
  combinable?: boolean;
  /** 元数据（可存储扩展信息） */
  metadata?: Record<string, unknown>;
}

/**
 * 已解析范围 - 带有解析后的过滤器结果
 */
export interface ResolvedScope {
  /** 范围定义 */
  definition: DataScopeDefinition;
  /** 解析后的过滤器列表 */
  filters: FilterCondition[];
  /** 解析时间戳 */
  resolvedAt: Date;
}

/**
 * 范围分配 - 将范围关联到资源/角色/主体
 */
export interface ScopeAssignment {
  /** 分配记录的唯一 ID */
  id: string;
  /** 租户 ID */
  tenantId: string;
  /** 范围定义 ID */
  scopeId: string;
  /** 目标类型（resource=资源、role=角色、subject=主体） */
  targetType: 'resource' | 'role' | 'subject';
  /** 目标标识符（资源名/角色名/主体 ID） */
  targetId: string;
  /** 可选：此分配仅适用于特定权限 */
  permission?: string;
  /** 分配优先级（数值越大越优先） */
  priority?: number;
  /** 是否启用 */
  enabled: boolean;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 范围解析上下文
 * 解析范围时需要的上下文信息
 */
export interface ScopeResolutionContext {
  /** MTPC 上下文（包含租户、主体等信息） */
  mtpcContext: MTPCContext;
  /** 资源名称（如：User、Order） */
  resourceName: string;
  /** 操作动作（如：read、create、update、delete） */
  action: string;
  /** 已存在的过滤器（将被合并到范围过滤器中） */
  existingFilters?: FilterCondition[];
}

/**
 * 范围解析结果
 * 范围解析的完整结果
 */
export interface ScopeResolutionResult {
  /** 解析后的范围列表 */
  scopes: ResolvedScope[];
  /** 合并后的过滤条件（可直接用于数据库查询） */
  combinedFilters: FilterCondition[];
  /** 应用的范围 ID 列表（用于调试和审计） */
  appliedScopeIds: string[];
  /** 解析时间戳 */
  resolvedAt: Date;
}

/**
 * 数据范围存储接口
 * 定义范围持久化的操作接口
 */
export interface DataScopeStore {
  // === 范围定义操作 ===
  /** 创建新的范围定义 */
  createScope(scope: Omit<DataScopeDefinition, 'id'>): Promise<DataScopeDefinition>;
  /** 更新范围定义 */
  updateScope(
    id: string,
    updates: Partial<DataScopeDefinition>
  ): Promise<DataScopeDefinition | null>;
  /** 删除范围定义 */
  deleteScope(id: string): Promise<boolean>;
  /** 获取单个范围定义 */
  getScope(id: string): Promise<DataScopeDefinition | null>;
  /** 列出所有范围定义 */
  listScopes(): Promise<DataScopeDefinition[]>;

  // === 范围分配操作 ===
  /** 创建范围分配 */
  createAssignment(
    assignment: Omit<ScopeAssignment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ScopeAssignment>;
  /** 删除范围分配 */
  deleteAssignment(id: string): Promise<boolean>;
  /** 获取目标的范围分配（资源/角色/主体） */
  getAssignmentsForTarget(
    tenantId: string,
    targetType: ScopeAssignment['targetType'],
    targetId: string
  ): Promise<ScopeAssignment[]>;
  /** 获取资源的范围分配 */
  getAssignmentsForResource(tenantId: string, resourceName: string): Promise<ScopeAssignment[]>;
}

/**
 * 数据范围插件选项
 * DataScope 实例的配置选项
 */
export interface DataScopeOptions {
  /** 自定义存储实现（默认使用 InMemoryDataScopeStore） */
  store?: DataScopeStore;
  /** 默认范围类型（当没有显式分配时使用，默认 'tenant'） */
  defaultScope?: ScopeType;
  /** 所有者/创建者字段名（默认 'createdBy'） */
  ownerField?: string;
  /** 部门字段名（默认 'departmentId'） */
  departmentField?: string;
  /** 团队字段名（默认 'teamId'） */
  teamField?: string;
  /** 是否启用缓存（保留项，当前版本默认启用） */
  cacheEnabled?: boolean;
  /** 缓存过期时间（毫秒，默认 60000 = 1 分钟） */
  cacheTTL?: number;
  /** 管理员角色名称列表（拥有这些角色的用户无数据限制，默认 ['admin']） */
  adminRoles?: string[];
  /** 是否检查通配符权限 '*'（拥有 '*' 权限的用户无数据限制，默认 true） */
  checkWildcardPermission?: boolean;
  /** 层级解析器（用于 hierarchy 操作符） */
  hierarchyResolver?: HierarchyResolver;
}

/**
 * 通用模式的上下文字段路径
 * 用于快速引用 MTPCContext 中的常用字段
 */
export const CONTEXT_FIELDS = {
  /** 主体 ID 路径 */
  SUBJECT_ID: 'subject.id',
  /** 租户 ID 路径 */
  TENANT_ID: 'tenant.id',
  /** 部门 ID 路径 */
  DEPARTMENT_ID: 'subject.metadata.departmentId',
  /** 团队 ID 路径 */
  TEAM_ID: 'subject.metadata.teamId',
  /** 角色列表路径 */
  ROLE: 'subject.roles',
} as const;

/**
 * 通用资源字段
 * 用于快速引用资源上的常用字段名
 */
export const RESOURCE_FIELDS = {
  /** 所有者字段（创建者 ID） */
  OWNER: 'createdBy',
  /** 租户字段 */
  TENANT: 'tenantId',
  /** 部门字段 */
  DEPARTMENT: 'departmentId',
  /** 团队字段 */
  TEAM: 'teamId',
} as const;
