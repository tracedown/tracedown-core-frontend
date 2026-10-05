<template>
    <ResourcePage
      :title="t('nav.account')"
      :tabs="tabs"
    >
      <template #profile>
        <ProfileTab />
      </template>
      <template #sessions>
        <SessionsTab />
      </template>
      <template #silences>
        <SilencesTab />
      </template>
      <template #apiKeys>
        <ApiKeysTab />
      </template>
    </ResourcePage>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { faBellSlash, faDesktop, faKey, faUser } from '@fortawesome/free-solid-svg-icons';
import ResourcePage from '@/components/resource/ResourcePage.vue';
import ProfileTab from '@/components/account/ProfileTab.vue';
import SessionsTab from '@/components/account/SessionsTab.vue';
import SilencesTab from '@/components/account/SilencesTab.vue';
import ApiKeysTab from '@/components/account/ApiKeysTab.vue';
import type { DisplayTab } from '@/types/ui/tabs';

/**
 * Per-user settings: profile/security, active login sessions, personal
 * notification silences, and the user's own API keys.
 */
const { t } = useI18n();

const tabs = computed<DisplayTab[]>(() => [
  { key: 'profile', label: t('account.profile'), icon: faUser },
  { key: 'sessions', label: t('account.sessions'), icon: faDesktop },
  { key: 'silences', label: t('account.silences'), icon: faBellSlash },
  { key: 'apiKeys', label: t('nav.apiKeys'), icon: faKey },
]);
</script>
