import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { usePermissions } from '../hooks/usePermissions';
import { Button, Modal } from './ui';
import { ProductForm } from './forms/ProductForm';
import { ProductDetail } from './details/ProductDetail';
import { useToast } from './ui';

interface ResourceViewProps {
  resource: 'product' | 'order' | 'customer';
  onView?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const resourceLabels: Record<string, { title: string; singular: string }> = {
  product: { title: '产品列表', singular: '产品' },
  order: { title: '订单列表', singular: '订单' },
  customer: { title: '客户列表', singular: '客户' },
};

export function ResourceView({ resource, onView, onDelete }: ResourceViewProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { show: showToast } = useToast();
  const { canAccess } = usePermissions();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [resource],
    queryFn: async () => {
      switch (resource) {
        case 'product':
          return api.listProducts();
        case 'order':
          return api.listOrders();
        case 'customer':
          return api.listCustomers();
      }
    },
  });

  const items = data?.data?.data || [];

  const handleCreate = async (values: any) => {
    try {
      switch (resource) {
        case 'product':
          await api.createProduct(values);
          break;
        case 'order':
          await api.createOrder(values);
          break;
        case 'customer':
          await api.createCustomer(values);
          break;
      }
      showToast('success', `${resourceLabels[resource].singular}创建成功`);
      setShowCreateModal(false);
      refetch();
    } catch (error) {
      showToast('error', '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`确定要删除这个${resourceLabels[resource].singular}吗？`)) return;

    try {
      switch (resource) {
        case 'product':
          await api.deleteProduct(id);
          break;
        case 'customer':
          await api.deleteCustomer(id);
          break;
        case 'order':
          showToast('warning', '订单不能删除');
          return;
      }
      showToast('success', '删除成功');
      refetch();
      onDelete?.(id);
    } catch (error) {
      showToast('error', '删除失败');
    }
  };

  const handleViewItem = (id: string) => {
    setSelectedId(id);
    setShowDetailModal(true);
    onView?.(id);
  };

  const canCreate = canAccess(`${resource}:create`);
  const canUpdate = canAccess(`${resource}:update`);
  const canDelete = canAccess(`${resource}:delete`);

  if (isLoading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">加载失败</div>;

  return (
    <div className="resource-view">
      <div className="page-header">
        <h2>{resourceLabels[resource].title}</h2>
        {canCreate && (
          <Button onClick={() => setShowCreateModal(true)}>
            + 新建{resourceLabels[resource].singular}
          </Button>
        )}
      </div>

      <div className="permission-bar">
        <strong>权限:</strong>
        {canCreate && <span className="permission-badge granted">create</span>}
        <span className="permission-badge granted">read</span>
        {canUpdate && <span className="permission-badge granted">update</span>}
        {canDelete && <span className="permission-badge granted">delete</span>}
        {!canCreate && <span className="permission-badge denied">create</span>}
        {!canUpdate && <span className="permission-badge denied">update</span>}
        {!canDelete && <span className="permission-badge denied">delete</span>}
      </div>

      {items.length === 0 ? (
        <div className="empty">
          没有找到{resourceLabels[resource].singular}
          {canCreate && '，点击上方按钮创建。'}
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id}>
                <td className="id-cell">{item.id?.slice(0, 8)}...</td>
                <td className="name-cell">
                  {item.name || item.orderNumber || `${item.firstName || ''} ${item.lastName || ''}`}
                </td>
                <td>
                  <span className={`status-badge status-${item.status}`}>
                    {item.status}
                  </span>
                </td>
                <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}</td>
                <td className="actions-cell">
                  <Button size="sm" variant="secondary" onClick={() => handleViewItem(item.id)}>
                    查看
                  </Button>
                  {canDelete && resource !== 'order' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(item.id)}
                    >
                      删除
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreateModal && resource === 'product' && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={`新建${resourceLabels[resource].singular}`}
          size="lg"
        >
          <ProductForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      )}

      {showDetailModal && selectedId && resource === 'product' && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={`${resourceLabels[resource].singular}详情`}
          size="lg"
        >
          <ProductDetail
            productId={selectedId}
            onClose={() => {
              setShowDetailModal(false);
              refetch();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
