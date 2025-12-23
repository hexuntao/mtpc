/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

/**
 * Make all properties required recursively
 */
export type DeepRequired<T> = T extends object ? { [P in keyof T]-?: DeepRequired<T[P]> } : T;

/**
 * Make all properties readonly recursively
 */
export type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

/**
 * Extract keys of type
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Make specified keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specified keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Prettify type display
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Merge two types, second type takes precedence
 */
export type Merge<T, U> = Prettify<Omit<T, keyof U> & U>;

/**
 * Check if type is never
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Check if type is any
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Get union of all value types
 */
export type ValueOf<T> = T[keyof T];

/**
 * Get array element type
 */
export type ElementOf<T> = T extends (infer E)[] ? E : never;

/**
 * Nullable type
 */
export type Nullable<T> = T | null;

/**
 * Maybe type (nullable and optional)
 */
export type Maybe<T> = T | null | undefined;

/**
 * Function type helper
 */
export type AnyFunction = (...args: unknown[]) => unknown;

/**
 * Async function type helper
 */
export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>;

/**
 * Constructor type
 */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;
