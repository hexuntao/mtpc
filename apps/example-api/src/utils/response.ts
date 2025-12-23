/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T = any> {
  /** 操作是否成功 */
  success: boolean;
  /** 响应数据，成功时返回 */
  data?: T;
  /** 错误信息，失败时返回 */
  error?: {
    /** 错误码 */
    code: string;
    /** 错误消息 */
    message: string;
    /** 错误详情，仅在开发环境返回 */
    details?: any;
  };
  /** 分页信息，列表查询时返回 */
  pagination?: {
    /** 当前页码 */
    page: number;
    /** 每页大小 */
    pageSize: number;
    /** 总记录数 */
    total: number;
    /** 总页数 */
    totalPages: number;
    /** 是否有下一页 */
    hasNext: boolean;
    /** 是否有上一页 */
    hasPrev: boolean;
  };
  /** 响应时间戳 */
  timestamp: number;
}

/**
 * 成功响应生成器
 * @param data 响应数据
 * @param pagination 分页信息（可选）
 * @returns 统一格式的成功响应
 */
export function successResponse<T = any>(data?: T, pagination?: ApiResponse['pagination']): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    timestamp: Date.now(),
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (pagination) {
    response.pagination = pagination;
  }

  return response;
}

/**
 * 错误响应生成器
 * @param code 错误码
 * @param message 错误消息
 * @param details 错误详情（可选）
 * @returns 统一格式的错误响应
 */
export function errorResponse(code: string, message: string, details?: any): ApiResponse {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: Date.now(),
  };

  // 仅在开发环境返回错误详情
  if (details && process.env.NODE_ENV !== 'production') {
    response.error.details = details;
  }

  return response;
}

/**
 * 常见错误码枚举
 */
export enum ErrorCodes {
  // 通用错误
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // 资源错误
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  INVALID_RESOURCE_DATA = 'INVALID_RESOURCE_DATA',
  
  // 权限错误
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  
  // 数据库错误
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
}

/**
 * 错误码对应的 HTTP 状态码映射
 */
export const errorCodeToHttpStatus: Record<string, number> = {
  // 通用错误
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  
  // 资源错误
  [ErrorCodes.RESOURCE_NOT_FOUND]: 404,
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCodes.INVALID_RESOURCE_DATA]: 400,
  
  // 权限错误
  [ErrorCodes.PERMISSION_DENIED]: 403,
  [ErrorCodes.ROLE_NOT_FOUND]: 404,
  [ErrorCodes.UNAUTHORIZED_ACCESS]: 401,
  
  // 数据库错误
  [ErrorCodes.DATABASE_ERROR]: 500,
  [ErrorCodes.DATABASE_CONNECTION_ERROR]: 503,
};
