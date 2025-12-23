import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getPermissions();
      if (result.success && result.data) {
        setPermissions(result.data.permissions || []);
        setRoles(result.data.roles || []);
      }
    } catch (e) {
      setError('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Re-fetch when user changes
  useEffect(() => {
    const interval = setInterval(fetchPermissions, 5000);
    return () => clearInterval(interval);
  }, [fetchPermissions]);

  const canAccess = useCallback(
    (permission: string): boolean => {
      // Check for wildcard
      if (permissions.includes('*')) {
        return true;
      }

      // Check for resource wildcard
      const [resource] = permission.split(':');
      if (permissions.includes(`${resource}:*`)) {
        return true;
      }

      // Check exact permission
      return permissions.includes(permission);
    },
    [permissions]
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      return roles.includes(role);
    },
    [roles]
  );

  return {
    permissions,
    roles,
    loading,
    error,
    canAccess,
    hasRole,
    refresh: fetchPermissions,
  };
}
