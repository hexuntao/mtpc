import { rbac } from './mtpc.js';

async function seed() {
  console.log('🌱 Seeding database...');

  const tenantId = 'default';

  // Create custom roles
  try {
    await rbac.createRole(tenantId, {
      name: 'sales_rep',
      displayName: 'Sales Representative',
      description: 'Can manage orders and view customers',
      permissions: [
        'order:create',
        'order:read',
        'order:update',
        'order:list',
        'order:confirm',
        'customer:read',
        'customer:list',
        'product:read',
        'product:list',
      ],
    });
    console.log('  ✓ Created sales_rep role');
  } catch (e) {
    console.log('  - sales_rep role already exists');
  }

  try {
    await rbac.createRole(tenantId, {
      name: 'inventory_manager',
      displayName: 'Inventory Manager',
      description: 'Can manage products and stock',
      permissions: [
        'product:create',
        'product:read',
        'product:update',
        'product:list',
        'product:import',
        'product:export',
      ],
    });
    console.log('  ✓ Created inventory_manager role');
  } catch (e) {
    console.log('  - inventory_manager role already exists');
  }

  // Assign roles to demo users
  await rbac.assignRole(tenantId, 'admin', 'user', 'user-admin');
  console.log('  ✓ Assigned admin role to user-admin');

  await rbac.assignRole(tenantId, 'manager', 'user', 'user-manager');
  console.log('  ✓ Assigned manager role to user-manager');

  await rbac.assignRole(tenantId, 'viewer', 'user', 'user-viewer');
  console.log('  ✓ Assigned viewer role to user-viewer');

  await rbac.assignRole(tenantId, 'sales_rep', 'user', 'user-sales');
  console.log('  ✓ Assigned sales_rep role to user-sales');

  console.log('\n✅ Seeding completed!');
  console.log('\nDemo users:');
  console.log('  - user-admin (admin)');
  console.log('  - user-manager (manager)');
  console.log('  - user-viewer (viewer)');
  console.log('  - user-sales (sales_rep)');

  process.exit(0);
}

seed().catch(console.error);
