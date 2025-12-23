import { usePermissions } from '../hooks/usePermissions';

interface PermissionsViewProps {
  permissions: string[];
}

export function PermissionsView({ permissions }: PermissionsViewProps) {
  const { roles, canAccess } = usePermissions();

  // All possible permissions to check
  const allPermissions = [
    'product:create', 'product:read', 'product:update', 'product:delete', 'product:list',
    'order:create', 'order:read', 'order:update', 'order:list', 'order:confirm', 'order:cancel',
    'customer:create', 'customer:read', 'customer:update', 'customer:delete', 'customer:list',
  ];

  return (
    <div>
      <h2>My Permissions</h2>
      <p style={{ color: '#666', marginBottom: 20 }}>
        View your current permissions and access rights.
      </p>

      <div style={{ marginBottom: 30 }}>
        <h3>Current Roles</h3>
        <div className="permissions-list">
          {roles.length > 0 ? (
            roles.map(role => (
              <span key={role} className="permission-badge granted">
                {role}
              </span>
            ))
          ) : (
            <span style={{ color: '#999' }}>No roles assigned</span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 30 }}>
        <h3>Granted Permissions ({permissions.length})</h3>
        <div className="permissions-list">
          {permissions.length > 0 ? (
            permissions.map(perm => (
              <span key={perm} className="permission-badge granted">
                {perm}
              </span>
            ))
          ) : (
            <span style={{ color: '#999' }}>No permissions granted</span>
          )}
        </div>
      </div>

      <div>
        <h3>Permission Matrix</h3>
        <table className="data-table" style={{ marginTop: 15 }}>
          <thead>
            <tr>
              <th>Permission</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {allPermissions.map(perm => (
              <tr key={perm}>
                <td style={{ fontFamily: 'monospace' }}>{perm}</td>
                <td>
                  {canAccess(perm) ? (
                    <span className="permission-badge granted">✓ Granted</span>
                  ) : (
                    <span className="permission-badge denied">✗ Denied</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 30, padding: 20, background: '#f0f9ff', borderRadius: 8 }}>
        <h4 style={{ marginBottom: 10 }}>💡 How it works</h4>
        <ul style={{ paddingLeft: 20, fontSize: 14, color: '#0369a1' }}>
          <li>Permissions are resolved from roles assigned to the user</li>
          <li>Wildcard (*) grants access to all resources and actions</li>
          <li>Resource wildcards (e.g., product:*) grant all actions on that resource</li>
          <li>Switch users using the dropdown in the header to see different permission sets</li>
        </ul>
      </div>
    </div>
  );
}
