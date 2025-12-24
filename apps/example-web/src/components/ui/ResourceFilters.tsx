import type React from 'react';
import { Input, Select, Button } from './';

interface FilterValues {
  search?: string;
  status?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

interface ResourceFiltersProps {
  onFilter: (values: FilterValues) => void;
  onReset?: () => void;
  showPriceFilter?: boolean;
}

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '上架' },
  { value: 'inactive', label: '下架' },
  { value: 'discontinued', label: '停产' },
];

export function ResourceFilters({
  onFilter,
  onReset,
  showPriceFilter = false
}: ResourceFiltersProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const values: FilterValues = {
      search: formData.get('search') as string | undefined,
      status: formData.get('status') as string | undefined,
      category: formData.get('category') as string | undefined,
    };

    if (showPriceFilter) {
      const minPrice = formData.get('minPrice');
      const maxPrice = formData.get('maxPrice');
      if (minPrice) values.minPrice = Number(minPrice);
      if (maxPrice) values.maxPrice = Number(maxPrice);
    }

    onFilter(values);
  };

  const handleReset = () => {
    const form = document.getElementById('filter-form') as HTMLFormElement;
    form?.reset();
    onReset?.();
  };

  return (
    <form id="filter-form" onSubmit={handleSubmit} className="filters">
      <div className="filter-row">
        <Input
          name="search"
          placeholder="搜索..."
          className="filter-search"
        />

        <Select
          name="status"
          options={statusOptions}
          className="filter-select"
        />

        <Input
          name="category"
          placeholder="分类"
          className="filter-input"
        />

        {showPriceFilter && (
          <>
            <Input
              name="minPrice"
              type="number"
              placeholder="最低价格"
              className="filter-input"
            />
            <Input
              name="maxPrice"
              type="number"
              placeholder="最高价格"
              className="filter-input"
            />
          </>
        )}

        <Button type="submit">搜索</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleReset}
        >
          重置
        </Button>
      </div>
    </form>
  );
}
