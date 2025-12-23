import { describe, expect, it } from 'vitest';
import { errorResponse, ErrorCodes, successResponse } from './response.js';

describe('Response Utilities', () => {
  describe('successResponse', () => {
    it('should create a successful response with data', () => {
      const data = { id: 1, name: 'Test' };
      const response = successResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeUndefined();
      expect(response.timestamp).toBeDefined();
    });

    it('should create a successful response with pagination', () => {
      const data = [{ id: 1, name: 'Test' }];
      const pagination = {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };
      const response = successResponse(data, pagination);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.pagination).toEqual(pagination);
      expect(response.error).toBeUndefined();
    });

    it('should create a successful response without data', () => {
      const response = successResponse();

      expect(response.success).toBe(true);
      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
    });
  });

  describe('errorResponse', () => {
    it('should create an error response with code and message', () => {
      const code = ErrorCodes.BAD_REQUEST;
      const message = 'Invalid request';
      const response = errorResponse(code, message);

      expect(response.success).toBe(false);
      expect(response.data).toBeUndefined();
      expect(response.error).toEqual({ code, message });
      expect(response.timestamp).toBeDefined();
    });

    it('should create an error response with details in development mode', () => {
      const code = ErrorCodes.INTERNAL_SERVER_ERROR;
      const message = 'Server error';
      const details = { stack: 'Error stack trace' };

      // 保存原始环境变量
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = errorResponse(code, message, details);

      // 恢复环境变量
      process.env.NODE_ENV = originalEnv;

      expect(response.success).toBe(false);
      expect(response.error).toEqual({ code, message, details });
    });

    it('should not include details in production mode', () => {
      const code = ErrorCodes.INTERNAL_SERVER_ERROR;
      const message = 'Server error';
      const details = { stack: 'Error stack trace' };

      // 保存原始环境变量
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = errorResponse(code, message, details);

      // 恢复环境变量
      process.env.NODE_ENV = originalEnv;

      expect(response.success).toBe(false);
      expect(response.error).toEqual({ code, message });
      expect(response.error?.details).toBeUndefined();
    });
  });
});
