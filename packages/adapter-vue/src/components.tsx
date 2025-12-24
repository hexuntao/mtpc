// @mtpc/adapter-vue - MTPC Vue 适配器的组件

import { defineComponent, } from 'vue';
import { usePermissionContext } from './context.js';
import type { CanProps } from './types.js';
import { toArray } from './utils.js';

/**
 * <Can> 组件 - Vue 权限条件渲染组件
 * 仅当权限允许时渲染子内容
 */
export const Can = defineComponent<CanProps>({
  name: 'MtpcCan',
  props: {
    permission: String, // 单个权限代码
    permissions: Array as () => string[] | undefined, // 权限代码数组
    mode: {
      type: String as () => 'any' | 'all',
      default: 'all', // 匹配模式，默认 'all'（所有权限都必须匹配）
    },
    not: {
      type: Boolean,
      default: false, // 是否取反，true 表示权限不允许时渲染
    },
  },
  setup(props, { slots }) {
    // 获取权限上下文
    const ctx = usePermissionContext();
    
    // 规范化权限输入，将单个权限或权限数组转换为统一的数组格式
    const required = toArray(props.permission, props.permissions);
    
    return () => {
      // 评估权限
      const result = ctx.evaluate(required, props.mode ?? 'all');
      
      // 根据 not 参数决定是否取反结果
      const allowed = props.not ? !result.allowed : result.allowed;
      
      // 权限不允许时返回 null
      if (!allowed) {
        return null;
      }
      
      // 权限允许时渲染子内容
      return slots.default ? slots.default() : null;
    };
  },
});

/**
 * <Cannot> 组件 - <Can> 组件的相反版本
 * 仅当权限不允许时渲染子内容
 */
export const Cannot = defineComponent<CanProps>({
  name: 'MtpcCannot',
  props: {
    permission: String, // 单个权限代码
    permissions: Array as () => string[] | undefined, // 权限代码数组
    mode: {
      type: String as () => 'any' | 'all',
      default: 'all', // 匹配模式，默认 'all'（所有权限都必须匹配）
    },
  },
  setup(props, { slots }) {
    // 获取权限上下文
    const ctx = usePermissionContext();
    
    // 规范化权限输入，将单个权限或权限数组转换为统一的数组格式
    const required = toArray(props.permission, props.permissions);
    
    return () => {
      // 评估权限
      const result = ctx.evaluate(required, props.mode ?? 'all');
      
      // 权限允许时返回 null
      if (result.allowed) {
        return null;
      }
      
      // 权限不允许时渲染子内容
      return slots.default ? slots.default() : null;
    };
  },
});
