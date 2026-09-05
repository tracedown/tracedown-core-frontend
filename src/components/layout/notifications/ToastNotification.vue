<template>
    <div
      class="p-3 rounded-lg m-2 max-w-96 max-md:max-w-none font-medium flex items-center justify-between gap-3 shadow-lg text-white"
      :class="{
        'bg-status-success': message.type === 'success',
        'bg-status-warning': message.type === 'warning',
        'bg-status-failure': message.type === 'error',
      }"
    >
      <p class="w-full wrap-break-word whitespace-pre-wrap overflow-hidden text-sm">
        {{ message.text }}
      </p>
      <FontAwesomeIcon
        :icon="faXmark"
        width-auto
        class="h-3 cursor-pointer shrink-0"
        @click="emit('close')"
      />
    </div>
</template>

<script setup lang="ts">

import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { UiMessage } from "@/types/ui/common";

defineProps<{
  message: UiMessage
}>();

const emit = defineEmits([
  "close"
]);
</script>
