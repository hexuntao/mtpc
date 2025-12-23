import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config/index.js';

// 从配置获取数据库连接信息
const client = postgres(config.database.url, {
  max: config.database.maxConnections,
  ssl: config.database.ssl,
});

export const db = drizzle(client);
