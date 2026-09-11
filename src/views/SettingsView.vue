<template>
    <ResourcePage
      :title="t('common.labels.settings')"
      :tabs="tabs"
    >
      <template #general>
        <SettingsGeneral />
      </template>
      <template #agents>
        <SettingsAgents />
      </template>
      <template #bodyStores>
        <SettingsBodyStores />
      </template>
      <template #warningLog>
        <SettingsWarningLog />
      </template>
      <template #usage>
        <UsageTab scope="org" />
      </template>
    </ResourcePage>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { faBoxArchive, faChartArea, faGear, faServer, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import ResourcePage from '@/components/resource/ResourcePage.vue';
import SettingsGeneral from '@/views/settings/SettingsGeneral.vue';
import SettingsAgents from '@/views/settings/SettingsAgents.vue';
import SettingsWarningLog from '@/views/settings/SettingsWarningLog.vue';
import SettingsBodyStores from '@/views/settings/SettingsBodyStores.vue';
import UsageTab from '@/components/resource/usage/UsageTab.vue';
import { useAuthStore } from '@/store/core/auth';
import { useOrgStore } from '@/store/core/org';
import { isFeatureEnabled } from '@/config/extensions';
import type { DisplayTab } from '@/types/ui/tabs';

/**
 * Org settings hub. General is the high-trust admin surface (org identity,
 * TOTP policy, danger zone); Agents, Body storage and the Warning log are
 * operational. The
 * infra config surfaces (webhooks, notifications, org variables, domains) live
 * under Infrastructure. Tabs are filtered to what the user may see so the first
 * visible one is the default.
 */
const { t } = useI18n();
const authStore = useAuthStore();
const orgStore = useOrgStore();

const tabs = computed<DisplayTab[]>(() => [
  { key: 'general', label: t('settings.general'), icon: faGear, visible: authStore.canRead('admin') },
  {
    key: 'agents', label: t('nav.agents'), icon: faServer,
    visible: authStore.canRead('settings')
      && isFeatureEnabled('agents', { orgId: orgStore.selectedOrgId }),
  },
  {
    key: 'bodyStores', label: t('bodyStores.tab'), icon: faBoxArchive,
    visible: authStore.canRead('settings')
      && isFeatureEnabled('bodyStores', { orgId: orgStore.selectedOrgId }),
  },
  {
    key: 'warningLog', label: t('systemAlerts.logTab'), icon: faTriangleExclamation,
    visible: authStore.canWrite('settings'),
  },
  { key: 'usage', label: t('usage.title'), icon: faChartArea, visible: authStore.canWrite('admin') },
].filter(tab => tab.visible));
</script>
