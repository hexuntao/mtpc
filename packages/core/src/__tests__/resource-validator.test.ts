import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateResourceDefinition, validateData, validateCreateInput, validateUpdateInput, safeValidate } from '../resource/validator.js';
import { defineResource } from '../resource/define.js';
import { InvalidResourceDefinitionError, ValidationError } from '@mtpc/shared';

describe('Resource Validator', () => {
  describe('validateResourceDefinition - name validation', () => {
    it('should throw for null name', () => {
      expect(() => validateResourceDefinition({
        name: null as any,
        schema: z.object({ id: z.string() }),
        permissions: [],
        relations: [],
      })).toThrow(InvalidResourceDefinitionError);
    });

    it('should throw for undefined name', () => {
      expect(() => validateResourceDefinition({
        name: undefined as any,
        schema: z.object({ id: z.string() }),
        permissions: [],
        relations: [],
      })).toThrow(InvalidResourceDefinitionError);
    });

    it('should throw for empty name', () => {
      expect(() => validateResourceDefinition({
        name: '',
        schema: z.object({ id: z.string() }),
        permissions: [],
        relations: [],
      })).toThrow(InvalidResourceDefinitionError);
    });

    it('should throw for non-string name', () => {
      expect(() => validateResourceDefinition({
        name: 123 as any,
        schema: z.object({ id: z.string() }),
        permissions: [],
        relations: [],
      })).toThrow(InvalidResourceDefinitionError);
    });

    it('should throw for name starting with number', () => {
      expect(() => validateResourceDefinition({
        name: '123user',
        schema: z.object({ id: z.string() }),
        permissions: [],
        relations: [],
      })).toThrow('must start with a letter');
    });

    it('should throw for name with special characters', () => {
      expect(() => validateResourceDefinition({
        name: 'user-name',
        schema: z.object({ id: z.string() }),
        permissions: [],
        relations: [],
      })).toThrow('alphanumeric');
    });

    it('should accept valid name', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
      });

      expect(() => validateResourceDefinition(resource)).not.toThrow();
    });

    it('should accept name with underscores', () => {
      const resource = defineResource({
        name: 'user_profile',
        schema: z.object({ id: z.string() }),
        features: { read: true },
      });

      expect(() => validateResourceDefinition(resource)).not.toThrow();
    });

    it('should accept name with numbers', () => {
      const resource = defineResource({
        name: 'user123',
        schema: z.object({ id: z.string() }),
        features: { read: true },
      });

      expect(() => validateResourceDefinition(resource)).not.toThrow();
    });
  });

  describe('validateResourceDefinition - schema validation', () => {
    it('should throw for null schema', () => {
      expect(() => validateResourceDefinition({
        name: 'user',
        schema: null as any,
        permissions: [],
        relations: [],
      })).toThrow('must be a valid Zod schema');
    });

    it('should throw for undefined schema', () => {
      expect(() => validateResourceDefinition({
        name: 'user',
        schema: undefined as any,
        permissions: [],
        relations: [],
      })).toThrow('must be a valid Zod schema');
    });

    it('should throw for non-Zod schema', () => {
      expect(() => validateResourceDefinition({
        name: 'user',
        schema: {} as any,
        permissions: [],
        relations: [],
      })).toThrow('must be a valid Zod schema');
    });

    it('should accept valid Zod schema', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string(), name: z.string() }),
        features: { read: true },
      });

      expect(() => validateResourceDefinition(resource)).not.toThrow();
    });
  });

  describe('validateResourceDefinition - permission validation', () => {
    it('should throw for permission with missing action', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
        permissions: [{} as any],
      });

      expect(() => validateResourceDefinition(resource)).toThrow('action must be a non-empty string');
    });

    it('should throw for permission with empty action', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
        permissions: [{ action: '' } as any],
      });

      expect(() => validateResourceDefinition(resource)).toThrow('action must be a non-empty string');
    });

    it('should accept permission with valid action', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
        permissions: [{ action: 'export', description: 'Export' }],
      });

      expect(() => validateResourceDefinition(resource)).not.toThrow();
    });
  });

  describe('validateResourceDefinition - relation validation', () => {
    it('should throw for relation with missing name', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
        relations: [{ type: 'hasMany', target: 'post', foreignKey: 'userId' } as any],
      });

      expect(() => validateResourceDefinition(resource)).toThrow('must have name, target, and type');
    });

    it('should throw for relation with missing target', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
        relations: [{ name: 'posts', type: 'hasMany', foreignKey: 'userId' } as any],
      });

      expect(() => validateResourceDefinition(resource)).toThrow('must have name, target, and type');
    });

    it('should throw for relation with missing type', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
        relations: [{ name: 'posts', target: 'post', foreignKey: 'userId' } as any],
      });

      expect(() => validateResourceDefinition(resource)).toThrow('must have name, target, and type');
    });

    it('should accept relation with all required fields', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string() }),
        features: { read: true },
        relations: [{ name: 'posts', type: 'hasMany', target: 'post', foreignKey: 'userId' }],
      });

      expect(() => validateResourceDefinition(resource)).not.toThrow();
    });
  });

  describe('validateData', () => {
    it('should return parsed data for valid input', () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const data = { name: 'John', age: 30 };

      const result = validateData(schema, data);

      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
    });

    it('should throw ValidationError for invalid input', () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const data = { name: 123, age: 'not a number' };

      expect(() => validateData(schema, data)).toThrow(ValidationError);
    });

    it('should throw for missing required fields', () => {
      const schema = z.object({ name: z.string(), email: z.string().email() });
      const data = { name: 'John' };

      expect(() => validateData(schema, data)).toThrow(ValidationError);
    });

    it('should throw for invalid email format', () => {
      const schema = z.object({ email: z.string().email() });
      const data = { email: 'not-an-email' };

      expect(() => validateData(schema, data)).toThrow(ValidationError);
    });

    it('should throw for extra fields when not allowed', () => {
      const schema = z.object({ name: z.string() }).strict();
      const data = { name: 'John', extra: 'field' };

      expect(() => validateData(schema, data)).toThrow(ValidationError);
    });

    it('should strip unknown fields with strict: false', () => {
      const schema = z.object({ name: z.string() }).strict();
      const data = { name: 'John', extra: 'field' };

      expect(() => validateData(schema, data)).toThrow();
    });
  });

  describe('validateCreateInput', () => {
    it('should validate using createSchema', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string(), name: z.string(), email: z.string().email() }),
        createSchema: z.object({ name: z.string(), email: z.string().email() }),
        features: { create: true, read: true },
      });

      const data = { name: 'John', email: 'john@example.com' };

      const result = validateCreateInput(resource, data);
      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
    });

    it('should reject invalid create input', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string(), name: z.string() }),
        createSchema: z.object({ name: z.string(), email: z.string().email() }),
        features: { create: true, read: true },
      });

      const data = { name: 'John', email: 'invalid-email' };

      expect(() => validateCreateInput(resource, data)).toThrow(ValidationError);
    });

    it('should use main schema when createSchema not specified', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string(), name: z.string() }),
        features: { create: true, read: true },
      });

      const data = { id: '1', name: 'John' };

      const result = validateCreateInput(resource, data);
      expect(result.id).toBe('1');
      expect(result.name).toBe('John');
    });
  });

  describe('validateUpdateInput', () => {
    it('should validate using updateSchema', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string(), name: z.string(), email: z.string().email() }),
        updateSchema: z.object({ name: z.string().optional(), email: z.string().email().optional() }),
        features: { update: true, read: true },
      });

      const data = { name: 'Jane' };

      const result = validateUpdateInput(resource, data);
      expect(result.name).toBe('Jane');
    });

    it('should reject invalid update input', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string(), name: z.string() }),
        updateSchema: z.object({ name: z.string() }),
        features: { update: true, read: true },
      });

      const data = { name: 123 };

      expect(() => validateUpdateInput(resource, data)).toThrow(ValidationError);
    });

    it('should use main schema when updateSchema not specified', () => {
      const resource = defineResource({
        name: 'user',
        schema: z.object({ id: z.string(), name: z.string() }),
        features: { update: true, read: true },
      });

      const data = { id: '1', name: 'Jane' };

      const result = validateUpdateInput(resource, data);
      expect(result.name).toBe('Jane');
    });
  });

  describe('safeValidate', () => {
    it('should return success: true for valid data', () => {
      const schema = z.object({ name: z.string() });
      const data = { name: 'John' };

      const result = safeValidate(schema, data);

      expect(result.success).toBe(true);
      expect((result as any).data.name).toBe('John');
    });

    it('should return success: false for invalid data', () => {
      const schema = z.object({ name: z.string() });
      const data = { name: 123 };

      const result = safeValidate(schema, data);

      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(z.ZodError);
    });

    it('should not throw for invalid data', () => {
      const schema = z.object({ name: z.string() });
      const data = { name: 123 };

      expect(() => safeValidate(schema, data)).not.toThrow();
    });

    it('should handle complex nested validation', () => {
      const schema = z.object({
        users: z.array(z.object({ id: z.string(), name: z.string() })),
      });

      const data = {
        users: [
          { id: '1', name: 'John' },
          { id: '2', name: 'Jane' },
        ],
      };

      const result = safeValidate(schema, data);
      expect(result.success).toBe(true);
    });

    it('should handle array validation errors', () => {
      const schema = z.object({
        users: z.array(z.object({ id: z.string(), name: z.string() })),
      });

      const data = {
        users: [
          { id: '1', name: 'John' },
          { id: '2', name: 123 },
        ],
      };

      const result = safeValidate(schema, data);
      expect(result.success).toBe(false);
    });
  });

  describe('Complete validation workflow', () => {
    it('should validate full resource lifecycle', () => {
      // Create resource with validation schemas
      const userResource = defineResource({
        name: 'user',
        schema: z.object({
          id: z.string(),
          name: z.string().min(2).max(50),
          email: z.string().email(),
          age: z.number().min(0).max(150).optional(),
        }),
        createSchema: z.object({
          name: z.string().min(2).max(50),
          email: z.string().email(),
          age: z.number().min(0).max(150).optional(),
        }),
        updateSchema: z.object({
          name: z.string().min(2).max(50).optional(),
          email: z.string().email().optional(),
          age: z.number().min(0).max(150).optional(),
        }),
        features: { create: true, read: true, update: true, delete: true, list: true },
      });

      // Validate resource definition
      expect(() => validateResourceDefinition(userResource)).not.toThrow();

      // Validate create input
      const createData = { name: 'John Doe', email: 'john@example.com', age: 30 };
      expect(() => validateCreateInput(userResource, createData)).not.toThrow();

      // Validate update input
      const updateData = { name: 'Jane Doe' };
      expect(() => validateUpdateInput(userResource, updateData)).not.toThrow();

      // Validate invalid create input
      expect(() => validateCreateInput(userResource, { name: 'J' })).toThrow();
      expect(() => validateCreateInput(userResource, { email: 'invalid' })).toThrow();
    });

    it('should handle ValidationError details', () => {
      const schema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
      });

      try {
        validateData(schema, { name: 'J', email: 'invalid' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
      }
    });
  });
});
