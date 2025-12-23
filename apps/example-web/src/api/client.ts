const API_BASE = '/api';

let currentUserId = 'user-admin';
const tenantId = 'default';

export function setCurrentUser(userId: string) {
  currentUserId = userId;
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
    'x-user-id': currentUserId,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  return response.json();
}

export const api = {
  // Products
  listProducts: () => fetchAPI<any>('/products'),
  getProduct: (id: string) => fetchAPI<any>(`/products/${id}`),
  createProduct: (data: any) => fetchAPI<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) => fetchAPI<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => fetchAPI<any>(`/products/${id}`, { method: 'DELETE' }),

  // Orders
  listOrders: () => fetchAPI<any>('/orders'),
  getOrder: (id: string) => fetchAPI<any>(`/orders/${id}`),
  createOrder: (data: any) => fetchAPI<any>('/orders', { method: 'POST', body: JSON.stringify(data) }),

  // Customers
  listCustomers: () => fetchAPI<any>('/customers'),
  getCustomer: (id: string) => fetchAPI<any>(`/customers/${id}`),
  createCustomer: (data: any) => fetchAPI<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),

  // Roles
  listRoles: () => fetchAPI<any>('/roles'),
  assignRole: (roleId: string, userId: string) => fetchAPI<any>(`/roles/${roleId}/assign`, { 
    method: 'POST', 
    body: JSON.stringify({ userId }) 
  }),

  // Permissions
  getPermissions: () => fetchAPI<any>('/permissions'),

  // Metadata
  getMetadata: () => fetchAPI<any>('/metadata'),
};
