import { serve } from '@hono/node-server';
import { app } from './app.js';
import { runMigrations } from './db/migrations.js';
import { config } from './config/index.js';

async function startServer() {
  try {
    // 运行数据库迁移
    await runMigrations();
    
    const { port, host } = config.server;
    
    console.log(`🚀 Server starting on ${host}:${port} (${config.server.env} mode)`);
    
    serve({
      fetch: app.fetch,
      port,
      hostname: host,
    });
    
    console.log(`✅ Server running at http://${host}:${port}`);
    console.log(`📚 API docs at http://${host}:${port}/api`);
    console.log(`❤️  Health check at http://${host}:${port}/health`);
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();
