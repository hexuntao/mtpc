import { hc } from 'hono/client';
import type { ApiResponse, ListQueryParams } from '../types.js';
import type { ClientOptions, MTPCClientOptions, ResourceClientOptions } from './types.js';

/**
 * Create typed RPC client
 */
export function createRPCClient<T>(
  baseUrl: string,
  options: ClientOptions = {}
): ReturnType<typeof hc<T>> {
  const { headers = {}, fetch: customFetch } = options;

  return hc<T>(baseUrl, {
    headers,
    fetch: customFetch,
  });
}

/**
 * Resource client interface
 */
export interface ResourceClient<T = unknown> {
  list(params?: ListQueryParams): Promise<ApiResponse<{ data: T[]; total: number }>>;
  create(data: unknown): Promise<ApiResponse<T>>;
  read(id: string): Promise<ApiResponse<T | null>>;
  update(id: string, data: unknown): Promise<ApiResponse<T | null>>;
  delete(id: string): Promise<ApiResponse<{ deleted: boolean }>>;
}

/**
 * Create resource client
 */
export function createResourceClient<T = unknown>(
  baseUrl: string,
  resourceName: string,
  options: ResourceClientOptions = {}
): ResourceClient<T> {
  const { tenantId, token, headers = {} } = options;

  const allHeaders: Record<string, string> = {
    ...headers,
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const resourceUrl = `${baseUrl}/${resourceName}`;

  return {
    async list(params: ListQueryParams = {}): Promise<ApiResponse<{ data: T[]; total: number }>> {
      const query = new URLSearchParams();
      if (params.page) query.set('page', params.page);
      if (params.pageSize) query.set('pageSize', params.pageSize);
      if (params.sort) query.set('sort', params.sort);
      if (params.filter) query.set('filter', params.filter);

      const response = await fetch(`${resourceUrl}?${query}`, {
        headers: allHeaders,
      });
      return response.json();
    },

    async create(data: unknown): Promise<ApiResponse<T>> {
      const response = await fetch(resourceUrl, {
        method: 'POST',
        headers: {
          ...allHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response.json();
    },

    async read(id: string): Promise<ApiResponse<T | null>> {
      const response = await fetch(`${resourceUrl}/${id}`, {
        headers: allHeaders,
      });
      return response.json();
    },

    async update(id: string, data: unknown): Promise<ApiResponse<T | null>> {
      const response = await fetch(`${resourceUrl}/${id}`, {
        method: 'PUT',
        headers: {
          ...allHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response.json();
    },

    async delete(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
      const response = await fetch(`${resourceUrl}/${id}`, {
        method: 'DELETE',
        headers: allHeaders,
      });
      return response.json();
    },
  };
}

/**
 * MTPC client type
 */
export interface MTPCClient {
  [resourceName: string]: ResourceClient;
  setTenant(newTenantId: string): MTPCClient;
  setToken(newToken: string): MTPCClient;
}

/**
 * Create MTPC client with all resources
 */
export function createMTPCClient(baseUrl: string, options: MTPCClientOptions = {}): MTPCClient {
  const { resources = [], tenantId, token } = options;

  const clients: Record<string, ResourceClient> = {};

  for (const resourceName of resources) {
    clients[resourceName] = createResourceClient(baseUrl, resourceName, {
      tenantId,
      token,
    });
  }

  return {
    ...clients,
    setTenant(newTenantId: string): MTPCClient {
      return createMTPCClient(baseUrl, { ...options, tenantId: newTenantId });
    },
    setToken(newToken: string): MTPCClient {
      return createMTPCClient(baseUrl, { ...options, token: newToken });
    },
  };
}
