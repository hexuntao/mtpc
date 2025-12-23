import { serve } from '@hono/node-server';
import { app } from './app.js';

const port = parseInt(process.env.PORT ?? '3000', 10);

console.log(`🚀 Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`✅ Server running at http://localhost:${port}`);
console.log(`📚 API docs at http://localhost:${port}/api`);
console.log(`❤️  Health check at http://localhost:${port}/health`);
