import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input, Select, Textarea } from '../ui';
import { Button } from '../ui';

const productSchema = z.object({
  name: z.string().min(1, '产品名称不能为空').max(200, '产品名称不能超过200字符'),
  description: z.string().optional(),
  price: z.number().positive('价格必须大于0'),
  sku: z.string().min(1, 'SKU不能为空').max(50, 'SKU不能超过50字符'),
  category: z.string().optional(),
  status: z.enum(['active', 'inactive', 'discontinued']),
  stock: z.number().int().min(0, '库存不能为负数'),
});

export type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  initialValues?: Partial<ProductFormValues>;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

const statusOptions = [
  { value: 'active', label: '上架' },
  { value: 'inactive', label: '下架' },
  { value: 'discontinued', label: '停产' },
];

export function ProductForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = '保存'
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: initialValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      <Input
        label="产品名称"
        {...register('name')}
        error={errors.name?.message}
        required
      />

      <Textarea
        label="描述"
        {...register('description')}
        error={errors.description?.message}
        rows={3}
      />

      <div className="form-row">
        <Input
          label="价格"
          type="number"
          step="0.01"
          {...register('price', { valueAsNumber: true })}
          error={errors.price?.message}
          required
        />

        <Input
          label="SKU"
          {...register('sku')}
          error={errors.sku?.message}
          required
        />
      </div>

      <div className="form-row">
        <Input
          label="分类"
          {...register('category')}
          error={errors.category?.message}
          placeholder="例如：电子产品、服装等"
        />

        <Input
          label="库存"
          type="number"
          {...register('stock', { valueAsNumber: true })}
          error={errors.stock?.message}
          required
        />
      </div>

      <Select
        label="状态"
        {...register('status')}
        error={errors.status?.message}
        options={statusOptions}
      />

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
