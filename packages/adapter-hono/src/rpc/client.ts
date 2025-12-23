import { hc } from 'hono/client';

/**
 * Create typed RPC client
 */
export function createRPCClient(baseUrl, options = {}) {
  const { headers = {}, fetch: customFetch } = options;

  const client = hc(baseUrl, {
    headers,
    fetch: customFetch,
  });

  return client;
}

/**
 * Create resource client
 */
export function createResourceClient(baseUrl, resourceName, options = {}) {
  const { tenantId, token, headers = {} } = options;

  const allHeaders = {
    ...headers,
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const client = createRPCClient(`${baseUrl}/${resourceName}`, {
    headers: allHeaders,
  });

  return {
    async list(params = {}) {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.pageSize) query.set('pageSize', String(params.pageSize));
      if (params.sort) query.set('sort', params.sort);
      if (params.filter) query.set('filter', params.filter);

      const response = await fetch(`${baseUrl}/${resourceName}?${query}`, {
        headers: allHeaders,
      });
      return response.json();
    },

    async create(data) {
      const response = await fetch(`${baseUrl}/${resourceName}`, {
        method: 'POST',
        headers: {
          ...allHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response.json();
    },

    async read(id) {
      const response = await fetch(`${baseUrl}/${resourceName}/${id}`, {
        headers: allHeaders,
      });
      return response.json();
    },

    async update(id, data) {
      const response = await fetch(`${baseUrl}/${resourceName}/${id}`, {
        method: 'PUT',
        headers: {
          ...allHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response.json();
    },

    async delete(id) {
      const response = await fetch(`${baseUrl}/${resourceName}/${id}`, {
        method: 'DELETE',
        headers: allHeaders,
      });
      return response.json();
    },
  };
}

/**
 * Create MTPC client with all resources
 */
export function createMTPCClient(baseUrl, options = {}) {
  const { resources = [], tenantId, token } = options;

  const clients = {};

  for (const resourceName of resources) {
    clients[resourceName] = createResourceClient(baseUrl, resourceName, {
      tenantId,
      token,
    });
  }

  return {
    ...clients,
    setTenant(newTenantId) {
      return createMTPCClient(baseUrl, { ...options, tenantId: newTenantId });
    },
    setToken(newToken) {
      return createMTPCClient(baseUrl, { ...options, token: newToken });
    },
  };
}
