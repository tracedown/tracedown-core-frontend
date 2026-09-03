<template>
    <span class="inline-flex items-center gap-1.5">
      <FontAwesomeIcon
        v-if="locked"
        :icon="faLock"
        class="w-3 h-3 text-text-secondary shrink-0"
        :title="lockTitle"
      />
      <span class="break-all"><span class="text-text-secondary">{{ resourcePrefix }}</span><span class="text-text-primary">{{ variableKey }}</span></span>
    </span>
</template>

<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';

/**
 * The `$scope.name` label of a variable, with the padlock that marks the ones
 * the platform owns. Shared by the table row, the stacked mobile card and the
 * webhook panel so the three cannot drift apart.
 */
defineProps<{
  variableKey: string;
  /** Key prefix of the owning scope, e.g. `$p.`. */
  resourcePrefix: string;
  /** System or computed variable — shows the padlock. */
  locked?: boolean;
  /** Tooltip of the padlock; says which kind of lock this is. */
  lockTitle?: string;
}>();
</script>
