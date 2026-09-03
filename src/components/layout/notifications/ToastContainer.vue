<template>
    <!--  Anchored bottom-right; on a phone it also pins to the left edge so a
          long message wraps inside the viewport instead of running off it.  -->
    <div class="fixed bottom-4 right-4 z-9999 max-md:left-4">
      <transition-group name="list">
        <ToastNotification
          v-for="message in notificationStore.messages"
          :key="message.id"
          :message="message"
          @close="notificationStore.hide(message.id)"
        />
      </transition-group>
    </div>
</template>

<script setup lang="ts">

import { useNotificationStore } from "@/store/ui/notifications";
import ToastNotification from "@/components/layout/notifications/ToastNotification.vue";

const notificationStore = useNotificationStore();
</script>
