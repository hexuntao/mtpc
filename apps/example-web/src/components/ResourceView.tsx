import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { usePermissions } from '../hooks/usePermissions';

interface ResourceViewProps {
  resource: 'product' | 'order' | 'customer';
}

export function ResourceView({ resource }: ResourceViewProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { canAccess } = usePermissions();

  useEffect(() => {
    loadItems();
  }, [resource]);

  const loadItems = async () => {
    setLoading(true);
    setError(null);

    try {
      let result;
      switch (resource) {
        case 'product':
          result = await api.listProducts();
          break;
        case 'order':
          result = await api.listOrders();
          break;
        case 'customer':
          result = await api.listCustomers();
          break;
      }

      if (result.success && result.data) {
        setItems(result.data.data || []);
      } else {
        setError(result.error?.message || 'Failed to load data');
      }
    } catch (e) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const canCreate = canAccess(`${resource}:create`);
  const canUpdate = canAccess(`${resource}:update`);
  const canDelete = canAccess(`${resource}:delete`);

  const resourceLabels: Record<string, string> = {
    product: 'Products',
    order: 'Orders',
    customer: 'Customers',
  };

  if (loading) {
    return <div className="loading">Loading {resourceLabels[resource]}...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2>{resourceLabels[resource]}</h2>
        {canCreate && <button className="btn btn-primary">+ Create {resource}</button>}
      </div>

      <div style={{ marginBottom: 15, fontSize: 14, color: '#666' }}>
        <strong>Permissions:</strong>{' '}
        {canCreate && <span className="permission-badge granted">create</span>}{' '}
        <span className={`permission-badge granted`}>read</span>{' '}
        {canUpdate && <span className="permission-badge granted">update</span>}{' '}
        {canDelete && <span className="permission-badge granted">delete</span>}
        {!canCreate && <span className="permission-badge denied">create</span>}{' '}
        {!canUpdate && <span className="permission-badge denied">update</span>}{' '}
        {!canDelete && <span className="permission-badge denied">delete</span>}
      </div>

      {items.length === 0 ? (
        <div className="empty">
          No {resourceLabels[resource].toLowerCase()} found.
          {canCreate && ' Click the button above to create one.'}
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name / Title</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.id?.slice(0, 8)}...</td>
                <td>{item.name || item.orderNumber || `${item.firstName} ${item.lastName}`}</td>
                <td>
                  <span
                    className={`action-badge ${item.status === 'active' ? 'enabled' : 'disabled'}`}
                  >
                    {item.status}
                  </span>
                </td>
                <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-secondary" style={{ marginRight: 5 }}>
                    View
                  </button>
                  {canUpdate && (
                    <button className="btn btn-secondary" style={{ marginRight: 5 }}>
                      Edit
                    </button>
                  )}
                  {canDelete && <button className="btn btn-danger">Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
