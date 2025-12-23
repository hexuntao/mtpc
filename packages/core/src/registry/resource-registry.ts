import type { ResourceDefinition } from '../types/index.js';
import { ResourceNotFoundError, ResourceAlreadyExistsError } from '@mtpc/shared';
import { validateResourceDefinition } from '../resource/validator.js';

/**
 * Resource registry
 */
export class ResourceRegistry {
  private resources: Map<string, ResourceDefinition> = new Map();
  private frozen = false;

  /**
   * Register a resource
   */
  register(resource: ResourceDefinition): void {
    if (this.frozen) {
      throw new Error('Registry is frozen. Cannot register new resources.');
    }

    if (this.resources.has(resource.name)) {
      throw new ResourceAlreadyExistsError(resource.name);
    }

    validateResourceDefinition(resource);
    this.resources.set(resource.name, resource);
  }

  /**
   * Register multiple resources
   */
  registerMany(resources: ResourceDefinition[]): void {
    for (const resource of resources) {
      this.register(resource);
    }
  }

  /**
   * Get resource by name
   */
  get(name: string): ResourceDefinition | undefined {
    return this.resources.get(name);
  }

  /**
   * Get resource or throw
   */
  getOrThrow(name: string): ResourceDefinition {
    const resource = this.resources.get(name);
    
    if (!resource) {
      throw new ResourceNotFoundError(name);
    }

    return resource;
  }

  /**
   * Check if resource exists
   */
  has(name: string): boolean {
    return this.resources.has(name);
  }

  /**
   * List all resources
   */
  list(): ResourceDefinition[] {
    return Array.from(this.resources.values());
  }

  /**
   * List resource names
   */
  names(): string[] {
    return Array.from(this.resources.keys());
  }

  /**
   * Get resources by group
   */
  getByGroup(group: string): ResourceDefinition[] {
    return this.list().filter(r => r.metadata.group === group);
  }

  /**
   * Get visible resources (not hidden)
   */
  getVisible(): ResourceDefinition[] {
    return this.list().filter(r => !r.metadata.hidden);
  }

  /**
   * Freeze the registry
   */
  freeze(): void {
    this.frozen = true;
  }

  /**
   * Check if registry is frozen
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Get count
   */
  get size(): number {
    return this.resources.size;
  }

  /**
   * Clear all resources (for testing)
   */
  clear(): void {
    if (this.frozen) {
      throw new Error('Registry is frozen. Cannot clear resources.');
    }
    this.resources.clear();
  }

  /**
   * Iterate over resources
   */
  [Symbol.iterator](): Iterator<[string, ResourceDefinition]> {
    return this.resources[Symbol.iterator]();
  }

  /**
   * For each resource
   */
  forEach(
    callback: (resource: ResourceDefinition, name: string) => void
  ): void {
    this.resources.forEach((resource, name) => callback(resource, name));
  }
}

/**
 * Create a resource registry
 */
export function createResourceRegistry(): ResourceRegistry {
  return new ResourceRegistry();
}
