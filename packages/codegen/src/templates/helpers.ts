import { toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from '@mtpc/shared';

/**
 * 模板辅助函数集合
 * 提供字符串处理、格式转换等常用功能
 *
 * **功能**：
 * - 大小写转换
 * - 数组操作
 * - 缩进处理
 * - 复数处理
 *
 * **示例**：
 * ```typescript
 * templateHelpers.pascalCase('user_name');  // 'UserName'
 * templateHelpers.pluralize('user');        // 'users'
 * templateHelpers.indent('code', 2);        // '  code'
 * ```
 */
export const templateHelpers = {
  /** 转换为帕斯卡命名法（PascalCase） */
  pascalCase: toPascalCase,
  /** 转换为驼峰命名法（camelCase） */
  camelCase: toCamelCase,
  /** 转换为蛇形命名法（snake_case） */
  snakeCase: toSnakeCase,
  /** 转换为短横线命名法（kebab-case） */
  kebabCase: toKebabCase,

  /**
   * 首字母大写
   *
   * @param str 输入字符串
   * @returns 首字母大写后的字符串
   *
   * **示例**：
   * - capitalize('hello')  返回 'Hello'
   * - capitalize('Hello')  返回 'Hello'
   * - capitalize('')       返回 ''
   */
  capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * 首字母小写
   *
   * @param str 输入字符串
   * @returns 首字母小写后的字符串
   *
   * **示例**：
   * - uncapitalize('Hello')  返回 'hello'
   * - uncapitalize('hello')  返回 'hello'
   */
  uncapitalize(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  },

  /**
   * 使用指定分隔符连接数组
   *
   * @param arr 字符串数组
   * @param separator 分隔符（默认 ', '）
   * @returns 连接后的字符串
   *
   * **示例**：
   * - join(['a', 'b', 'c'], ', ')  返回 'a, b, c'
   * - join(['a', 'b', 'c'], ' | ') 返回 'a | b | c'
   */
  join(arr: string[], separator: string = ', '): string {
    return arr.join(separator);
  },

  /**
   * 对文本进行缩进
   *
   * @param text 输入文本
   * @param spaces 缩进空格数（默认 2）
   * @returns 缩进后的文本
   *
   * **示例**：
   * indent('line1\nline2', 2) 返回 '  line1\n  line2'
   */
  indent(text: string, spaces: number = 2): string {
    const padding = ' '.repeat(spaces);
    return text
      .split('\n')
      .map(line => padding + line)
      .join('\n');
  },

  /**
   * 为字符串添加引号
   *
   * @param str 输入字符串
   * @param char 引号字符（默认单引号 '）
   * @returns 带引号的字符串
   *
   * **示例**：
   * - quote('hello')       返回 "'hello'"
   * - quote('hello', '"')  返回 '"hello"'
   */
  quote(str: string, char: string = "'"): string {
    return `${char}${str}${char}`;
  },

  /**
   * 格式化为 JSDoc 注释
   *
   * @param text 注释内容
   * @returns JSDoc 格式的注释
   *
   * **示例**：
   * - jsDoc('Single line') 返回 "/** Single line *\/"
   * - jsDoc('Multi\nline') 返回 "/**\n * Multi\n * line\n *\/"
   */
  jsDoc(text: string): string {
    const lines = text.split('\n');
    if (lines.length === 1) {
      return `/** ${text} */`;
    }
    return ['/**', ...lines.map(l => ` * ${l}`), ' */'].join('\n');
  },

  /**
   * 将单词转换为复数形式
   *
   * **规则**：
   * - 以 'y' 结尾（非元音+y）→ ies
   * - 以 s, x, ch, sh 结尾 → es
   * - 其他 → s
   *
   * @param word 输入单词
   * @returns 复数形式的单词
   *
   * **示例**：
   * - pluralize('user')     返回 'users'
   * - pluralize('category') 返回 'categories'
   * - pluralize('bus')      返回 'buses'
   * - pluralize('box')      返回 'boxes'
   */
  pluralize(word: string): string {
    if (word.endsWith('y') && !['ay', 'ey', 'iy', 'oy', 'uy'].some(v => word.endsWith(v))) {
      return word.slice(0, -1) + 'ies';
    }
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
      return word + 'es';
    }
    return word + 's';
  },

  /**
   * 将单词转换为单数形式
   *
   * **规则**：
   * - 以 ies 结尾 → y
   * - 以 es 结尾 → 去掉 es
   * - 以 s 结尾（非 ss）→ 去掉 s
   *
   * @param word 输入单词
   * @returns 单数形式的单词
   *
   * **示例**：
   * - singularize('users')     返回 'user'
   * - singularize('categories') 返回 'category'
   * - singularize('buses')     返回 'bus'
   */
  singularize(word: string): string {
    if (word.endsWith('ies')) {
      return word.slice(0, -3) + 'y';
    }
    if (word.endsWith('es')) {
      return word.slice(0, -2);
    }
    if (word.endsWith('s') && !word.endsWith('ss')) {
      return word.slice(0, -1);
    }
    return word;
  },
};
