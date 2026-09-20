<template>
    <!--  The title rides the wrapper, not the button: a disabled button is
          inert and a native tooltip on it never opens.  -->
    <span
      v-if="visible"
      :title="title"
      @click.stop
    >
      <IconButton
        :fa-icon="silenced || inherited ? faBellSlash : faBell"
        :color-class="silenced || inherited
          ? 'text-status-warning hover:text-text-primary'
          : 'text-text-secondary hover:text-accent-primary'"
        icon-class="w-3.5 h-3.5"
        :disabled="inherited || muteBlocked"
        @click="handleToggle"
      />
    </span>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { faBell, faBellSlash } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@/components/core/buttons/IconButton.vue';
import { useAuthStore } from '@/store/core/auth';
import { useSilenceStore } from '@/store/core/silence';
import { useNotificationStore } from '@/store/ui/notifications';
import { useFeatureGate } from '@/composables/useFeatureGate';
import type { GrantResourceType } from '@/data/orgs/PermissionDto';

/**
 * Per-resource notification mute for the current user. Rendered only when
 * the user holds an explicit grant (notification eligibility). When an
 * ancestor scope is silenced the bell shows as silenced and locked —
 * unless the user holds an explicit grant on THIS resource, in which case
 * the broader silence doesn't cover them (most specific grant wins, same
 * rule the dispatcher applies) and the bell stays independent. The wrapper
 * stops click propagation so the bell can sit inside clickable cards/rows.
 */
const props = withDefaults(
  defineProps<{
    resourceType: GrantResourceType;
    resourceId: string;
    /** Ancestor keys ("type::id") — a parent grant covers this resource. */
    parentKeys?: string[];
  }>(),
  {
    parentKeys: () => [],
  }
);

const { t } = useI18n();
const authStore = useAuthStore();
const silenceStore = useSilenceStore();
const notifications = useNotificationStore();
const createGate = useFeatureGate('silence.create');

/** Only grant holders receive notifications — no grant, nothing to silence. */
const visible = computed(() => authStore.hasResourceGrant([
  `${props.resourceType}::${props.resourceId}`,
  ...props.parentKeys,
]));

const silenced = computed(() => silenceStore.isSilenced(props.resourceType, props.resourceId));

/**
 * Silenced through an ancestor scope, with no explicit grant here — the
 * parent silence covers this resource, so the bell is display-only.
 */
const inherited = computed(() => {
  if (authStore.hasResourceGrant([`${props.resourceType}::${props.resourceId}`])) return false;
  return props.parentKeys.some((key) => {
    const [type, id] = key.split('::');
    return silenceStore.isSilenced(type as GrantResourceType, id);
  });
});

/** Only placing a new silence is gated — lifting an existing one is not. */
const muteBlocked = computed(() => !silenced.value && !createGate.value.enabled);

const title = computed<string>(() => {
  if (inherited.value) return t('silences.inherited');
  if (silenced.value) return t('silences.muted');
  return muteBlocked.value ? createGate.value.hint : t('silences.mute');
});

async function handleToggle() {
  if (inherited.value || muteBlocked.value) return;
  const result = await silenceStore.toggle(props.resourceType, props.resourceId);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

onMounted(() => {
  void silenceStore.ensureLoaded();
});
</script>
