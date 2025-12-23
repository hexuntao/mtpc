import type { AnyZodSchema, InferSchema, PaginatedResult, ResourceDefinition } from '@mtpc/core';
import type { z } from 'zod';
import type { ApiResponse, ListQueryParams } from '../types.js';

/**
 * Infer CRUD routes type from resource
 */
export type InferCRUDRoutes<T extends ResourceDefinition> = {
  list: {
    input: ListQueryParams;
    output: ApiResponse<PaginatedResult<InferSchema<T['schema']>>>;
  };
  create: {
    input: InferSchema<T['createSchema']>;
    output: ApiResponse<InferSchema<T['schema']>>;
  };
  read: {
    input: { id: string };
    output: ApiResponse<InferSchema<T['schema']> | null>;
  };
  update: {
    input: { id: string; data: InferSchema<T['updateSchema']> };
    output: ApiResponse<InferSchema<T['schema']> | null>;
  };
  delete: {
    input: { id: string };
    output: ApiResponse<{ deleted: boolean }>;
  };
};

/**
 * RPC route definition
 */
export interface RPCRouteDef<TInput = unknown, TOutput = unknown> {
  input: TInput;
  output: TOutput;
}

/**
 * Infer RPC client type from routes
 */
export type InferRPCClient<TRoutes extends Record<string, RPCRouteDef>> = {
  [K in keyof TRoutes]: (input: TRoutes[K]['input']) => Promise<TRoutes[K]['output']>;
};

/**
 * Client options
 */
export interface ClientOptions {
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

/**
 * Resource client options
 */
export interface ResourceClientOptions {
  tenantId?: string;
  token?: string;
  headers?: Record<string, string>;
}

/**
 * MTPC client options
 */
export interface MTPCClientOptions extends ResourceClientOptions {
  resources?: string[];
}
