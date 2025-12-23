import { createMTPC } from '@mtpc/core';
import { createRBAC, role } from '@mtpc/rbac';
import { resources } from './resources.js';

// Create MTPC instance
export const mtpc = createMTPC();

// Register resources
mtpc.registerResources(resources);

// Create RBAC instance
export const rbac = createRBAC();

// Define system roles
const adminRole = role('admin')
  .displayName('Administrator')
  .description('Full system access')
  .system()
  .permission('*')
  .buildDefinition('admin');

const managerRole = role('manager')
  .displayName('Manager')
  .description('Can manage products and orders')
  .fullAccess('product')
  .fullAccess('order')
  .readOnly('customer')
  .buildDefinition('manager');

const viewerRole = role('viewer')
  .displayName('Viewer')
  .description('Read-only access')
  .readOnly('product')
  .readOnly('order')
  .readOnly('customer')
  .buildDefinition('viewer');

// Register system roles
rbac.roles.registerSystemRole(adminRole);
rbac.roles.registerSystemRole(managerRole);
rbac.roles.registerSystemRole(viewerRole);

// Initialize MTPC
await mtpc.init();

console.log('✅ MTPC initialized with', mtpc.getSummary());
