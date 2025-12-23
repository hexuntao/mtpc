/**
 * 递归将所有属性变为可选
 * 用于创建对象的深度可选类型
 */
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

/**
 * 递归将所有属性变为必填
 * 用于创建对象的深度必填类型
 */
export type DeepRequired<T> = T extends object ? { [P in keyof T]-?: DeepRequired<T[P]> } : T;

/**
 * 递归将所有属性变为只读
 * 用于创建对象的深度只读类型
 */
export type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

/**
 * 提取指定类型的键
 * 用于获取对象中值类型为指定类型的所有键
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * 将指定键变为必填
 * 用于强制要求对象中的某些属性必须提供
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * 将指定键变为可选
 * 用于将对象中的某些必填属性变为可选
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * 美化类型显示
 * 用于在 IDE 中更清晰地显示复杂类型
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * 合并两种类型，第二种类型优先
 * 用于组合两个类型，当存在冲突时使用第二种类型的定义
 */
export type Merge<T, U> = Prettify<Omit<T, keyof U> & U>;

/**
 * 检查类型是否为 never
 * 用于类型条件判断
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * 检查类型是否为 any
 * 用于类型条件判断，避免 any 类型带来的问题
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * 获取所有值类型的联合类型
 * 用于从对象类型中提取所有可能的值类型
 */
export type ValueOf<T> = T[keyof T];

/**
 * 获取数组元素类型
 * 用于从数组类型中提取元素类型
 */
export type ElementOf<T> = T extends (infer E)[] ? E : never;

/**
 * 可空类型
 * 表示类型可以是原值或 null
 */
export type Nullable<T> = T | null;

/**
 * 可能类型（可空且可选）
 * 表示类型可以是原值、null 或 undefined
 */
export type Maybe<T> = T | null | undefined;

/**
 * 任意函数类型助手
 * 表示接受任意参数并返回任意值的函数
 */
export type AnyFunction = (...args: unknown[]) => unknown;

/**
 * 异步函数类型助手
 * 表示返回 Promise 的异步函数
 */
export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>;

/**
 * 构造函数类型
 * 表示可用于创建实例的构造函数
 */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;
