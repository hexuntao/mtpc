/**
 * 策略模块导出
 * 该模块统一导出策略系统相关的所有类和函数
 *
 * 包含内容：
 * - PolicyBuilder: 策略构建器
 * - PolicyRuleBuilder: 策略规则构建器
 * - compilePolicy: 策略编译
 * - DefaultPolicyEngine: 默认策略引擎
 * - evaluateCondition: 条件评估
 *
 * 策略系统提供以下功能：
 * - 策略定义和构建
 * - 策略编译和优化
 * - 策略条件评估
 * - 策略引擎执行
 *
 * @example
 * ```typescript
 * import {
 *   policy,
 *   rule,
 *   compilePolicy,
 *   createPolicyEngine
 * } from '@mtpc/core/policy';
 *
 * // 构建策略
 * const myPolicy = policy('my-policy')
 *   .name('我的策略')
 *   .description('描述策略')
 *   .rule(rule()
 *     .permissions('user:read')
 *     .allow()
 *     .whereEquals('role', 'admin'))
 *   .build();
 *
 * // 编译策略
 * const compiled = compilePolicy(myPolicy);
 *
 * // 创建策略引擎
 * const engine = createPolicyEngine();
 * engine.addPolicy(myPolicy);
 *
 * // 评估策略
 * const result = await engine.evaluate(context);
 * ```
 */

// 导出策略构建器相关
export * from './builder.js';

// 导出策略编译器相关
export * from './compiler.js';

// 导出策略条件相关
export * from './conditions.js';

// 导出策略引擎相关
export * from './engine.js';
