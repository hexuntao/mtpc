import type React from 'react';
import { useEffect, useState } from 'react';
import { PermissionsView } from './components/PermissionsView';
import { ResourceView } from './components/ResourceView';
import { RolesView } from './components/RolesView';
import { usePermissions, useRoles, usePermissionContext } from '@mtpc/adapter-react';

type View = 'products' | 'orders' | 'customers' | 'roles' | 'permissions';

const DEMO_USERS = [
  { id: 'user-admin', name: 'Admin User', role: 'admin' },
  { id: 'user-manager', name: 'Manager User', role: 'manager' },
  { id: 'user-viewer', name: 'Viewer User', role: 'viewer' },
  { id: 'user-sales', name: 'Sales Rep', role: 'sales_rep' },
];

export function App() {
  const [currentView, setCurrentView] = useState<View>('products');
  const [currentUser, setUser] = useState(DEMO_USERS[0]);

  // 使用 @mtpc/adapter-react 的钩子
  const { permissions, loading } = usePermissions();
  const roles = useRoles();
  const ctx = usePermissionContext(); // 获取完整的上下文以使用 can 方法

  // 通知 PermissionProvider 用户变化
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('user-change', { detail: currentUser.id }));
  }, [currentUser.id]);

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const user = DEMO_USERS.find(u => u.id === e.target.value);
    if (user) {
      setUser(user);
    }
  };

  const navItems = [
    { id: 'products' as View, label: 'Products', permission: 'product:list' },
    { id: 'orders' as View, label: 'Orders', permission: 'order:list' },
    { id: 'customers' as View, label: 'Customers', permission: 'customer:list' },
    { id: 'roles' as View, label: 'Roles', permission: null },
    { id: 'permissions' as View, label: 'My Permissions', permission: null },
  ];

  return (
    <div>
      <header>
        <div className="container">
          <h1>MTPC Example App</h1>
          <div className="user-selector">
            <span>Current User:</span>
            <select value={currentUser.id} onChange={handleUserChange}>
              {DEMO_USERS.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="container">
        <div className="main-content">
          <aside className="sidebar">
            <h3>Navigation</h3>
            <ul className="nav-list">
              {navItems.map(item => {
                const canView = item.permission === null || ctx.can(item.permission);
                return (
                  <li key={item.id}>
                    <button
                      className={currentView === item.id ? 'active' : ''}
                      onClick={() => setCurrentView(item.id)}
                      disabled={!canView}
                    >
                      {item.label}
                      {!canView && ' 🔒'}
                    </button>
                  </li>
                );
              })}
            </ul>

            <h3 style={{ marginTop: 30 }}>User Info</h3>
            <p style={{ fontSize: 14, color: '#666' }}>
              <strong>ID:</strong> {currentUser.id}
              <br />
              <strong>Role:</strong> {currentUser.role}
              <br />
              <strong>Roles:</strong> {roles.join(', ') || 'None'}
            </p>
          </aside>

          <main className="content">
            {loading ? (
              <div className="loading">Loading permissions...</div>
            ) : (
              <>
                {currentView === 'products' && <ResourceView resource="product" />}
                {currentView === 'orders' && <ResourceView resource="order" />}
                {currentView === 'customers' && <ResourceView resource="customer" />}
                {currentView === 'roles' && <RolesView />}
                {currentView === 'permissions' && <PermissionsView permissions={permissions} />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
