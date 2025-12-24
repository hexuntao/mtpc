import { PermissionProvider } from '@mtpc/adapter-react';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { createAuthClient } from './api/rpc-client';
import { ToastProvider } from './components/ui';
import './styles.css';

/**
 * 创建基于 Hono RPC 的权限获取器
 * 使用类型安全的 RPC 客户端调用后端权限接口
 */
const createPermissionFetcher = (userId: string) => {
  return async () => {
    const client = createAuthClient(userId, 'default');

    const response = await client['/api/permissions'].get({});

    // 从后端响应中提取权限和角色
    // 后端返回格式: { success: true, data: { permissions: string[], roles: string[] } }
    if (response.success && response.data) {
      return {
        permissions: response.data.permissions || [],
        roles: response.data.roles || [],
      };
    }

    return { permissions: [], roles: [] };
  };
};

// 权限提供者包装组件
function PermissionWrapper({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState('user-admin');

  // 监听用户变化事件（从 App 组件触发）
  useEffect(() => {
    const handleUserChange = (e: CustomEvent<string>) => {
      setCurrentUserId(e.detail);
    };

    window.addEventListener('user-change', handleUserChange as EventListener);
    return () => {
      window.removeEventListener('user-change', handleUserChange as EventListener);
    };
  }, []);

  const fetcher = createPermissionFetcher(currentUserId);

  return (
    <PermissionProvider
      tenantId="default"
      subjectId={currentUserId}
      fetcher={fetcher}
      autoFetch={true}
    >
      {children}
    </PermissionProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <PermissionWrapper>
        <App />
      </PermissionWrapper>
    </ToastProvider>
  </React.StrictMode>
);
