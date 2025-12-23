import { createMigrationRunner, createSystemTablesMigration } from '@mtpc/adapter-drizzle';
import { sql } from 'drizzle-orm';
import { db } from './connection.js';

// 创建迁移运行器
const migrationRunner = createMigrationRunner(db);

// 注册系统表迁移
migrationRunner.register(createSystemTablesMigration());

// 注册 RBAC 表迁移
migrationRunner.register({
  id: '0002_rbac_tables',
  name: 'Create RBAC tables',
  async up(db) {
    await db.execute(
      sql.raw(`
        -- Roles table
        CREATE TABLE IF NOT EXISTS roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          display_name VARCHAR(255),
          description TEXT,
          type VARCHAR(50) DEFAULT 'custom' NOT NULL,
          status VARCHAR(50) DEFAULT 'active' NOT NULL,
          permissions JSONB DEFAULT '[]',
          inherits JSONB,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by UUID,
          
          CONSTRAINT roles_tenant_name_unique UNIQUE (tenant_id, name)
        );

        CREATE INDEX IF NOT EXISTS roles_tenant_idx ON roles(tenant_id);
        CREATE INDEX IF NOT EXISTS roles_type_idx ON roles(type);
        CREATE INDEX IF NOT EXISTS roles_status_idx ON roles(status);

        -- Role bindings table
        CREATE TABLE IF NOT EXISTS role_bindings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          role_id UUID NOT NULL,
          subject_type VARCHAR(50) NOT NULL,
          subject_id VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by UUID,
          
          CONSTRAINT role_bindings_tenant_subject_role_unique UNIQUE (tenant_id, subject_type, subject_id, role_id)
        );

        CREATE INDEX IF NOT EXISTS role_bindings_tenant_idx ON role_bindings(tenant_id);
        CREATE INDEX IF NOT EXISTS role_bindings_role_idx ON role_bindings(role_id);
        CREATE INDEX IF NOT EXISTS role_bindings_subject_idx ON role_bindings(tenant_id, subject_type, subject_id);
        CREATE INDEX IF NOT EXISTS role_bindings_expires_idx ON role_bindings(expires_at);

        -- Resources tables (auto-generated from resource definitions)
        CREATE TABLE IF NOT EXISTS products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          name VARCHAR(200) NOT NULL,
          description TEXT,
          price DOUBLE PRECISION NOT NULL,
          sku VARCHAR(50) NOT NULL,
          category TEXT,
          status TEXT DEFAULT 'active' NOT NULL,
          stock INTEGER DEFAULT 0 NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by UUID,
          updated_by UUID,
          deleted_at TIMESTAMP WITH TIME ZONE,
          deleted_by UUID
        );

        CREATE INDEX IF NOT EXISTS products_tenant_idx ON products(tenant_id);
        CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku);
        CREATE INDEX IF NOT EXISTS products_created_at_idx ON products(created_at);

        CREATE TABLE IF NOT EXISTS orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          order_number VARCHAR(255) NOT NULL,
          customer_id UUID NOT NULL,
          status TEXT DEFAULT 'pending' NOT NULL,
          items JSONB NOT NULL,
          total_amount DOUBLE PRECISION NOT NULL,
          shipping_address JSONB,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by UUID,
          updated_by UUID,
          deleted_at TIMESTAMP WITH TIME ZONE,
          deleted_by UUID
        );

        CREATE INDEX IF NOT EXISTS orders_tenant_idx ON orders(tenant_id);
        CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id);
        CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
        CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);

        CREATE TABLE IF NOT EXISTS customers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          email VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          phone TEXT,
          status TEXT DEFAULT 'active' NOT NULL,
          tier TEXT DEFAULT 'standard' NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by UUID,
          updated_by UUID,
          deleted_at TIMESTAMP WITH TIME ZONE,
          deleted_by UUID,
          
          CONSTRAINT customers_tenant_email_unique UNIQUE (tenant_id, email)
        );

        CREATE INDEX IF NOT EXISTS customers_tenant_idx ON customers(tenant_id);
        CREATE INDEX IF NOT EXISTS customers_status_idx ON customers(status);
        CREATE INDEX IF NOT EXISTS customers_tier_idx ON customers(tier);
        CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers(created_at);
      `)
    );
  },
  async down(db) {
    await db.execute(
      sql.raw(`
        DROP TABLE IF EXISTS customers;
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS products;
        DROP TABLE IF EXISTS role_bindings;
        DROP TABLE IF EXISTS roles;
      `)
    );
  },
});

// 运行迁移
async function runMigrations() {
  try {
    console.log('开始运行数据库迁移...');
    const executed = await migrationRunner.migrate();
    
    if (executed.length === 0) {
      console.log('没有待运行的迁移');
    } else {
      console.log(`成功运行了 ${executed.length} 个迁移:`);
      executed.forEach((id) => console.log(`  - ${id}`));
    }
    
    return true;
  } catch (error) {
    console.error('迁移失败:', error);
    return false;
  }
}

// 导出迁移运行器和运行函数
export {
  migrationRunner,
  runMigrations,
};
