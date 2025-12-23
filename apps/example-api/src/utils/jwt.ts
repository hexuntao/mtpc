import { jwtVerify, SignJWT } from 'jose';
import { config } from '../config/index.js';

// JWT 有效载荷接口
export interface JwtPayload {
  sub: string; // 用户 ID
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

/**
 * 生成 JWT 令牌
 * @param userId 用户 ID
 * @param email 用户邮箱
 * @param roles 用户角色列表
 * @param expiresIn 过期时间，默认使用配置值
 * @returns JWT 令牌字符串
 */
export async function generateToken(
  userId: string,
  email: string,
  roles: string[],
  expiresIn?: string
): Promise<string> {
  const secret = new TextEncoder().encode(config.jwt.secret);
  const payload = {
    sub: userId,
    email,
    roles,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: config.jwt.algorithm })
    .setIssuedAt()
    .setExpirationTime(expiresIn || config.jwt.expiresIn)
    .sign(secret);

  return token;
}

/**
 * 验证 JWT 令牌
 * @param token JWT 令牌字符串
 * @returns 验证成功返回 JWT 有效载荷，否则返回 null
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const secret = new TextEncoder().encode(config.jwt.secret);
    const decoded = await jwtVerify(token, secret, { algorithms: [config.jwt.algorithm] });
    return decoded.payload as JwtPayload;
  } catch (error) {
    return null;
  }
}

/**
 * 从 JWT 令牌中提取用户信息
 * @param token JWT 令牌字符串
 * @returns 用户信息对象，包含 id、email 和 roles
 */
export async function extractUserInfo(token: string) {
  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  return {
    id: payload.sub,
    email: payload.email,
    roles: payload.roles,
  };
}
