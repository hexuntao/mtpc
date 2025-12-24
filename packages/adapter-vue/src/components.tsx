import { defineComponent, h } from 'vue';
import { usePermissionContext } from './context.js';
import type { CanProps } from './types.js';
import { toArray } from './utils.js';

/**
 * <Can> component for Vue
 */
export const Can = defineComponent<CanProps>({
  name: 'MtpcCan',
  props: {
    permission: String,
    permissions: Array as () => string[] | undefined,
    mode: {
      type: String as () => 'any' | 'all',
      default: 'all',
    },
    not: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { slots }) {
    const ctx = usePermissionContext();
    const required = toArray(props.permission, props.permissions);
    return () => {
      const result = ctx.evaluate(required, props.mode ?? 'all');
      const allowed = props.not ? !result.allowed : result.allowed;
      if (!allowed) {
        return null;
      }
      return slots.default ? slots.default() : null;
    };
  },
});

/**
 * <Cannot> component - opposite of <Can>
 */
export const Cannot = defineComponent<CanProps>({
  name: 'MtpcCannot',
  props: {
    permission: String,
    permissions: Array as () => string[] | undefined,
    mode: {
      type: String as () => 'any' | 'all',
      default: 'all',
    },
  },
  setup(props, { slots }) {
    const ctx = usePermissionContext();
    const required = toArray(props.permission, props.permissions);
    return () => {
      const result = ctx.evaluate(required, props.mode ?? 'all');
      const allowed = result.allowed;
      if (allowed) {
        return null;
      }
      return slots.default ? slots.default() : null;
    };
  },
});
