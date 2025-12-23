import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/**
 * 应用配置模式定义
 */
export const configSchema = z.object({
  // 服务器配置
  server: z.object({
    port: z.coerce.number().default(3000),
    host: z.string().default('0.0.0.0'),
    env: z.enum(['development', 'production', 'test']).default('development'),
  }),

  // 数据库配置
  database: z.object({
    url: z.string().default('postgres://postgres:password@localhost:5432/mtpc_example'),
    maxConnections: z.coerce.number().default(10),
    ssl: z.boolean().default(false),
  }),

  // JWT 配置
  jwt: z.object({
    secret: z.string().default(randomBytes(32).toString('base64')),
    expiresIn: z.string().default('7d'),
    algorithm: z.string().default('HS256'),
  }),

  // CORS 配置
  cors: z.object({
    origin: z.array(z.string()).default(['http://localhost:5173', 'http://localhost:3000']),
    credentials: z.boolean().default(true),
  }),

  // 权限缓存配置
  cache: z.object({
    ttl: z.coerce.number().default(3600000), // 1 小时
    cacheSize: z.coerce.number().default(10000), // 最大缓存条目数
  }),

  // 日志配置
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'text']).default('text'),
  }),
});

/**
 * 应用配置类型
 */
export type AppConfig = z.infer<typeof configSchema>;

/**
 * 从环境变量加载配置
 * @returns 配置对象
 */
export function loadConfig(): AppConfig {
  // 从环境变量加载配置
  const envConfig = {
    server: {
      port: process.env.PORT,
      host: process.env.HOST,
      env: process.env.NODE_ENV,
    },
    database: {
      url: process.env.DATABASE_URL,
      maxConnections: process.env.DATABASE_MAX_CONNECTIONS,
      // 正确处理 SSL 环境变量，转换为布尔值
      ssl: process.env.DATABASE_SSL ? process.env.DATABASE_SSL === 'true' : undefined,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN,
      algorithm: process.env.JWT_ALGORITHM,
    },
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : undefined,
      credentials: process.env.CORS_CREDENTIALS
        ? process.env.CORS_CREDENTIALS === 'true'
        : undefined,
    },
    cache: {
      ttl: process.env.CACHE_TTL,
      cacheSize: process.env.CACHE_SIZE,
    },
    logging: {
      level: process.env.LOG_LEVEL,
      format: process.env.LOG_FORMAT,
    },
  };

  // 验证并合并默认值
  return configSchema.parse(envConfig);
}

// 导出单例配置实例
export const config = loadConfig();
