import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Checkbox } from './ui';
import { useToast } from './ui';

interface RolePermissionsMatrixProps {
  roleId: string;
  onUpdate?: (permissions: string[]) => void;
  readOnly?: boolean;
}

export function RolePermissionsMatrix({ roleId, onUpdate, readOnly = false }: RolePermissionsMatrixProps) {
  const { show: showToast } = useToast();

  const { data: metadata, isLoading: loadingMetadata } = useQuery({
    queryKey: ['metadata'],
    queryFn: () => api.getMetadata(),
  });

  const { data: role, isLoading: loadingRole } = useQuery({
    queryKey: ['role', roleId],
    queryFn: () => api.getRole(roleId),
  });

  if (loadingMetadata || loadingRole) {
    return <div className="loading">加载中...</div>;
  }

  const rolePermissions = new Set(role?.data?.permissions || []);
  const resources = metadata?.data?.resources || [];

  const actions = ['create', 'read', 'update', 'delete', 'list'];

  const handleTogglePermission = async (resourceName: string, action: string, checked: boolean) => {
    if (readOnly) return;

    const permission = `${resourceName}:${action}`;
    const newPermissions = [...rolePermissions];

    if (checked) {
      newPermissions.push(permission);
    } else {
      const index = newPermissions.indexOf(permission);
      if (index > -1) {
        newPermissions.splice(index, 1);
      }
    }

    // TODO: 调用 API 更新角色权限
    // await api.updateRole(roleId, { permissions: newPermissions });
    onUpdate?.(newPermissions);
  };

  return (
    <div className="permissions-matrix">
      <table className="matrix-table">
        <thead>
          <tr>
            <th>资源</th>
            {actions.map(action => (
              <th key={action} className="text-center">{action}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource: any) => (
            <tr key={resource.name}>
              <td className="resource-name">
                {resource.displayName || resource.name}
              </td>
              {actions.map(action => {
                const permission = `${resource.name}:${action}`;
                const hasPermission = rolePermissions.has(permission);
                const isDefined = resource.permissions?.includes(action);

                return (
                  <td key={action} className="text-center">
                    <Checkbox
                      checked={hasPermission}
                      disabled={!isDefined || readOnly || role?.data?.isSystem}
                      onChange={(e) => handleTogglePermission(resource.name, action, e.target.checked)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {role?.data?.isSystem && (
        <p className="system-role-notice">
          系统角色不可修改
        </p>
      )}
    </div>
  );
}
