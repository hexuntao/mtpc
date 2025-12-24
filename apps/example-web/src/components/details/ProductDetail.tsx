import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { usePermissions } from '../../hooks/usePermissions';
import { Button, Modal } from '../ui';
import { ProductForm } from '../forms/ProductForm';
import { useState } from 'react';
import { useToast } from '../ui';

interface ProductDetailProps {
  productId: string;
  onClose?: () => void;
}

const statusLabels: Record<string, string> = {
  active: '上架',
  inactive: '下架',
  discontinued: '停产',
};

export function ProductDetail({ productId, onClose }: ProductDetailProps) {
  const { show: showToast } = useToast();
  const { canAccess } = usePermissions();
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: product, isLoading, error, refetch } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => api.getProduct(productId),
  });

  const handleDelete = async () => {
    if (!confirm('确定要删除这个产品吗？')) return;

    try {
      await api.deleteProduct(productId);
      showToast('success', '产品已删除');
      onClose?.();
    } catch (error) {
      showToast('error', '删除失败');
    }
  };

  const handleUpdate = async (values: any) => {
    try {
      await api.updateProduct(productId, values);
      showToast('success', '产品已更新');
      setShowEditModal(false);
      refetch();
    } catch (error) {
      showToast('error', '更新失败');
    }
  };

  if (isLoading) return <div className="loading">加载中...</div>;

  if (error || !product?.data) {
    return <div className="error">加载失败</div>;
  }

  const p = product.data;

  return (
    <div className="detail-view">
      <div className="detail-header">
        <h2>{p.name}</h2>
        <div className="detail-actions">
          {canAccess('product:update') && (
            <Button size="sm" variant="secondary" onClick={() => setShowEditModal(true)}>
              编辑
            </Button>
          )}
          {canAccess('product:delete') && (
            <Button size="sm" variant="danger" onClick={handleDelete}>
              删除
            </Button>
          )}
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-section">
          <h3>基本信息</h3>
          <dl className="detail-list">
            <dt>SKU</dt>
            <dd>{p.sku}</dd>
            <dt>价格</dt>
            <dd>¥{p.price?.toFixed(2) || '0.00'}</dd>
            <dt>状态</dt>
            <dd>
              <span className={`status-badge status-${p.status}`}>
                {statusLabels[p.status] || p.status}
              </span>
            </dd>
            <dt>库存</dt>
            <dd>{p.stock ?? 0}</dd>
            <dt>分类</dt>
            <dd>{p.category || '-'}</dd>
          </dl>
        </div>

        <div className="detail-section">
          <h3>描述</h3>
          <p>{p.description || '无描述'}</p>
        </div>

        <div className="detail-section">
          <h3>元数据</h3>
          <dl className="detail-list">
            <dt>创建时间</dt>
            <dd>{p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'}</dd>
            <dt>更新时间</dt>
            <dd>{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '-'}</dd>
          </dl>
        </div>
      </div>

      {showEditModal && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="编辑产品"
          size="lg"
        >
          <ProductForm
            initialValues={p}
            onSubmit={handleUpdate}
            onCancel={() => setShowEditModal(false)}
            submitLabel="更新"
          />
        </Modal>
      )}
    </div>
  );
}
