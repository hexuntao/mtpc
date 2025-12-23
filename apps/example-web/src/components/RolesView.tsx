import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export function RolesView() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const result = await api.listRoles();
      if (result.success && result.data) {
        setRoles(result.data);
      }
    } catch (e) {
      console.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading roles...</div>;
  }

  return (
    <div>
      <h2>Roles</h2>
      <p style={{ color: '#666', marginBottom: 20 }}>Manage roles and permissions in the system.</p>

      <ul className="role-list">
        {roles.map((role: any) => (
          <li key={role.id} className="role-item">
            <div>
              <h4>{role.displayName || role.name}</h4>
              <span className="type">{role.type} role</span>
              {role.description && (
                <p style={{ fontSize: 13, color: '#666', marginTop: 5 }}>{role.description}</p>
              )}
            </div>
            <div>
              <span
                style={{
                  padding: '4px 8px',
                  background: role.status === 'active' ? '#d1fae5' : '#fee2e2',
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                {role.status}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 30 }}>
        <h3>Role Permissions</h3>
        {roles.map((role: any) => (
          <div
            key={role.id}
            style={{ marginTop: 15, padding: 15, background: '#f9fafb', borderRadius: 8 }}
          >
            <h4 style={{ marginBottom: 10 }}>{role.displayName || role.name}</h4>
            <div className="permissions-list">
              {role.permissions?.length > 0 ? (
                role.permissions.map((perm: string) => (
                  <span key={perm} className="permission-badge">
                    {perm}
                  </span>
                ))
              ) : (
                <span style={{ color: '#999', fontSize: 13 }}>No permissions</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
