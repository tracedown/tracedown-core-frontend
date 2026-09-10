<template>
    <!-- Single org: plain label, no dropdown -->
    <span
      v-if="orgStore.orgs.length === 1 && !footerFilled"
      class="block px-1.5 py-0.5 text-sm text-text-primary font-medium truncate"
    >
      {{ orgStore.orgs[0].name }}
    </span>

    <!-- A host that fills the footer slot turns the single-org label into a
         dropdown too: its item is the reason to open it. -->
    <DropdownPanel v-else-if="orgStore.orgs.length > 1 || footerFilled">
      <template #trigger="{ open, toggle }">
        <button
          class="w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg text-sm text-text-secondary
               hover:bg-background-primary transition-colors"
          @click="toggle"
        >
          <span class="min-w-0 text-text-primary font-medium truncate">
            {{ orgStore.currentOrg?.name ?? t('nav.selectOrg') }}
          </span>
          <FontAwesomeIcon
            :icon="open ? faChevronDown : faChevronRight"
            class="w-2.5 h-2.5 shrink-0"
          />
        </button>
      </template>

      <template #default="{ close }">
        <button
          v-for="org in orgStore.orgs"
          :key="org.id"
          class="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-background-primary/50"
          :class="org.id === orgStore.selectedOrgId ? 'text-accent-primary font-medium' : 'text-text-primary'"
          @click="selectOrg(org.id, close)"
        >
          {{ org.name }}
        </button>
        <!-- Host-mounted items under the org list (a host application may
             offer actions here, e.g. creating another organization). -->
        <div
          v-if="footerFilled"
          class="border-t border-text-secondary/15 mt-1 pt-1"
        >
          <SlotOutlet
            name="org-select-footer"
            :slot-props="{ close }"
          />
        </div>
      </template>
    </DropdownPanel>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import DropdownPanel from '@/components/core/DropdownPanel.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import { slotIsFilled } from '@/config/extensions';
import { useOrgStore } from '@/store/core/org';
import { useNotificationStore } from '@/store/ui/notifications';

const { t } = useI18n();
const orgStore = useOrgStore();
const notifications = useNotificationStore();
// Registry is populated before mount, so a plain read is enough.
const footerFilled = slotIsFilled('org-select-footer');

async function selectOrg(orgId: string, close: () => void) {
  close();
  if (orgId === orgStore.selectedOrgId) return;

  const result = await orgStore.switchOrg(orgId);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  // Full reload: every loaded resource belongs to the previous org.
  window.location.assign('/');
}
</script>
