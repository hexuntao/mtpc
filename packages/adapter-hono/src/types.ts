import type {
  MTPC,
  MTPCContext,
  PaginatedResult,
  QueryOptions,
  ResourceDefinition,
  SubjectContext,
  TenantContext,
} from '@mtpc/core';
import type { Context, Env, MiddlewareHandler } from 'hono';

/**
 * Hono context variables for MTPC
 */
export interface MTPCVariables {
  tenant: TenantContext;
  subject: SubjectContext;
  mtpcContext: MTPCContext;
  mtpc: MTPC;
}

/**
 * Extended Hono env with MTPC variables
 */
export interface MTPCEnv extends Env {
  Variables: MTPCVariables;
}

/**
 * Tenant middleware options
 */
export interface TenantMiddlewareOptions {
  headerName?: string;
  required?: boolean;
  defaultTenantId?: string;
  validate?: (tenant: TenantContext) => Promise<boolean> | boolean;
}

/**
 * Auth middleware options
 */
export interface AuthMiddlewareOptions {
  headerName?: string;
  roleHeaderName?: string;
  required?: boolean;
  resolver?: (c: Context<MTPCEnv>) => Promise<SubjectContext | null> | SubjectContext | null;
}

/**
 * Bearer auth options
 */
export interface BearerAuthOptions {
  verifyToken: (token: string) => Promise<SubjectContext>;
  required?: boolean;
}

/**
 * API key auth options
 */
export interface ApiKeyAuthOptions {
  headerName?: string;
  verifyApiKey: (apiKey: string) => Promise<SubjectContext>;
  required?: boolean;
}

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  includeStack?: boolean;
  onError?: (err: Error, c: Context) => Promise<void> | void;
}

/**
 * CRUD handler interface
 */
export interface CRUDHandlers<T = unknown> {
  list?: (ctx: MTPCContext, options: QueryOptions) => Promise<PaginatedResult<T>>;
  create?: (ctx: MTPCContext, data: unknown) => Promise<T>;
  read?: (ctx: MTPCContext, id: string) => Promise<T | null>;
  update?: (ctx: MTPCContext, id: string, data: unknown) => Promise<T | null>;
  delete?: (ctx: MTPCContext, id: string) => Promise<boolean>;
}

/**
 * Route options
 */
export interface ResourceRouteOptions {
  prefix?: string;
  middleware?: MiddlewareHandler<MTPCEnv>[];
}

/**
 * API response type
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * List query params
 */
export interface ListQueryParams {
  page?: string;
  pageSize?: string;
  sort?: string;
  filter?: string;
}

/**
 * Permission resolver context
 */
export interface PermissionResolverContext {
  resource: string;
  action: string;
  resourceId?: string;
}

/**
 * Dynamic permission resolver
 */
export type DynamicPermissionResolver = (
  c: Context<MTPCEnv>
) => Promise<PermissionResolverContext> | PermissionResolverContext;

/**
 * MTPC App options
 */
export interface MTPCAppOptions {
  prefix?: string;
  cors?: boolean | Record<string, unknown>;
  logging?: boolean;
  errorHandling?: boolean;
  tenantOptions?: TenantMiddlewareOptions;
  authOptions?: AuthMiddlewareOptions;
  handlerFactory?: <T>(resource: ResourceDefinition) => CRUDHandlers<T>;
}
