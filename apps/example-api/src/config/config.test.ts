import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('Configuration Management', () => {
  it('should load default configuration when no environment variables are set', () => {
    const config = loadConfig();

    expect(config.server.port).toBe(3000);
    expect(config.server.host).toBe('0.0.0.0');
    // Vitest 会自动设置 NODE_ENV=test，所以这里应该是 'test'
    expect(config.server.env).toBe('test');
    expect(config.database.url).toBe('postgres://postgres:password@localhost:5432/mtpc_example');
    expect(config.database.maxConnections).toBe(10);
    expect(config.database.ssl).toBe(false);
    expect(config.cors.origin).toEqual(['http://localhost:5173', 'http://localhost:3000']);
    expect(config.cors.credentials).toBe(true);
  });

  it('should load configuration from environment variables', () => {
    // 设置环境变量
    const originalEnv = {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_MAX_CONNECTIONS: process.env.DATABASE_MAX_CONNECTIONS,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
    };

    // 设置测试环境变量
    process.env.PORT = '3001';
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://test:password@localhost:5432/test_db';
    process.env.DATABASE_MAX_CONNECTIONS = '20';
    // 注意：Zod 的 coerce.boolean() 会正确处理 'true' 字符串
    process.env.DATABASE_SSL = 'true';
    process.env.CORS_ORIGIN = 'http://localhost:8080,http://localhost:4200';

    const config = loadConfig();

    // 验证配置加载
    expect(config.server.port).toBe(3001);
    expect(config.server.env).toBe('production');
    expect(config.database.url).toBe('postgres://test:password@localhost:5432/test_db');
    expect(config.database.maxConnections).toBe(20);
    expect(config.database.ssl).toBe(true);
    expect(config.cors.origin).toEqual(['http://localhost:8080', 'http://localhost:4200']);

    // 恢复原始环境变量
    Object.assign(process.env, originalEnv);
  });

  it('should handle missing environment variables gracefully', () => {
    // 设置部分环境变量
    const originalEnv = {
      PORT: process.env.PORT,
      DATABASE_MAX_CONNECTIONS: process.env.DATABASE_MAX_CONNECTIONS,
    };

    // 只设置有效的环境变量
    process.env.PORT = '3002';
    process.env.DATABASE_MAX_CONNECTIONS = '25';

    const config = loadConfig();

    // 验证有效的环境变量被加载，无效的使用默认值
    expect(config.server.port).toBe(3002);
    expect(config.database.maxConnections).toBe(25);
    // 其他配置应该使用默认值
    expect(config.database.ssl).toBe(false);
    expect(config.cors.credentials).toBe(true);

    // 恢复原始环境变量
    Object.assign(process.env, originalEnv);
  });
});
