import type { AnyZodSchema, InferSchema, PaginatedResult, ResourceDefinition } from '@mtpc/core';
import type { z } from 'zod';

/**
 * API response wrapper
 */
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };

/**
 * List query params
 */
export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  filter?: string;
}

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
