import { toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from '@mtpc/shared';

/**
 * Template helpers
 */
export const templateHelpers = {
  pascalCase: toPascalCase,
  camelCase: toCamelCase,
  snakeCase: toSnakeCase,
  kebabCase: toKebabCase,

  /**
   * Uppercase first letter
   */
  capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Lowercase first letter
   */
  uncapitalize(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  },

  /**
   * Join array with separator
   */
  join(arr: string[], separator: string = ', '): string {
    return arr.join(separator);
  },

  /**
   * Indent lines
   */
  indent(text: string, spaces: number = 2): string {
    const padding = ' '.repeat(spaces);
    return text
      .split('\n')
      .map(line => padding + line)
      .join('\n');
  },

  /**
   * Quote string
   */
  quote(str: string, char: string = "'"): string {
    return `${char}${str}${char}`;
  },

  /**
   * Format as JSDoc comment
   */
  jsDoc(text: string): string {
    const lines = text.split('\n');
    if (lines.length === 1) {
      return `/** ${text} */`;
    }
    return ['/**', ...lines.map(l => ` * ${l}`), ' */'].join('\n');
  },

  /**
   * Pluralize word
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
   * Singularize word
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
